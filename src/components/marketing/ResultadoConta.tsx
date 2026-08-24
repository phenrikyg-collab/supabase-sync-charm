import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDown, ArrowUp, Zap } from 'lucide-react';

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

export interface ContaDia {
  dia: string;
  interacoes?: number | null;
  eng_feed?: number | null;
  visitas_perfil?: number | null;
  cliques_bio?: number | null;
  novos_seguidores?: number | null;
}

export interface ContaResumo {
  novos_seguidores?: number | null;
  saldo_seguidores?: number | null;
  seguidores_perdidos?: number | null;
  visitas_perfil?: number | null;
  cliques_bio?: number | null;
  alcance_conta?: number | null;
  views_conta?: number | null;
  contas_engajadas?: number | null;
  interacoes_conta?: number | null;
  interacoes_fora_do_feed?: number | null;
  dias?: ContaDia[] | null;
}

export interface ResultadoDaConta {
  leitura?: string | null;
  motor_fora_do_feed?: string | null;
  acao?: string | null;
}

const fmt = (n?: number | null) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString('pt-BR'));
const fmtDia = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const variacao = (atual?: number | null, anterior?: number | null) => {
  if (atual === null || atual === undefined || !anterior) return null;
  return ((atual - anterior) / anterior) * 100;
};

// "Não", "sem pico", "nenhum" → sem motor externo detectado.
const temPico = (texto?: string | null) => {
  const t = String(texto ?? '').trim().toLowerCase();
  if (!t) return false;
  return !/^(n[ãa]o|nenhum|sem\b|nada)/.test(t);
};

function Linha({ label, atual, anterior }: { label: string; atual?: number | null; anterior?: number | null }) {
  const v = variacao(atual, anterior);
  const pos = (v ?? 0) >= 0;
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span className="text-sm" style={{ color: C.textSec }}>{label}</span>
      <span className="flex items-baseline gap-3">
        <span className="text-lg font-bold tabular-nums" style={{ color: C.text }}>{fmt(atual)}</span>
        {v !== null && (
          <span className="text-xs font-semibold inline-flex items-center gap-0.5 tabular-nums" style={{ color: pos ? C.green : C.red, minWidth: 70, justifyContent: 'flex-end' }}>
            {pos ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {`${pos ? '+' : '−'}${Math.abs(v).toFixed(0)}%`}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Resultado da conta — o que aconteceu com o perfil como destino, independente
 * do alcance dos posts. Vai logo abaixo do resumo porque é a leitura que muda
 * o significado da semana.
 */
export default function ResultadoConta({ atual, anterior, analise, periodo }: {
  atual?: ContaResumo | null;
  anterior?: ContaResumo | null;
  analise?: ResultadoDaConta | null;
  periodo?: string;
}) {
  if (!atual && !analise) return null;
  const a = atual ?? {};
  const ant = anterior ?? {};
  const dias = (a.dias ?? []).map(d => ({
    dia: fmtDia(d.dia),
    interacoes: d.interacoes ?? 0,
    feed: d.eng_feed ?? 0,
  }));
  const pico = temPico(analise?.motor_fora_do_feed);

  return (
    <div className="rounded-xl p-5 md:p-6" style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.bronze}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
        <h3 className="text-xl" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
          Resultado da conta
        </h3>
        {periodo && <span className="text-xs" style={{ color: C.textSec }}>{periodo}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Linha label="Seguidoras novas" atual={a.novos_seguidores} anterior={ant.novos_seguidores} />
          <Linha label="Visitas ao perfil" atual={a.visitas_perfil} anterior={ant.visitas_perfil} />
          <Linha label="Cliques na bio" atual={a.cliques_bio} anterior={ant.cliques_bio} />
          <Linha label="Interações na conta" atual={a.interacoes_conta} anterior={ant.interacoes_conta} />
          <div className="flex flex-wrap gap-4 mt-3 text-xs" style={{ color: C.textSec }}>
            {a.saldo_seguidores != null && <span>saldo líquido <b style={{ color: C.text }}>{fmt(a.saldo_seguidores)}</b></span>}
            {a.seguidores_perdidos != null && <span>perdidas {fmt(a.seguidores_perdidos)}</span>}
            {a.alcance_conta != null && <span>alcance da conta {fmt(a.alcance_conta)}</span>}
          </div>
        </div>

        {dias.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: C.textSec }}>
              Interações por dia — conta × feed próprio
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dias} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                <XAxis dataKey="dia" stroke={C.textSec} fontSize={11} />
                <YAxis stroke={C.textSec} fontSize={11} />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}` }} formatter={(v: any) => Number(v).toLocaleString('pt-BR')} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="interacoes" name="Conta" fill={C.bronze} radius={[3, 3, 0, 0]} />
                <Bar dataKey="feed" name="Feed próprio" fill={C.gold} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {pico && (
        <div className="rounded-lg p-4 mt-5" style={{ background: C.gold + '2E', borderLeft: `3px solid ${C.bronze}` }}>
          <p className="text-sm font-bold flex items-center gap-1.5 mb-1" style={{ color: C.bronze }}>
            <Zap size={15} />
            {a.interacoes_fora_do_feed != null
              ? `${fmt(a.interacoes_fora_do_feed)} interações vieram de fora do feed`
              : 'Motor de interações fora do feed'}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: C.text }}>{analise?.motor_fora_do_feed}</p>
        </div>
      )}

      {analise?.leitura && (
        <p className="text-sm leading-relaxed mt-4" style={{ color: C.text }}>{analise.leitura}</p>
      )}
      {analise?.acao && (
        <div className="rounded-lg p-4 mt-3" style={{ background: C.blue + '14', borderLeft: `3px solid ${C.blue}` }}>
          <p className="text-sm font-bold mb-1" style={{ color: C.blue }}>Ação</p>
          <p className="text-sm leading-relaxed" style={{ color: C.text }}>{analise.acao}</p>
        </div>
      )}
    </div>
  );
}
