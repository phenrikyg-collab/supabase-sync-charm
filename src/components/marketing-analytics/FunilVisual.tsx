import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { UserMinus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Aviso, BlocoLoading, C, Card, SANS, SectionTitle, SemDado, fmtInt, fmtNum } from './shared';

interface FunilRow {
  etapa1_discovery: number | null;
  etapa2_interesse: number | null;
  etapa4_intencao: number | null;
  etapa5_ativacao: number | null;
  etapa6_venda_pedidos: number | null;
  etapa6_venda_receita: number | null;
  etapa7_risco_churn: number | null;
  taxa_alcance_visitas_pct: number | null;
  taxa_visitas_cliques_pct: number | null;
  taxa_alcance_seguidores_pct: number | null;
  taxa_visitantes_venda_pct: number | null;
}

type Saude = 'verde' | 'amarelo' | 'vermelho' | null;

const SAUDE_META: Record<string, { bg: string; fg: string; label: string }> = {
  verde: { bg: '#E8F5EE', fg: C.green, label: 'saudável' },
  amarelo: { bg: '#FFF4D6', fg: C.yellow, label: 'atenção' },
  vermelho: { bg: '#FBEAE5', fg: C.red, label: 'crítico' },
};

function saudePor(valor: number | null | undefined, verm: number, amar: number): Saude {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return null;
  if (valor < verm) return 'vermelho';
  if (valor < amar) return 'amarelo';
  return 'verde';
}

export function larguraFunil(valor: number, valorMax: number, valorMin: number, larguraMax = 100, larguraMin = 20) {
  const logMax = Math.log10(Math.max(valorMax, 1));
  const logMin = Math.log10(Math.max(valorMin, 1));
  const logVal = Math.log10(Math.max(valor, 1));
  if (logMax === logMin) return larguraMax;
  const proporcao = (logVal - logMin) / (logMax - logMin);
  return larguraMin + proporcao * (larguraMax - larguraMin);
}

// gradiente frio (topo) -> quente/saturado (base)
const GRADIENTES = [
  'linear-gradient(135deg, #7FA9D6 0%, #A8C6E6 100%)',
  'linear-gradient(135deg, #86B79C 0%, #B4D3C0 100%)',
  'linear-gradient(135deg, #D9C27A 0%, #E8D9A2 100%)',
  'linear-gradient(135deg, #D19A4E 0%, #E3B978 100%)',
  'linear-gradient(135deg, #B5542F 0%, #D4763F 100%)',
];

function useContador(alvo: number | null, ativo: boolean, dur = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!ativo || alvo === null || alvo === undefined || !Number.isFinite(alvo)) return;
    let raf = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min((t - t0) / dur, 1);
      setV(alvo * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ativo, dur]);
  return v;
}

interface Camada {
  n: number;
  nome: string;
  metrica: string;
  valor: number | null;
  extra?: string | null;
  taxa: number | null;
  taxaLabel?: string;
  saude: Saude;
  dica: string;
}

function CamadaFunil({ c, largura, index, ativo }: { c: Camada; largura: number; index: number; ativo: boolean }) {
  const [aberto, setAberto] = useState(false);
  const contado = useContador(c.valor, ativo);
  const meta = c.saude ? SAUDE_META[c.saude] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={ativo ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: index * 0.1, ease: 'easeOut' }}
      className="flex flex-col items-center w-full"
    >
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.25 }}
        onHoverStart={() => setAberto(true)}
        onHoverEnd={() => setAberto(false)}
        onClick={() => setAberto(a => !a)}
        className="relative cursor-pointer rounded-lg px-4 py-3 text-center select-none"
        style={{
          width: `${largura}%`,
          minWidth: 150,
          background: GRADIENTES[index] ?? GRADIENTES[GRADIENTES.length - 1],
          boxShadow: aberto ? '0 8px 24px rgba(0,0,0,0.18)' : '0 2px 6px rgba(0,0,0,0.08)',
          transition: 'box-shadow 250ms ease',
        }}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#FFFFFF', fontFamily: SANS, opacity: 0.9 }}>
            {c.n}. {c.nome}
          </span>
          <span className="text-lg md:text-xl font-bold tabular-nums" style={{ color: '#FFFFFF', fontFamily: SANS }}>
            {c.valor === null ? '—' : fmtInt(contado)}
          </span>
          <span className="text-[11px]" style={{ color: '#FFFFFF', opacity: 0.85, fontFamily: SANS }}>{c.metrica}</span>
          {c.extra && (
            <span className="text-[11px] font-semibold" style={{ color: '#FFFFFF', opacity: 0.95, fontFamily: SANS }}>{c.extra}</span>
          )}
          {c.taxa !== null && c.taxa !== undefined && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded font-semibold whitespace-nowrap ${c.saude === 'vermelho' ? 'animate-pulse' : ''}`}
              style={{ background: meta?.bg ?? 'rgba(255,255,255,0.25)', color: meta?.fg ?? '#FFFFFF' }}
              title={c.taxaLabel}
            >
              {fmtNum(c.taxa, 1)}%
            </span>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={false}
        animate={{ height: aberto ? 'auto' : 0, opacity: aberto ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        style={{ overflow: 'hidden', width: '100%' }}
      >
        <p className="text-xs text-center mx-auto max-w-2xl px-3 py-2" style={{ color: C.textSec, fontFamily: SANS }}>
          {c.taxaLabel && c.taxa !== null && <b style={{ color: C.text }}>{c.taxaLabel}: {fmtNum(c.taxa, 1)}% · </b>}
          {c.dica}
        </p>
      </motion.div>
    </motion.div>
  );
}

export function FunilVisual() {
  const [row, setRow] = useState<FunilRow | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  useEffect(() => {
    let ativo = true;
    (supabase.from('vw_funil_instagram' as any).select('*') as any).single()
      .then(({ data }: any) => {
        if (!ativo) return;
        setRow((data as FunilRow) || null);
        setLoading(false);
      });
    return () => { ativo = false; };
  }, []);

  const camadas: Camada[] = row ? [
    {
      n: 1, nome: 'Discovery', metrica: 'contas alcançadas', valor: row.etapa1_discovery,
      taxa: null, saude: null,
      dica: 'Reels com gancho forte nos 3s iniciais, formatos virais, collabs — aqui não se vende, se chama atenção.',
    },
    {
      n: 2, nome: 'Interesse', metrica: 'visitas ao perfil', valor: row.etapa2_interesse,
      taxa: row.taxa_alcance_visitas_pct, taxaLabel: 'alcance → visitas',
      saude: saudePor(row.taxa_alcance_visitas_pct, 8, 12),
      dica: 'CTA de "visita o perfil" no final do Reels/vídeo; feed fixado e bio precisam justificar o clique.',
    },
    {
      n: 3, nome: 'Intenção', metrica: 'cliques na bio', valor: row.etapa4_intencao,
      taxa: row.taxa_visitas_cliques_pct, taxaLabel: 'visitas → cliques',
      saude: saudePor(row.taxa_visitas_cliques_pct, 5, 10),
      dica: 'Stories com link direto, destaques de oferta em evidência, CTA claro na bio.',
    },
    {
      n: 4, nome: 'Ativação', metrica: 'novos seguidores', valor: row.etapa5_ativacao,
      taxa: row.taxa_alcance_seguidores_pct, taxaLabel: 'alcance → seguidores',
      saude: saudePor(row.taxa_alcance_seguidores_pct, 1.5, 3),
      dica: 'Bastidores, conteúdo de relacionamento, prova social — o que faz alguém querer continuar sendo impactada.',
    },
    {
      n: 5, nome: 'Venda', metrica: 'pedidos', valor: row.etapa6_venda_pedidos,
      extra: row.etapa6_venda_receita != null
        ? `R$ ${Number(row.etapa6_venda_receita).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
        : null,
      taxa: row.taxa_visitantes_venda_pct, taxaLabel: 'visitantes → venda', saude: null,
      dica: 'DSB, prova social direta, oferta clara com urgência real (nunca artificial).',
    },
  ] : [];

  const valores = camadas.map(c => Math.max(c.valor ?? 0, 1));
  const vMax = Math.max(...valores, 1);
  const vMin = Math.min(...valores, vMax);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4" ref={ref}>
      <Card accent={C.bronze}>
        <SectionTitle subtitle="Do alcance à venda — passe o mouse ou toque em cada camada para ver a dica de conteúdo">
          Funil do Instagram
        </SectionTitle>
        {loading ? <BlocoLoading altura={320} /> : !row ? <SemDado /> : (
          <div className="space-y-2 py-2">
            {camadas.map((c, i) => (
              <CamadaFunil
                key={c.n}
                c={c}
                index={i}
                ativo={inView}
                largura={larguraFunil(Math.max(c.valor ?? 0, 1), vMax, vMin)}
              />
            ))}
            <Aviso>Larguras em escala logarítmica — comparação de ordem de grandeza, não proporção linear.</Aviso>
          </div>
        )}
      </Card>

      <Card accent={C.red}>
        <SectionTitle subtitle="Contexto — não é etapa do funil">Risco de churn</SectionTitle>
        {loading ? <BlocoLoading altura={120} /> : !row ? <SemDado /> : (
          <div className="rounded-lg p-4 text-center" style={{ background: '#FBEAE5' }}>
            <UserMinus size={22} className="mx-auto mb-2" style={{ color: C.red }} />
            <p className="text-3xl font-bold tabular-nums" style={{ color: C.red, fontFamily: SANS }}>
              {fmtInt(row.etapa7_risco_churn)}
            </p>
            <p className="text-xs mt-1" style={{ color: C.textSec, fontFamily: SANS }}>seguidores perdidos no período</p>
          </div>
        )}
      </Card>
    </div>
  );
}
