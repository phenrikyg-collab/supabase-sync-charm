import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aviso, BlocoLoading, C, Card, SANS, SectionTitle, SemDado, Status, StatusChip, fmtInt, fmtNum } from './shared';

interface Indicador {
  nome: string;
  valor: number | null;
  unidade?: string;
  absoluto: number | null;
  status: Status;
  leitura: string | null;
  referencia: string | null;
}

interface Tema {
  tema: string;
  posts: number;
  alcance_med: number | null;
}

interface Clareza {
  avisos: string[];
  indicadores: Indicador[];
  periodo_dias: number;
  posts_analisados: number;
  temas_mais_frequentes: Tema[];
  classificacao_confianca_baixa: number | null;
}

const COR_STATUS: Record<string, string> = { saudavel: C.green, atencao: C.yellow, critico: C.red };

export function ClarezaComunicacao({ dias }: { dias: number }) {
  const [data, setData] = useState<Clareza | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    supabase.rpc('fn_ig_clareza_comunicacao' as any, { p_dias: dias }).then(({ data }: any) => {
      if (!ativo) return;
      setData((data as Clareza) || null);
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [dias]);

  return (
    <Card accent={C.red}>
      <SectionTitle subtitle={data ? `${data.posts_analisados} publicações analisadas nos últimos ${data.periodo_dias} dias` : undefined}>
        Estamos comunicando bem o que vendemos?
      </SectionTitle>

      {loading ? <BlocoLoading altura={220} /> : !data?.indicadores?.length ? <SemDado /> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.indicadores.map(i => (
              <div key={i.nome} className="rounded-lg p-4" style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${COR_STATUS[i.status || ''] || C.grey}` }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium" style={{ color: C.text, fontFamily: SANS }}>{i.nome}</p>
                  <StatusChip status={i.status} />
                </div>
                <p className="text-2xl mt-1" style={{ color: C.text, fontFamily: SANS, fontWeight: 700 }}>
                  {i.valor === null ? '—' : `${fmtNum(i.valor)}${i.unidade || ''}`}
                  {i.absoluto !== null && <span className="text-xs font-normal ml-2" style={{ color: C.textSec }}>{fmtInt(i.absoluto)} posts</span>}
                </p>
                {i.leitura && <p className="text-xs mt-1" style={{ color: C.textSec }}>{i.leitura}</p>}
                {i.referencia && <p className="text-[11px] mt-1" style={{ color: C.grey }}>Referência: {i.referencia}</p>}
              </div>
            ))}
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold mb-2" style={{ color: C.text, fontFamily: SANS }}>Temas mais frequentes</p>
            {!data.temas_mais_frequentes?.length ? (
              <SemDado texto="sem tema classificado no período" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Tema', 'Posts', 'Alcance médio'].map(h => (
                        <th key={h} className="text-left py-2 px-2 font-semibold text-xs" style={{ color: C.textSec }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.temas_mais_frequentes.map(t => (
                      <tr key={t.tema} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td className="py-2 px-2" style={{ color: C.text }}>{t.tema}</td>
                        <td className="py-2 px-2" style={{ color: C.textSec }}>{t.posts}</td>
                        <td className="py-2 px-2" style={{ color: C.textSec }}>{fmtInt(t.alcance_med)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {data.avisos?.length > 0 && (
            <div className="mt-4 space-y-1">
              {data.avisos.map((a, i) => <Aviso key={i}>{a}</Aviso>)}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
