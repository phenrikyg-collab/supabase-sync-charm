/** Soma aprovadas/reprovadas de todas as linhas de tamanho. */
export function somaRevisao(linhas: { aprovadas: number; reprovadas: number }[]) {
  const aprovadas = linhas.reduce((a, l) => a + (l.aprovadas || 0), 0);
  const reprovadas = linhas.reduce((a, l) => a + (l.reprovadas || 0), 0);
  return { aprovadas, reprovadas, total: aprovadas + reprovadas };
}

/** Dias úteis de segunda a sábado entre duas datas AAAA-MM-DD (inclusive), igual à revisão atual. */
export function diasUteisSegSab(inicio: string, fim: string): number {
  const a = new Date(`${inicio}T12:00:00`);
  const b = new Date(`${fim}T12:00:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || a > b) return 0;
  let n = 0;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) n++;
  return n;
}
