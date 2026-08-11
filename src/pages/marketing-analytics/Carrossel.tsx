import { useMemo } from 'react';
import { ComparativoFormato } from '@/components/marketing-analytics/Comparativo';
import { DriversBlock } from '@/components/marketing-analytics/DriversBlock';
import { MelhorHorario } from '@/components/marketing-analytics/MelhorHorario';
import { GradeConteudo, useConteudo } from '@/components/marketing-analytics/GradeConteudo';
import { C, KpiCard, MALayout, fmtCompact, fmtNum, media, useDias } from '@/components/marketing-analytics/shared';

export default function MACarrossel() {
  const [dias] = useDias();
  const { data, loading } = useConteudo(dias, 'FEED');
  const posts = data || [];

  const kpis = useMemo(() => ({
    alcanceMed: media(posts.map(p => p.reach)),
    views: posts.reduce((s, p) => s + (p.views || 0), 0),
    saveRate: media(posts.map(p => p.save_rate)),
    shareRate: media(posts.map(p => p.share_rate)),
    eng: media(posts.map(p => p.taxa_engajamento)),
    comentarios: media(posts.map(p => p.comments_count)),
  }), [posts]);

  return (
    <MALayout titulo="Carrossel" subtitulo="Formato de feed: carrossel e imagem única">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard label="Alcance médio" value={fmtCompact(kpis.alcanceMed)} accent={C.bronze} />
        <KpiCard label="Views" value={fmtCompact(kpis.views)} accent={C.gold} />
        <KpiCard label="Save rate" value={kpis.saveRate === null ? '—' : `${fmtNum(kpis.saveRate, 2)}%`} accent={C.green} />
        <KpiCard label="Share rate" value={kpis.shareRate === null ? '—' : `${fmtNum(kpis.shareRate, 2)}%`} accent={C.blue} />
        <KpiCard label="Taxa de engajamento" value={kpis.eng === null ? '—' : `${fmtNum(kpis.eng, 2)}%`} accent={C.bronze} />
        <KpiCard label="Comentários médios" value={kpis.comentarios === null ? '—' : fmtNum(kpis.comentarios)} accent={C.gold} />
      </div>

      <ComparativoFormato dias={dias} formato="FEED" />

      <DriversBlock dias={dias} formato="FEED" />

      <MelhorHorario dias={90} formato="FEED" />

      <GradeConteudo posts={posts} loading={loading} isReels={false} />
    </MALayout>
  );
}
