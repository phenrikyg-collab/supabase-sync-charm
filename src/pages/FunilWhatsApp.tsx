import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2, MoreVertical, RefreshCw, MessageCircle, TrendingDown } from "lucide-react";

type Etapa = "atendimento" | "interesse" | "pagamento_enviado" | "pago" | "perdido";

const ETAPAS: { key: Etapa; label: string }[] = [
  { key: "atendimento", label: "Atendimento" },
  { key: "interesse", label: "Interesse" },
  { key: "pagamento_enviado", label: "Pagamento Enviado" },
  { key: "pago", label: "Pago" },
  { key: "perdido", label: "Perdido" },
];

const ETAPA_STYLE: Record<Etapa, string> = {
  atendimento: "border-t-muted-foreground/40",
  interesse: "border-t-primary/60",
  pagamento_enviado: "border-t-amber-500/70",
  pago: "border-t-emerald-500/70",
  perdido: "border-t-destructive/70",
};

type Atendimento = {
  atendimento_id: number;
  conversa_id: number | null;
  data: string;
  etapa: Etapa | string;
  valor_venda: number | null;
  atendente: string | null;
  perdido_motivo: string | null;
  telefone: string | null;
  nome: string | null;
  canal: string | null;
  conversa_status: string | null;
  atualizado_em: string | null;
};

type Dashboard = {
  periodo?: unknown;
  totais?: {
    atendimentos?: number; interesse?: number; pagamento_enviado?: number;
    pagos?: number; perdidos?: number; valor_total?: number;
  };
  taxas?: {
    atendimento_para_interesse?: number; interesse_para_pagamento?: number;
    pagamento_para_pago?: number; conversao_geral?: number;
  };
  por_dia?: { data: string; atendimentos: number; interesse: number; pagamento_enviado: number; pagos: number; valor: number }[];
};

const brl = (v?: number | null) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (v?: number | null) => `${(Number(v) || 0).toFixed(1)}%`;

const hora = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const hoje = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

const diasAtras = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

const dataCurta = (s: string) => {
  const [, m, d] = (s || "").split("-");
  return m && d ? `${d}/${m}` : s;
};

export default function FunilWhatsApp() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-heading">Funil WhatsApp</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhe o atendimento do dia e a conversão do canal.
        </p>
      </div>

      <Tabs defaultValue="funil">
        <TabsList>
          <TabsTrigger value="funil">Funil do dia</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>
        <TabsContent value="funil" className="mt-4">
          <FunilDoDia />
        </TabsContent>
        <TabsContent value="dashboard" className="mt-4">
          <DashboardFunil />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------- Kanban ---------------------------------- */

function FunilDoDia() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const atendente = useMemo(
    () => (user?.user_metadata?.nome as string) || user?.email || "Painel",
    [user],
  );

  const [data, setData] = useState<string>(hoje());
  const [itens, setItens] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [modal, setModal] = useState<{ item: Atendimento; etapa: Etapa } | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data: rows, error } = await supabase.rpc("funil_atendimentos_lista", {
      p_inicio: data,
      p_fim: data,
      p_canal: "whatsapp",
    });
    if (error) {
      if (!silencioso) toast.error("Erro ao carregar funil: " + error.message);
    } else {
      setItens(((rows as unknown) as Atendimento[]) || []);
    }
    setLoading(false);
  }, [data]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const t = setInterval(() => carregar(true), 30000);
    return () => clearInterval(t);
  }, [carregar]);

  const setEtapa = useCallback(
    async (item: Atendimento, etapa: Etapa, extras?: { valor?: number; motivo?: string }) => {
      const anterior = itens;
      setItens((prev) =>
        prev.map((i) => (i.atendimento_id === item.atendimento_id
          ? { ...i, etapa, valor_venda: extras?.valor ?? i.valor_venda, perdido_motivo: extras?.motivo ?? i.perdido_motivo, atendente }
          : i)),
      );
      const params: Record<string, unknown> = {
        p_atendimento_id: item.atendimento_id,
        p_etapa: etapa,
        p_atendente: atendente,
      };
      if (extras?.valor !== undefined) params.p_valor = extras.valor;
      if (extras?.motivo) params.p_motivo = extras.motivo;

      const { error } = await supabase.rpc("funil_set_etapa", params as never);
      if (error) {
        setItens(anterior);
        toast.error("Não foi possível mover: " + error.message);
      } else {
        toast.success("Etapa atualizada");
        carregar(true);
      }
    },
    [itens, atendente, carregar],
  );

  const mover = (item: Atendimento, etapa: Etapa) => {
    if (item.etapa === etapa) return;
    if (etapa === "pago" || etapa === "perdido") {
      setModal({ item, etapa });
      return;
    }
    setEtapa(item, etapa);
  };

  const porEtapa = (etapa: Etapa) => itens.filter((i) => i.etapa === etapa);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="data-funil">Data</Label>
          <Input
            id="data-funil"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value || hoje())}
            className="w-44"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => carregar()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Atualizar
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          {itens.length} atendimento(s)
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2">
          {ETAPAS.map(({ key, label }) => {
            const cards = porEtapa(key);
            return (
              <div
                key={key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const item = itens.find((i) => i.atendimento_id === arrastando);
                  setArrastando(null);
                  if (item) mover(item, key);
                }}
                className={cn(
                  "rounded-lg border border-t-4 bg-muted/30 p-2 min-h-[220px] space-y-2",
                  ETAPA_STYLE[key],
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-medium">{label}</span>
                  <Badge variant="secondary">{cards.length}</Badge>
                </div>
                {cards.map((item) => (
                  <CardAtendimento
                    key={item.atendimento_id}
                    item={item}
                    onDragStart={() => setArrastando(item.atendimento_id)}
                    onMover={(etapa) => mover(item, etapa)}
                    onAbrir={() => {
                      if (item.conversa_id) navigate(`/atendimento?conversa=${item.conversa_id}`);
                    }}
                  />
                ))}
                {cards.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1 py-6 text-center">Vazio</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ModalEtapa
        modal={modal}
        onClose={() => setModal(null)}
        onConfirm={(extras) => {
          if (modal) setEtapa(modal.item, modal.etapa, extras);
          setModal(null);
        }}
      />
    </div>
  );
}

function CardAtendimento({
  item, onDragStart, onMover, onAbrir,
}: {
  item: Atendimento;
  onDragStart: () => void;
  onMover: (etapa: Etapa) => void;
  onAbrir: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onAbrir}
      className="rounded-md border bg-card p-2 cursor-pointer hover:shadow-sm transition-shadow"
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.nome || "Sem nome"}</p>
          <p className="text-xs text-muted-foreground truncate">{item.telefone || "—"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {ETAPAS.filter((e) => e.key !== item.etapa).map((e) => (
              <DropdownMenuItem key={e.key} onSelect={() => onMover(e.key)}>
                Mover para {e.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-muted-foreground">{hora(item.atualizado_em)}</span>
        {item.valor_venda ? (
          <Badge variant="outline" className="text-[11px]">{brl(item.valor_venda)}</Badge>
        ) : null}
        {item.atendente ? (
          <Badge variant="secondary" className="text-[11px]">{item.atendente}</Badge>
        ) : null}
      </div>
      {item.perdido_motivo ? (
        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{item.perdido_motivo}</p>
      ) : null}
    </div>
  );
}

function ModalEtapa({
  modal, onClose, onConfirm,
}: {
  modal: { item: Atendimento; etapa: Etapa } | null;
  onClose: () => void;
  onConfirm: (extras?: { valor?: number; motivo?: string }) => void;
}) {
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    setValor(modal?.item.valor_venda ? String(modal.item.valor_venda) : "");
    setMotivo(modal?.item.perdido_motivo || "");
  }, [modal]);

  const pago = modal?.etapa === "pago";

  return (
    <Dialog open={!!modal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pago ? "Marcar como Pago" : "Marcar como Perdido"}</DialogTitle>
          <DialogDescription>
            {pago ? "Informe o valor da venda (opcional)." : "Informe o motivo (opcional)."}
          </DialogDescription>
        </DialogHeader>
        {pago ? (
          <div className="space-y-1">
            <Label htmlFor="valor-venda">Valor da venda</Label>
            <Input
              id="valor-venda"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="motivo-perda">Motivo</Label>
            <Textarea
              id="motivo-perda"
              placeholder="Ex.: achou caro, comprou em outro lugar..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => {
              if (pago) {
                const n = Number(valor.replace(/\./g, "").replace(",", "."));
                onConfirm(Number.isFinite(n) && n > 0 ? { valor: n } : undefined);
              } else {
                onConfirm(motivo.trim() ? { motivo: motivo.trim() } : undefined);
              }
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Dashboard -------------------------------- */

type Preset = "hoje" | "7" | "30" | "custom";

function DashboardFunil() {
  const [preset, setPreset] = useState<Preset>("30");
  const [inicio, setInicio] = useState(diasAtras(29));
  const [fim, setFim] = useState(hoje());
  const [dados, setDados] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const aplicarPreset = (p: Preset) => {
    setPreset(p);
    if (p === "hoje") { setInicio(hoje()); setFim(hoje()); }
    if (p === "7") { setInicio(diasAtras(6)); setFim(hoje()); }
    if (p === "30") { setInicio(diasAtras(29)); setFim(hoje()); }
  };

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("funil_dashboard", { p_inicio: inicio, p_fim: fim });
      if (!ativo) return;
      if (error) toast.error("Erro ao carregar dashboard: " + error.message);
      else setDados((data as unknown) as Dashboard);
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, [inicio, fim]);

  const t = dados?.totais || {};
  const taxas = dados?.taxas || {};
  const porDia = (dados?.por_dia || []).map((d) => ({ ...d, label: dataCurta(d.data) }));

  const etapasFunil = [
    { label: "Atendimentos", valor: t.atendimentos || 0 },
    { label: "Interesse", valor: t.interesse || 0 },
    { label: "Pagamento enviado", valor: t.pagamento_enviado || 0 },
    { label: "Pagos", valor: t.pagos || 0 },
  ];
  const maxFunil = Math.max(1, ...etapasFunil.map((e) => e.valor));
  const taxasEntre = [
    taxas.atendimento_para_interesse,
    taxas.interesse_para_pagamento,
    taxas.pagamento_para_pago,
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        {([["hoje", "Hoje"], ["7", "7 dias"], ["30", "30 dias"], ["custom", "Personalizado"]] as [Preset, string][])
          .map(([k, label]) => (
            <Button
              key={k}
              size="sm"
              variant={preset === k ? "default" : "outline"}
              onClick={() => aplicarPreset(k)}
            >
              {label}
            </Button>
          ))}
        {preset === "custom" && (
          <div className="flex items-end gap-2">
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-40" />
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-40" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-5 sm:grid-cols-2">
            <Resumo titulo="Atendimentos" valor={String(t.atendimentos || 0)} icone={<MessageCircle className="h-4 w-4" />} />
            <Resumo titulo="Conversão geral" valor={pct(taxas.conversao_geral)} />
            <Resumo titulo="Vendas (pagos)" valor={String(t.pagos || 0)} />
            <Resumo titulo="Receita" valor={brl(t.valor_total)} />
            <Resumo titulo="Perdidos" valor={String(t.perdidos || 0)} icone={<TrendingDown className="h-4 w-4" />} />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Funil</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {etapasFunil.map((e, i) => (
                <div key={e.label}>
                  <div className="flex items-center gap-3">
                    <span className="w-40 text-sm text-muted-foreground">{e.label}</span>
                    <div className="flex-1 h-8 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary/70 flex items-center justify-end px-2"
                        style={{ width: `${Math.max(4, (e.valor / maxFunil) * 100)}%` }}
                      >
                        <span className="text-xs font-medium text-primary-foreground">{e.valor}</span>
                      </div>
                    </div>
                  </div>
                  {i < taxasEntre.length && (
                    <p className="ml-40 pl-3 text-[11px] text-muted-foreground py-0.5">
                      ↓ {pct(taxasEntre[i])}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Evolução diária</CardTitle></CardHeader>
            <CardContent className="h-80">
              {porDia.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={porDia}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis yAxisId="left" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" fontSize={12} />
                    <Tooltip
                      formatter={(v: number, n: string) => (n === "Receita" ? brl(v) : v)}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="atendimentos" name="Atendimentos" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="pagos" name="Pagos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="valor" name="Receita" stroke="hsl(var(--chart-2, var(--primary)))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Resumo({ titulo, valor, icone }: { titulo: string; valor: string; icone?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs">{titulo}</span>
          {icone}
        </div>
        <p className="text-2xl font-semibold mt-1">{valor}</p>
      </CardContent>
    </Card>
  );
}
