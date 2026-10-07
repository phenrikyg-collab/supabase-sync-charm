import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { chamarRpc } from "@/lib/supabaseRpc";
import { cn } from "@/lib/utils";

export type ConversaAoVivo = {
  id: string | number;
  cliente_nome?: string | null;
  telefone?: string | null;
  ao_vivo?: boolean | null;
  ao_vivo_motivo?: string | null;
  ao_vivo_seg_espera?: number | null;
  ao_vivo_desde?: number | null;
  site_agora?: string | null;
};

/** Momento (ms) em que a espera começou: última entrada da cliente ou, sem ela, a espera informada pela view. */
export function inicioEspera(c: any, agora = Date.now()): number | null {
  const ultima = c.ultima_entrada ?? c.ultima_entrada_em;
  if (ultima) {
    const t = new Date(ultima).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (c.ao_vivo_seg_espera != null) return agora - Number(c.ao_vivo_seg_espera) * 1000;
  return null;
}

function useAgora() {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

export function Cronometro({ desde }: { desde?: number | null }) {
  const agora = useAgora();
  if (desde == null) return null;
  const seg = Math.max(0, Math.floor((agora - desde) / 1000));
  const cor = seg < 120 ? "text-success" : seg <= 180 ? "text-warning" : "text-danger";
  const mm = Math.floor(seg / 60);
  const ss = String(seg % 60).padStart(2, "0");
  return <span className={cn("shrink-0 font-medium tabular-nums", cor)}>esperando {mm}:{ss}</span>;
}

export function PontoAoVivo({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-2 w-2 shrink-0", className)} title="Online agora">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
    </span>
  );
}

export function FaixaAoVivo({ conversas, onAbrir, nomeDe }: {
  conversas: ConversaAoVivo[];
  onAbrir: (c: any) => void;
  nomeDe: (c: any) => string;
}) {
  if (conversas.length === 0) return null;
  return (
    <div className="shrink-0 border-b border-border bg-success/5 px-2 py-1.5">
      <p className="px-1 pb-1 text-[11px] font-bold tracking-wide text-success">🟢 AO VIVO ({conversas.length})</p>
      <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
        {conversas.map((c) => (
          <button
            key={String(c.id)}
            type="button"
            onClick={() => onAbrir(c)}
            className="flex w-full min-w-0 flex-col rounded px-1.5 py-1 text-left hover:bg-accent/60"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-[12px]">
              <PontoAoVivo />
              <span className="min-w-0 flex-1 truncate font-semibold">{nomeDe(c)}</span>
              <span className="text-[11px]"><Cronometro desde={c.ao_vivo_desde} /></span>
            </span>
            <span className="block min-w-0 truncate pl-3.5 text-[11px] text-muted-foreground">
              {c.ao_vivo_motivo ?? ""}
              {c.site_agora ? ` · vendo: ${c.site_agora}` : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- som ---------------- */

const CHAVE_SOM = "atendimento-ao-vivo-som";

export function lerSomAtivo(): boolean {
  try {
    return localStorage.getItem(CHAVE_SOM) !== "off";
  } catch {
    return true;
  }
}

export function tocarDing() {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    ganho.gain.setValueAtTime(0.0001, ctx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.connect(ganho).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
    osc.onended = () => void ctx.close();
  } catch {
    /* sem áudio disponível */
  }
}

export function BotaoSomAoVivo({ ativo, onChange }: { ativo: boolean; onChange: (v: boolean) => void }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-7 w-7 shrink-0"
      aria-label={ativo ? "Silenciar som de cliente ao vivo" : "Ligar som de cliente ao vivo"}
      title={ativo ? "Silenciar som de cliente ao vivo" : "Ligar som de cliente ao vivo"}
      onClick={() => {
        const novo = !ativo;
        try {
          localStorage.setItem(CHAVE_SOM, novo ? "on" : "off");
        } catch {
          /* segue sem guardar */
        }
        onChange(novo);
      }}
    >
      {ativo ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
    </Button>
  );
}

/** Avisa (toast + som) quando uma conversa passa a ficar ao vivo e não é a aberta. */
export function useAvisoAoVivo(opts: {
  conversas: ConversaAoVivo[];
  carregado: boolean;
  selecionada: string | null;
  desativado: boolean;
  somAtivo: boolean;
  nomeDe: (c: any) => string;
  onAbrir: (c: any) => void;
}) {
  const avisadasRef = useRef<Set<string> | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!opts.carregado) return;
    const aoVivo = opts.conversas.filter((c) => c.ao_vivo);
    const idsAtuais = new Set(aoVivo.map((c) => String(c.id)));
    // primeiro carregamento: só registra, sem avisar
    if (avisadasRef.current === null) {
      avisadasRef.current = idsAtuais;
      return;
    }
    const avisadas = avisadasRef.current;
    for (const id of Array.from(avisadas)) if (!idsAtuais.has(id)) avisadas.delete(id);
    const { desativado, selecionada, somAtivo, nomeDe, onAbrir } = optsRef.current;
    for (const c of aoVivo) {
      const id = String(c.id);
      if (avisadas.has(id)) continue;
      avisadas.add(id);
      if (desativado || id === String(selecionada ?? "")) continue;
      if (somAtivo) tocarDing();
      const t = toast({
        duration: 20000,
        title: `🟢 ${nomeDe(c)} está online te esperando`,
        description: <Cronometro desde={c.ao_vivo_desde} />,
        action: (
          <ToastAction altText="Abrir conversa" onClick={() => { onAbrir(c); t.dismiss(); }}>
            Abrir
          </ToastAction>
        ),
      });
    }
  }, [opts.conversas, opts.carregado]);
}

/* ---------------- tempo de resposta ---------------- */

type TempoResposta = {
  respostas?: number | null;
  mediana_min?: number | null;
  ate_3min_pct?: number | null;
  ao_vivo_respostas?: number | null;
  ao_vivo_mediana_min?: number | null;
  ao_vivo_ate_3min_pct?: number | null;
  meta_min?: number | null;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (v: unknown) => num(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function IndicadorTempoResposta() {
  const { data } = useQuery({
    queryKey: ["whatsapp-tempo-resposta-hoje"],
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_tempo_resposta_hoje");
      if (error) throw error;
      const d = Array.isArray(data) ? data[0] : data;
      return (d ?? {}) as TempoResposta;
    },
  });
  if (!data) return null;
  if (!num(data.respostas)) {
    return <span className="truncate text-[11px] text-muted-foreground">Resposta hoje: sem dados</span>;
  }
  const mediana = num(data.mediana_min);
  const cor = mediana <= 3 ? "text-success" : mediana <= 10 ? "text-warning" : "text-danger";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("min-w-0 cursor-default truncate text-[11px] font-medium", cor)}>
            Resposta hoje: {fmt(mediana)} min · {fmt(data.ate_3min_pct)}% até 3 min
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {num(data.ao_vivo_respostas)
            ? `Clientes ao vivo: mediana ${fmt(data.ao_vivo_mediana_min)} min, ${fmt(data.ao_vivo_ate_3min_pct)}% até 3 min, meta ${fmt(data.meta_min ?? 3)} min`
            : `Clientes ao vivo: sem respostas hoje, meta ${fmt(data.meta_min ?? 3)} min`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
