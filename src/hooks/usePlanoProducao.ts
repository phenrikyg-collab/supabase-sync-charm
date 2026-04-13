import { supabase } from "@/integrations/supabase/client";
import { extrairTipoMaquina } from "@/utils/producao";

export interface PlanoPreview {
  diasPlano: DiaPlan[];
  pecasPorDia: number;
  tempoEfetivoPorPeca: number;
  gargalo: { maquina: string; capacidadeSegundos: number; quantidade: number } | undefined;
  totalDias: number;
  totalPecas: number;
  nomeProduto: string;
  dataInicio: string;
  dataConclusao: string;
  capacidadeMaquinas: { tipo: string; quantidade: number; capSegundos: number; pecasDia: number; ocupacao: number }[];
}

interface DiaPlan {
  planoDia: {
    ordem_producao_id: string;
    oficina_id: string;
    data_planejada: string;
    horas_disponiveis: number;
    pecas_planejadas: number;
    segundos_utilizados: number;
    status: string;
  };
  etapasDia: {
    tipo_maquina: string;
    numero_etapa: number;
    nome_etapa: string;
    tempo_segundos_por_peca: number;
    pecas_planejadas: number;
    segundos_utilizados: number;
    capacidade_segundos_dia: number;
  }[];
}

/** Calcula tempo efetivo considerando etapas em conjunto (grupo) */
function calcTempoEfetivo(etapas: { tempo: number; grupo: number }[]): number {
  const grupos = new Map<number, number>();
  let totalSeq = 0;
  for (const e of etapas) {
    if (e.grupo === 0) {
      totalSeq += e.tempo;
    } else {
      const current = grupos.get(e.grupo) || 0;
      grupos.set(e.grupo, Math.max(current, e.tempo));
    }
  }
  let totalGrupos = 0;
  grupos.forEach((v) => { totalGrupos += v; });
  return totalSeq + totalGrupos;
}

function parseGrupo(observacao: string | null): number {
  const match = observacao?.match(/grupo=(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export async function gerarPlano(
  ordemId: string,
  oficinaId: string,
  dataInicio: string,
  horasDisponiveis: number
): Promise<PlanoPreview> {
  // 1. Busca a ordem de produção
  const { data: ordem, error: errOrdem } = await supabase
    .from("ordens_producao")
    .select("*")
    .eq("id", ordemId)
    .single();

  if (errOrdem || !ordem) throw new Error("Ordem de produção não encontrada.");

  // Busca nome do produto
  let nomeProduto = ordem.nome_produto || "";
  if (ordem.produto_id) {
    const { data: prod } = await supabase
      .from("produtos")
      .select("nome_do_produto")
      .eq("id", ordem.produto_id)
      .single();
    if (prod) nomeProduto = prod.nome_do_produto;
  }

  // 2. Busca etapas da ficha técnica (tempo_minutos está em SEGUNDOS!)
  if (!ordem.produto_id) {
    throw new Error("Ordem de produção sem produto vinculado.");
  }

  const { data: etapas } = await supabase
    .from("fichas_tecnicas_tempo")
    .select("*")
    .eq("produto_id", ordem.produto_id)
    .order("numero_etapa");

  if (!etapas || etapas.length === 0) {
    throw new Error("Ficha técnica não encontrada para este produto. Cadastre etapas na aba Fichas Técnicas.");
  }

  // 3. Calcula tempo efetivo por peça considerando conjuntos
  const etapasParaCalculo = etapas.map((e) => ({
    tempo: e.tempo_minutos, // em segundos
    grupo: parseGrupo(e.observacao),
  }));
  const tempoEfetivoPorPeca = calcTempoEfetivo(etapasParaCalculo);

  if (tempoEfetivoPorPeca <= 0) {
    throw new Error("Tempo efetivo por peça é zero. Verifique a ficha técnica.");
  }

  // 4. Busca configuração das máquinas e calcula capacidade
  const { data: maquinas } = await supabase.from("config_maquinas").select("*");

  const capacidades = (maquinas || []).map((m) => ({
    maquina: m.tipo_maquina,
    quantidade: m.quantidade_maquinas,
    capacidadeSegundos: m.quantidade_maquinas * horasDisponiveis * 3600,
  }));

  // 5. Gargalo = menor capacidade total por dia
  const gargalo = capacidades.length > 0
    ? capacidades.reduce((min, m) => m.capacidadeSegundos < min.capacidadeSegundos ? m : min)
    : undefined;

  const capGargaloSegundos = gargalo?.capacidadeSegundos || (horasDisponiveis * 3600);

  // 6. Peças por dia = capacidade do gargalo / tempo efetivo por peça
  const pecasPorDia = Math.floor(capGargaloSegundos / tempoEfetivoPorPeca);

  if (pecasPorDia === 0) {
    throw new Error("Horas disponíveis insuficientes para produzir ao menos 1 peça por dia.");
  }

  // 7. Distribui peças pelos dias
  const totalPecas = ordem.quantidade_pecas_ordem || ordem.quantidade || 0;
  let pecasRestantes = totalPecas;
  const dataAtual = new Date(dataInicio + "T12:00:00");
  const diasPlano: DiaPlan[] = [];

  // Mapa de etapas para detalhamento
  const etapasInfo = etapas.map((e) => ({
    tipoMaquina: extrairTipoMaquina(e.observacao),
    numero_etapa: e.numero_etapa,
    nome_etapa: e.nome_etapa || "",
    tempo_segundos: e.tempo_minutos, // em segundos
  }));

  while (pecasRestantes > 0) {
    const pecasHoje = Math.min(pecasPorDia, pecasRestantes);

    const planoDia = {
      ordem_producao_id: ordemId,
      oficina_id: oficinaId,
      data_planejada: dataAtual.toISOString().split("T")[0],
      horas_disponiveis: horasDisponiveis,
      pecas_planejadas: pecasHoje,
      segundos_utilizados: pecasHoje * tempoEfetivoPorPeca,
      status: "planejado",
    };

    const etapasDia = etapasInfo.map((e) => {
      const capMaq = capacidades.find((c) => c.maquina.toLowerCase() === e.tipoMaquina.toLowerCase());
      return {
        tipo_maquina: e.tipoMaquina,
        numero_etapa: e.numero_etapa,
        nome_etapa: e.nome_etapa,
        tempo_segundos_por_peca: e.tempo_segundos,
        pecas_planejadas: pecasHoje,
        segundos_utilizados: pecasHoje * e.tempo_segundos,
        capacidade_segundos_dia: capMaq?.capacidadeSegundos || (horasDisponiveis * 3600),
      };
    });

    diasPlano.push({ planoDia, etapasDia });
    pecasRestantes -= pecasHoje;
    dataAtual.setDate(dataAtual.getDate() + 1);
  }

  // 8. Capacidade por máquina para o preview
  // % ocupação = (pecasPorDia × tempoEfetivoPorPeca / capacidadeSegundos) × 100
  const capacidadeMaquinas = capacidades.map((m) => ({
    tipo: m.maquina,
    quantidade: m.quantidade,
    capSegundos: m.capacidadeSegundos,
    pecasDia: pecasPorDia,
    ocupacao: (pecasPorDia * tempoEfetivoPorPeca / m.capacidadeSegundos) * 100,
  }));

  const dataConclusao = diasPlano.length > 0
    ? diasPlano[diasPlano.length - 1].planoDia.data_planejada
    : dataInicio;

  return {
    diasPlano,
    pecasPorDia,
    tempoEfetivoPorPeca,
    gargalo,
    totalDias: diasPlano.length,
    totalPecas,
    nomeProduto,
    dataInicio,
    dataConclusao,
    capacidadeMaquinas,
  };
}

export async function salvarPlano(diasPlano: DiaPlan[]) {
  for (const dia of diasPlano) {
    const { data: plano, error } = await supabase
      .from("planos_producao" as any)
      .insert(dia.planoDia as any)
      .select()
      .single();

    if (error || !plano) throw new Error("Erro ao salvar plano: " + error?.message);

    const etapasComId = dia.etapasDia.map((e) => ({
      ...e,
      plano_producao_id: (plano as any).id,
    }));

    const { error: errEtapas } = await supabase
      .from("planos_producao_etapas" as any)
      .insert(etapasComId as any);

    if (errEtapas) throw new Error("Erro ao salvar etapas: " + errEtapas.message);
  }
}

export async function excluirPlanoPorOrdem(ordemId: string) {
  const { error } = await supabase
    .from("planos_producao" as any)
    .delete()
    .eq("ordem_producao_id", ordemId);
  if (error) throw new Error("Erro ao excluir plano: " + error.message);
}
