export interface EtapaTempoComGrupo {
  tempo_segundos: number;
  grupo: number;
}

export interface CapacidadeMaquina {
  maquina: string;
  quantidade: number;
  horasPorDia: number;
  capacidadeSegundos: number;
}

// Extrai tipo de máquina do campo observacao
export function extrairTipoMaquina(observacao: string | null): string {
  const match = observacao?.match(/\[\[meta:maq=([^,\]]+)/);
  return match ? match[1] : "Reta";
}

export function extrairGrupoEtapa(observacao: string | null): number {
  const match = observacao?.match(/grupo=(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Bonificações grava tempo_segundos / 60 em fichas_tecnicas_tempo.tempo_minutos
// Então, para recuperar o tempo real em segundos, precisamos multiplicar por 60.
export function tempoFichaParaSegundos(tempoMinutos: number | null | undefined): number {
  return Number(tempoMinutos || 0) * 60;
}

export function calcularTempoEfetivo(etapas: EtapaTempoComGrupo[]): number {
  const grupos = new Map<number, number>();
  let totalSequencial = 0;

  for (const etapa of etapas) {
    if (etapa.grupo === 0) {
      totalSequencial += etapa.tempo_segundos;
      continue;
    }

    const atual = grupos.get(etapa.grupo) || 0;
    grupos.set(etapa.grupo, Math.max(atual, etapa.tempo_segundos));
  }

  let totalGrupos = 0;
  grupos.forEach((valor) => {
    totalGrupos += valor;
  });

  return totalSequencial + totalGrupos;
}

export function calcularTempoEfetivoFicha(
  etapas: Array<{ tempo_minutos: number | null; observacao: string | null }>
): number {
  return calcularTempoEfetivo(
    etapas.map((etapa) => ({
      tempo_segundos: tempoFichaParaSegundos(etapa.tempo_minutos),
      grupo: extrairGrupoEtapa(etapa.observacao),
    }))
  );
}

export function calcularCapacidadesMaquinas(
  maquinas: Array<{ tipo_maquina: string; quantidade_maquinas: number | null; horas_por_dia?: number | null }>,
  horasDisponiveis?: number
): CapacidadeMaquina[] {
  return maquinas.map((maquina) => {
    const quantidade = Number(maquina.quantidade_maquinas || 0);
    const horasPorDia = Number(horasDisponiveis ?? maquina.horas_por_dia ?? 8);

    return {
      maquina: maquina.tipo_maquina,
      quantidade,
      horasPorDia,
      capacidadeSegundos: quantidade * horasPorDia * 3600,
    };
  });
}

export function obterMaquinaGargalo(capacidades: CapacidadeMaquina[]): CapacidadeMaquina | undefined {
  if (capacidades.length === 0) return undefined;
  return capacidades.reduce((minima, atual) =>
    atual.capacidadeSegundos < minima.capacidadeSegundos ? atual : minima
  );
}

export function calcularPecasPorDia(
  tempoEfetivoPorPecaSegundos: number,
  capacidadeGargaloSegundos: number
): number {
  if (tempoEfetivoPorPecaSegundos <= 0 || capacidadeGargaloSegundos <= 0) return 0;
  return Math.floor(capacidadeGargaloSegundos / tempoEfetivoPorPecaSegundos);
}

export function calcularDataConclusaoPlanejada(dataInicio: string, totalDias: number): string {
  const data = new Date(`${dataInicio}T12:00:00`);
  data.setDate(data.getDate() + Math.max(totalDias - 1, 0));
  return data.toISOString().split("T")[0];
}

// Formata segundos em texto legível
export function formatarSegundos(segundos: number): string {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segs = Math.floor(segundos % 60);
  if (horas > 0) return `${horas}h ${minutos}min`;
  if (minutos > 0) return `${minutos}min ${segs}s`;
  return `${segs}s`;
}

// Converte data para DD/MM/YYYY
export function formatarData(data: string): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}
