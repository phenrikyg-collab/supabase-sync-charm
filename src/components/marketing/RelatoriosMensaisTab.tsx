import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Plus, Sparkles, X, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { useToast } from '@/hooks/use-toast';

const C = {
  bg: '#FAF8F3',
  card: '#FFFFFF',
  text: '#1D1D1B',
  textSec: '#6B6B69',
  gold: '#E8CD7E',
  bronze: '#8B6914',
  border: '#E8E6E0',
  green: '#2D7A4F',
  red: '#C0392B',
  yellow: '#D4A017',
  blue: '#4A90D9',
  gray: '#9E9E9E',
};

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface RelatorioRow {
  id: string;
  mes: number;
  ano: number;
  relatorio_ia: any;
  dados_raw: any;
  total_posts: number;
  alcance_total: number;
  engajamento_total: number;
  salvamentos: number;
  compartilhamentos: number;
  taxa_engajamento: number;
  formato_dominante: string;
  gerado_em: string;
}

const fmt = (n: number) => (n || 0).toLocaleString('pt-BR');
const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;

const statusBadge = (s: string) => {
  if (s === 'on_track') return { bg: C.green + '22', color: C.green, label: '✓ No alvo' };
  if (s === 'at_risk') return { bg: C.yellow + '22', color: C.yellow, label: '⚠ Em risco' };
  return { bg: C.red + '22', color: C.red, label: '✗ Fora do alvo' };
};

const prioBadge = (p: string) => {
  const low = (p || '').toLowerCase();
  if (low.includes('imediat')) return { bg: C.red, color: '#fff' };
  if (low.includes('essa') || low.includes('esta') || low.includes('este')) return { bg: C.gold, color: C.text };
  if (low.includes('próxim') || low.includes('proxim')) return { bg: C.gray, color: '#fff' };
  return { bg: C.border, color: C.text };
};
const impactoBadge = (i: string) => {
  const low = (i || '').toLowerCase();
  if (low.startsWith('alto')) return { bg: C.green, color: '#fff' };
  if (low.startsWith('med')) return { bg: C.blue, color: '#fff' };
  return { bg: C.gray, color: '#fff' };
};
const esforcoBadge = (e: string) => {
  const low = (e || '').toLowerCase();
  if (low.startsWith('baix')) return { bg: C.green, color: '#fff' };
  if (low.startsWith('med')) return { bg: C.yellow, color: '#fff' };
  if (low.startsWith('alt')) return { bg: C.red, color: '#fff' };
  return { bg: C.gray, color: '#fff' };
};

export default function RelatoriosMensaisTab() {
  const { toast } = useToast();
  const [lista, setLista] = useState<RelatorioRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const hoje = new Date();
  const [mesSel, setMesSel] = useState(hoje.getMonth() + 1);
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());

  const selected = lista.find((r) => r.id === selectedId);

  const fetchLista = async (selectId?: string) => {
    setLoadingList(true);
    const { data, error } = await (supabase as any)
      .from('instagram_relatorios_mensais')
      .select('*')
      .order('ano', { ascending: false })
      .order('mes', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar relatórios', description: error.message, variant: 'destructive' });
    }
    const rows = (data as RelatorioRow[]) || [];
    setLista(rows);
    if (selectId) setSelectedId(selectId);
    else if (!selectedId && rows.length) setSelectedId(rows[0].id);
    setLoadingList(false);
  };

  useEffect(() => {
    fetchLista();
  }, []);

  const gerarRelatorio = async () => {
    setGenerating(true);
    try {
      await invokeEdgeFunction('gerar-relatorio-mensal', { mes: mesSel, ano: anoSel }, { timeoutMs: 180_000 });
      toast({ title: '✓ Relatório gerado', description: `${MESES_FULL[mesSel - 1]}/${anoSel} criado com sucesso!` });
      setModalOpen(false);
      // recarregar e selecionar o recém-criado
      const { data } = await (supabase as any)
        .from('instagram_relatorios_mensais')
        .select('*')
        .eq('mes', mesSel)
        .eq('ano', anoSel)
        .order('gerado_em', { ascending: false })
        .limit(1);
      const novoId = data?.[0]?.id;
      await fetchLista(novoId);
    } catch (err: any) {
      toast({ title: 'Erro ao gerar relatório', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const Header = (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 className="text-2xl" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
          Relatórios Mensais
        </h2>
        <p className="text-sm" style={{ color: C.textSec }}>Histórico de performance e análise IA</p>
      </div>
      <button
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition"
        style={{ background: C.text, color: C.gold }}
      >
        <Plus size={16} /> Gerar Relatório
      </button>
    </div>
  );

  const Modal = modalOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-xl p-6 w-full max-w-md" style={{ background: C.card }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
            Gerar Relatório Mensal
          </h3>
          <button onClick={() => !generating && setModalOpen(false)} style={{ color: C.textSec }}><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase mb-1 block" style={{ color: C.textSec }}>Mês</label>
            <select
              value={mesSel}
              onChange={(e) => setMesSel(Number(e.target.value))}
              disabled={generating}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: C.border, color: C.text, background: '#fff' }}
            >
              {MESES_FULL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase mb-1 block" style={{ color: C.textSec }}>Ano</label>
            <select
              value={anoSel}
              onChange={(e) => setAnoSel(Number(e.target.value))}
              disabled={generating}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: C.border, color: C.text, background: '#fff' }}
            >
              {[2025, 2026, 2027, 2028].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            onClick={gerarRelatorio}
            disabled={generating}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition disabled:opacity-60"
            style={{ background: C.text, color: C.gold }}
          >
            {generating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? `Analisando ${MESES_FULL[mesSel - 1]}…` : 'Gerar'}
          </button>
        </div>
      </div>
    </div>
  );

  if (loadingList) {
    return (
      <div>
        {Header}
        <div className="mt-6 text-sm" style={{ color: C.textSec }}>Carregando…</div>
        {Modal}
      </div>
    );
  }

  if (!lista.length) {
    return (
      <div>
        {Header}
        <div
          className="rounded-xl p-12 text-center mt-6"
          style={{ background: C.bg, border: `1px solid ${C.border}` }}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: C.gold + '33', color: C.bronze }}>
            <Sparkles size={28} />
          </div>
          <h3 className="text-xl mb-2" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
            Nenhum relatório ainda
          </h3>
          <p className="text-sm mb-6" style={{ color: C.textSec }}>
            Gere o primeiro relatório mensal para começar o histórico.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold"
            style={{ background: C.text, color: C.gold }}
          >
            <Sparkles size={16} /> Gerar primeiro relatório
          </button>
        </div>
        {Modal}
      </div>
    );
  }

  const ri = selected?.relatorio_ia || {};
  const dr = selected?.dados_raw || {};
  const evolucao = Array.isArray(dr?.evolucaoSemanal) ? dr.evolucaoSemanal : [];
  const mixAtual = dr?.atual || {};
  const totalMix = (mixAtual.reels || 0) + (mixAtual.carrossel || 0) + (mixAtual.imagem || 0);

  return (
    <div className="space-y-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {Header}

      {/* Pills selector */}
      <div className="flex flex-wrap gap-2">
        {lista.map((r) => {
          const ativo = r.id === selectedId;
          return (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className="px-3 py-1.5 rounded-full text-sm transition"
              style={{
                background: ativo ? C.text : '#fff',
                color: ativo ? C.gold : C.text,
                border: `1px solid ${ativo ? C.text : C.border}`,
              }}
            >
              {MESES[r.mes - 1]} {r.ano}
            </button>
          );
        })}
      </div>

      {selected && (
        <>
          {/* 1. Resumo do Mês */}
          <div className="rounded-xl p-6 md:p-8" style={{ background: C.text, color: '#fff' }}>
            <div className="flex items-start gap-6 flex-wrap">
              <div className="flex-1 min-w-[260px]">
                <p className="text-xs uppercase tracking-widest mb-2" style={{ color: C.gold }}>
                  {MESES_FULL[selected.mes - 1]} {selected.ano}
                </p>
                <p className="text-lg md:text-xl font-bold mb-3 text-white">
                  {ri.headline_metrica || '—'}
                </p>
                <p className="text-sm md:text-base mb-4 leading-relaxed" style={{ opacity: 0.85 }}>
                  {ri.resumo_executivo || ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ri.grande_vitoria && (
                    <span className="inline-flex px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: C.green, color: '#fff' }}>
                      ✓ {ri.grande_vitoria}
                    </span>
                  )}
                  {ri.ponto_atencao && (
                    <span className="inline-flex px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: C.yellow, color: '#fff' }}>
                      ⚠ {ri.ponto_atencao}
                    </span>
                  )}
                </div>
              </div>
              {ri.nota_geral != null && (
                <div
                  className="flex items-center justify-center rounded-full font-bold"
                  style={{
                    width: 110, height: 110,
                    border: `4px solid ${C.gold}`,
                    color: C.gold,
                    fontSize: 28,
                    fontFamily: 'Cormorant Garamond, serif',
                  }}
                >
                  {ri.nota_geral}
                </div>
              )}
            </div>
          </div>

          {/* 2. KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Posts publicados', value: fmt(selected.total_posts), accent: C.blue },
              { label: 'Alcance total', value: fmt(selected.alcance_total), accent: C.green },
              { label: 'Engajamento', value: fmt(selected.engajamento_total), accent: C.gold },
              { label: 'Salvamentos', value: fmt(selected.salvamentos), accent: C.bronze },
              { label: 'Compartilhamentos', value: fmt(selected.compartilhamentos), accent: C.blue },
              { label: 'Taxa de engajamento', value: fmtPct(selected.taxa_engajamento), accent: C.green },
            ].map((k, i) => (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{ background: C.card, borderLeft: `3px solid ${k.accent}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
              >
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.textSec }}>{k.label}</p>
                <p className="font-bold" style={{ color: C.text, fontSize: 28, lineHeight: 1.1 }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* 3. Mix de Formatos */}
          <div
            className="rounded-xl p-5 md:p-6"
            style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <h3 className="text-xl mb-4" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
              Mix de Formatos
            </h3>
            <div className="space-y-3">
              {(['reels', 'carrossel', 'imagem'] as const).map((f) => {
                const val = mixAtual[f] || 0;
                const pct = totalMix ? (val / totalMix) * 100 : 0;
                const isMelhor = selected.formato_dominante?.toLowerCase().includes(f);
                return (
                  <div key={f}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="capitalize font-medium" style={{ color: C.text }}>
                        {f} {isMelhor && <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: C.gold, color: C.text }}>⭐ Melhor formato</span>}
                      </span>
                      <span style={{ color: C.textSec }}>{val} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.gold }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {ri.analise_formatos?.justificativa && (
              <p className="text-sm italic mt-4" style={{ color: C.textSec }}>
                {ri.analise_formatos.justificativa}
              </p>
            )}
          </div>

          {/* 4. Métricas comparativas */}
          {Array.isArray(ri.metricas) && ri.metricas.length > 0 && (
            <div
              className="rounded-xl p-5 md:p-6"
              style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
            >
              <h3 className="text-xl mb-4" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
                Métricas Comparativas
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                      <th className="text-left py-2 px-3" style={{ color: C.textSec }}>Métrica</th>
                      <th className="text-right py-2 px-3" style={{ color: C.textSec }}>Este Mês</th>
                      <th className="text-right py-2 px-3" style={{ color: C.textSec }}>Mês Anterior</th>
                      <th className="text-right py-2 px-3" style={{ color: C.textSec }}>Variação</th>
                      <th className="text-center py-2 px-3" style={{ color: C.textSec }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ri.metricas.map((m: any, i: number) => {
                      const v = String(m.variacao || '');
                      const isNeg = v.startsWith('-') || v.startsWith('↓');
                      const sb = statusBadge(m.status);
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td className="py-3 px-3 font-medium" style={{ color: C.text }}>{m.nome}</td>
                          <td className="text-right py-3 px-3" style={{ color: C.text }}>{m.atual}</td>
                          <td className="text-right py-3 px-3" style={{ color: C.textSec }}>{m.anterior}</td>
                          <td className="text-right py-3 px-3 font-semibold">
                            <span className="inline-flex items-center gap-1" style={{ color: isNeg ? C.red : C.green }}>
                              {isNeg ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                              {v.replace(/^[↑↓]/, '')}
                            </span>
                          </td>
                          <td className="text-center py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: sb.bg, color: sb.color }}>
                              {sb.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. Evolução Semanal */}
          {evolucao.length > 0 && (
            <div
              className="rounded-xl p-5 md:p-6"
              style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
            >
              <h3 className="text-xl mb-4" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
                Evolução Semanal
              </h3>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={evolucao}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="semana" tick={{ fill: C.textSec, fontSize: 12 }} />
                    <YAxis tick={{ fill: C.textSec, fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8 }}
                      labelStyle={{ color: C.text, fontWeight: 600 }}
                    />
                    <Bar dataKey="alcance" fill={C.gold} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 6. O que funcionou / melhorar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl p-5" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <h3 className="text-lg mb-4" style={{ color: C.green, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
                ✓ O que Funcionou
              </h3>
              <div className="space-y-3">
                {(ri.o_que_funcionou || []).map((item: any, i: number) => (
                  <div key={i} className="rounded-md p-3" style={{ background: '#fff', borderLeft: `3px solid ${C.green}` }}>
                    <p className="font-bold text-sm mb-1" style={{ color: C.text }}>{item.titulo}</p>
                    <p className="text-sm mb-1" style={{ color: C.text }}><strong>Dado:</strong> {item.dado}</p>
                    <p className="text-xs italic" style={{ color: C.textSec }}>Como replicar: {item.como_replicar}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl p-5" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <h3 className="text-lg mb-4" style={{ color: C.bronze, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
                ⚠ O que Melhorar
              </h3>
              <div className="space-y-3">
                {(ri.o_que_melhorar || []).map((item: any, i: number) => (
                  <div key={i} className="rounded-md p-3" style={{ background: '#fff', borderLeft: `3px solid ${C.gold}` }}>
                    <p className="font-bold text-sm mb-1" style={{ color: C.text }}>{item.titulo}</p>
                    <p className="text-sm mb-1" style={{ color: C.text }}><strong>Dado:</strong> {item.dado}</p>
                    <p className="text-xs italic" style={{ color: C.textSec }}>Correção: {item.correcao}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 7. Recomendações Próximo Mês */}
          {Array.isArray(ri.recomendacoes_proximo_mes) && ri.recomendacoes_proximo_mes.length > 0 && (
            <div
              className="rounded-xl p-5 md:p-6"
              style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
            >
              <h3 className="text-xl mb-4" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
                Recomendações Próximo Mês
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                      <th className="text-left py-2 px-3" style={{ color: C.textSec }}>Ação</th>
                      <th className="text-left py-2 px-3" style={{ color: C.textSec }}>Motivo</th>
                      <th className="text-center py-2 px-3" style={{ color: C.textSec }}>Impacto</th>
                      <th className="text-center py-2 px-3" style={{ color: C.textSec }}>Esforço</th>
                      <th className="text-center py-2 px-3" style={{ color: C.textSec }}>Prioridade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ri.recomendacoes_proximo_mes.map((r: any, i: number) => {
                      const pb = prioBadge(r.prioridade);
                      const ib = impactoBadge(r.impacto);
                      const eb = esforcoBadge(r.esforco);
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td className="py-3 px-3 font-medium" style={{ color: C.text }}>{r.acao}</td>
                          <td className="py-3 px-3" style={{ color: C.textSec }}>{r.motivo}</td>
                          <td className="text-center py-3 px-3"><span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ background: ib.bg, color: ib.color }}>{r.impacto}</span></td>
                          <td className="text-center py-3 px-3"><span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ background: eb.bg, color: eb.color }}>{r.esforco}</span></td>
                          <td className="text-center py-3 px-3"><span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ background: pb.bg, color: pb.color }}>{r.prioridade}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. Metas próximo mês */}
          {ri.metas_proximo_mes && (
            <div>
              <h3 className="text-xl mb-4" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
                Metas do Próximo Mês
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Posts', key: 'posts' },
                  { label: 'Alcance', key: 'alcance' },
                  { label: 'Engajamento', key: 'engajamento' },
                  { label: 'Taxa Engajamento', key: 'taxa_engajamento' },
                ].map((m) => (
                  <div key={m.key} className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <p className="text-xs uppercase tracking-wider mb-1" style={{ color: C.textSec }}>{m.label}</p>
                    <p className="font-bold" style={{ color: C.text, fontSize: 22 }}>
                      {ri.metas_proximo_mes[m.key] ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
              {ri.metas_proximo_mes.justificativa && (
                <p className="text-sm italic mt-3" style={{ color: C.textSec }}>
                  {ri.metas_proximo_mes.justificativa}
                </p>
              )}
            </div>
          )}

          {/* 9. Foco próximo mês */}
          {Array.isArray(ri.foco_proximo_mes) && ri.foco_proximo_mes.length > 0 && (
            <div>
              <h3 className="text-xl mb-4" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
                Foco do Próximo Mês
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ri.foco_proximo_mes.map((foco: string, i: number) => (
                  <div
                    key={i}
                    className="rounded-xl p-5"
                    style={{ background: C.card, borderTop: `3px solid ${C.gold}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                  >
                    <div className="font-bold mb-2" style={{ color: C.gold, fontSize: 32, lineHeight: 1, fontFamily: 'Cormorant Garamond, serif' }}>
                      {i + 1}
                    </div>
                    <p className="text-sm font-bold" style={{ color: C.text }}>{foco}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selected.gerado_em && (
            <p className="text-xs text-right" style={{ color: C.textSec }}>
              Gerado em {new Date(selected.gerado_em).toLocaleString('pt-BR')}
            </p>
          )}
        </>
      )}

      {Modal}
    </div>
  );
}
