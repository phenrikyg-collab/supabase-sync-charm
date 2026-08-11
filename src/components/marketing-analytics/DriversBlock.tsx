import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnaliseEscrita } from './AnaliseEscrita';
import { BarraDivergente, BlocoLoading, C, Card, SANS, SectionTitle, SemDado, fmtInt, fmtNum } from './shared';

export interface DriverRow {
  categoria: string;
  posts: number;
  pct_do_volume: number;
  alcance_med: number | null;
  save_rate_med: number | null;
  share_rate_med: number | null;
  engajamento_med: number | null;
  skip_rate_med: number | null;
  watch_medio_s: number | null;
  indice_vs_media: number | null;
}

export const DIMENSOES = [
  { value: 'pilar', label: 'Pilar' },
  { value: 'angulo', label: 'Ângulo' },
  { value: 'persona', label: 'Persona' },
  { value: 'funcao', label: 'Função' },
  { value: 'cta', label: 'CTA' },
  { value: 'dia', label: 'Dia' },
  { value: 'hora', label: 'Hora' },
  { value: 'legenda', label: 'Legenda' },
];

export function useDrivers(dias: number, formato: string | null, dimensao: string) {
  const [data, setData] = useState<DriverRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro('');
    supabase
      .rpc('fn_ig_drivers' as any, { p_dias: dias, p_formato: formato, p_dimensao: dimensao })
      .then(({ data, error }: any) => {
        if (!ativo) return;
        if (error) setErro(error.message);
        setData((data as DriverRow[]) || []);
        setLoading(false);
      });
    return () => { ativo = false; };
  }, [dias, formato, dimensao]);

  return { data, loading, erro };
}

function Badge({ tipo }: { tipo: 'sub' | 'super' }) {
  const sub = tipo === 'sub';
  return (
    <span className="text-[10px] px-2 py-0.5 rounded font-semibold whitespace-nowrap"
      style={{ background: sub ? '#E8F5EE' : '#FBEAE5', color: sub ? C.green : C.red }}>
      {sub ? 'Subutilizado' : 'Superutilizado'}
    </span>
  );
}

export function DriversBlock({ dias, formato, mostrarSkip = false }: { dias: number; formato: string | null; mostrarSkip?: boolean }) {
  const [dimensao, setDimensao] = useState('pilar');
  const { data, loading, erro } = useDrivers(dias, formato, dimensao);

  const linhas = useMemo(
    () => [...(data || [])].sort((a, b) => (b.indice_vs_media ?? 0) - (a.indice_vs_media ?? 0)),
    [data]
  );

  return (
    <Card accent={C.bronze}>
      <SectionTitle subtitle="Índice 1.00 = média do período. Categorias com menos de 3 posts são omitidas pelo banco.">
        O que faz performar
      </SectionTitle>

      <div className="flex flex-wrap gap-2 mb-5">
        {DIMENSOES.map(d => (
          <button
            key={d.value}
            onClick={() => setDimensao(d.value)}
            className="px-3 py-1.5 text-xs rounded-full transition"
            style={{
              background: dimensao === d.value ? C.text : 'transparent',
              color: dimensao === d.value ? C.gold : C.textSec,
              border: `1px solid ${dimensao === d.value ? C.text : C.border}`,
              fontFamily: SANS,
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {loading ? (
        <BlocoLoading altura={200} />
      ) : erro ? (
        <SemDado texto={`Erro ao carregar: ${erro}`} />
      ) : linhas.length === 0 ? (
        <SemDado />
      ) : (
        <>
          {/* Desktop */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Categoria', 'Índice vs média', 'Posts', '% volume', 'Alcance méd.', 'Save %', 'Share %', 'Eng. %', ...(mostrarSkip ? ['Skip %', 'Watch (s)'] : [])].map(h => (
                    <th key={h} className="text-left py-2.5 px-2 font-semibold text-xs" style={{ color: C.textSec }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map(r => {
                  const sub = (r.indice_vs_media ?? 0) > 1.15 && r.pct_do_volume < 15;
                  const sup = (r.indice_vs_media ?? 0) < 0.95 && r.pct_do_volume > 15;
                  return (
                    <tr key={r.categoria} style={{ borderBottom: `1px solid ${C.border}`, background: sub ? '#F6FBF8' : 'transparent' }}>
                      <td className="py-2.5 px-2" style={{ color: C.text }}>
                        <span className="font-medium">{r.categoria}</span>
                        {(sub || sup) && <span className="ml-2"><Badge tipo={sub ? 'sub' : 'super'} /></span>}
                      </td>
                      <td className="py-2.5 px-2"><BarraDivergente indice={r.indice_vs_media} /></td>
                      <td className="py-2.5 px-2" style={{ color: C.textSec }}>{r.posts}</td>
                      <td className="py-2.5 px-2" style={{ color: C.textSec }}>{fmtNum(r.pct_do_volume)}%</td>
                      <td className="py-2.5 px-2" style={{ color: C.text }}>{fmtInt(r.alcance_med)}</td>
                      <td className="py-2.5 px-2" style={{ color: C.textSec }}>{fmtNum(r.save_rate_med, 2)}</td>
                      <td className="py-2.5 px-2" style={{ color: C.textSec }}>{fmtNum(r.share_rate_med, 2)}</td>
                      <td className="py-2.5 px-2" style={{ color: C.textSec }}>{fmtNum(r.engajamento_med, 2)}</td>
                      {mostrarSkip && <td className="py-2.5 px-2" style={{ color: C.textSec }}>{fmtNum(r.skip_rate_med)}</td>}
                      {mostrarSkip && <td className="py-2.5 px-2" style={{ color: C.textSec }}>{fmtNum(r.watch_medio_s)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {linhas.map(r => {
              const sub = (r.indice_vs_media ?? 0) > 1.15 && r.pct_do_volume < 15;
              const sup = (r.indice_vs_media ?? 0) < 0.95 && r.pct_do_volume > 15;
              return (
                <div key={r.categoria} className="rounded-lg p-3" style={{ border: `1px solid ${C.border}` }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-medium text-sm" style={{ color: C.text }}>{r.categoria}</span>
                    {(sub || sup) && <Badge tipo={sub ? 'sub' : 'super'} />}
                  </div>
                  <BarraDivergente indice={r.indice_vs_media} />
                  <p className="text-xs mt-2" style={{ color: C.textSec }}>
                    {r.posts} posts · {fmtNum(r.pct_do_volume)}% do volume · alcance méd. {fmtInt(r.alcance_med)}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      <AnaliseEscrita formato={formato} />
    </Card>
  );
}
