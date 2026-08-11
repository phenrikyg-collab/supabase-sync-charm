import { ReactNode, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ImageOff, Loader2 } from 'lucide-react';

// ===== Paleta (identidade atual) =====
export const C = {
  bg: '#FAF8F3',
  card: '#FFFFFF',
  text: '#1D1D1B',
  textSec: '#6B6B69',
  gold: '#E8CD7E',
  bronze: '#8B6914',
  border: '#E8E6E0',
  green: '#2D7A4F',
  red: '#C0392B',
  yellow: '#B8860B',
  blue: '#4A90D9',
  tabBg: '#F0EDE6',
  grey: '#9A9A97',
};

export const SERIF = 'Cormorant Garamond, serif';
export const SANS = 'DM Sans, sans-serif';

export const fmtInt = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : Math.round(n).toLocaleString('pt-BR');
export const fmtNum = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtPct = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined ? '—' : `${Number(n).toFixed(d)}%`;
export const fmtCompact = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.round(n).toLocaleString('pt-BR');
};

export const media = (arr: (number | null | undefined)[]) => {
  const v = arr.filter((x): x is number => x !== null && x !== undefined && !Number.isNaN(x));
  if (!v.length) return null;
  return v.reduce((s, x) => s + x, 0) / v.length;
};
export const mediana = (arr: (number | null | undefined)[]) => {
  const v = arr.filter((x): x is number => x !== null && x !== undefined && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// ===== Período compartilhado via query param =====
export const PERIODOS = [7, 14, 30, 60, 90];

export function useDias(): [number, (d: number) => void] {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get('dias'));
  const dias = PERIODOS.includes(raw) ? raw : 30;
  const set = (d: number) => {
    const next = new URLSearchParams(params);
    next.set('dias', String(d));
    setParams(next, { replace: true });
  };
  return [dias, set];
}

export const dataInicioISO = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().split('T')[0];
};

// ===== Blocos visuais =====
export function Card({ children, className = '', accent }: { children: ReactNode; className?: string; accent?: string }) {
  return (
    <div
      className={`rounded-lg p-5 md:p-6 ${className}`}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderLeft: accent ? `3px solid ${accent}` : `1px solid ${C.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl md:text-2xl" style={{ color: C.text, fontFamily: SERIF, fontWeight: 600 }}>
        {children}
      </h2>
      {subtitle && <p className="text-sm mt-1" style={{ color: C.textSec, fontFamily: SANS }}>{subtitle}</p>}
    </div>
  );
}

export function KpiCard({ label, value, sub, accent = C.bronze, change }: {
  label: string; value: ReactNode; sub?: string; accent?: string; change?: number | null;
}) {
  return (
    <div className="rounded-lg p-4" style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}` }}>
      <p className="text-[11px] uppercase tracking-wider" style={{ color: C.textSec, fontFamily: SANS }}>{label}</p>
      <p className="text-2xl mt-1" style={{ color: C.text, fontFamily: SERIF, fontWeight: 700 }}>{value}</p>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {change !== null && change !== undefined && Number.isFinite(change) && (
          <span className="text-xs font-semibold" style={{ color: change >= 0 ? C.green : C.red }}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-xs" style={{ color: C.textSec }}>{sub}</span>}
      </div>
    </div>
  );
}

export function BlocoLoading({ altura = 120 }: { altura?: number }) {
  return (
    <div className="flex items-center justify-center rounded-lg" style={{ height: altura, background: C.tabBg }}>
      <Loader2 className="animate-spin" size={20} style={{ color: C.bronze }} />
    </div>
  );
}

export function SemDado({ texto = 'sem dado no período' }: { texto?: string }) {
  return (
    <div className="text-center py-8 rounded-lg text-sm" style={{ background: C.tabBg, color: C.textSec, border: `1px dashed ${C.border}` }}>
      {texto}
    </div>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] leading-relaxed mt-1" style={{ color: C.grey, fontFamily: SANS }}>
      {children}
    </p>
  );
}

// ===== Semáforo =====
export type Status = 'saudavel' | 'atencao' | 'critico' | 'sem_dado' | null;

export const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  saudavel: { label: 'Saudável', bg: '#E8F5EE', fg: C.green },
  atencao: { label: 'Atenção', bg: '#FFF4D6', fg: C.yellow },
  critico: { label: 'Crítico', bg: '#FBEAE5', fg: C.red },
  sem_dado: { label: 'sem dado no período', bg: '#F0EDE6', fg: C.grey },
};

export function StatusChip({ status, prefixo }: { status: Status; prefixo?: string }) {
  if (!status) return null;
  const m = STATUS_META[status] ?? STATUS_META.sem_dado;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium whitespace-nowrap"
      style={{ background: m.bg, color: m.fg }}>
      {prefixo && <span className="opacity-70">{prefixo}</span>}
      {m.label}
    </span>
  );
}

// ===== Barra divergente centrada em 1.00 =====
export function BarraDivergente({ indice }: { indice: number | null }) {
  if (indice === null || indice === undefined) return <span className="text-xs" style={{ color: C.grey }}>—</span>;
  const delta = indice - 1;
  const largura = Math.min(Math.abs(delta), 1) * 50; // % de metade da barra
  const positivo = delta >= 0;
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="relative flex-1 h-3 rounded" style={{ background: C.tabBg }}>
        <div className="absolute top-0 bottom-0" style={{ left: '50%', width: 1, background: C.border }} />
        <div
          className="absolute top-0 bottom-0 rounded"
          style={{
            background: positivo ? C.green : C.red,
            left: positivo ? '50%' : `${50 - largura}%`,
            width: `${largura}%`,
          }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color: positivo ? C.green : C.red, minWidth: 38 }}>
        {indice.toFixed(2)}
      </span>
    </div>
  );
}

// ===== Imagem com fallback (CDN da Meta expira) =====
export function ImgSafe({ src, alt, className = '', style }: { src?: string | null; alt?: string; className?: string; style?: React.CSSProperties }) {
  const [erro, setErro] = useState(false);
  if (!src || erro) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ background: C.tabBg, ...style }}>
        <ImageOff size={22} style={{ color: C.grey }} />
      </div>
    );
  }
  return <img src={src} alt={alt || ''} loading="lazy" onError={() => setErro(true)} className={className} style={style} />;
}

export function AlertaConfianca() {
  return (
    <span title="Classificação de baixa confiança (legenda curta ou ambígua)">
      <AlertTriangle size={13} style={{ color: C.yellow }} />
    </span>
  );
}

// ===== Layout com abas + pills de período =====
const ABAS = [
  { to: '/marketing-analytics', label: 'Análise do Perfil', end: true },
  { to: '/marketing-analytics/reels', label: 'Reels' },
  { to: '/marketing-analytics/carrossel', label: 'Carrossel' },
  { to: '/marketing-analytics/stories', label: 'Stories' },
  { to: '/marketing-analytics/insights', label: 'Insights IA' },
  { to: '/marketing-analytics/relatorios', label: 'Relatórios Mensais' },
  { to: '/marketing-analytics/recomendacoes', label: 'Recomendações' },
];

export function MALayout({ titulo, subtitulo, children, semPeriodo }: {
  titulo: string; subtitulo?: string; children: ReactNode; semPeriodo?: boolean;
}) {
  const [dias, setDias] = useDias();
  const [params] = useSearchParams();
  const qs = `?dias=${PERIODOS.includes(Number(params.get('dias'))) ? params.get('dias') : 30}`;

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <div className="border-b" style={{ background: C.card, borderColor: C.border }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl" style={{ color: C.text, fontFamily: SERIF, fontWeight: 600 }}>{titulo}</h1>
              {subtitulo && <p className="text-sm mt-1" style={{ color: C.textSec, fontFamily: SANS }}>{subtitulo}</p>}
            </div>
            {!semPeriodo && (
              <div className="flex flex-wrap gap-2">
                {PERIODOS.map(p => (
                  <button
                    key={p}
                    onClick={() => setDias(p)}
                    className="px-3.5 py-1.5 text-sm rounded-full transition"
                    style={{
                      background: dias === p ? C.text : 'transparent',
                      color: dias === p ? C.gold : C.textSec,
                      border: `1px solid ${dias === p ? C.text : C.border}`,
                      fontFamily: SANS,
                    }}
                  >
                    {p} dias
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="inline-flex gap-1 p-1 rounded-lg mt-5 overflow-x-auto max-w-full" style={{ background: C.tabBg }}>
            {ABAS.map(a => (
              <NavLink
                key={a.to}
                to={a.to + qs}
                end={a.end}
                className="px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition"
                style={({ isActive }) => ({
                  background: isActive ? C.text : 'transparent',
                  color: isActive ? C.gold : C.textSec,
                  fontFamily: SANS,
                })}
              >
                {a.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">{children}</div>
    </div>
  );
}
