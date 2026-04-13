// Extrai tipo de máquina do campo observacao
export function extrairTipoMaquina(observacao: string | null): string {
  const match = observacao?.match(/\[\[meta:maq=([^,\]]+)/);
  return match ? match[1] : "Reta";
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
