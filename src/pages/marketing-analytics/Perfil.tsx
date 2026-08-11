import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { CalculadoraValorSeguidor } from '@/components/marketing-analytics/CalculadoraValorSeguidor';
import { ClarezaComunicacao } from '@/components/marketing-analytics/ClarezaComunicacao';
import { DiagnosticoCompleto } from '@/components/marketing-analytics/DiagnosticoCompleto';
import { DriversBlock } from '@/components/marketing-analytics/DriversBlock';
import { FunilConta, FunilTaxa } from '@/components/marketing-analytics/FunilConta';
import { FunilDestino } from '@/components/marketing-analytics/FunilDestino';
import { FunilVisual } from '@/components/marketing-analytics/FunilVisual';
import { MelhorHorario } from '@/components/marketing-analytics/MelhorHorario';
import {
  Aviso, BlocoLoading, C, Card, KpiCard, MALayout, SANS, SectionTitle, SemDado,
  dataInicioISO, fmtCompact, fmtInt, fmtNum, media, useDias,
} from '@/components/marketing-analytics/shared';

interface TotalItem { atual: number | null; anterior: number | null; variacao_pct?: number | null }
interface Funil {
  taxas: FunilTaxa[];
  avisos: string[];
  views: number | null;
  visitas: number | null;
  seguidores: number | null;
  cliques_bio: number | null;
  periodo_dias: number;
  dias_com_dado: number;
  alcance_somado: number | null;
  contas_engajadas: number | null;
  novos_seguidores: number | null;
  saldo_seguidores: number | null;
  seguidores_perdidos: number | null;
  pct_alcance_nao_seguidor: number | null;
  legenda_status: Record<string, string> | null;
  totais: Record<string, TotalItem> | null;
}

function useFunil(dias: number) {
  const [data, setData] = useState<Funil | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let ativo = true;
    setLoading(true);
    supabase.rpc('fn_ig_funil' as any, { p_dias: dias }).then(({ data }: any) => {
      if (!ativo) return;
      setData((data as Funil) || null);
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [dias]);
  return { funil: data, loading };
}


function MixFormatos({ dias }: { dias: number }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    let ativo = true;
    (supabase.from('vw_ig_conteudo' as any).select('formato,reach,saves,shares,taxa_engajamento') as any)
      .gte('data_br', dataInicioISO(dias))
      .then(({ data }: any) => { if (ativo) setRows(data || []); });
    return () => { ativo = false; };
  }, [dias]);

  const dados = useMemo(() => {
    const map = new Map<string, any[]>();
    (rows || []).forEach(r => {
      const k = r.formato === 'REELS' ? 'Reels' : 'Feed';
      map.set(k, [...(map.get(k) || []), r]);
    });
    return Array.from(map.entries()).map(([formato, arr]) => ({
      formato,
      posts: arr.length,
      alcance_medio: Math.round(media(arr.map(a => a.reach)) || 0),
      engajamento: Number((media(arr.map(a => a.taxa_engajamento)) || 0).toFixed(2)),
    }));
  }, [rows]);

  return (
    <Card accent={C.gold}>
      <SectionTitle subtitle="Volume publicado e alcance médio por formato">Mix de formatos</SectionTitle>
      {!rows ? <BlocoLoading altura={220} /> : dados.length === 0 ? <SemDado /> : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dados} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="formato" stroke={C.textSec} />
              <YAxis stroke={C.textSec} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}` }} />
              <Bar dataKey="alcance_medio" fill={C.bronze} radius={[4, 4, 0, 0]} name="Alcance médio" />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {dados.map(d => (
              <div key={d.formato} className="p-3 rounded-lg" style={{ background: C.tabBg }}>
                <p className="text-sm font-semibold" style={{ color: C.text }}>{d.formato}</p>
                <p className="text-xs" style={{ color: C.textSec }}>
                  {d.posts} posts · alcance méd. {fmtCompact(d.alcance_medio)} · eng. {fmtNum(d.engajamento, 2)}%
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

const CAMPOS_DIM = ['dimensao', 'tipo', 'metrica', 'categoria_tipo'];
const CAMPOS_VAL = ['categoria', 'valor_dimensao', 'faixa', 'label', 'nome', 'valor_categoria'];
const CAMPOS_QTD = ['quantidade', 'valor', 'total', 'seguidores', 'qtd', 'percentual'];

function Demografia() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    let ativo = true;
    (supabase.from('instagram_demografia' as any).select('*').limit(300) as any)
      .then(({ data }: any) => { if (ativo) setRows(data || []); });
    return () => { ativo = false; };
  }, []);

  const grupos = useMemo(() => {
    if (!rows?.length) return [];
    const keys = Object.keys(rows[0]);
    const kDim = CAMPOS_DIM.find(k => keys.includes(k));
    const kVal = CAMPOS_VAL.find(k => keys.includes(k));
    const kQtd = CAMPOS_QTD.find(k => keys.includes(k));
    if (!kVal || !kQtd) return [];
    const map = new Map<string, { label: string; qtd: number }[]>();
    rows.forEach(r => {
      const g = kDim ? String(r[kDim]) : 'Audiência';
      map.set(g, [...(map.get(g) || []), { label: String(r[kVal]), qtd: Number(r[kQtd]) || 0 }]);
    });
    return Array.from(map.entries()).map(([g, itens]) => ({
      grupo: g,
      itens: itens.sort((a, b) => b.qtd - a.qtd).slice(0, 8),
      total: itens.reduce((s, i) => s + i.qtd, 0),
    }));
  }, [rows]);

  return (
    <Card accent={C.blue}>
      <SectionTitle subtitle="Distribuição da audiência conforme último snapshot da Graph API">Demografia</SectionTitle>
      {!rows ? <BlocoLoading altura={160} /> : grupos.length === 0 ? (
        <SemDado texto="sem dado de demografia sincronizado" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {grupos.map(g => (
            <div key={g.grupo}>
              <p className="text-sm font-semibold mb-2 capitalize" style={{ color: C.text, fontFamily: SANS }}>{g.grupo}</p>
              <div className="space-y-2">
                {g.itens.map(i => (
                  <div key={i.label}>
                    <div className="flex justify-between text-xs mb-1" style={{ color: C.textSec }}>
                      <span>{i.label}</span>
                      <span>{g.total ? `${((i.qtd / g.total) * 100).toFixed(1)}%` : fmtInt(i.qtd)}</span>
                    </div>
                    <div className="h-2 rounded" style={{ background: C.tabBg }}>
                      <div className="h-2 rounded" style={{ width: `${g.total ? (i.qtd / g.total) * 100 : 0}%`, background: C.bronze }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function MarketingAnalytics() {
  const [dias] = useDias();
  const { funil, loading } = useFunil(dias);

  return (
    <MALayout titulo="Análise do Perfil" subtitulo="Funil da conta, mix de formatos e o que move o alcance">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard label="Alcance somado" value={fmtCompact(funil?.alcance_somado)} accent={C.bronze}
          change={funil?.totais?.alcance_somado?.variacao_pct ?? undefined} />
        <KpiCard label="Views" value={fmtCompact(funil?.views)} accent={C.gold}
          change={funil?.totais?.views?.variacao_pct ?? undefined} />
        <KpiCard label="Visitas ao perfil" value={fmtCompact(funil?.visitas)} accent={C.blue}
          change={funil?.totais?.visitas?.variacao_pct ?? undefined} />
        <KpiCard label="Cliques na bio" value={fmtCompact(funil?.cliques_bio)} accent={C.green}
          change={funil?.totais?.cliques_bio?.variacao_pct ?? undefined} />
        <KpiCard label="Novos seguidores" value={fmtCompact(funil?.novos_seguidores)} sub={funil?.saldo_seguidores != null ? `saldo ${fmtInt(funil.saldo_seguidores)}` : undefined} accent={C.bronze} />
        <KpiCard label="% alcance não seguidor" value={funil?.pct_alcance_nao_seguidor == null ? '—' : `${fmtNum(funil.pct_alcance_nao_seguidor)}%`} accent={C.gold} />
      </div>

      <DiagnosticoCompleto dias={dias} />

      <FunilVisual />


        <SectionTitle subtitle={funil ? `${funil.dias_com_dado} de ${funil.periodo_dias} dias com dado no período` : undefined}>
          Funil da conta
        </SectionTitle>
        {loading ? <BlocoLoading altura={220} /> : !funil?.taxas?.length ? <SemDado /> : (
          <FunilConta taxas={funil.taxas} avisos={funil.avisos} legenda={funil.legenda_status} />
        )}
      </Card>

      <FunilDestino dias={dias} />

      <MixFormatos dias={dias} />

      <MelhorHorario dias={90} />

      <DriversBlock dias={dias} formato={null} />

      <ClarezaComunicacao dias={dias} />

      <CalculadoraValorSeguidor dias={dias} />

      <Demografia />

    </MALayout>
  );
}
