import { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';

const C = {
  card: '#FFFFFF',
  bg: '#FAF8F3',
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

export interface PostCategoria {
  dia?: string | null;
  funcao?: string | null;
  pilar?: string | null;
  angulo?: string | null;
  alcance?: number | null;
  engajamento?: number | null;
  legenda?: string | null;
}

export interface CategoriasRaw {
  posts?: PostCategoria[] | null;
  por_funcao?: { funcao: string; posts: number; alcance_medio?: number | null }[] | null;
  por_pilar?: { pilar: string; posts: number; alcance_medio?: number | null }[] | null;
  por_angulo?: { angulo: string; posts: number; alcance_medio?: number | null }[] | null;
  total_posts?: number | null;
  confianca_baixa?: number | null;
  sem_classificacao?: number | null;
}

export interface AnaliseCategorias {
  mix_atual?: string | null;
  vs_meta?: string | null;
  melhor_pilar?: string | null;
  melhor_angulo?: string | null;
  leitura?: string | null;
  ressalva?: string | null;
}

// Meta de mix por função no funil.
const META: Record<string, number> = { Alcance: 40, Relacionamento: 30, Conversao: 30 };
const ORDEM = ['Alcance', 'Relacionamento', 'Conversao'];
const LABEL: Record<string, string> = { Alcance: 'Alcance', Relacionamento: 'Relacionamento', Conversao: 'Conversão' };

const fmt = (n?: number | null) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString('pt-BR'));

export default function CategorizacaoBlock({ categorias, analise }: {
  categorias?: CategoriasRaw | null;
  analise?: AnaliseCategorias | null;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  if (!categorias && !analise) return null;

  const porFuncao = categorias?.por_funcao ?? [];
  const semClass = Number(categorias?.sem_classificacao ?? 0);
  const classificados = porFuncao.reduce((s, f) => s + (f.posts || 0), 0);
  const total = classificados || Number(categorias?.total_posts ?? 0);
  const posts = categorias?.posts ?? [];

  const linhas = ORDEM.map((funcao) => {
    const item = porFuncao.find((f) => String(f.funcao).toLowerCase() === funcao.toLowerCase());
    const qtd = item?.posts ?? 0;
    const pct = total ? (qtd / total) * 100 : 0;
    const meta = META[funcao];
    const desvio = pct - meta;
    const statusCor = Math.abs(desvio) <= 7 ? C.green : C.yellow;
    const statusLabel = Math.abs(desvio) <= 7 ? 'ok' : desvio < 0 ? '⚠ abaixo' : '⚠ acima';
    return { funcao, qtd, pct, meta, statusCor, statusLabel };
  });

  const postsDaFuncao = (funcao: string) =>
    posts.filter((p) => String(p.funcao ?? '').toLowerCase() === funcao.toLowerCase());

  return (
    <div className="rounded-xl p-5 md:p-6" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
        <h3 className="text-xl" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
          Conteúdo por função no funil
        </h3>
        <span className="text-xs" style={{ color: C.textSec }}>meta: 40 / 30 / 30</span>
      </div>

      {semClass > 0 && (
        <div className="rounded-lg p-3 mb-4 flex items-start gap-2" style={{ background: C.red + '14', borderLeft: `3px solid ${C.red}` }}>
          <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: C.red }} />
          <p className="text-sm" style={{ color: C.red, fontWeight: 600 }}>
            {semClass} {semClass === 1 ? 'post ainda sem categoria' : 'posts ainda sem categoria'} — leitura incompleta.
            Os percentuais abaixo consideram só os {total} posts classificados.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {linhas.map((l) => {
          const lista = postsDaFuncao(l.funcao);
          const expandida = aberta === l.funcao;
          return (
            <div key={l.funcao} className="rounded-lg" style={{ border: `1px solid ${C.border}` }}>
              <button
                type="button"
                onClick={() => setAberta(expandida ? null : l.funcao)}
                className="w-full text-left px-3 py-2.5"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: C.text, minWidth: 128 }}>{LABEL[l.funcao]}</span>
                  <span className="text-xs tabular-nums" style={{ color: C.textSec, minWidth: 62 }}>{l.qtd} posts</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: C.text, minWidth: 46 }}>{l.pct.toFixed(0)}%</span>
                  <span className="relative flex-1 h-3 rounded min-w-[120px]" style={{ background: C.bg }}>
                    <span className="absolute top-0 bottom-0 rounded" style={{ width: `${Math.min(l.pct, 100)}%`, background: l.statusCor }} />
                    <span className="absolute top-[-3px] bottom-[-3px]" style={{ left: `${l.meta}%`, width: 2, background: C.text }} title={`meta ${l.meta}%`} />
                  </span>
                  <span className="text-xs" style={{ color: C.textSec, minWidth: 62 }}>meta {l.meta}%</span>
                  <span className="text-xs font-semibold" style={{ color: l.statusCor, minWidth: 66 }}>{l.statusLabel}</span>
                  <ChevronDown size={14} style={{ color: C.gray, transform: expandida ? 'rotate(180deg)' : undefined }} />
                </div>
              </button>
              {expandida && (
                <div className="px-3 pb-3 space-y-1.5">
                  {!lista.length ? (
                    <p className="text-xs" style={{ color: C.gray }}>Nenhum post desta função no período.</p>
                  ) : lista.map((p, i) => (
                    <div key={i} className="rounded-md px-3 py-2 text-xs flex items-start justify-between gap-3" style={{ background: C.bg }}>
                      <span style={{ color: C.text }}>
                        <b>{p.dia}</b>{p.pilar ? ` · ${p.pilar}` : ''}{p.angulo ? ` · ${p.angulo}` : ''}
                        <span className="block mt-0.5" style={{ color: C.textSec }}>{p.legenda}</span>
                      </span>
                      <span className="shrink-0 tabular-nums" style={{ color: C.textSec }}>
                        {fmt(p.alcance)} alcance · {fmt(p.engajamento)} eng.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {analise?.melhor_pilar && (
          <div className="rounded-lg p-3" style={{ background: C.bg }}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: C.textSec }}>Melhor pilar</p>
            <p className="text-sm" style={{ color: C.text }}>{analise.melhor_pilar}</p>
          </div>
        )}
        {analise?.melhor_angulo && (
          <div className="rounded-lg p-3" style={{ background: C.bg }}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: C.textSec }}>Melhor ângulo</p>
            <p className="text-sm" style={{ color: C.text }}>{analise.melhor_angulo}</p>
          </div>
        )}
      </div>

      {analise?.vs_meta && <p className="text-sm leading-relaxed mt-4" style={{ color: C.text }}>{analise.vs_meta}</p>}
      {analise?.leitura && <p className="text-sm leading-relaxed mt-2" style={{ color: C.text }}>{analise.leitura}</p>}

      {(analise?.ressalva || Number(categorias?.confianca_baixa ?? 0) > 0) && (
        <div className="rounded-lg p-3 mt-4 flex items-start gap-2" style={{ background: C.yellow + '18', borderLeft: `3px solid ${C.yellow}` }}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: C.bronze }} />
          <p className="text-sm" style={{ color: C.text }}>
            {analise?.ressalva
              ?? `${categorias?.confianca_baixa} posts classificados com confiança baixa (legenda curta).`}
          </p>
        </div>
      )}
    </div>
  );
}
