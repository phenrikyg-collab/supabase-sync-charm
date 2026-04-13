import { supabase } from "@/integrations/supabase/client";
import {
  calcularCapacidadesMaquinas,
  calcularDataConclusaoPlanejada,
  calcularPecasPorDia,
  calcularTempoEfetivoFicha,
  extrairTipoMaquina,
  obterMaquinaGargalo,
  tempoFichaParaSegundos,
} from "@/utils/producao";

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

export async function gerarPlano(
  ordemId: string,
  oficinaId: string,
  dataInicio: string,
  horasDisponiveis: number
): Promise<PlanoPreview> {
  const { data: ordem, error: errOrdem } = await supabase
    .from("ordens_producao")
    .select("*")
    .eq("id", ordemId)
    .single();

  if (errOrdem || !ordem) throw new Error("Ordem de produção não encontrada.");

  let nomeProduto = ordem.nome_produto || "";
  if (ordem.produto_id) {
    const { data: prod } = await supabase
      .from("produtos")
      .select("nome_do_produto")
      .eq("id", ordem.produto_id)
      .single();
    if (prod) nomeProduto = prod.nome_do_produto;
  }

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

  const tempoEfetivoPorPeca = calcularTempoEfetivoFicha(etapas);
  if (tempoEfetivoPorPeca <= 0) {
    throw new Error("Tempo efetivo por peça é zero. Verifique a ficha técnica.");
  }

  const { data: maquinas } = await supabase.from("config_maquinas").select("*");
  const capacidades = calcularCapacidadesMaquinas(maquinas || [], horasDisponiveis);
  const gargalo = obterMaquinaGargalo(capacidades);
  const capGargaloSegundos = gargalo?.capacidadeSegundos || (horasDisponiveis * 3600);
  const pecasPorDia = calcularPecasPorDia(tempoEfetivoPorPeca, capGargaloSegundos);

  if (pecasPorDia === 0) {
    throw new Error("Horas disponíveis insuficientes para produzir ao menos 1 peça por dia.");
  }

  const totalPecas = ordem.quantidade_pecas_ordem || ordem.quantidade || 0;
  let pecasRestantes = totalPecas;
  const dataAtual = new Date(`${dataInicio}T12:00:00`);
  const diasPlano: DiaPlan[] = [];

  const etapasInfo = etapas.map((etapa) => ({
    tipoMaquina: extrairTipoMaquina(etapa.observacao),
    numero_etapa: etapa.numero_etapa,
    nome_etapa: etapa.nome_etapa || "",
    tempo_segundos: tempoFichaParaSegundos(etapa.tempo_minutos),
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

    const etapasDia = etapasInfo.map((etapa) => {
      const capMaq = capacidades.find((capacidade) => capacidade.maquina.toLowerCase() === etapa.tipoMaquina.toLowerCase());
      return {
        tipo_maquina: etapa.tipoMaquina,
        numero_etapa: etapa.numero_etapa,
        nome_etapa: etapa.nome_etapa,
        tempo_segundos_por_peca: etapa.tempo_segundos,
        pecas_planejadas: pecasHoje,
        segundos_utilizados: pecasHoje * etapa.tempo_segundos,
        capacidade_segundos_dia: capMaq?.capacidadeSegundos || (horasDisponiveis * 3600),
      };
    });

    diasPlano.push({ planoDia, etapasDia });
    pecasRestantes -= pecasHoje;
    dataAtual.setDate(dataAtual.getDate() + 1);
  }

  const capacidadeMaquinas = capacidades.map((maquina) => ({
    tipo: maquina.maquina,
    quantidade: maquina.quantidade,
    capSegundos: maquina.capacidadeSegundos,
    pecasDia: pecasPorDia,
    ocupacao: (pecasPorDia * tempoEfetivoPorPeca / maquina.capacidadeSegundos) * 100,
  }));

  const totalDias = diasPlano.length;
  const dataConclusao = calcularDataConclusaoPlanejada(dataInicio, totalDias);

  return {
    diasPlano,
    pecasPorDia,
    tempoEfetivoPorPeca,
    gargalo,
    totalDias,
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

    const etapasComId = dia.etapasDia.map((etapa) => ({
      ...etapa,
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
