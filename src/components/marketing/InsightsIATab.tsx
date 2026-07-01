import { useState } from 'react';
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
  blue: '#4A90D9',
  gray: '#9E9E9E',
};

interface Metric {
  nome: string;
  atual: number | string;
  anterior: number | string;
  variacao: string;
  status: 'on_track' | 'at_risk' | 'off_track';
}

interface Relatorio {
  periodo?: string;
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

const statusBadge = (s: string) => {
  if (s === 'on_track') return { bg: C.green + '22', color: C.green, label: '✓ No alvo' };
  if (s === 'at_risk') return { bg: C.yellow + '22', color: C.yellow, label: '⚠ Em risco' };
  return { bg: C.red + '22', color: C.red, label: '✗ Fora do alvo' };
};

const prioBadge = (p: string) => {
  const low = (p || '').toLowerCase();
  if (low.includes('imediat')) return { bg: C.red, color: '#fff' };
  if (low.includes('essa semana') || low.includes('esta semana')) return { bg: C.gold, color: C.text };
  if (low.includes('próxima') || low.includes('proxima')) return { bg: C.gray, color: '#fff' };
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

export default function InsightsIATab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [geradoEm, setGeradoEm] = useState<string>('');

  const gerarRelatorio = async () => {
    setLoading(true);
    try {
      const data = await invokeEdgeFunction('gerar-insights-semanal', {}, { timeoutMs: 180_000 });
      const rel: Relatorio = data?.relatorio || data;
      if (!rel || !rel.metricas) throw new Error('Resposta inválida da função');
      setRelatorio(rel);
      setGeradoEm(new Date().toLocaleString('pt-BR'));
    } catch (err: any) {
      toast({ title: 'Erro ao gerar relatório', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!relatorio) {
    return (
      <div
        className="rounded-xl p-12 text-center"
        style={{ background: C.bg, border: `1px solid ${C.border}` }}
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
        <p className="text-sm mb-6" style={{ color: C.textSec, fontFamily: 'DM Sans, sans-serif' }}>
          Clique para gerar o relatório semanal com IA
        </p>
        <button
          onClick={gerarRelatorio}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition disabled:opacity-60"
          style={{ background: C.text, color: C.gold, fontFamily: 'DM Sans, sans-serif' }}
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? 'Analisando sua semana…' : '✨ Gerar Relatório Semanal'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs" style={{ color: C.textSec }}>
          Gerado em <strong>{geradoEm}</strong>
        </p>
        <button
          onClick={gerarRelatorio}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition disabled:opacity-60"
          style={{ background: C.text, color: C.gold }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Atualizando…' : '↺ Atualizar Relatório'}
        </button>
      </div>

      {/* 1. Resumo Executivo */}
      <div className="rounded-xl p-6 md:p-8" style={{ background: C.text, color: '#fff' }}>
        {relatorio.periodo && (
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: C.gold }}>
            {relatorio.periodo}
          </p>
        )}
        <p className="text-xl md:text-2xl font-bold mb-4 leading-tight text-white">
          {relatorio.headline_metrica}
        </p>
        <p className="text-sm md:text-base mb-5 leading-relaxed" style={{ opacity: 0.85 }}>
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
        className="rounded-xl p-5 md:p-6"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        <h3 className="text-xl mb-4" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
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
                const sb = statusBadge(m.status);
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
                        style={{ background: sb.bg, color: sb.color }}
                      >
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

      {/* 3 + 4 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div
          className="rounded-xl p-5"
          style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <h3 className="text-lg mb-4 flex items-center gap-2" style={{ color: C.green, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
            ✓ O que Funcionou
          </h3>
          <div className="space-y-3">
            {relatorio.o_que_funcionou.map((item, i) => (
              <div key={i} className="rounded-md p-3" style={{ background: '#fff', borderLeft: `3px solid ${C.green}` }}>
                <p className="font-bold text-sm mb-1" style={{ color: C.text }}>{item.titulo}</p>
                <p className="text-sm mb-2" style={{ color: C.text }}><strong>Dado:</strong> {item.dado}</p>
                <p className="text-xs italic" style={{ color: C.textSec }}>Como replicar: {item.como_replicar}</p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-xl p-5"
          style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <h3 className="text-lg mb-4 flex items-center gap-2" style={{ color: C.bronze, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
            ⚠ O que Melhorar
          </h3>
          <div className="space-y-3">
            {relatorio.o_que_melhorar.map((item, i) => (
              <div key={i} className="rounded-md p-3" style={{ background: '#fff', borderLeft: `3px solid ${C.gold}` }}>
                <p className="font-bold text-sm mb-1" style={{ color: C.text }}>{item.titulo}</p>
                <p className="text-sm mb-2" style={{ color: C.text }}><strong>Dado:</strong> {item.dado}</p>
                <p className="text-xs italic" style={{ color: C.textSec }}>Correção: {item.correcao}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Recomendações */}
      <div
        className="rounded-xl p-5 md:p-6"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        <h3 className="text-xl mb-4" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
          Recomendações Prioritárias
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
                const pb = prioBadge(r.prioridade);
                const ib = impactoBadge(r.impacto);
                const eb = esforcoBadge(r.esforco);
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td className="py-3 px-3 font-medium" style={{ color: C.text }}>{r.acao}</td>
                    <td className="py-3 px-3" style={{ color: C.textSec }}>{r.motivo}</td>
                    <td className="text-center py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ background: ib.bg, color: ib.color }}>{r.impacto}</span>
                    </td>
                    <td className="text-center py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ background: eb.bg, color: eb.color }}>{r.esforco}</span>
                    </td>
                    <td className="text-center py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ background: pb.bg, color: pb.color }}>{r.prioridade}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Foco */}
      <div>
        <h3 className="text-xl mb-4" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
          Foco da Próxima Semana
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {relatorio.foco_proxima_semana.map((foco, i) => (
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
    </div>
  );
}
