import { useEffect, useRef, useState } from 'react';
import { Sparkles, RefreshCw, ArrowUp, ArrowDown, CheckCircle2, AlertTriangle, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PlanoSemanaBlock from './PlanoSemanaBlock';
import ResultadoConta, { ContaResumo, ResultadoDaConta } from './ResultadoConta';
import CategorizacaoBlock, { AnaliseCategorias, CategoriasRaw } from './CategorizacaoBlock';

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

interface MudancaItem {
  item: string;
  dado?: string;
  hipotese?: string;
}

interface OQueMudou {
  melhorou?: MudancaItem[];
  piorou?: MudancaItem[];
  ausencias_impactantes?: string | string[];
  recomendacao?: string;
}

interface FormatoInfo {
  quantidade?: number | string;
  performance?: string;
  top_gancho?: string;
  melhor_tema?: string;
}

interface AnaliseFormatos {
  reels?: FormatoInfo;
  carrossel?: FormatoInfo;
  imagem?: FormatoInfo;
  recomendacao_mix?: string;
}

interface Relatorio {
  periodo?: string;
  resumo_executivo: string;
  headline_metrica: string;
  grande_vitoria: string;
  ponto_atencao: string;
  metricas: Metric[];
  o_que_mudou_essa_semana?: OQueMudou;
  analise_formatos?: AnaliseFormatos;
  o_que_funcionou: { titulo: string; dado: string; como_replicar: string }[];
  o_que_melhorar: { titulo: string; dado: string; correcao: string }[];
  recomendacoes: { acao: string; motivo: string; impacto: string; esforco: string; prioridade: string }[];
  foco_proxima_semana: string[];
  resultado_da_conta?: ResultadoDaConta;
  analise_categorias?: AnaliseCategorias;
  confiabilidade_dos_dados?: string | string[];
  observacao_do_ciclo?: string | null;
}

interface DadosRaw {
  conta_atual?: ContaResumo | null;
  conta_anterior?: ContaResumo | null;
  categorias_atual?: CategoriasRaw | null;
  categorias_anterior?: CategoriasRaw | null;
}

const statusBadge = (s: string) => {
  const t = String(s ?? '').toLowerCase();
  if (t.includes('critic') || t.includes('off_track') || t.includes('fora'))
    return { bg: C.red + '22', color: C.red, label: '✗ Crítico' };
  if (t.includes('atenc') || t.includes('atenç') || t.includes('at_risk') || t.includes('risco'))
    return { bg: C.yellow + '22', color: C.yellow, label: '⚠ Atenção' };
  if (t.includes('on_track') || t.includes('saud') || t.includes('alvo') || t.includes('ok'))
    return { bg: C.green + '22', color: C.green, label: '✓ No alvo' };
  return { bg: C.border, color: C.textSec, label: s || '—' };
};

// O nome importa: existe alcance dos posts e alcance da conta.
const nomeMetrica = (nome: string) => {
  const n = String(nome).trim().toLowerCase();
  if (n === 'alcance') return 'Alcance dos posts';
  if (n === 'visualizacoes' || n === 'visualizações' || n === 'views') return 'Visualizações dos posts';
  return nome;
};

const fmtPeriodoSemana = (inicio?: string | null, fim?: string | null) => {
  const dia = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };
  const a = dia(inicio);
  const b = dia(fim);
  if (a && b) return `${a} a ${b}`;
  return a || b || '';
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

// Lê os contadores do backend sem fixar nada no código — muda a cada semana.
const ROTULO_EXCLUIDO: Record<string, [string, string]> = {
  lives: ['live', 'lives'],
  posts_apagados: ['post apagado', 'posts apagados'],
  apagados: ['post apagado', 'posts apagados'],
  anuncios: ['anúncio', 'anúncios'],
};
const descreverExcluidos = (excl: any): string => {
  if (!excl || typeof excl !== 'object') return '';
  const partes = Object.entries(excl)
    .map(([chave, valor]) => {
      const n = Number(valor);
      if (!Number.isFinite(n) || n <= 0) return null;
      const [sing, plur] = ROTULO_EXCLUIDO[chave] ?? [chave.replace(/_/g, ' '), chave.replace(/_/g, ' ')];
      return `${n} ${n === 1 ? sing : plur}`;
    })
    .filter(Boolean) as string[];
  if (!partes.length) return '';
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
};

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const limparJson = (value: any): any => {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') {
    return value
      .replace(/\u0000/g, '')
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
      .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1');
  }
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(limparJson);

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, limparJson(item)])
  );
};

const normalizarRelatorio = (value: any): Relatorio | null => {
  if (!value) return null;
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object') return null;

  return {
    ...parsed,
    metricas: Array.isArray(parsed.metricas) ? parsed.metricas : [],
    o_que_funcionou: Array.isArray(parsed.o_que_funcionou) ? parsed.o_que_funcionou : [],
    o_que_melhorar: Array.isArray(parsed.o_que_melhorar) ? parsed.o_que_melhorar : [],
    recomendacoes: Array.isArray(parsed.recomendacoes) ? parsed.recomendacoes : [],
    foco_proxima_semana: Array.isArray(parsed.foco_proxima_semana) ? parsed.foco_proxima_semana : [],
  } as Relatorio;
};

// O relatório semanal mora em instagram_relatorios_semanais, com chave
// (periodo_inicio, periodo_fim) — instagram_relatorios_mensais é só do mensal.
const TABELA = 'instagram_relatorios_semanais';
const COLUNAS =
  'id, periodo_inicio, periodo_fim, gerado_em, dados_coletados_em, relatorio_ia, dados_raw, total_posts, alcance_total, engajamento_total, salvamentos, compartilhamentos, taxa_engajamento, formato_dominante, status, erro, iniciado_em';


interface SemanaRow {
  id: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  gerado_em: string | null;
  dados_coletados_em?: string | null;
  relatorio_ia: any;
  dados_raw: any;
}

/** A janela vem pronta do backend (domingo a sábado) — nunca recalcular no front. */
const janelaDoRelatorio = (rel: any, row?: any, payload?: any) => {
  const j = rel?.janela ?? {};
  return {
    inicio: j?.inicio ?? row?.periodo_inicio ?? payload?.periodo_inicio ?? null,
    fim: j?.fim ?? row?.periodo_fim ?? payload?.periodo_fim ?? null,
    tipo: rel?.tipo_de_semana ?? null,
  };
};

export default function InsightsIATab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [geradoEm, setGeradoEm] = useState<string>('');
  const [ciclo, setCiclo] = useState(0);
  const [dadosRaw, setDadosRaw] = useState<DadosRaw | null>(null);
  const [periodoSemana, setPeriodoSemana] = useState('');
  const [tipoSemana, setTipoSemana] = useState<string | null>(null);
  const [coletadoEm, setColetadoEm] = useState<string>('');
  const [coleta, setColeta] = useState<any>(null);
  const [excluidos, setExcluidos] = useState<any>(null);
  const [semanas, setSemanas] = useState<SemanaRow[]>([]);
  const [semanaSel, setSemanaSel] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroGeracao, setErroGeracao] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limiteRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const aplicarLinha = (row: any) => {
    const rel = normalizarRelatorio(row?.relatorio_ia);
    if (!rel) return false;
    const janela = janelaDoRelatorio(rel, row);
    setRelatorio(rel);
    setGeradoEm(fmtDateTime(row?.gerado_em));
    setDadosRaw((row?.dados_raw ?? null) as DadosRaw | null);
    setPeriodoSemana(fmtPeriodoSemana(janela.inicio, janela.fim));
    setTipoSemana(janela.tipo);
    setColetadoEm(fmtDateTime((rel as any)?.dados_coletados_em ?? row?.dados_coletados_em));
    setColeta((rel as any)?.coleta ?? null);
    setExcluidos((rel as any)?.excluidos_das_somas ?? null);
    setSemanaSel(row?.id ?? null);
    return true;
  };

  const carregarSemanas = async (selecionarId?: string) => {
    const { data } = await (supabase as any)
      .from(TABELA)
      .select(COLUNAS)
      .order('periodo_inicio', { ascending: false, nullsFirst: false })
      .order('gerado_em', { ascending: false, nullsFirst: false })
      .limit(30);
    const rows = ((data ?? []) as SemanaRow[]).filter(
      (r: any) => (!r.status || r.status === 'pronto') && r.relatorio_ia,
    );
    setSemanas(rows);

    const alvo = (selecionarId && rows.find((r) => r.id === selecionarId)) || rows[0];
    if (alvo) aplicarLinha(alvo);
    return rows;
  };

  useEffect(() => {
    (async () => {
      try {
        await carregarSemanas();
      } catch {
        // sem relatório salvo — mostra o botão
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const selecionarSemana = (id: string) => {
    const row = semanas.find((r) => r.id === id);
    if (row) {
      aplicarLinha(row);
      setCiclo((c) => c + 1);
    }
  };

  const salvarRelatorio = async (rel: Relatorio, payload: any) => {
    const geradoEmISO = new Date().toISOString();
    const janela = janelaDoRelatorio(rel, null, payload);
    const registro: any = {
      periodo_inicio: janela.inicio,
      periodo_fim: janela.fim,
      relatorio_ia: limparJson(rel),
      dados_raw: limparJson(payload?.dados_raw ?? payload?.dados ?? null),
      total_posts: payload?.total_posts ?? null,
      alcance_total: payload?.alcance_total ?? null,
      engajamento_total: payload?.engajamento_total ?? null,
      salvamentos: payload?.salvamentos ?? null,
      compartilhamentos: payload?.compartilhamentos ?? null,
      taxa_engajamento: payload?.taxa_engajamento ?? null,
      dados_coletados_em: (rel as any)?.dados_coletados_em ?? null,
      gerado_em: geradoEmISO,
    };
    Object.keys(registro).forEach((k) => registro[k] === null && delete registro[k]);

    const { data, error } = await (supabase as any)
      .from(TABELA)
      .insert(registro)
      .select(COLUNAS)
      .single();

    if (!error) return data;

    // A chave é (periodo_inicio, periodo_fim): regerar a mesma semana atualiza,
    // sem apagar as semanas anteriores do histórico.
    const { data: existente } = await (supabase as any)
      .from(TABELA)
      .select('id')
      .eq('periodo_inicio', janela.inicio)
      .eq('periodo_fim', janela.fim)
      .order('gerado_em', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!existente?.id) throw error;

    const { data: atualizado, error: updateError } = await (supabase as any)
      .from(TABELA)
      .update(registro)
      .eq('id', existente.id)
      .select(COLUNAS)
      .single();

    if (updateError) throw updateError;
    return atualizado;
  };

  // A função responde 202 na hora e faz o trabalho depois. A tela acompanha o
  // andamento lendo a linha do período em instagram_relatorios_semanais.
  const pararPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (limiteRef.current) {
      clearTimeout(limiteRef.current);
      limiteRef.current = null;
    }
  };

  useEffect(() => pararPolling, []);

  const acompanhar = (periodoInicio: string, periodoFim: string) => {
    pararPolling();
    setGerando(true);
    setErroGeracao('');

    const checar = async () => {
      const { data } = await (supabase as any)
        .from(TABELA)
        .select(COLUNAS)
        .eq('periodo_inicio', periodoInicio)
        .eq('periodo_fim', periodoFim)
        .maybeSingle();

      if (!data) return;

      if (data.status === 'erro') {
        pararPolling();
        setGerando(false);
        setErroGeracao(data.erro || 'A geração falhou. Tente de novo.');
        return;
      }

      if (data.status === 'pronto' || (!data.status && data.relatorio_ia)) {
        if (aplicarLinha(data)) {
          pararPolling();
          setGerando(false);
          setCiclo((c) => c + 1);
          await carregarSemanas(data.id);
        }
      }
    };

    pollRef.current = setInterval(() => {
      void checar();
    }, 5000);

    limiteRef.current = setTimeout(() => {
      pararPolling();
      setGerando(false);
      setErroGeracao('Demorou mais que o esperado, tente de novo.');
    }, 5 * 60 * 1000);
  };

  const gerarRelatorio = async () => {
    setLoading(true);
    setErroGeracao('');
    try {
      const { data, error } = await supabase.functions.invoke('gerar-insights-semanal', { body: {} });
      if (error) throw error;

      const inicio = data?.periodo_inicio;
      const fim = data?.periodo_fim;
      if (!inicio || !fim) throw new Error('Resposta inválida da função');

      acompanhar(inicio, fim);
      if (data?.ja_em_andamento) {
        toast({ title: 'Já estava gerando', description: 'Acompanhando a geração em andamento.' });
      }
    } catch (err: any) {
      setErroGeracao(err?.message || 'Não foi possível iniciar a geração.');
      toast({ title: 'Erro ao gerar relatório', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };


  if (carregando) {
    return (
      <div className="rounded-xl p-12 text-center" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
        <RefreshCw size={20} className="animate-spin inline-block" style={{ color: C.bronze }} />
      </div>
    );
  }

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
          {gerando
            ? 'Gerando o relatório, leva cerca de 2 minutos'
            : 'Clique para gerar o relatório semanal com IA'}
        </p>
        {erroGeracao && (
          <p className="text-sm mb-4 flex items-center justify-center gap-2" style={{ color: C.red }}>
            <AlertTriangle size={14} /> {erroGeracao}
          </p>
        )}
        <button
          onClick={gerarRelatorio}
          disabled={loading || gerando}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition disabled:opacity-60"
          style={{ background: C.text, color: C.gold, fontFamily: 'DM Sans, sans-serif' }}
        >
          {loading || gerando ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {gerando
            ? 'Gerando o relatório…'
            : loading
              ? 'Iniciando…'
              : erroGeracao
                ? '✨ Tentar de novo'
                : '✨ Gerar Relatório Semanal'}
        </button>
      </div>
    );
  }


  return (
    <div className="space-y-6 relatorio-content relatorio-print" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Cabeçalho apenas para impressão */}
      <div className="print-header" style={{ display: 'none' }}>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600 }}>
          Mariana Cardoso — Relatório Semanal de Performance
        </h1>
        <p style={{ fontSize: 12 }}>Gerado em {geradoEm}</p>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs px-3 py-1.5 rounded-full"
            style={{ background: C.gold + '33', color: C.bronze, fontWeight: 600 }}
          >
            Gerado em {geradoEm}
          </span>
          {coletadoEm && (
            <span
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: C.border, color: C.textSec, fontWeight: 600 }}
              title="Momento em que os números foram lidos da Meta. O texto do relatório é uma foto desse instante."
            >
              Dados coletados em {coletadoEm}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition"
            style={{ background: 'transparent', color: C.text, border: `1px solid ${C.border}` }}
          >
            <Printer size={14} /> Imprimir
          </button>
          <button
            onClick={gerarRelatorio}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition disabled:opacity-60"
            style={{ background: 'transparent', color: C.bronze, border: `1px solid ${C.bronze}` }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Atualizando…' : 'Regenerar'}
          </button>
        </div>
      </div>

      {coleta && coleta.sincronizou_antes_de_gerar === false && coleta.detalhe && (
        <p className="text-xs flex items-start gap-1.5 no-print" style={{ color: C.bronze }}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {coleta.detalhe}
        </p>
      )}

      {/* Seletor de semanas — histórico por (periodo_inicio, periodo_fim) */}
      {semanas.length > 1 && (
        <div className="flex flex-wrap gap-2 no-print">
          {semanas.map((s) => {
            const ativo = s.id === semanaSel;
            const jan = janelaDoRelatorio(s.relatorio_ia, s);
            return (
              <button
                key={s.id}
                onClick={() => selecionarSemana(s.id)}
                className="px-3 py-1.5 rounded-full text-xs transition"
                style={{
                  background: ativo ? C.text : '#fff',
                  color: ativo ? C.gold : C.text,
                  border: `1px solid ${ativo ? C.text : C.border}`,
                }}
              >
                {fmtPeriodoSemana(jan.inicio, jan.fim) || '—'}
              </button>
            );
          })}
        </div>
      )}

      {/* 1. Resumo Executivo */}
      <div className="rounded-xl p-6 md:p-8" style={{ background: C.text, color: '#fff' }}>
        {(periodoSemana || relatorio.periodo) && (
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: C.gold }}>
            Semana de {periodoSemana || relatorio.periodo}
            {tipoSemana ? ` (${tipoSemana === 'domingo a sabado' ? 'domingo a sábado' : tipoSemana})` : ''}
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

      {/* 2. Resultado da conta */}
      <ResultadoConta
        atual={dadosRaw?.conta_atual}
        anterior={dadosRaw?.conta_anterior}
        analise={relatorio.resultado_da_conta}
        periodo={periodoSemana}
      />

      {/* 3. Métricas dos posts */}
      <div
        className="rounded-xl p-5 md:p-6"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        <h3 className="text-xl mb-4" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
          Métricas dos posts na semana
        </h3>
        {descreverExcluidos(excluidos) && (
          <p className="text-xs mb-3" style={{ color: C.textSec }}>
            {descreverExcluidos(excluidos)} ficaram fora das somas.
          </p>
        )}
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
              {(relatorio.metricas ?? []).map((m, i) => {
                const v = String(m.variacao);
                const isNeg = v.startsWith('-') || v.startsWith('↓');
                const varColor = isNeg ? C.red : C.green;
                const sb = statusBadge(m.status);
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td className="py-3 px-3 font-medium" style={{ color: C.text }}>{nomeMetrica(m.nome)}</td>
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
                        title={String(m.status ?? '')}
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

      {/* 4. Categorização */}
      <CategorizacaoBlock categorias={dadosRaw?.categorias_atual} analise={relatorio.analise_categorias} />

      {/* 5. Plano da semana — o que vamos fazer diferente */}
      <PlanoSemanaBlock
        ciclo={ciclo}
        avaliacaoFallback={{
          cumprimento_do_plano: (relatorio as any).cumprimento_do_plano ?? [],
          observacao_do_ciclo: relatorio.observacao_do_ciclo ?? null,
        }}
      />

      {/* 6. O que mudou essa semana */}
      {relatorio.o_que_mudou_essa_semana && (
        <div
          className="rounded-xl p-5 md:p-6"
          style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <h3 className="text-xl mb-4" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
            O que mudou essa semana?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(relatorio.o_que_mudou_essa_semana.melhorou ?? []).map((m, i) => (
              <div key={`up-${i}`} className="rounded-lg p-4" style={{ background: C.green + '14', borderLeft: `3px solid ${C.green}` }}>
                <p className="text-sm font-bold mb-1 flex items-center gap-1" style={{ color: C.green }}>
                  <ArrowUp size={14} /> {m.item}
                </p>
                {m.dado && <p className="text-sm mb-1" style={{ color: C.text }}><strong>Dado:</strong> {m.dado}</p>}
                {m.hipotese && <p className="text-xs italic" style={{ color: C.textSec }}>Hipótese: {m.hipotese}</p>}
              </div>
            ))}
            {(relatorio.o_que_mudou_essa_semana.piorou ?? []).map((m, i) => (
              <div key={`down-${i}`} className="rounded-lg p-4" style={{ background: C.red + '14', borderLeft: `3px solid ${C.red}` }}>
                <p className="text-sm font-bold mb-1 flex items-center gap-1" style={{ color: C.red }}>
                  <ArrowDown size={14} /> {m.item}
                </p>
                {m.dado && <p className="text-sm mb-1" style={{ color: C.text }}><strong>Dado:</strong> {m.dado}</p>}
                {m.hipotese && <p className="text-xs italic" style={{ color: C.textSec }}>Hipótese: {m.hipotese}</p>}
              </div>
            ))}
          </div>
          {relatorio.o_que_mudou_essa_semana.ausencias_impactantes && (
            <div className="rounded-lg p-4 mt-4" style={{ background: C.yellow + '18', borderLeft: `3px solid ${C.yellow}` }}>
              <p className="text-sm font-bold mb-1" style={{ color: C.bronze }}>⚠ Ausências impactantes</p>
              <p className="text-sm" style={{ color: C.text }}>
                {Array.isArray(relatorio.o_que_mudou_essa_semana.ausencias_impactantes)
                  ? relatorio.o_que_mudou_essa_semana.ausencias_impactantes.join(' · ')
                  : relatorio.o_que_mudou_essa_semana.ausencias_impactantes}
              </p>
            </div>
          )}
          {relatorio.o_que_mudou_essa_semana.recomendacao && (
            <div className="rounded-lg p-4 mt-3" style={{ background: C.blue + '14', borderLeft: `3px solid ${C.blue}` }}>
              <p className="text-sm font-bold mb-1" style={{ color: C.blue }}>💡 Recomendação</p>
              <p className="text-sm" style={{ color: C.text }}>{relatorio.o_que_mudou_essa_semana.recomendacao}</p>
            </div>
          )}
        </div>
      )}

      {/* 2.2 Análise por Formato */}
      {relatorio.analise_formatos && (
        <div
          className="rounded-xl p-5 md:p-6"
          style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <h3 className="text-xl mb-4" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
            Análise por Formato
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              { key: 'reels', label: 'REELS', extraLabel: 'Top gancho', extraKey: 'top_gancho' },
              { key: 'carrossel', label: 'CARROSSEL', extraLabel: 'Melhor tema', extraKey: 'melhor_tema' },
              { key: 'imagem', label: 'IMAGEM', extraLabel: '', extraKey: '' },
            ] as const).map(({ key, label, extraLabel, extraKey }) => {
              const f = (relatorio.analise_formatos as any)?.[key] as FormatoInfo | undefined;
              if (!f) return null;
              const extra = extraKey ? (f as any)[extraKey] : null;
              return (
                <div key={key} className="rounded-lg p-4" style={{ background: '#fff', borderTop: `3px solid ${C.gold}`, border: `1px solid ${C.border}` }}>
                  <p className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: C.bronze }}>{label}</p>
                  <p className="font-bold mb-1" style={{ color: C.text, fontSize: 26, fontFamily: 'Cormorant Garamond, serif', lineHeight: 1 }}>
                    {f.quantidade ?? '—'}
                  </p>
                  <p className="text-xs mb-2" style={{ color: C.textSec }}>posts publicados</p>
                  {f.performance && <p className="text-sm mb-2" style={{ color: C.text }}>{f.performance}</p>}
                  {extra && <p className="text-xs italic" style={{ color: C.textSec }}>{extraLabel}: {extra}</p>}
                </div>
              );
            })}
          </div>
          {relatorio.analise_formatos.recomendacao_mix && (
            <div className="rounded-lg p-4 mt-4" style={{ background: C.blue + '14', borderLeft: `3px solid ${C.blue}` }}>
              <p className="text-sm font-bold mb-1" style={{ color: C.blue }}>Mix recomendado para a próxima semana</p>
              <p className="text-sm" style={{ color: C.text }}>{relatorio.analise_formatos.recomendacao_mix}</p>
            </div>
          )}
        </div>
      )}


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
            {(relatorio.o_que_funcionou ?? []).map((item, i) => (
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
            {(relatorio.o_que_melhorar ?? []).map((item, i) => (
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
              {(relatorio.recomendacoes ?? []).map((r, i) => {
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
          {(relatorio.foco_proxima_semana ?? []).map((foco, i) => (
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

      {/* Confiabilidade dos dados — rodapé discreto */}
      {relatorio.confiabilidade_dos_dados && (
        <p className="text-xs leading-relaxed" style={{ color: C.textSec }}>
          <strong style={{ color: C.text }}>Confiabilidade dos dados:</strong>{' '}
          {Array.isArray(relatorio.confiabilidade_dos_dados)
            ? relatorio.confiabilidade_dos_dados.join(' ')
            : relatorio.confiabilidade_dos_dados}
        </p>
      )}
    </div>
  );
}
