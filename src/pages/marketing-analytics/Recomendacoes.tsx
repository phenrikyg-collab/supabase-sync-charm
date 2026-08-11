import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  BlocoLoading, C, Card, MALayout, SectionTitle, SemDado,
  fmtNum, media, useDias,
} from '@/components/marketing-analytics/shared';

const iso = (d: Date) => d.toISOString().split('T')[0];

function usePeriodos(dias: number) {
  const [atual, setAtual] = useState<any[] | null>(null);
  const [anterior, setAnterior] = useState<any[] | null>(null);

  useEffect(() => {
    let ativo = true;
    const hoje = new Date();
    const iniAtual = new Date(hoje); iniAtual.setDate(hoje.getDate() - dias);
    const iniAnt = new Date(hoje); iniAnt.setDate(hoje.getDate() - dias * 2);

    const q = (de: string, ate: string) =>
      (supabase.from('vw_ig_conteudo' as any).select('formato,pilar,reach,saves,shares,like_count,comments_count,taxa_engajamento') as any)
        .gte('data_br', de).lt('data_br', ate);

    Promise.all([q(iso(iniAtual), iso(new Date(hoje.getTime() + 864e5))), q(iso(iniAnt), iso(iniAtual))])
      .then(([a, b]: any[]) => {
        if (!ativo) return;
        setAtual(a.data || []);
        setAnterior(b.data || []);
      });
    return () => { ativo = false; };
  }, [dias]);

  return { atual, anterior };
}

const pctVar = (a: number, b: number) => (b ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);

const MIX_META = { lifestyle: 70, educacional: 20, produto: 10 };
const classificar = (pilar: string | null) => {
  const p = (pilar || '').toLowerCase();
  if (/produto|oferta|venda|lan[çc]amento|promo/.test(p)) return 'produto';
  if (/educa|dica|tutorial|conceito|angulo|ângulo|guia/.test(p)) return 'educacional';
  return 'lifestyle';
};

export default function MARecomendacoes() {
  const [dias] = useDias();
  const { atual, anterior } = usePeriodos(dias);

  const mix = useMemo(() => {
    if (!atual?.length) return null;
    const cont = { lifestyle: 0, educacional: 0, produto: 0 } as Record<string, number>;
    atual.forEach(p => { cont[classificar(p.pilar)]++; });
    const t = atual.length;
    return {
      lifestyle: Math.round((cont.lifestyle / t) * 100),
      educacional: Math.round((cont.educacional / t) * 100),
      produto: Math.round((cont.produto / t) * 100),
    };
  }, [atual]);

  const comparativo = useMemo(() => {
    if (!atual || !anterior) return null;
    const agg = (arr: any[]) => ({
      Publicações: arr.length,
      'Alcance médio': media(arr.map(a => a.reach)) || 0,
      'Saves médios': media(arr.map(a => a.saves)) || 0,
      'Shares médios': media(arr.map(a => a.shares)) || 0,
      'Engajamento (%)': media(arr.map(a => a.taxa_engajamento)) || 0,
    });
    const a = agg(atual), b = agg(anterior);
    return Object.keys(a).map(k => ({ metrica: k, atual: (a as any)[k], ant: (b as any)[k] }));
  }, [atual, anterior]);

  return (
    <MALayout titulo="Recomendações" subtitulo="Mix de conteúdo e comparativo entre períodos">
      <Card accent={C.gold}>
        <SectionTitle subtitle="Meta: 70% lifestyle · 20% educacional · 10% produto direto">Mix de conteúdo</SectionTitle>
        {!atual ? <BlocoLoading altura={140} /> : !mix ? <SemDado /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(['lifestyle', 'educacional', 'produto'] as const).map(k => {
              const atualPct = mix[k];
              const meta = MIX_META[k];
              const naMeta = atualPct >= meta;
              const cor = k === 'lifestyle' ? C.green : k === 'educacional' ? C.blue : C.bronze;
              return (
                <div key={k}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold capitalize" style={{ color: C.text }}>{k}</span>
                    <span className="text-xs" style={{ color: C.textSec }}>{atualPct}% / {meta}%</span>
                  </div>
                  <div className="w-full rounded-full h-3 mb-2" style={{ background: C.tabBg }}>
                    <div className="h-3 rounded-full" style={{ width: `${Math.min((atualPct / meta) * 100, 100)}%`, background: cor }} />
                  </div>
                  <span className="inline-block text-[11px] px-2 py-0.5 rounded font-medium"
                    style={{ background: naMeta ? '#E8F5EE' : '#FFF4D6', color: naMeta ? C.green : C.bronze }}>
                    {naMeta ? 'Na meta' : 'Abaixo da meta'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card accent={C.bronze}>
        <SectionTitle subtitle={`Últimos ${dias} dias vs ${dias} dias anteriores`}>Comparativo de períodos</SectionTitle>
        {!comparativo ? <BlocoLoading altura={200} /> : comparativo.length === 0 ? <SemDado /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Métrica', 'Período anterior', 'Período atual', 'Variação'].map((h, i) => (
                    <th key={h} className={`py-3 px-2 font-semibold ${i ? 'text-right' : 'text-left'}`} style={{ color: C.textSec }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparativo.map(r => {
                  const v = pctVar(r.atual, r.ant);
                  const pos = v >= 0;
                  return (
                    <tr key={r.metrica} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td className="py-3 px-2" style={{ color: C.text }}>{r.metrica}</td>
                      <td className="py-3 px-2 text-right" style={{ color: C.textSec }}>{fmtNum(r.ant, r.metrica === 'Publicações' ? 0 : 1)}</td>
                      <td className="py-3 px-2 text-right font-semibold" style={{ color: C.text }}>{fmtNum(r.atual, r.metrica === 'Publicações' ? 0 : 1)}</td>
                      <td className="py-3 px-2 text-right font-semibold" style={{ color: pos ? C.green : C.red }}>
                        <span className="inline-flex items-center gap-1 justify-end">
                          {pos ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{Math.abs(v).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </MALayout>
  );
}
