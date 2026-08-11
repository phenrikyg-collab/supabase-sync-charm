import { Aviso, C, SANS, STATUS_META, SemDado, Status, StatusChip, fmtNum } from './shared';

export interface FunilTaxa {
  etapa: string;
  pergunta: string | null;
  valor: number | null;
  valor_anterior: number | null;
  variacao_pp: number | null;
  status: Status;
  faixas: string | null;
  diagnostico: string | null;
  inverso?: boolean;
}

const COR: Record<string, string> = { saudavel: C.green, atencao: C.yellow, critico: C.red, sem_dado: C.grey };

function Variacao({ pp, inverso }: { pp: number | null; inverso?: boolean }) {
  if (pp === null || pp === undefined || !Number.isFinite(pp)) {
    return <span className="text-xs" style={{ color: C.grey }}>sem base de comparação</span>;
  }
  const sobe = pp >= 0;
  const bom = inverso ? !sobe : sobe;
  const cor = pp === 0 ? C.grey : bom ? C.green : C.red;
  return (
    <span className="text-xs font-semibold" style={{ color: cor }}>
      {sobe ? '▲' : '▼'} {Math.abs(pp).toFixed(2)} p.p.
    </span>
  );
}

export function FunilConta({ taxas, avisos, legenda }: {
  taxas: FunilTaxa[];
  avisos?: string[];
  legenda?: Record<string, string> | null;
}) {
  if (!taxas?.length) return <SemDado />;

  return (
    <div className="space-y-3">
      {taxas.map(t => {
        const semDado = t.valor === null || t.status === 'sem_dado';
        const cor = semDado ? C.grey : COR[t.status || 'sem_dado'] || C.grey;
        const mostrarDiagnostico = !semDado && (t.status === 'atencao' || t.status === 'critico');
        return (
          <div key={t.etapa} className="p-4 rounded-lg" style={{ background: C.tabBg, borderLeft: `3px solid ${cor}` }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-[220px]">
                <p className="text-sm font-semibold" style={{ color: C.text, fontFamily: SANS }}>{t.etapa}</p>
                {t.pergunta && <p className="text-xs mt-0.5" style={{ color: C.textSec, fontFamily: SANS }}>{t.pergunta}</p>}
              </div>
              <div className="text-right">
                <p className="text-2xl leading-none" style={{ color: semDado ? C.grey : C.text, fontFamily: SANS, fontWeight: 700 }}>
                  {semDado ? '—' : `${fmtNum(t.valor, 2)}%`}
                </p>
                <div className="flex items-center justify-end gap-2 mt-1.5 flex-wrap">
                  {!semDado && <Variacao pp={t.variacao_pp} inverso={t.inverso} />}
                  {t.valor_anterior !== null && !semDado && (
                    <span className="text-[11px]" style={{ color: C.grey }}>antes {fmtNum(t.valor_anterior, 2)}%</span>
                  )}
                  <StatusChip status={semDado ? 'sem_dado' : t.status} />
                </div>
              </div>
            </div>
            {t.faixas && (
              <p className="text-[11px] mt-2" style={{ color: C.grey, fontFamily: SANS }} title={t.faixas}>{t.faixas}</p>
            )}
            {mostrarDiagnostico && t.diagnostico && (
              <p className="text-xs mt-2" style={{ color: C.textSec, fontFamily: SANS }}>{t.diagnostico}</p>
            )}
          </div>
        );
      })}

      {legenda && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 pt-2">
          {Object.entries(legenda).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: C.textSec, fontFamily: SANS }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COR[k] || C.grey }} />
              <b style={{ color: C.text }}>{STATUS_META[k]?.label || k}:</b> {v}
            </span>
          ))}
        </div>
      )}

      {avisos?.map((a, i) => <Aviso key={i}>{a}</Aviso>)}
    </div>
  );
}
