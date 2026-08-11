import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aviso, BlocoLoading, C, Card, SANS, SectionTitle, SemDado, fmtInt, fmtNum } from './shared';

interface FunilDestinoResp {
  avisos: string[];
  coleta_desde: string | null;
  periodo_dias: number;
  sessoes_total: number | null;
  cupons_gerados: number | null;
  leads_capturados: number | null;
  cliques_em_botoes: number | null;
  sessoes_do_instagram: number | null;
  taxa_sessao_para_lead: number | null;
  taxa_sessao_para_clique: number | null;
  pct_trafego_do_instagram: number | null;
}

function Bloco({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: C.tabBg }}>
      <p className="text-[11px] uppercase tracking-wider" style={{ color: C.textSec, fontFamily: SANS }}>{label}</p>
      <p className="text-xl mt-1" style={{ color: C.text, fontFamily: SANS, fontWeight: 700 }}>{valor}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: C.grey }}>{sub}</p>}
    </div>
  );
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

  return (
    <Card accent={C.green}>
      <SectionTitle subtitle="O que acontece depois do clique: tráfego, cliques e leads no link da bio">
        Para onde o Instagram manda
      </SectionTitle>

      {loading ? <BlocoLoading altura={180} /> : !data ? <SemDado texto="sem dado de destino no período" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Bloco label="Sessões no link" valor={fmtInt(data.sessoes_total)}
              sub={data.pct_trafego_do_instagram === null ? undefined : `${fmtNum(data.pct_trafego_do_instagram)}% vindas do Instagram`} />
            <Bloco label="Sessões do Instagram" valor={fmtInt(data.sessoes_do_instagram)} />
            <Bloco label="Cliques em botões" valor={fmtInt(data.cliques_em_botoes)}
              sub={data.taxa_sessao_para_clique === null ? undefined : `${fmtNum(data.taxa_sessao_para_clique)} cliques por 100 sessões`} />
            <Bloco label="Leads capturados" valor={fmtInt(data.leads_capturados)}
              sub={data.taxa_sessao_para_lead === null ? undefined : `${fmtNum(data.taxa_sessao_para_lead)}% das sessões viram lead`} />
          </div>

          {data.cupons_gerados !== null && (
            <p className="text-sm mt-4" style={{ color: C.textSec, fontFamily: SANS }}>
              {fmtInt(data.cupons_gerados)} cupons gerados no período.
            </p>
          )}

          <Aviso>
            Cliques por sessão pode passar de 100: a Meta e o site contam bases diferentes — cada sessão pode gerar vários cliques.
          </Aviso>
          {data.coleta_desde && <Aviso>Coleta do link da bio começou em {data.coleta_desde.split('-').reverse().join('/')}.</Aviso>}
          {(data.avisos || []).map((a, i) => <Aviso key={i}>{a}</Aviso>)}
        </>
      )}
    </Card>
  );
}
