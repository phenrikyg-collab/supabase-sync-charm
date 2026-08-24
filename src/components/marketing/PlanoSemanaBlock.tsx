import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, RefreshCw, Check, X, HelpCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  gray: '#9E9E9E',
};

const FORMATOS = ['REELS', 'CAROUSEL_ALBUM', 'IMAGE', 'STORIES'] as const;
const METRICAS = ['alcance', 'engajamento', 'salvamentos', 'comentarios'] as const;

type Status = 'planejado' | 'feito' | 'parcial' | 'nao_feito';

interface Compromisso {
  id?: string;
  texto: string;
  formato?: string | null;
  metrica_alvo?: string | null;
  meta_numero?: number | null;
  origem?: string | null;
  status?: Status;
  observacao?: string | null;
}

interface Sugestao {
  texto: string;
  motivo?: string | null;
  prioridade?: string | null;
  origem?: string | null;
}

interface PlanoSemana {
  semana_inicio?: string | null;
  semana_fim?: string | null;
  existe?: boolean;
  compromissos?: Compromisso[] | null;
  observacoes?: string | null;
  sugestoes_do_relatorio?: Sugestao[] | null;
  avaliacao_ia?: any;
  semana_anterior?: any;
}

const fmtDia = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const STATUS_LABEL: Record<Status, string> = {
  planejado: 'planejado',
  feito: 'feito',
  parcial: 'parcial',
  nao_feito: 'não feito',
};

const vereditoVisual = (veredito?: string | null) => {
  const v = (veredito ?? '').toLowerCase();
  if (v.includes('não') || v.includes('nao')) return { icone: X, cor: C.red, label: veredito || 'não cumprido' };
  if (v.includes('parcial')) return { icone: HelpCircle, cor: C.yellow, label: veredito || 'parcial' };
  if (v.includes('cumprid')) return { icone: Check, cor: C.green, label: veredito || 'cumprido' };
  return { icone: HelpCircle, cor: C.gray, label: veredito || 'sem veredito' };
};

const vazio = (): Compromisso => ({
  texto: '',
  formato: null,
  metrica_alvo: null,
  meta_numero: null,
  origem: 'equipe',
  status: 'planejado',
});

/**
 * Bloco "O que vamos fazer diferente" — plano da semana da equipe.
 * Fecha o ciclo: a equipe registra compromissos e o relatório da semana
 * seguinte confere item a item (avaliacao_ia).
 */
export default function PlanoSemanaBlock({ ciclo = 0 }: { ciclo?: number }) {
  const { toast } = useToast();
  const [plano, setPlano] = useState<PlanoSemana | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [itens, setItens] = useState<Compromisso[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [autor, setAutor] = useState('');

  const carregar = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any).rpc('fn_ig_plano_semana');
      if (error) throw error;
      const p: PlanoSemana = (typeof data === 'string' ? JSON.parse(data) : data) ?? {};
      setPlano(p);
      const lista = Array.isArray(p.compromissos) ? p.compromissos : [];
      setItens(lista.length ? lista.map((c) => ({ ...c, status: (c.status ?? 'planejado') as Status })) : [vazio()]);
      setObservacoes(p.observacoes ?? '');
    } catch (e: any) {
      toast({ title: 'Não foi possível carregar o plano da semana', description: e?.message, variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  }, [toast]);

  useEffect(() => {
    void carregar();
  }, [carregar, ciclo]);

  const atualizar = (idx: number, patch: Partial<Compromisso>) =>
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const adicionarSugestao = (s: Sugestao) =>
    setItens((prev) => {
      const base = prev.filter((p) => p.texto.trim() || p.id);
      return [...base, { ...vazio(), texto: s.texto, origem: 'recomendacao_ia' }];
    });

  const salvar = async () => {
    const payload = itens
      .filter((i) => i.texto.trim())
      .map((i) => ({
        ...(i.id ? { id: i.id } : {}),
        texto: i.texto.trim(),
        formato: i.formato || null,
        metrica_alvo: i.metrica_alvo || null,
        meta_numero: i.meta_numero ?? null,
        origem: i.origem || 'equipe',
        status: i.status || 'planejado',
        observacao: i.observacao || null,
      }));

    if (!payload.length && !observacoes.trim()) {
      toast({
        title: 'Nada para salvar',
        description: 'Escreva ao menos um compromisso ou uma observação.',
        variant: 'destructive',
      });
      return;
    }

    setSalvando(true);
    try {
      const { error } = await (supabase as any).rpc('fn_ig_plano_salvar', {
        p_compromissos: payload,
        p_observacoes: observacoes.trim() || null,
        p_usuario: autor.trim() || null,
      });
      if (error) throw error;
      toast({ title: 'Plano da semana salvo' });
      await carregar();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar o plano', description: e?.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const marcar = async (id: string | undefined, status: Status) => {
    if (!id) return;
    try {
      const { error } = await (supabase as any).rpc('fn_ig_plano_marcar', {
        p_compromisso_id: id,
        p_status: status,
        p_observacao: null,
      });
      if (error) throw error;
      setItens((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    } catch (e: any) {
      toast({ title: 'Erro ao marcar o compromisso', description: e?.message, variant: 'destructive' });
    }
  };

  if (carregando) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
        <RefreshCw size={16} className="animate-spin inline-block" style={{ color: C.bronze }} />
      </div>
    );
  }
  if (!plano) return null;

  const avaliacao = plano.avaliacao_ia ?? null;
  const cumprimento: any[] = Array.isArray(avaliacao?.cumprimento_do_plano)
    ? avaliacao.cumprimento_do_plano
    : Array.isArray(avaliacao?.compromissos)
      ? avaliacao.compromissos
      : [];
  const observacaoCiclo = avaliacao?.observacao_do_ciclo ?? null;
  const sugestoes = (plano.sugestoes_do_relatorio ?? []).filter((s) => s?.texto);

  return (
    <div
      className="rounded-xl p-5 md:p-6 space-y-5"
      style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3
          className="text-xl"
          style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}
        >
          O que vamos fazer diferente
        </h3>
        <span className="text-xs" style={{ color: C.textSec }}>
          semana de {fmtDia(plano.semana_inicio)} a {fmtDia(plano.semana_fim)}
        </span>
      </div>

      {/* Avaliação da IA sobre os compromissos */}
      {cumprimento.length > 0 && (
        <div className="space-y-3">
          {cumprimento.map((c: any, i: number) => {
            const vv = vereditoVisual(c.veredito ?? c.resultado);
            const Icone = vv.icone;
            const porDados = String(c.verificacao ?? '').toLowerCase().includes('dado');
            return (
              <div
                key={c.compromisso_id ?? c.id ?? i}
                className="rounded-lg p-4"
                style={{ background: vv.cor + '10', borderLeft: `3px solid ${vv.cor}` }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: vv.cor }}>
                    <Icone size={14} /> {c.texto ?? c.compromisso ?? '—'}
                  </p>
                  <span className="text-xs" style={{ color: C.textSec }}>
                    {vv.label} · {porDados ? 'pelos dados' : 'só a equipe pode confirmar'}
                  </span>
                </div>
                {c.contradicao && (
                  <p
                    className="text-sm mt-2 rounded-md px-3 py-2 flex items-start gap-1.5"
                    style={{ background: C.red + '18', color: C.red, fontWeight: 600 }}
                  >
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {c.contradicao}
                  </p>
                )}
                {(c.dados || c.evidencia || c.detalhe) && (
                  <p className="text-sm mt-2" style={{ color: C.text }}>
                    {c.dados ?? c.evidencia ?? c.detalhe}
                  </p>
                )}
                {(c.recomendacao ?? c.proximo_passo) && (
                  <p className="text-sm mt-1" style={{ color: C.bronze }}>
                    → {c.recomendacao ?? c.proximo_passo}
                  </p>
                )}
              </div>
            );
          })}
          {observacaoCiclo && (
            <p className="text-sm leading-relaxed rounded-lg p-4" style={{ background: C.bg, color: C.text }}>
              {observacaoCiclo}
            </p>
          )}
        </div>
      )}

      {/* Sugestões do relatório */}
      {sugestoes.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: C.textSec }}>
            Sugestões do relatório <span className="normal-case tracking-normal">(clique para adicionar)</span>
          </p>
          <div className="space-y-1.5">
            {sugestoes.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => adicionarSugestao(s)}
                className="w-full text-left rounded-lg px-3 py-2 flex items-start gap-2 transition hover:opacity-80"
                style={{ background: C.bg, border: `1px solid ${C.border}` }}
              >
                <Plus size={14} className="mt-0.5 shrink-0" style={{ color: C.bronze }} />
                <span className="flex-1 text-sm" style={{ color: C.text }}>
                  {s.texto}
                  {s.motivo && (
                    <span className="block text-xs mt-0.5" style={{ color: C.textSec }}>{s.motivo}</span>
                  )}
                </span>
                {s.prioridade && (
                  <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: C.gold + '44', color: C.bronze }}>
                    {s.prioridade}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Compromissos editáveis */}
      <div>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: C.textSec }}>
          Nossos compromissos
        </p>
        <div className="space-y-2">
          {itens.map((it, idx) => (
            <div key={it.id ?? idx} className="rounded-lg p-3 space-y-2" style={{ border: `1px solid ${C.border}` }}>
              <div className="flex items-start gap-2">
                <select
                  value={it.status ?? 'planejado'}
                  onChange={(e) => {
                    const s = e.target.value as Status;
                    atualizar(idx, { status: s });
                    if (it.id) void marcar(it.id, s);
                  }}
                  className="text-xs rounded-md px-2 py-1.5 bg-transparent"
                  style={{ border: `1px solid ${C.border}`, color: C.text }}
                >
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <input
                  value={it.texto}
                  onChange={(e) => atualizar(idx, { texto: e.target.value })}
                  placeholder="Ex.: Publicar 3 Reels com gancho nos primeiros 3 segundos"
                  className="flex-1 text-sm rounded-md px-3 py-1.5 bg-transparent"
                  style={{ border: `1px solid ${C.border}`, color: C.text }}
                />
                <button
                  type="button"
                  onClick={() => setItens((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : [vazio()]))}
                  aria-label="Remover compromisso"
                  className="p-1.5 rounded-md transition hover:opacity-70"
                  style={{ color: C.gray }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={it.formato ?? ''}
                  onChange={(e) => atualizar(idx, { formato: e.target.value || null })}
                  className="text-xs rounded-md px-2 py-1.5 bg-transparent"
                  style={{ border: `1px solid ${C.border}`, color: C.text }}
                >
                  <option value="">formato (opcional)</option>
                  {FORMATOS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select
                  value={it.metrica_alvo ?? ''}
                  onChange={(e) => atualizar(idx, { metrica_alvo: e.target.value || null })}
                  className="text-xs rounded-md px-2 py-1.5 bg-transparent"
                  style={{ border: `1px solid ${C.border}`, color: C.text }}
                >
                  <option value="">métrica (opcional)</option>
                  {METRICAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                  type="number"
                  min={0}
                  value={it.meta_numero ?? ''}
                  onChange={(e) => atualizar(idx, { meta_numero: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="meta"
                  className="text-xs rounded-md px-2 py-1.5 w-24 bg-transparent"
                  style={{ border: `1px solid ${C.border}`, color: C.text }}
                />
                {it.origem === 'recomendacao_ia' && (
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: C.gold + '33', color: C.bronze }}>
                    sugestão da IA
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItens((prev) => [...prev, vazio()])}
          className="mt-2 inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition"
          style={{ border: `1px dashed ${C.border}`, color: C.bronze }}
        >
          <Plus size={13} /> adicionar compromisso
        </button>
        <p className="text-xs mt-2" style={{ color: C.textSec }}>
          Colocar formato e número deixa a IA conferir sozinha na semana que vem.
        </p>
      </div>

      {/* Observações */}
      <div>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: C.textSec }}>Observações</p>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          placeholder="Contexto da semana, imprevistos, decisões…"
          className="w-full text-sm rounded-md px-3 py-2 bg-transparent"
          style={{ border: `1px solid ${C.border}`, color: C.text }}
        />
      </div>

      <div className="flex items-center justify-end gap-2 flex-wrap">
        <input
          value={autor}
          onChange={(e) => setAutor(e.target.value)}
          placeholder="quem preencheu"
          className="text-xs rounded-md px-3 py-2 bg-transparent"
          style={{ border: `1px solid ${C.border}`, color: C.text }}
        />
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60"
          style={{ background: C.text, color: C.gold }}
        >
          {salvando ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {salvando ? 'Salvando…' : 'Salvar plano'}
        </button>
      </div>
    </div>
  );
}
