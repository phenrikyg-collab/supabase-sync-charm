import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aviso, BlocoLoading, C, Card, SANS, SectionTitle, SemDado, fmtInt, fmtNum } from './shared';

interface Destino {
  origem: string;
  sessoes: number | null;
  leads: number | null;
  cliques_bio: number | null;
  taxa_sessao_para_clique: number | null;
  taxa_lead: number | null;
  observacao: string | null;
}
interface FunilDestinoResp {
  avisos: string[];
  periodo_dias: number;
  destinos: Destino[];
  total_sessoes: number | null;
  total_leads: number | null;
}

export function FunilDestino({ dias }: { dias: number }) {
  const [data, setData] = useState<FunilDestinoResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    supabase.rpc('fn_ig_funil_destino' as any, { p_dias: dias }).then(({ data }: any) => {
      if (!ativo) return;
      setData((data as FunilDestinoResp) || null);
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [dias]);

  const destinos = data?.destinos || [];

  return (
    <Card accent={C.green}>
      <SectionTitle subtitle="O que acontece depois do clique: sessões e leads gerados por origem no link da bio">
        Para onde o Instagram manda
      </SectionTitle>

      {loading ? <BlocoLoading altura={200} /> : !destinos.length ? (
        <SemDado texto="sem dado de destino no período" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Origem', 'Sessões', 'Cliques na bio', 'Cliques por sessão', 'Leads', 'Taxa de lead'].map(h => (
                    <th key={h} className="text-left py-2.5 px-2 font-semibold text-xs" style={{ color: C.textSec }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {destinos.map(d => (
                  <tr key={d.origem} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td className="py-2.5 px-2 font-medium" style={{ color: C.text }}>
                      {d.origem}
                      {d.observacao && <p className="text-[11px] font-normal" style={{ color: C.grey }}>{d.observacao}</p>}
                    </td>
                    <td className="py-2.5 px-2" style={{ color: C.text }}>{fmtInt(d.sessoes)}</td>
                    <td className="py-2.5 px-2" style={{ color: C.textSec }}>{fmtInt(d.cliques_bio)}</td>
                    <td className="py-2.5 px-2" style={{ color: C.textSec }}>
                      {d.taxa_sessao_para_clique === null ? '—' : `${fmtNum(d.taxa_sessao_para_clique, 2)}%`}
                    </td>
                    <td className="py-2.5 px-2" style={{ color: C.text }}>{fmtInt(d.leads)}</td>
                    <td className="py-2.5 px-2" style={{ color: C.textSec }}>
                      {d.taxa_lead === null ? '—' : `${fmtNum(d.taxa_lead, 2)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="p-3 rounded-lg" style={{ background: C.tabBg }}>
              <p className="text-xs" style={{ color: C.textSec, fontFamily: SANS }}>Sessões no período</p>
              <p className="text-xl" style={{ color: C.text, fontFamily: SANS, fontWeight: 700 }}>{fmtInt(data?.total_sessoes)}</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: C.tabBg }}>
              <p className="text-xs" style={{ color: C.textSec, fontFamily: SANS }}>Leads no período</p>
              <p className="text-xl" style={{ color: C.text, fontFamily: SANS, fontWeight: 700 }}>{fmtInt(data?.total_leads)}</p>
            </div>
          </div>

          <Aviso>
            Cliques por sessão pode passar de 100%: a Meta conta cliques no link e o site conta sessões iniciadas — são bases diferentes.
          </Aviso>
          {(data?.avisos || []).map((a, i) => <Aviso key={i}>{a}</Aviso>)}
        </>
      )}
    </Card>
  );
}
