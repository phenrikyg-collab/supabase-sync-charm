import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aviso, BlocoLoading, C, Card, SANS, SectionTitle, SemDado, fmtInt, fmtNum } from './shared';

interface Celula {
  dia: string;
  dia_num: number;
  hora: number;
  hora_label: string;
  posts: number;
  indice: number | null;
  alcance_med: number | null;
  save_rate: number | null;
  confianca: 'media' | 'baixa' | 'muito_baixa' | string;
}
interface MelhorHorarioResp {
  avisos: string[];
  formato: string | null;
  periodo_dias: number;
  grade_dia_hora: Celula[];
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const CONF_LABEL: Record<string, string> = { media: 'confiança média', baixa: 'confiança baixa', muito_baixa: 'confiança muito baixa' };

function corCelula(indice: number | null) {
  if (indice === null) return C.tabBg;
  if (indice >= 1.3) return '#2E7D5B';
  if (indice >= 1.1) return '#7FB79A';
  if (indice >= 0.9) return '#E8CD7E';
  if (indice >= 0.7) return '#E2A76F';
  return '#C96A5A';
}

export function MelhorHorario({ dias, formato = null }: { dias: number; formato?: string | null }) {
  const [data, setData] = useState<MelhorHorarioResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    const args: Record<string, unknown> = { p_dias: dias };
    if (formato) args.p_formato = formato;
    supabase.rpc('fn_ig_melhor_horario' as any, args).then(({ data }: any) => {
      if (!ativo) return;
      setData((data as MelhorHorarioResp) || null);
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [dias, formato]);

  const grade = data?.grade_dia_hora || [];

  const horas = useMemo(() => {
    const set = new Set<number>(grade.map(c => c.hora));
    return Array.from(set).sort((a, b) => a - b);
  }, [grade]);

  const mapa = useMemo(() => {
    const m = new Map<string, Celula>();
    grade.forEach(c => m.set(`${c.dia_num}-${c.hora}`, c));
    return m;
  }, [grade]);

  const top = useMemo(
    () => [...grade].sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0)).slice(0, 5),
    [grade]
  );

  return (
    <Card accent={C.gold}>
      <SectionTitle subtitle="Índice 1,00 = alcance médio do período. Cada célula tem poucos posts — leia como indício, não como regra.">
        Melhor horário para publicar
      </SectionTitle>

      {loading ? <BlocoLoading altura={260} /> : !grade.length ? <SemDado /> : (
        <>
          <div className="overflow-x-auto">
            <table className="text-xs" style={{ borderCollapse: 'separate', borderSpacing: 3 }}>
              <thead>
                <tr>
                  <th />
                  {horas.map(h => (
                    <th key={h} className="font-medium px-1" style={{ color: C.textSec, fontFamily: SANS }}>{h}h</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIAS.map((d, i) => (
                  <tr key={d}>
                    <td className="pr-2 whitespace-nowrap font-medium" style={{ color: C.textSec, fontFamily: SANS }}>{d}</td>
                    {horas.map(h => {
                      const c = mapa.get(`${i}-${h}`);
                      const fraca = c && c.confianca !== 'media';
                      return (
                        <td key={h}>
                          <div
                            title={c
                              ? `${c.dia} ${c.hora_label} · índice ${fmtNum(c.indice, 2)} · ${c.posts} posts · alcance méd. ${fmtInt(c.alcance_med)} · ${CONF_LABEL[c.confianca] || c.confianca}`
                              : 'sem publicações nesse horário'}
                            className="w-9 h-8 rounded flex items-center justify-center"
                            style={{
                              background: corCelula(c?.indice ?? null),
                              opacity: c ? (fraca ? 0.55 : 1) : 0.35,
                              color: c ? '#fff' : C.grey,
                              fontFamily: SANS,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {c ? fmtNum(c.indice, 2) : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] mt-3" style={{ color: C.grey, fontFamily: SANS }}>
            Células mais claras têm confiança baixa (menos de 5 posts). Passe o mouse para ver os detalhes.
          </p>

          <div className="mt-4">
            <p className="text-sm font-semibold mb-2" style={{ color: C.text, fontFamily: SANS }}>Melhores janelas</p>
            <div className="space-y-2">
              {top.map((c, i) => (
                <div key={`${c.dia_num}-${c.hora}-${i}`} className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg" style={{ background: C.tabBg }}>
                  <span className="text-sm font-medium" style={{ color: C.text, fontFamily: SANS }}>{c.dia}, {c.hora_label}</span>
                  <span className="text-xs" style={{ color: C.textSec, fontFamily: SANS }}>
                    índice {fmtNum(c.indice, 2)} · {c.posts} posts · alcance méd. {fmtInt(c.alcance_med)}
                    {c.confianca !== 'media' && ` · ${CONF_LABEL[c.confianca] || c.confianca}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {(data?.avisos || []).map((a, i) => <Aviso key={i}>{a}</Aviso>)}
        </>
      )}
    </Card>
  );
}
