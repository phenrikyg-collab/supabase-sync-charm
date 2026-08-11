import { useMemo } from 'react';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { ComparativoFormato } from '@/components/marketing-analytics/Comparativo';
import { DriversBlock } from '@/components/marketing-analytics/DriversBlock';
import { GradeConteudo, useConteudo } from '@/components/marketing-analytics/GradeConteudo';
import {
  Aviso, BlocoLoading, C, Card, KpiCard, MALayout, SANS, SectionTitle, SemDado,
  fmtCompact, fmtInt, fmtNum, media, mediana, useDias,
} from '@/components/marketing-analytics/shared';

export default function MAReels() {
  const [dias] = useDias();
  const { data, loading } = useConteudo(dias, 'REELS');
  const posts = data || [];

  const kpis = useMemo(() => ({
    alcanceMed: media(posts.map(p => p.reach)),
    views: posts.reduce((s, p) => s + (p.views || 0), 0),
    skipMed: mediana(posts.map(p => p.skip_rate)),
    watchMed: media(posts.map(p => p.watch_medio_s)),
    retencaoMed: media(posts.map(p => p.retencao_inicial)),
    horas: posts.reduce((s, p) => s + (p.watch_total_h || 0), 0),
    saveRate: media(posts.map(p => p.save_rate)),
  }), [posts]);

  const scatter = useMemo(
    () => posts
      .filter(p => p.skip_rate !== null && p.watch_medio_s !== null)
      .map(p => ({ x: p.skip_rate as number, y: p.watch_medio_s as number, z: p.reach || 0, caption: p.caption?.slice(0, 60) })),
    [posts]
  );
  const medSkip = mediana(scatter.map(s => s.x));
  const medWatch = mediana(scatter.map(s => s.y));

  const quadrantes = useMemo(() => {
    if (medSkip === null || medWatch === null) return null;
    const q = { bom: 0, ganchoOk: 0, conteudoOk: 0, refazer: 0 };
    scatter.forEach(s => {
      const skipBaixo = s.x <= medSkip;
      const watchAlto = s.y >= medWatch;
      if (skipBaixo && watchAlto) q.bom++;
      else if (skipBaixo && !watchAlto) q.ganchoOk++;
      else if (!skipBaixo && watchAlto) q.conteudoOk++;
      else q.refazer++;
    });
    return q;
  }, [scatter, medSkip, medWatch]);

  return (
    <MALayout titulo="Reels" subtitulo="Performance do formato que mais distribui">
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
        <KpiCard label="Alcance médio" value={fmtCompact(kpis.alcanceMed)} accent={C.bronze} />
        <KpiCard label="Views" value={fmtCompact(kpis.views)} accent={C.gold} />
        <KpiCard label="Skip rate mediano" value={kpis.skipMed === null ? '—' : `${fmtNum(kpis.skipMed)}%`} accent={C.red} />
        <KpiCard label="Watch médio" value={kpis.watchMed === null ? '—' : `${fmtNum(kpis.watchMed)}s`} accent={C.blue} />
        <KpiCard label="Retenção inicial" value={kpis.retencaoMed === null ? '—' : `${fmtNum(kpis.retencaoMed)}%`} accent={C.green} />
        <KpiCard label="Horas assistidas" value={fmtNum(kpis.horas)} accent={C.green} />
        <KpiCard label="Save rate" value={kpis.saveRate === null ? '—' : `${fmtNum(kpis.saveRate, 2)}%`} accent={C.bronze} />
      </div>

      <ComparativoFormato dias={dias} formato="REELS" />

      <DriversBlock dias={dias} formato="REELS" mostrarSkip />


      <Card accent={C.blue}>
        <SectionTitle subtitle="Tamanho do ponto = alcance. Linhas de referência nas medianas da conta.">
          Skip Rate × Watch Time
        </SectionTitle>
        {loading ? (
          <BlocoLoading altura={280} />
        ) : scatter.length === 0 ? (
          <SemDado />
        ) : (
          <>
            <div className="hidden md:block">
              <ResponsiveContainer width="100%" height={340}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="Skip rate" unit="%" stroke={C.textSec} />
                  <YAxis type="number" dataKey="y" name="Watch médio" unit="s" stroke={C.textSec} />
                  <ZAxis type="number" dataKey="z" range={[40, 400]} name="Alcance" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ background: C.card, border: `1px solid ${C.border}` }}
                    formatter={(v: any, n: any) => [typeof v === 'number' ? v.toLocaleString('pt-BR') : v, n]}
                  />
                  {medSkip !== null && <ReferenceLine x={medSkip} stroke={C.bronze} strokeDasharray="4 4" />}
                  {medWatch !== null && <ReferenceLine y={medWatch} stroke={C.bronze} strokeDasharray="4 4" />}
                  <Scatter data={scatter} fill={C.bronze} fillOpacity={0.65} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Mobile: lista ordenada */}
            <div className="md:hidden space-y-2">
              {[...scatter].sort((a, b) => a.x - b.x).map((s, i) => (
                <div key={i} className="flex justify-between text-xs p-2 rounded" style={{ border: `1px solid ${C.border}`, color: C.textSec }}>
                  <span className="truncate flex-1 mr-2" style={{ color: C.text }}>{s.caption || 'Sem legenda'}</span>
                  <span>skip {fmtNum(s.x)}% · watch {fmtNum(s.y)}s · {fmtInt(s.z)}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
              {[
                ['Gancho e conteúdo fortes', 'baixo skip · alto watch', C.green],
                ['Gancho forte, conteúdo fraco', 'baixo skip · baixo watch', C.yellow],
                ['Gancho fraco, conteúdo forte', 'alto skip · alto watch', C.blue],
                ['Refazer', 'alto skip · baixo watch', C.red],
              ].map(([t, s, cor]) => (
                <div key={t as string} className="p-2 rounded" style={{ background: C.tabBg, borderLeft: `3px solid ${cor}` }}>
                  <b style={{ color: C.text }}>{t}</b>
                  <p style={{ color: C.textSec }}>{s}</p>
                </div>
              ))}
            </div>

            <Aviso>
              Skip rate e watch time são independentes (correlação −0,02). O skip mede o gancho, o watch mede o conteúdo.
              Skip rate é o que mais prevê alcance (−0,65): quanto menos gente pula, mais o Instagram distribui.
            </Aviso>
          </>
        )}
      </Card>

      <GradeConteudo posts={posts} loading={loading} isReels />
    </MALayout>
  );
}
