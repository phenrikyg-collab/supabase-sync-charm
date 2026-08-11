import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aviso, BlocoLoading, C, Card, SANS, SectionTitle, SemDado, Status, StatusChip, fmtNum } from './shared';

interface HealthDim {
  dimensao: string;
  nota: number | null;
  status: Status;
  observacao: string | null;
}
interface RedFlag {
  flag: string;
  valor: string | null;
  indica: string | null;
  acao: string | null;
}
interface Frequencia {
  atual_por_semana: number | null;
  faixa_recomendada: string | null;
  formula_do_material: number | null;
  formula_aplicavel: boolean;
  observacao: string | null;
}
interface GargaloPrincipal {
  etapa: string;
  valor: number | null;
  faixas: string | null;
  problema: string | null;
  acao: string | null;
}
interface Diagnostico {
  avisos: string[];
  status_geral: Status;
  status_rotulo: string | null;
  gargalo_principal: GargaloPrincipal | null;
  health_score: HealthDim[];
  health_score_media: number | null;
  red_flags: RedFlag[];
  frequencia: Frequencia | null;
  periodo_dias: number;
}

const COR: Record<string, string> = { saudavel: C.green, atencao: C.yellow, critico: C.red, sem_dado: C.grey };

export function DiagnosticoCompleto({ dias }: { dias: number }) {
  const [data, setData] = useState<Diagnostico | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    supabase.rpc('fn_ig_diagnostico_completo' as any, { p_dias: dias }).then(({ data }: any) => {
      if (!ativo) return;
      setData((data as Diagnostico) || null);
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [dias]);

  const corGeral = COR[data?.status_geral || 'sem_dado'] || C.grey;
  const comNota = (data?.health_score || []).filter(h => h.nota !== null);

  return (
    <Card accent={corGeral}>
      <SectionTitle subtitle={`Leitura consolidada do funil, saúde do perfil e alertas nos últimos ${dias} dias`}>
        Diagnóstico
      </SectionTitle>

      {loading ? <BlocoLoading altura={280} /> : !data ? <SemDado /> : (
        <div className="space-y-5">
          {data.status_rotulo && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold"
              style={{ background: corGeral, color: '#fff', fontFamily: SANS }}>
              {data.status_rotulo}
            </span>
          )}

          {data.gargalo_principal && (
            <div className="p-4 rounded-lg" style={{ background: '#FBEAE5', border: `1px solid ${C.red}` }}>
              <p className="text-[11px] uppercase tracking-wider" style={{ color: C.red, fontFamily: SANS }}>Gargalo principal</p>
              <p className="text-lg mt-1" style={{ color: C.text, fontFamily: SERIF_FALLBACK, fontWeight: 700 }}>
                {data.gargalo_principal.etapa}
                {data.gargalo_principal.valor !== null && (
                  <span className="ml-2 text-base" style={{ color: C.red }}>{fmtNum(data.gargalo_principal.valor, 2)}%</span>
                )}
              </p>
              {data.gargalo_principal.faixas && (
                <p className="text-[11px] mt-1" style={{ color: C.textSec }}>{data.gargalo_principal.faixas}</p>
              )}
              {data.gargalo_principal.problema && (
                <p className="text-sm mt-2" style={{ color: C.text, fontFamily: SANS }}>{data.gargalo_principal.problema}</p>
              )}
              {data.gargalo_principal.acao && (
                <p className="text-sm mt-2 font-medium" style={{ color: C.text, fontFamily: SANS }}>→ {data.gargalo_principal.acao}</p>
              )}
            </div>
          )}

          <div>
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <p className="text-sm font-semibold" style={{ color: C.text, fontFamily: SANS }}>Health Score</p>
              <p className="text-xs" style={{ color: C.textSec, fontFamily: SANS }}>
                média {data.health_score_media === null ? '—' : fmtNum(data.health_score_media, 1)}/10 · cobre {comNota.length} de {(data.health_score || []).length} dimensões
              </p>
            </div>
            <div className="space-y-3">
              {(data.health_score || []).map(h => (
                <div key={h.dimensao}>
                  <div className="flex items-center justify-between gap-2 text-sm mb-1">
                    <span style={{ color: C.text, fontFamily: SANS }}>{h.dimensao}</span>
                    <span className="flex items-center gap-2">
                      <StatusChip status={h.status} />
                      <b style={{ color: h.nota === null ? C.grey : C.text }}>{h.nota === null ? 'sem dado' : `${h.nota}/10`}</b>
                    </span>
                  </div>
                  <div className="h-2.5 rounded" style={{ background: C.tabBg }}>
                    <div className="h-2.5 rounded" style={{
                      width: `${h.nota === null ? 100 : (h.nota / 10) * 100}%`,
                      background: h.nota === null ? C.border : COR[h.status || 'sem_dado'] || C.grey,
                    }} />
                  </div>
                  {h.observacao && <p className="text-[11px] mt-1" style={{ color: C.grey, fontFamily: SANS }}>{h.observacao}</p>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: C.text, fontFamily: SANS }}>Red flags</p>
            {!(data.red_flags || []).length ? (
              <div className="p-3 rounded-lg text-sm" style={{ background: '#E8F5EE', color: C.green, fontFamily: SANS }}>
                Nenhum alerta ativo.
              </div>
            ) : (
              <div className="space-y-2">
                {data.red_flags.map((f, i) => (
                  <div key={i} className="p-3 rounded-lg" style={{ background: C.tabBg, borderLeft: `3px solid ${C.red}` }}>
                    <p className="text-sm font-medium" style={{ color: C.text, fontFamily: SANS }}>
                      {f.flag}{f.valor && <span className="ml-2 text-xs" style={{ color: C.red }}>{f.valor}</span>}
                    </p>
                    {f.indica && <p className="text-xs mt-1" style={{ color: C.textSec }}>{f.indica}</p>}
                    {f.acao && <p className="text-xs mt-1 font-medium" style={{ color: C.text }}>→ {f.acao}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {data.frequencia && (
            <div className="p-4 rounded-lg" style={{ background: C.tabBg }}>
              <p className="text-sm font-semibold mb-1" style={{ color: C.text, fontFamily: SANS }}>Frequência de publicação</p>
              <p className="text-2xl" style={{ color: C.text, fontFamily: SANS, fontWeight: 700 }}>
                {fmtNum(data.frequencia.atual_por_semana, 1)} <span className="text-sm font-normal" style={{ color: C.textSec }}>publicações por semana</span>
              </p>
              <p className="text-xs mt-1" style={{ color: C.textSec }}>Recomendado: {data.frequencia.faixa_recomendada}</p>
              {data.frequencia.formula_do_material !== null && (
                <Aviso>
                  Fórmula do material (não aplicável a esta conta): {data.frequencia.formula_do_material} posts por semana.{' '}
                  {data.frequencia.observacao}
                </Aviso>
              )}
            </div>
          )}

          {(data.avisos || []).length > 0 && (
            <div className="space-y-1">{data.avisos.map((a, i) => <Aviso key={i}>{a}</Aviso>)}</div>
          )}
        </div>
      )}
    </Card>
  );
}

const SERIF_FALLBACK = 'Cormorant Garamond, serif';
