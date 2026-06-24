import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, ArrowUp, ArrowDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
};

interface Metric {
  nome: string;
  atual: number | string;
  anterior: number | string;
  variacao: string;
  status: 'on_track' | 'at_risk' | 'off_track';
}

interface Relatorio {
  resumo_executivo: string;
  headline_metrica: string;
  grande_vitoria: string;
  ponto_atencao: string;
  metricas: Metric[];
  o_que_funcionou: { titulo: string; dado: string; como_replicar: string }[];
  o_que_melhorar: { titulo: string; dado: string; correcao: string }[];
  recomendacoes: { acao: string; motivo: string; impacto: string; esforco: string; prioridade: string }[];
  foco_proxima_semana: string[];
}

interface Agg {
  total_posts: number;
  alcance_total: number;
  engajamento_total: number;
  salvamentos: number;
  compartilhamentos: number;
  taxa_engajamento: number;
  formato_dominante: string;
  melhor_post_caption: string;
}

const aggregate = (rows: any[]): Agg => {
  const total_posts = rows.length;
  const alcance_total = rows.reduce((s, p) => s + (p.reach || 0), 0);
  const engajamento_total = rows.reduce(
    (s, p) => s + (p.like_count || 0) + (p.comments_count || 0) + (p.shares || 0) + (p.saves || 0),
    0
  );
  const salvamentos = rows.reduce((s, p) => s + (p.saves || 0), 0);
  const compartilhamentos = rows.reduce((s, p) => s + (p.shares || 0), 0);
  const taxas = rows
    .filter((p) => (p.reach || 0) > 0)
    .map((p) => ((p.engagement || 0) / p.reach) * 100);
  const taxa_engajamento = taxas.length ? taxas.reduce((a, b) => a + b, 0) / taxas.length : 0;
  const formatos: Record<string, number> = {};
  rows.forEach((p) => {
    if (p.media_type) formatos[p.media_type] = (formatos[p.media_type] || 0) + 1;
  });
  const formato_dominante =
    Object.entries(formatos).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const melhor = rows.slice().sort((a, b) => (b.engagement || 0) - (a.engagement || 0))[0];
  return {
    total_posts,
    alcance_total,
    engajamento_total,
    salvamentos,
    compartilhamentos,
    taxa_engajamento,
    formato_dominante,
    melhor_post_caption: melhor?.caption?.substring(0, 200) || '',
  };
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const statusColor = (s: string) =>
  s === 'on_track' ? C.green : s === 'at_risk' ? C.yellow : C.red;

const prioBadge = (p: string) => {
  const low = (p || '').toLowerCase();
  if (low.includes('imediat')) return { bg: C.red, color: '#fff' };
  if (low.includes('próxima') || low.includes('proxima')) return { bg: C.yellow, color: '#fff' };
  return { bg: C.border, color: C.text };
};

export default function InsightsIATab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [geradoEm, setGeradoEm] = useState<string>('');
  const [periodoAtual, setPeriodoAtual] = useState('');
  const [periodoAnterior, setPeriodoAnterior] = useState('');
  const [dadosAtual, setDadosAtual] = useState<Agg | null>(null);
  const [dadosAnterior, setDadosAnterior] = useState<Agg | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const now = new Date();
    const d7 = new Date(); d7.setDate(d7.getDate() - 7);
    const d14 = new Date(); d14.setDate(d14.getDate() - 14);
    setPeriodoAtual(`${fmtDate(d7)} – ${fmtDate(now)}`);
    setPeriodoAnterior(`${fmtDate(d14)} – ${fmtDate(d7)}`);

    const [{ data: atualRows }, { data: antRows }] = await Promise.all([
      (supabase as any)
        .from('instagram_posts')
        .select('reach, saves, shares, engagement, like_count, comments_count, media_type, caption, data_publicacao')
        .gte('data_publicacao', d7.toISOString())
        .limit(500),
      (supabase as any)
        .from('instagram_posts')
        .select('reach, saves, shares, engagement, like_count, comments_count, media_type, caption, data_publicacao')
        .gte('data_publicacao', d14.toISOString())
        .lt('data_publicacao', d7.toISOString())
        .limit(500),
    ]);
    setDadosAtual(aggregate(atualRows || []));
    setDadosAnterior(aggregate(antRows || []));
  };

  const gerarRelatorio = async () => {
    if (!dadosAtual || !dadosAnterior) {
      toast({ title: 'Aguarde', description: 'Carregando dados…' });
      return;
    }
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      toast({
        title: 'API Key ausente',
        description: 'Defina VITE_ANTHROPIC_API_KEY no ambiente.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const prompt = `Você é especialista em marketing digital para e-commerce de moda feminina.

Analise a performance do Instagram da Use Mariana Cardoso nos últimos 7 dias e gere um relatório executivo seguindo esta estrutura:

DADOS DA SEMANA ATUAL (${periodoAtual}):
- Posts publicados: ${dadosAtual.total_posts}
- Alcance total: ${dadosAtual.alcance_total}
- Engajamento total: ${dadosAtual.engajamento_total}
- Salvamentos: ${dadosAtual.salvamentos}
- Compartilhamentos: ${dadosAtual.compartilhamentos}
- Taxa de engajamento média: ${dadosAtual.taxa_engajamento.toFixed(2)}%
- Formato dominante: ${dadosAtual.formato_dominante}
- Melhor post: "${dadosAtual.melhor_post_caption}"

DADOS DA SEMANA ANTERIOR (${periodoAnterior}):
- Posts publicados: ${dadosAnterior.total_posts}
- Alcance total: ${dadosAnterior.alcance_total}
- Engajamento total: ${dadosAnterior.engajamento_total}
- Salvamentos: ${dadosAnterior.salvamentos}
- Taxa de engajamento média: ${dadosAnterior.taxa_engajamento.toFixed(2)}%

META DE MIX DE CONTEÚDO: 70% lifestyle · 20% educacional · 10% produto

Gere o relatório em JSON com esta estrutura exata:
{
  "resumo_executivo": "2-3 frases sobre o desempenho geral",
  "headline_metrica": "a métrica mais importante da semana com variação",
  "grande_vitoria": "o maior ponto positivo com dado específico",
  "ponto_atencao": "o maior risco ou oportunidade perdida",
  "metricas": [
    {"nome": "Alcance", "atual": 0, "anterior": 0, "variacao": "0%", "status": "on_track"},
    {"nome": "Engajamento", "atual": 0, "anterior": 0, "variacao": "0%", "status": "at_risk"},
    {"nome": "Salvamentos", "atual": 0, "anterior": 0, "variacao": "0%", "status": "off_track"},
    {"nome": "Compartilhamentos", "atual": 0, "anterior": 0, "variacao": "0%", "status": "on_track"},
    {"nome": "Taxa Engajamento", "atual": "0%", "anterior": "0%", "variacao": "0%", "status": "on_track"},
    {"nome": "Posts publicados", "atual": 0, "anterior": 0, "variacao": "0%", "status": "on_track"}
  ],
  "o_que_funcionou": [
    {"titulo": "ponto positivo", "dado": "dado específico", "como_replicar": "ação concreta"}
  ],
  "o_que_melhorar": [
    {"titulo": "ponto negativo", "dado": "dado específico", "correcao": "ação corretiva"}
  ],
  "recomendacoes": [
    {"acao": "o que fazer", "motivo": "por quê", "impacto": "alto", "esforco": "baixo", "prioridade": "imediato"}
  ],
  "foco_proxima_semana": ["prioridade 1", "prioridade 2", "prioridade 3"]
}

Retorne APENAS o JSON, sem markdown ou texto adicional.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API ${response.status}: ${text.slice(0, 200)}`);
      }
      const json = await response.json();
      const raw = json?.content?.[0]?.text || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Resposta sem JSON válido');
      const parsed: Relatorio = JSON.parse(match[0]);
      setRelatorio(parsed);
      setGeradoEm(new Date().toLocaleString('pt-BR'));
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar relatório',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ===== Placeholder =====
  if (!relatorio) {
    return (
      <div
        className="rounded-lg p-12 text-center"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ background: C.gold + '33', color: C.bronze }}
        >
          <Sparkles size={28} />
        </div>
        <h2
          className="text-2xl mb-2"
          style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}
        >
          Relatório Semanal de Performance
        </h2>
        <p
          className="text-sm mb-6 max-w-md mx-auto"
          style={{ color: C.textSec, fontFamily: 'DM Sans, sans-serif' }}
        >
          Gere uma análise executiva dos últimos 7 dias do Instagram com IA, comparando
          com a semana anterior e sugerindo prioridades.
        </p>
        {periodoAtual && (
          <p className="text-xs mb-4" style={{ color: C.textSec }}>
            Período: <strong>{periodoAtual}</strong> vs <strong>{periodoAnterior}</strong>
            {dadosAtual && ` · ${dadosAtual.total_posts} posts analisados`}
          </p>
        )}
        <button
          onClick={gerarRelatorio}
          disabled={loading || !dadosAtual}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          style={{ background: C.text, color: C.gold, fontFamily: 'DM Sans, sans-serif' }}
        >
          {loading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {loading ? 'Gerando relatório…' : '✨ Gerar Relatório Semanal'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header com data e refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs" style={{ color: C.textSec }}>
          Gerado em <strong>{geradoEm}</strong> · Período {periodoAtual}
        </p>
        <button
          onClick={gerarRelatorio}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
          style={{ background: C.text, color: C.gold }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Atualizando…' : '↺ Atualizar Relatório'}
        </button>
      </div>

      {/* 1. Resumo Executivo */}
      <div
        className="rounded-lg p-6 md:p-8"
        style={{ background: C.text, color: '#fff' }}
      >
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: C.gold }}>
          Resumo Executivo
        </p>
        <p
          className="text-2xl md:text-3xl mb-4 leading-tight"
          style={{ color: C.gold, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}
        >
          {relatorio.headline_metrica}
        </p>
        <p className="text-sm md:text-base mb-5 leading-relaxed opacity-90">
          {relatorio.resumo_executivo}
        </p>
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: C.green, color: '#fff' }}
          >
            <CheckCircle2 size={14} /> {relatorio.grande_vitoria}
          </span>
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: C.yellow, color: '#fff' }}
          >
            <AlertTriangle size={14} /> {relatorio.ponto_atencao}
          </span>
        </div>
      </div>

      {/* 2. Métricas */}
      <div
        className="rounded-lg p-5 md:p-6"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <h3
          className="text-xl mb-4"
          style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}
        >
          Métricas da Semana
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                <th className="text-left py-2 px-3" style={{ color: C.textSec }}>Métrica</th>
                <th className="text-right py-2 px-3" style={{ color: C.textSec }}>Esta Semana</th>
                <th className="text-right py-2 px-3" style={{ color: C.textSec }}>Semana Anterior</th>
                <th className="text-right py-2 px-3" style={{ color: C.textSec }}>Variação</th>
                <th className="text-center py-2 px-3" style={{ color: C.textSec }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.metricas.map((m, i) => {
                const v = String(m.variacao);
                const isNeg = v.startsWith('-') || v.startsWith('↓');
                const varColor = isNeg ? C.red : C.green;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td className="py-3 px-3 font-medium" style={{ color: C.text }}>{m.nome}</td>
                    <td className="text-right py-3 px-3" style={{ color: C.text }}>{m.atual}</td>
                    <td className="text-right py-3 px-3" style={{ color: C.textSec }}>{m.anterior}</td>
                    <td className="text-right py-3 px-3 font-semibold">
                      <span className="inline-flex items-center gap-1" style={{ color: varColor }}>
                        {isNeg ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                        {v.replace(/^[↑↓]/, '')}
                      </span>
                    </td>
                    <td className="text-center py-3 px-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: statusColor(m.status) + '22', color: statusColor(m.status) }}
                      >
                        {m.status === 'on_track' ? 'No alvo' : m.status === 'at_risk' ? 'Atenção' : 'Crítico'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3 + 4 lado a lado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* O que funcionou */}
        <div
          className="rounded-lg p-5"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <h3
            className="text-lg mb-4 flex items-center gap-2"
            style={{ color: C.green, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}
          >
            <CheckCircle2 size={18} /> O Que Funcionou
          </h3>
          <div className="space-y-3">
            {relatorio.o_que_funcionou.map((item, i) => (
              <div
                key={i}
                className="rounded-md p-3"
                style={{ background: C.green + '11', borderLeft: `3px solid ${C.green}` }}
              >
                <p className="font-bold text-sm mb-1" style={{ color: C.text }}>
                  ✓ {item.titulo}
                </p>
                <p className="text-sm mb-2" style={{ color: C.text }}>{item.dado}</p>
                <p className="text-xs italic" style={{ color: C.textSec }}>
                  Como replicar: {item.como_replicar}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* O que melhorar */}
        <div
          className="rounded-lg p-5"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <h3
            className="text-lg mb-4 flex items-center gap-2"
            style={{ color: C.yellow, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}
          >
            <AlertTriangle size={18} /> O Que Melhorar
          </h3>
          <div className="space-y-3">
            {relatorio.o_que_melhorar.map((item, i) => (
              <div
                key={i}
                className="rounded-md p-3"
                style={{ background: C.yellow + '15', borderLeft: `3px solid ${C.yellow}` }}
              >
                <p className="font-bold text-sm mb-1" style={{ color: C.text }}>
                  ⚠ {item.titulo}
                </p>
                <p className="text-sm mb-2" style={{ color: C.text }}>{item.dado}</p>
                <p className="text-xs italic" style={{ color: C.textSec }}>
                  Correção: {item.correcao}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Recomendações */}
      <div
        className="rounded-lg p-5 md:p-6"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <h3
          className="text-xl mb-4"
          style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}
        >
          Recomendações
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
              {relatorio.recomendacoes.map((r, i) => {
                const badge = prioBadge(r.prioridade);
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td className="py-3 px-3 font-medium" style={{ color: C.text }}>{r.acao}</td>
                    <td className="py-3 px-3" style={{ color: C.textSec }}>{r.motivo}</td>
                    <td className="text-center py-3 px-3 capitalize" style={{ color: C.text }}>{r.impacto}</td>
                    <td className="text-center py-3 px-3 capitalize" style={{ color: C.text }}>{r.esforco}</td>
                    <td className="text-center py-3 px-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {r.prioridade}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Foco da próxima semana */}
      <div>
        <h3
          className="text-xl mb-4"
          style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}
        >
          Foco da Próxima Semana
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {relatorio.foco_proxima_semana.map((foco, i) => (
            <div
              key={i}
              className="rounded-lg p-5"
              style={{ background: C.card, border: `1px solid ${C.border}` }}
            >
              <div
                className="text-4xl font-bold mb-2"
                style={{ color: C.bronze, fontFamily: 'Cormorant Garamond, serif' }}
              >
                {i + 1}
              </div>
              <p className="text-sm font-bold" style={{ color: C.text }}>{foco}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
