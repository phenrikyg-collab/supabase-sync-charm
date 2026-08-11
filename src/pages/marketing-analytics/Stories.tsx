import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import {
  BlocoLoading, C, Card, ImgSafe, KpiCard, MALayout, SectionTitle, SemDado,
  dataInicioISO, fmtCompact, fmtInt, fmtNum, media, useDias,
} from '@/components/marketing-analytics/shared';

interface StoryRow {
  media_id: string;
  data_br: string;
  data_publicacao: string;
  media_type: string | null;
  permalink: string | null;
  imagem: string | null;
  posicao_sequencia: number | null;
  views: number | null;
  reach: number | null;
  replies: number | null;
  taps_forward: number | null;
  taps_back: number | null;
  exits: number | null;
  swipe_forward: number | null;
  interacoes_total: number | null;
  taxa_saida: number | null;
  taxa_replay: number | null;
  taxa_resposta: number | null;
  retencao_vs_story1: number | null;
}

export default function MAStories() {
  const [dias] = useDias();
  const [rows, setRows] = useState<StoryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [diaSel, setDiaSel] = useState<string>('');

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    (supabase.from('vw_ig_stories_detalhe' as any).select('*') as any)
      .gte('data_br', dataInicioISO(dias))
      .order('data_publicacao', { ascending: false })
      .then(({ data }: any) => {
        if (!ativo) return;
        setRows((data as StoryRow[]) || []);
        setLoading(false);
      });
    return () => { ativo = false; };
  }, [dias]);

  const lista = rows || [];

  const kpis = useMemo(() => ({
    total: lista.length,
    alcanceMed: media(lista.map(s => s.reach)),
    saida: media(lista.map(s => s.taxa_saida)),
    replay: media(lista.map(s => s.taxa_replay)),
    resposta: media(lista.map(s => s.taxa_resposta)),
    interacoes: lista.reduce((a, s) => a + (s.interacoes_total || 0), 0),
  }), [lista]);

  const dias_ = useMemo(() => Array.from(new Set(lista.map(s => s.data_br))).sort().reverse(), [lista]);
  const diaAtivo = diaSel || dias_[0] || '';
  const sequencia = useMemo(
    () => lista.filter(s => s.data_br === diaAtivo).sort((a, b) => (a.posicao_sequencia ?? 0) - (b.posicao_sequencia ?? 0)),
    [lista, diaAtivo]
  );

  const curva = useMemo(() => {
    const map = new Map<number, number[]>();
    lista.forEach(s => {
      if (s.posicao_sequencia == null || s.retencao_vs_story1 == null) return;
      map.set(s.posicao_sequencia, [...(map.get(s.posicao_sequencia) || []), s.retencao_vs_story1]);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([pos, vals]) => ({ pos: `#${pos}`, retencao: Number((vals.reduce((x, y) => x + y, 0) / vals.length).toFixed(1)) }));
  }, [lista]);

  const porDia = useMemo(() => {
    const map = new Map<string, { alcance: number; qtd: number }>();
    lista.forEach(s => {
      const cur = map.get(s.data_br) || { alcance: 0, qtd: 0 };
      map.set(s.data_br, { alcance: cur.alcance + (s.reach || 0), qtd: cur.qtd + 1 });
    });
    return Array.from(map.entries()).sort().map(([d, v]) => ({
      dia: new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      alcance_medio: Math.round(v.alcance / v.qtd),
      stories: v.qtd,
    }));
  }, [lista]);

  return (
    <MALayout titulo="Stories" subtitulo="Retenção da sequência e conversa com a audiência">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard label="Stories publicados" value={fmtInt(kpis.total)} accent={C.bronze} />
        <KpiCard label="Alcance médio" value={fmtCompact(kpis.alcanceMed)} accent={C.gold} />
        <KpiCard label="Taxa de saída" value={kpis.saida === null ? '—' : `${fmtNum(kpis.saida)}%`} accent={C.red} />
        <KpiCard label="Taxa de replay" value={kpis.replay === null ? '—' : `${fmtNum(kpis.replay)}%`} accent={C.blue} />
        <KpiCard label="Taxa de resposta" value={kpis.resposta === null ? '—' : `${fmtNum(kpis.resposta, 2)}%`} accent={C.green} />
        <KpiCard label="Interações" value={fmtInt(kpis.interacoes)} accent={C.bronze} />
      </div>

      <Card accent={C.blue}>
        <SectionTitle subtitle="Retenção média por posição na sequência (base = story #1 do dia)">Curva de retenção</SectionTitle>
        {loading ? <BlocoLoading altura={240} /> : curva.length === 0 ? <SemDado /> : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={curva} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="pos" stroke={C.textSec} />
              <YAxis stroke={C.textSec} unit="%" />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}` }} />
              <Line type="monotone" dataKey="retencao" stroke={C.bronze} strokeWidth={2} dot={{ r: 3 }} name="Retenção" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card accent={C.gold}>
        <SectionTitle subtitle="Alcance médio por dia de publicação">Evolução diária</SectionTitle>
        {loading ? <BlocoLoading altura={220} /> : porDia.length === 0 ? <SemDado /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porDia} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="dia" stroke={C.textSec} />
              <YAxis stroke={C.textSec} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}` }} />
              <Bar dataKey="alcance_medio" fill={C.bronze} radius={[4, 4, 0, 0]} name="Alcance médio" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card accent={C.bronze}>
        <SectionTitle subtitle="Escolha um dia para ver a sequência completa, story a story">Sequência do dia</SectionTitle>
        <div className="flex flex-wrap gap-2 mb-5">
          {dias_.slice(0, 14).map(d => (
            <button
              key={d}
              onClick={() => setDiaSel(d)}
              className="px-3 py-1.5 text-xs rounded-full transition"
              style={{
                background: diaAtivo === d ? C.text : 'transparent',
                color: diaAtivo === d ? C.gold : C.textSec,
                border: `1px solid ${diaAtivo === d ? C.text : C.border}`,
              }}
            >
              {new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')}
            </button>
          ))}
        </div>

        {loading ? <BlocoLoading altura={200} /> : sequencia.length === 0 ? <SemDado /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {sequencia.map(s => (
              <a key={s.media_id} href={s.permalink || undefined} target="_blank" rel="noreferrer"
                className="rounded-lg overflow-hidden block" style={{ border: `1px solid ${C.border}` }}>
                <div className="relative">
                  <ImgSafe src={s.media_type === 'VIDEO' ? null : s.imagem} alt={`Story ${s.posicao_sequencia}`} className="w-full object-cover" style={{ height: 160 }} />
                  <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded font-semibold"
                    style={{ background: 'rgba(29,29,27,0.85)', color: C.gold }}>#{s.posicao_sequencia}</span>
                </div>
                <div className="p-2 text-[11px]" style={{ color: C.textSec }}>
                  <p>Alcance <b style={{ color: C.text }}>{fmtInt(s.reach)}</b></p>
                  <p>Retenção <b style={{ color: C.text }}>{fmtNum(s.retencao_vs_story1)}%</b></p>
                  <p>Saída <b style={{ color: (s.taxa_saida ?? 0) > 8 ? C.red : C.text }}>{fmtNum(s.taxa_saida)}%</b></p>
                  <p>Respostas <b style={{ color: C.text }}>{fmtInt(s.replies)}</b></p>
                </div>
              </a>
            ))}
          </div>
        )}
      </Card>
    </MALayout>
  );
}
