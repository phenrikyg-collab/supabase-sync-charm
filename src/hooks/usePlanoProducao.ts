import { supabase } from "@/integrations/supabase/client";
import { extrairTipoMaquina } from "@/utils/producao";

export interface PlanoPreview {
  diasPlano: DiaPlan[];
  pecasPorDia: number;
  etapaGargalo: { etapa: any; tipoMaquina: string; pecasPossiveis: number } | undefined;
  totalDias: number;
  totalPecas: number;
  nomeProduto: string;
  dataInicio: string;
  dataConclusao: string;
  capacidadeMaquinas: { tipo: string; capSegundos: number; pecasDia: number; ocupacao: number }[];
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
  let etapasCalculo: any[] = [];

  if (ordem.produto_id) {
    const { data: etapas } = await supabase
      .from("fichas_tecnicas_tempo")
      .select("*")
      .eq("produto_id", ordem.produto_id)
      .order("numero_etapa");

    if (etapas && etapas.length > 0) {
      etapasCalculo = etapas;
    }
  }

  // 3. Se não houver etapas, usa tempo genérico
  if (etapasCalculo.length === 0) {
    throw new Error("Ficha técnica não encontrada para este produto. Cadastre etapas na aba Fichas Técnicas.");
  }

  // 4. Busca configuração das máquinas
  const { data: maquinas } = await supabase.from("config_maquinas").select("*");

  // 5. Calcula capacidade por máquina em SEGUNDOS
  const capacidadePorMaquina: Record<string, { capSegundos: number; qtd: number }> = {};
  (maquinas || []).forEach((m) => {
    capacidadePorMaquina[m.tipo_maquina.toLowerCase()] = {
      capSegundos: horasDisponiveis * 3600, // capacidade = horas disponíveis (não multiplica por máquinas)
      qtd: m.quantidade_maquinas,
    };
  });

  // 6. Calcula peças por dia por etapa — gargalo determina o total
  const pecasPorEtapa = etapasCalculo.map((etapa) => {
    const tipoMaquina = extrairTipoMaquina(etapa.observacao);
    const tipoLower = tipoMaquina.toLowerCase();
    const capacidadeSegundos =
      capacidadePorMaquina[tipoLower]?.capSegundos || horasDisponiveis * 3600;
    // tempo_minutos está em SEGUNDOS
    const tempoSegundos = etapa.tempo_minutos;
    return {
      etapa,
      tipoMaquina,
      capacidadeSegundos,
      pecasPossiveis: tempoSegundos > 0 ? Math.floor(capacidadeSegundos / tempoSegundos) : 999999,
    };
  });

  const pecasPorDia = Math.min(...pecasPorEtapa.map((e) => e.pecasPossiveis));
  const etapaGargalo = pecasPorEtapa.find((e) => e.pecasPossiveis === pecasPorDia);

  if (pecasPorDia === 0) {
    throw new Error("Horas disponíveis insuficientes para produzir ao menos 1 peça por dia.");
  }

  // 7. Distribui peças pelos dias
  const totalPecas = ordem.quantidade_pecas_ordem || ordem.quantidade || 0;
  let pecasRestantes = totalPecas;
  const dataAtual = new Date(dataInicio + "T12:00:00");
  const diasPlano: DiaPlan[] = [];

  while (pecasRestantes > 0) {
    const pecasHoje = Math.min(pecasPorDia, pecasRestantes);
    const tempoTotalPorPecaSegundos = etapasCalculo.reduce(
      (a: number, e: any) => a + (e.tempo_minutos || 0),
      0
    );

    const planoDia = {
      ordem_producao_id: ordemId,
      oficina_id: oficinaId,
      data_planejada: dataAtual.toISOString().split("T")[0],
      horas_disponiveis: horasDisponiveis,
      pecas_planejadas: pecasHoje,
      segundos_utilizados: pecasHoje * tempoTotalPorPecaSegundos,
      status: "planejado",
    };

    const etapasDia = pecasPorEtapa.map(({ etapa, tipoMaquina, capacidadeSegundos }) => ({
      tipo_maquina: tipoMaquina,
      numero_etapa: etapa.numero_etapa,
      nome_etapa: etapa.nome_etapa || "",
      tempo_segundos_por_peca: etapa.tempo_minutos, // em segundos
      pecas_planejadas: pecasHoje,
      segundos_utilizados: pecasHoje * etapa.tempo_minutos,
      capacidade_segundos_dia: capacidadeSegundos,
    }));

    diasPlano.push({ planoDia, etapasDia });
    pecasRestantes -= pecasHoje;
    dataAtual.setDate(dataAtual.getDate() + 1);
  }

  // Capacidade por máquina para o preview
  const maquinasMap = new Map<string, { capSegundos: number; pecasDia: number; ocupacao: number }>();
  pecasPorEtapa.forEach(({ tipoMaquina, capacidadeSegundos, etapa }) => {
    const key = tipoMaquina;
    const segUsados = pecasPorDia * etapa.tempo_minutos;
    const existing = maquinasMap.get(key);
    if (existing) {
      existing.ocupacao += (segUsados / capacidadeSegundos) * 100;
    } else {
      maquinasMap.set(key, {
        capSegundos: capacidadeSegundos,
        pecasDia: Math.floor(capacidadeSegundos / etapa.tempo_minutos),
        ocupacao: (segUsados / capacidadeSegundos) * 100,
      });
    }
  });

  const capacidadeMaquinas = Array.from(maquinasMap.entries()).map(([tipo, v]) => ({
    tipo,
    ...v,
  }));

  const dataConclusao = diasPlano.length > 0
    ? diasPlano[diasPlano.length - 1].planoDia.data_planejada
    : dataInicio;

  return {
    diasPlano,
    pecasPorDia,
    etapaGargalo,
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
  // CASCADE handles etapas
  const { error } = await supabase
    .from("planos_producao" as any)
    .delete()
    .eq("ordem_producao_id", ordemId);
  if (error) throw new Error("Erro ao excluir plano: " + error.message);
}
