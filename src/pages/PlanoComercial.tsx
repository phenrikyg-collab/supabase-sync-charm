import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Target, Sparkles, Loader2, CalendarDays, Trash2, CheckCircle2, RotateCw,
  Gift, Radio, Star, RefreshCw, Mail, MessageCircle, Megaphone, Users2, TrendingUp, ExternalLink,
} from "lucide-react";

// ===================== Types =====================
type Plano = {
  id: string;
  mes_referencia: string;
  status: string | null;
  meta_receita: number | null;
  meta_pedidos: number | null;
  meta_sessoes: number | null;
  investimento_previsto: number | null;
  meta_ticket_medio: number | null;
  created_at?: string;
};

type Acao = {
  id: string;
  plano_id: string | null;
  mes_referencia: string;
  semana: number;
  tipo_acao: string;
  publico_alvo: string | null;
  titulo: string;
  descricao: string | null;
  produto_foco: string | null;
  canais: string[] | null;
  copy_instagram: string | null;
  copy_email: string | null;
  copy_whatsapp: string | null;
  copy_anuncio: string | null;
  kpis_trafego: any;
  status: string | null;
  exportado_calendario: boolean | null;
};

type Investimento = {
  id?: string;
  mes_referencia: string;
  facebook_ads: number | null;
  google_ads: number | null;
  outros: number | null;
  observacao?: string | null;
};

type KpiRow = {
  mes_referencia: string;
  total_sessoes: number;
  total_pedidos: number;
  receita_total: number;
  ticket_medio: number;
  facebook_ads: number;
  google_ads: number;
  investimento_total: number;
  cps: number;
  taxa_conversao_pct: number;
  roas: number;
};

// ===================== Constants =====================
const TIPO_ACAO_META: Record<string, { label: string; icon: any; classes: string }> = {
  kit_oferta:    { label: "🎁 Kit",         icon: Gift,         classes: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  live:          { label: "🔴 Live",        icon: Radio,        classes: "bg-red-100 text-red-800 border-red-300" },
  lancamento:    { label: "✨ Lançamento",  icon: Star,         classes: "bg-purple-100 text-purple-800 border-purple-300" },
  reposicao:     { label: "🔄 Reposição",   icon: RefreshCw,    classes: "bg-sky-100 text-sky-800 border-sky-300" },
  reativacao:    { label: "💌 Reativação",  icon: Mail,         classes: "bg-orange-100 text-orange-800 border-orange-300" },
  novos_clientes:{ label: "🆕 Novos",       icon: Users2,       classes: "bg-cyan-100 text-cyan-800 border-cyan-300" },
  trafego_pago:  { label: "📱 Tráfego",     icon: Megaphone,    classes: "bg-amber-100 text-amber-900 border-amber-300" },
  email_mkt:     { label: "✉️ E-mail",      icon: Mail,         classes: "bg-slate-100 text-slate-800 border-slate-300" },
  whatsapp:      { label: "💬 WhatsApp",    icon: MessageCircle,classes: "bg-green-100 text-green-900 border-green-300" },
};

const PUBLICO_COLORS: Record<string, string> = {
  novos: "bg-cyan-50 text-cyan-700 border-cyan-200",
  recorrentes: "bg-blue-50 text-blue-700 border-blue-200",
  vip: "bg-amber-50 text-amber-800 border-amber-200",
  todos: "bg-slate-50 text-slate-700 border-slate-200",
};

const CANAL_LABEL: Record<string, string> = {
  instagram: "Instagram",
  instagram_feed: "Instagram",
  instagram_stories: "Stories",
  instagram_reels: "Reels",
  email: "E-mail",
  whatsapp: "WhatsApp",
  anuncio: "Anúncio",
  ads: "Anúncio",
  site: "Site",
};

// ===================== Helpers =====================
const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
const num = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR").format(Number(v || 0));

function mesAtualStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function formatMesLabel(mes: string): string {
  if (!mes || mes.length < 7) return mes;
  const [y, m] = mes.split("-");
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[parseInt(m,10)-1]} / ${y}`;
}
function ultimoDiaMes(mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function semanaRange(mes: string, semana: number): string {
  // Semana 1: dia 1-7, Semana 2: 8-14, Semana 3: 15-21, Semana 4: 22-fim
  const ultimo = ultimoDiaMes(mes);
  const ini = (semana - 1) * 7 + 1;
  const fim = semana === 4 ? ultimo : Math.min(ini + 6, ultimo);
  return `${String(ini).padStart(2,"0")}–${String(fim).padStart(2,"0")}/${mes.split("-")[1]}`;
}

// ===================== Page =====================
export default function PlanoComercial() {
  const [mesRef, setMesRef] = useState<string>(mesAtualStr());
  const [tab, setTab] = useState<string>("criar");

  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Target className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-serif text-3xl font-bold">Plano Comercial</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Estratégia mensal de receita, ações por semana e KPIs de tráfego pago
            </p>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs">Mês de referência</Label>
            <Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} className="w-[180px]" />
          </div>
          <div className="text-xs text-muted-foreground pb-2.5">{formatMesLabel(mesRef)}</div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-3">
          <TabsTrigger value="criar">Criar Plano</TabsTrigger>
          <TabsTrigger value="acoes">Ações por Semana</TabsTrigger>
          <TabsTrigger value="kpis">KPIs de Tráfego</TabsTrigger>
        </TabsList>

        <TabsContent value="criar" className="mt-6">
          <AbaCriarPlano mesRef={mesRef} onGenerated={() => setTab("acoes")} />
        </TabsContent>
        <TabsContent value="acoes" className="mt-6">
          <AbaAcoes mesRef={mesRef} />
        </TabsContent>
        <TabsContent value="kpis" className="mt-6">
          <AbaKpisTrafego mesRef={mesRef} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===================== Aba 1: Criar Plano =====================
function AbaCriarPlano({ mesRef, onGenerated }: { mesRef: string; onGenerated: () => void }) {
  const [metaReceita, setMetaReceita] = useState<string>("");
  const [investimento, setInvestimento] = useState<string>("");
  const [loadingSugestoes, setLoadingSugestoes] = useState(false);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [resposta, setResposta] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Carrega sugestões automáticas (meta + investimento) e plano existente
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSugestoes(true);
      try {
        const dataInicio = `${mesRef}-01`;
        const [{ data: metas }, { data: invs }, { data: planos }] = await Promise.all([
          supabase.from("metas_financeiras" as any).select("meta_mensal").eq("mes", dataInicio).limit(1),
          supabase.from("investimentos_midia" as any).select("facebook_ads,google_ads,outros").eq("mes_referencia", mesRef).limit(1),
          supabase.from("planos_comerciais" as any).select("*").eq("mes_referencia", mesRef).order("created_at", { ascending: false }).limit(1),
        ]);
        if (cancelled) return;
        const meta = (metas as any)?.[0]?.meta_mensal;
        if (meta && !metaReceita) setMetaReceita(String(meta));
        const inv = (invs as any)?.[0];
        if (inv && !investimento) {
          const total = Number(inv.facebook_ads || 0) + Number(inv.google_ads || 0) + Number(inv.outros || 0);
          if (total > 0) setInvestimento(String(total));
        }
        const p = (planos as any)?.[0] || null;
        setPlano(p);
        if (p?.meta_receita && !metaReceita) setMetaReceita(String(p.meta_receita));
        if (p?.investimento_previsto && !investimento) setInvestimento(String(p.investimento_previsto));
      } finally {
        setLoadingSugestoes(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesRef]);

  const handleGerar = async () => {
    setConfirmOpen(false);
    setGerando(true);
    setStatusMsg("Gerando plano estratégico...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-commercial-plan", {
        body: {
          mes_referencia: mesRef,
          meta_receita: Number(metaReceita),
          investimento_previsto: Number(investimento || 0),
        },
      });
      if (error) throw error;
      setResposta(data);
      // Recarrega plano persistido
      const { data: planos } = await supabase
        .from("planos_comerciais" as any)
        .select("*")
        .eq("mes_referencia", mesRef)
        .order("created_at", { ascending: false })
        .limit(1);
      setPlano((planos as any)?.[0] || null);
      toast.success(`Plano gerado: ${data?.total_acoes_geradas || 0} ações criadas`);
      onGenerated();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao gerar plano");
    } finally {
      setGerando(false);
      setStatusMsg("");
    }
  };

  const aprovarPlano = async () => {
    if (!plano) return;
    const { error } = await supabase
      .from("planos_comerciais" as any)
      .update({ status: "aprovado" })
      .eq("id", plano.id);
    if (error) return toast.error(error.message);
    setPlano({ ...plano, status: "aprovado" });
    toast.success("Plano aprovado");
  };

  const statusBadge = (s: string | null) => {
    const map: Record<string, string> = {
      rascunho: "bg-slate-200 text-slate-800",
      aprovado: "bg-emerald-600 text-white",
      em_execucao: "bg-blue-600 text-white",
    };
    return <Badge className={map[s || "rascunho"] || map.rascunho}>{s || "rascunho"}</Badge>;
  };

  const kpis = resposta?.kpis_necessarios;

  return (
    <div className="space-y-6">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração do plano</CardTitle>
          <CardDescription>Defina mês, meta e investimento previsto para gerar o plano com IA</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="meta">Meta de receita (R$)</Label>
            <Input
              id="meta"
              type="number"
              step="0.01"
              min="0"
              value={metaReceita}
              onChange={(e) => setMetaReceita(e.target.value)}
              placeholder={loadingSugestoes ? "Carregando..." : "Ex: 250000"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv">Investimento mídia (R$)</Label>
            <Input
              id="inv"
              type="number"
              step="0.01"
              min="0"
              value={investimento}
              onChange={(e) => setInvestimento(e.target.value)}
              placeholder={loadingSugestoes ? "Carregando..." : "Ex: 30000"}
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              disabled={!metaReceita || Number(metaReceita) <= 0 || gerando}
              onClick={() => setConfirmOpen(true)}
            >
              <Sparkles className="h-4 w-4 mr-2" /> Gerar Plano com IA
            </Button>
          </div>
        </CardContent>
      </Card>

      {gerando && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="pt-6 flex items-center gap-3 text-orange-900">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div>
              <div className="font-semibold">{statusMsg || "Gerando..."}</div>
              <div className="text-xs opacity-80">Isto pode levar até 60 segundos</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plano existente / Resposta IA */}
      {(plano || resposta) && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Plano de {formatMesLabel(mesRef)}
                  {statusBadge(plano?.status || "rascunho")}
                </CardTitle>
                <CardDescription>
                  {plano?.created_at && `Gerado em ${new Date(plano.created_at).toLocaleDateString("pt-BR")}`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} disabled={gerando}>
                  <RotateCw className="h-4 w-4 mr-2" /> Regenerar
                </Button>
                {plano?.status !== "aprovado" && (
                  <Button size="sm" onClick={aprovarPlano} className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar plano
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {resposta?.resumo_estrategico && (
              <div className="bg-sky-50 border border-sky-200 rounded-md p-4 text-sm text-sky-900">
                <div className="font-semibold mb-1">📋 Resumo estratégico</div>
                {resposta.resumo_estrategico}
              </div>
            )}
            {resposta?.diagnostico_trafego && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-900">
                <div className="font-semibold mb-1">🎯 Diagnóstico de tráfego</div>
                {resposta.diagnostico_trafego}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiBox label="Meta de receita" value={brl(plano?.meta_receita || resposta?.meta_receita)} />
              <KpiBox label="Meta de pedidos" value={num(plano?.meta_pedidos || resposta?.meta_pedidos)} />
              <KpiBox label="Sessões necessárias" value={num(plano?.meta_sessoes || resposta?.meta_sessoes)} />
              <KpiBox label="Investimento previsto" value={brl(plano?.investimento_previsto || Number(investimento) || 0)} />
            </div>

            {kpis && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <KpiBox label="CPS máximo" value={brl(kpis.cps_maximo)} variant="warn" />
                <KpiBox label="ROAS necessário" value={`${Number(kpis.roas_necessario || 0).toFixed(2)}x`} variant="ok" />
                <KpiBox label="Taxa de conversão alvo" value={`${Number(kpis.taxa_conversao || 0).toFixed(2)}%`} />
              </div>
            )}

            {Array.isArray(resposta?.distribuicao_semanas) && (
              <div>
                <div className="text-sm font-semibold mb-2">Distribuição de meta por semana</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {resposta.distribuicao_semanas.map((d: any) => (
                    <div key={d.semana} className="border rounded-md p-2.5 bg-card">
                      <div className="text-xs text-muted-foreground">Semana {d.semana}</div>
                      <div className="text-sm font-bold">{brl(d.meta_receita_semana)}</div>
                      <div className="text-[11px] text-muted-foreground">{d.percentual}% do mês</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal confirmação */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar plano para {formatMesLabel(mesRef)}</DialogTitle>
            <DialogDescription>
              O assistente irá criar o plano comercial completo para o mês selecionado.
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm space-y-1.5 pl-4 list-disc">
            <li>Distribuição de meta por semana baseada no histórico</li>
            <li>Ações por semana: kits, lives, reativação, novos clientes</li>
            <li>Kits validados com grade cruzada de estoque</li>
            <li>Estratégia de tráfego pago com KPIs alvo</li>
            <li>Copy por canal para cada ação</li>
          </ul>
          <div className="bg-orange-50 border border-orange-200 rounded-md p-3 text-sm text-orange-900">
            ⚠️ A geração leva aproximadamente <strong>60 segundos</strong>.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={handleGerar} className="bg-orange-600 hover:bg-orange-700">
              <Sparkles className="h-4 w-4 mr-2" /> Gerar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiBox({ label, value, variant }: { label: string; value: string; variant?: "ok" | "warn" }) {
  const cls = variant === "ok" ? "border-emerald-300 bg-emerald-50" : variant === "warn" ? "border-amber-300 bg-amber-50" : "bg-card";
  return (
    <div className={`border rounded-md p-3 ${cls}`}>
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

// ===================== Aba 2: Ações por Semana =====================
function AbaAcoes({ mesRef }: { mesRef: string }) {
  const [loading, setLoading] = useState(true);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [acaoSel, setAcaoSel] = useState<Acao | null>(null);
  const [distribuicao, setDistribuicao] = useState<Array<{ semana: number; meta_receita_semana: number; percentual: number }>>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: planos }, { data: acs }] = await Promise.all([
      supabase.from("planos_comerciais" as any).select("*").eq("mes_referencia", mesRef).order("created_at", { ascending: false }).limit(1),
      supabase.from("acoes_comerciais" as any).select("*").eq("mes_referencia", mesRef).order("semana", { ascending: true }),
    ]);
    const p = (planos as any)?.[0] || null;
    setPlano(p);
    setAcoes(((acs as any) || []) as Acao[]);
    // Distribuição: derivar do histórico semana_do_mes se sem plano salvo
    const { data: hist } = await supabase
      .from("vw_padroes_pedidos" as any)
      .select("semana_do_mes,receita_total")
      .limit(2000);
    const map = new Map<number, number>();
    (hist as any[] || []).forEach((r) => {
      const s = Number(r.semana_do_mes);
      if (!s) return;
      map.set(s, (map.get(s) || 0) + Number(r.receita_total || 0));
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1;
    const distr = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([semana, rec]) => ({
        semana,
        percentual: Math.round((rec / total) * 100),
        meta_receita_semana: ((p?.meta_receita || 0) * rec) / total,
      }));
    setDistribuicao(distr);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [mesRef]);

  const semanaPico = useMemo(() => {
    if (!distribuicao.length) return null;
    return distribuicao.reduce((a, b) => (b.meta_receita_semana > a.meta_receita_semana ? b : a));
  }, [distribuicao]);

  const acoesBySemana = useMemo(() => {
    const m: Record<number, Acao[]> = { 1: [], 2: [], 3: [], 4: [] };
    acoes.forEach((a) => {
      const s = Number(a.semana || 0);
      if (s >= 1 && s <= 4) m[s].push(a);
    });
    return m;
  }, [acoes]);

  return (
    <div className="space-y-6">
      {plano && (
        <div className="text-sm text-muted-foreground">
          Meta total de <strong className="text-foreground">{formatMesLabel(mesRef)}</strong>:{" "}
          <strong className="text-foreground">{brl(plano.meta_receita)}</strong>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {/* Distribuição por semana */}
          {distribuicao.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {distribuicao.map((d) => {
                const isPico = semanaPico && d.semana === semanaPico.semana;
                return (
                  <Card key={d.semana} className={isPico ? "border-amber-400 border-2" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardDescription className="font-semibold">Semana {d.semana}</CardDescription>
                        {isPico && <Badge className="bg-amber-500 hover:bg-amber-500 text-white">🏆 Pico</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">{d.percentual}% histórico</div>
                      <div className="text-base font-bold">{brl(d.meta_receita_semana)}</div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: "0%" }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Ações por semana */}
          {!plano && acoes.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground text-center">
                Nenhum plano gerado para este mês. Vá em <strong>Criar Plano</strong> para gerar.
              </CardContent>
            </Card>
          ) : (
            [1, 2, 3, 4].map((s) => (
              <Card key={s}>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base">
                      Semana {s} <span className="text-muted-foreground text-sm font-normal">— {semanaRange(mesRef, s)}</span>
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{acoesBySemana[s].length} ações</span>
                      {distribuicao.find((d) => d.semana === s) && (
                        <span>Meta {brl(distribuicao.find((d) => d.semana === s)!.meta_receita_semana)}</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {acoesBySemana[s].length === 0 ? (
                    <div className="text-sm text-muted-foreground italic">Sem ações para esta semana</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {acoesBySemana[s].map((a) => (
                        <AcaoCard key={a.id} acao={a} onClick={() => setAcaoSel(a)} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </>
      )}

      <AcaoDrawer
        acao={acaoSel}
        onClose={() => setAcaoSel(null)}
        onUpdated={(updated) => {
          setAcoes((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          setAcaoSel(updated);
        }}
        mesRef={mesRef}
      />
    </div>
  );
}

function AcaoCard({ acao, onClick }: { acao: Acao; onClick: () => void }) {
  const meta = TIPO_ACAO_META[acao.tipo_acao] || { label: acao.tipo_acao, classes: "bg-slate-100 text-slate-800 border-slate-300" } as any;
  return (
    <button
      onClick={onClick}
      className="text-left border rounded-lg p-3 bg-card hover:shadow-md transition relative"
    >
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <Badge variant="outline" className={meta.classes}>{meta.label}</Badge>
        {acao.publico_alvo && (
          <Badge variant="outline" className={PUBLICO_COLORS[acao.publico_alvo] || PUBLICO_COLORS.todos}>
            {acao.publico_alvo}
          </Badge>
        )}
        {acao.exportado_calendario && (
          <Badge className="bg-blue-600 hover:bg-blue-600 text-[10px]">📅 No calendário</Badge>
        )}
      </div>
      <div className="font-semibold text-sm leading-tight mb-1">{acao.titulo}</div>
      {acao.produto_foco && (
        <div className="text-xs text-muted-foreground line-clamp-1">📦 {acao.produto_foco}</div>
      )}
      {Array.isArray(acao.canais) && acao.canais.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {acao.canais.slice(0, 4).map((c) => (
            <span key={c} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{CANAL_LABEL[c] || c}</span>
          ))}
        </div>
      )}
    </button>
  );
}

// ===================== Drawer da ação =====================
function AcaoDrawer({
  acao, onClose, onUpdated, mesRef,
}: { acao: Acao | null; onClose: () => void; onUpdated: (a: Acao) => void; mesRef: string }) {
  const [local, setLocal] = useState<Acao | null>(acao);
  const [produtoUrl, setProdutoUrl] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    setLocal(acao);
    setProdutoUrl(null);
    if (acao?.produto_foco) {
      supabase
        .from("tray_products" as any)
        .select("url_https,name")
        .ilike("name", `%${acao.produto_foco}%`)
        .limit(1)
        .then(({ data }) => {
          const u = (data as any)?.[0]?.url_https;
          if (u) setProdutoUrl(u);
        });
    }
  }, [acao]);

  if (!local) return null;

  const meta = TIPO_ACAO_META[local.tipo_acao];

  const persistField = async (field: keyof Acao, value: any) => {
    const next = { ...local, [field]: value } as Acao;
    setLocal(next);
    const { error } = await supabase
      .from("acoes_comerciais" as any)
      .update({ [field]: value })
      .eq("id", local.id);
    if (error) toast.error(error.message);
    else onUpdated(next);
  };

  const aprovar = async () => {
    await persistField("status", "aprovado");
    toast.success("Ação aprovada");
  };
  const cancelar = async () => {
    await persistField("status", "cancelado");
    toast.success("Ação cancelada");
  };

  return (
    <Sheet open={!!acao} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {meta && <Badge variant="outline" className={meta.classes}>{meta.label}</Badge>}
            {local.publico_alvo && (
              <Badge variant="outline" className={PUBLICO_COLORS[local.publico_alvo] || PUBLICO_COLORS.todos}>
                {local.publico_alvo}
              </Badge>
            )}
            <Badge variant="outline">Semana {local.semana}</Badge>
            {local.status && <Badge>{local.status}</Badge>}
          </div>
          <SheetTitle className="text-xl">{local.titulo}</SheetTitle>
          <SheetDescription>{local.descricao}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          {local.produto_foco && (
            <div className="border rounded-md p-3 flex items-center justify-between gap-3 bg-muted/30">
              <div className="text-sm">
                <div className="text-xs text-muted-foreground">Produto foco</div>
                <div className="font-semibold">{local.produto_foco}</div>
              </div>
              {produtoUrl && (
                <a href={produtoUrl} target="_blank" rel="noreferrer" className="text-primary text-sm flex items-center gap-1 hover:underline">
                  Ver produto <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Copies */}
          <Tabs defaultValue="instagram">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="instagram">📸 Instagram</TabsTrigger>
              <TabsTrigger value="email">✉️ E-mail</TabsTrigger>
              <TabsTrigger value="whatsapp">💬 WhatsApp</TabsTrigger>
              <TabsTrigger value="anuncio">📢 Anúncio</TabsTrigger>
            </TabsList>
            <TabsContent value="instagram">
              <Textarea
                rows={8}
                value={local.copy_instagram || ""}
                onChange={(e) => setLocal({ ...local, copy_instagram: e.target.value })}
                onBlur={(e) => persistField("copy_instagram", e.target.value)}
                placeholder="Copy para Instagram..."
              />
            </TabsContent>
            <TabsContent value="email">
              <Textarea
                rows={10}
                value={local.copy_email || ""}
                onChange={(e) => setLocal({ ...local, copy_email: e.target.value })}
                onBlur={(e) => persistField("copy_email", e.target.value)}
                placeholder="Assunto:&#10;&#10;Corpo do e-mail..."
              />
            </TabsContent>
            <TabsContent value="whatsapp">
              <Textarea
                rows={8}
                value={local.copy_whatsapp || ""}
                onChange={(e) => setLocal({ ...local, copy_whatsapp: e.target.value })}
                onBlur={(e) => persistField("copy_whatsapp", e.target.value)}
                placeholder="Copy WhatsApp VIP..."
              />
            </TabsContent>
            <TabsContent value="anuncio">
              <Textarea
                rows={8}
                value={local.copy_anuncio || ""}
                onChange={(e) => setLocal({ ...local, copy_anuncio: e.target.value })}
                onBlur={(e) => persistField("copy_anuncio", e.target.value)}
                placeholder="Copy do anúncio pago..."
              />
            </TabsContent>
          </Tabs>

          {/* KPIs */}
          {local.kpis_trafego && typeof local.kpis_trafego === "object" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(local.kpis_trafego).map(([k, v]) => (
                <div key={k} className="border rounded-md p-2 bg-muted/30">
                  <div className="text-[10px] uppercase text-muted-foreground">{k.replace(/_/g, " ")}</div>
                  <div className="text-sm font-bold">{typeof v === "number" ? (k.includes("cps") || k.includes("budget") ? brl(v as number) : String(v)) : String(v)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button onClick={aprovar} className="bg-emerald-600 hover:bg-emerald-700" size="sm">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar ação
            </Button>
            <Button onClick={() => setExportOpen(true)} variant="outline" size="sm">
              <CalendarDays className="h-4 w-4 mr-2" /> Exportar para calendário
            </Button>
            <Button onClick={cancelar} variant="outline" size="sm" className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4 mr-2" /> Cancelar ação
            </Button>
          </div>
        </div>

        <ExportarCalendarioDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          acao={local}
          mesRef={mesRef}
          onDone={async () => {
            await persistField("exportado_calendario", true);
            await persistField("status", "exportado");
            toast.success("Ação exportada para o calendário!");
            setExportOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function ExportarCalendarioDialog({
  open, onOpenChange, acao, mesRef, onDone,
}: { open: boolean; onOpenChange: (b: boolean) => void; acao: Acao; mesRef: string; onDone: () => void }) {
  const todosCanais = ["instagram_feed", "instagram_stories", "instagram_reels", "email", "whatsapp", "anuncio"];
  const [data, setData] = useState<string>(`${mesRef}-15`);
  const [canais, setCanais] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setData(`${mesRef}-15`);
      setCanais(acao.canais && acao.canais.length ? acao.canais : ["instagram_feed"]);
    }
  }, [open, acao, mesRef]);

  const toggleCanal = (c: string) =>
    setCanais((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const handleExport = async () => {
    if (!data) return toast.error("Escolha uma data");
    if (canais.length === 0) return toast.error("Selecione ao menos 1 canal");
    setSaving(true);
    try {
      const { data: cal, error: e1 } = await supabase
        .from("calendario_comercial" as any)
        .insert({
          data,
          titulo: acao.titulo,
          tipo: "conteudo",
          descricao: acao.descricao || "",
          canal: canais.join(","),
          mes_referencia: mesRef,
          criado_por_ia: true,
          status: "aprovado",
        })
        .select()
        .single();
      if (e1) throw e1;

      const calId = (cal as any)?.id;
      const conteudosInsert = canais.map((c) => {
        let copy: string | null = null;
        if (c.startsWith("instagram")) copy = acao.copy_instagram;
        else if (c === "email") copy = acao.copy_email;
        else if (c === "whatsapp") copy = acao.copy_whatsapp;
        else copy = acao.copy_anuncio;
        return {
          calendario_id: calId,
          canal: c,
          copy_principal: copy,
          status: "rascunho",
          versao: 1,
        };
      });
      const { error: e2 } = await supabase.from("conteudos_gerados" as any).insert(conteudosInsert);
      if (e2) throw e2;
      onDone();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao exportar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar para calendário</DialogTitle>
          <DialogDescription>{acao.titulo}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Data de execução</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">Canais</Label>
            <div className="grid grid-cols-2 gap-2">
              {todosCanais.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm border rounded-md p-2 cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={canais.includes(c)} onCheckedChange={() => toggleCanal(c)} />
                  {CANAL_LABEL[c] || c}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleExport} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Aba 3: KPIs de Tráfego =====================
function AbaKpisTrafego({ mesRef }: { mesRef: string }) {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [planoAtual, setPlanoAtual] = useState<Plano | null>(null);
  const [respostaCache, setRespostaCache] = useState<any | null>(null);

  // Simulador
  const [simMeta, setSimMeta] = useState<string>("");
  const [simInv, setSimInv] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const [{ data: ks }, { data: invs }, { data: planos }] = await Promise.all([
      supabase.from("vw_kpis_trafego" as any).select("*").order("mes_referencia", { ascending: false }).limit(6),
      supabase.from("investimentos_midia" as any).select("*").order("mes_referencia", { ascending: false }).limit(12),
      supabase.from("planos_comerciais" as any).select("*").eq("mes_referencia", mesRef).order("created_at", { ascending: false }).limit(1),
    ]);
    setKpis(((ks as any) || []) as KpiRow[]);
    setInvestimentos(((invs as any) || []) as Investimento[]);
    setPlanoAtual((planos as any)?.[0] || null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [mesRef]);

  const atual = kpis[0];
  // Médias dos últimos 3 meses (conforme spec)
  const ultimos3 = useMemo(() => kpis.slice(0, 3), [kpis]);
  const ticketHist = useMemo(() => {
    if (!ultimos3.length) return 0;
    return ultimos3.reduce((s, k) => s + Number(k.ticket_medio || 0), 0) / ultimos3.length;
  }, [ultimos3]);
  const conversaoHist = useMemo(() => {
    if (!ultimos3.length) return 0;
    return ultimos3.reduce((s, k) => s + Number(k.taxa_conversao_pct || 0), 0) / ultimos3.length;
  }, [ultimos3]);
  const cpsHist = useMemo(() => {
    if (!ultimos3.length) return 0;
    return ultimos3.reduce((s, k) => s + Number(k.cps || 0), 0) / ultimos3.length;
  }, [ultimos3]);
  const roasHist = useMemo(() => {
    if (!ultimos3.length) return 0;
    return ultimos3.reduce((s, k) => s + Number(k.roas || 0), 0) / ultimos3.length;
  }, [ultimos3]);

  const simMetaNum = Number(simMeta) || 0;
  const simInvNum = Number(simInv) || 0;
  const simPedidos = ticketHist ? Math.ceil(simMetaNum / ticketHist) : 0;
  const simSessoes = conversaoHist ? Math.ceil(simPedidos / (conversaoHist / 100)) : 0;
  const simCps = simSessoes && simInvNum ? simInvNum / simSessoes : 0;
  const simRoas = simInvNum ? simMetaNum / simInvNum : 0;

  // Viabilidade individual
  const cpsViavel = cpsHist > 0 && simCps > 0 ? simCps <= cpsHist * 1.2 : null;
  const roasViavel = roasHist > 0 && simRoas > 0 ? simRoas <= roasHist * 1.5 : null;

  const semaforo = (() => {
    if (!simSessoes || !cpsHist) return "muted";
    if (cpsViavel && roasViavel) return "verde";
    if (cpsViavel || roasViavel) return "amarelo";
    return "vermelho";
  })();
  const semaforoStyle = {
    verde: "bg-emerald-50 border-emerald-400 text-emerald-900",
    amarelo: "bg-amber-50 border-amber-400 text-amber-900",
    vermelho: "bg-red-50 border-red-400 text-red-900",
    muted: "bg-muted/30 border-border",
  }[semaforo];

  const cpsBadge = cpsViavel == null ? "" : cpsViavel ? "text-emerald-700" : (simCps <= cpsHist * 1.5 ? "text-amber-700" : "text-red-700");
  const roasBadge = roasViavel == null ? "" : roasViavel ? "text-emerald-700" : "text-red-700";


  const updateInv = async (mes: string, field: keyof Investimento, value: number) => {
    const row = investimentos.find((i) => i.mes_referencia === mes);
    if (row?.id) {
      const { error } = await supabase.from("investimentos_midia" as any).update({ [field]: value }).eq("id", row.id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("investimentos_midia" as any).insert({ mes_referencia: mes, [field]: value }).select().single();
      if (error) return toast.error(error.message);
      setInvestimentos((prev) => [...prev, data as any]);
      return;
    }
    setInvestimentos((prev) => prev.map((i) => (i.mes_referencia === mes ? { ...i, [field]: value } : i)));
  };

  const addMes = async () => {
    const novoMes = prompt("Novo mês (YYYY-MM):", mesAtualStr());
    if (!novoMes || !/^\d{4}-\d{2}$/.test(novoMes)) return;
    if (investimentos.some((i) => i.mes_referencia === novoMes)) return toast.error("Mês já cadastrado");
    const { data, error } = await supabase
      .from("investimentos_midia" as any)
      .insert({ mes_referencia: novoMes, facebook_ads: 0, google_ads: 0, outros: 0 })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setInvestimentos((prev) => [data as any, ...prev]);
    toast.success("Mês adicionado");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Comparações com o plano atual (meta_*)
  const metaCps = planoAtual?.investimento_previsto && planoAtual?.meta_sessoes
    ? Number(planoAtual.investimento_previsto) / Number(planoAtual.meta_sessoes) : null;
  const metaRoas = planoAtual?.investimento_previsto && planoAtual?.meta_receita
    ? Number(planoAtual.meta_receita) / Number(planoAtual.investimento_previsto) : null;
  const metaConv = planoAtual?.meta_sessoes && planoAtual?.meta_pedidos
    ? (Number(planoAtual.meta_pedidos) / Number(planoAtual.meta_sessoes)) * 100 : null;

  const CompCard = ({ label, atualVal, metaVal, format, goodWhen }: any) => {
    const bom = metaVal != null && atualVal != null && (goodWhen === "lower" ? atualVal <= metaVal : atualVal >= metaVal);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>{label}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{format(atualVal)}</div>
          {metaVal != null && (
            <div className="text-xs text-muted-foreground mt-1">
              Meta: {format(metaVal)}
              <Badge className={`ml-2 ${bom ? "bg-emerald-600" : "bg-red-600"} hover:bg-current text-white`}>
                {bom ? "✓ no alvo" : "× fora"}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <CompCard label="CPS atual" atualVal={atual?.cps} metaVal={metaCps} format={(v: any) => v != null ? brl(v) : "—"} goodWhen="lower" />
        <CompCard label="ROAS atual" atualVal={atual?.roas} metaVal={metaRoas} format={(v: any) => v != null ? `${Number(v).toFixed(2)}x` : "—"} goodWhen="higher" />
        <CompCard label="Taxa de conversão" atualVal={atual?.taxa_conversao_pct} metaVal={metaConv} format={(v: any) => v != null ? `${Number(v).toFixed(2)}%` : "—"} goodWhen="higher" />
        <CompCard label="Sessões" atualVal={atual?.total_sessoes} metaVal={planoAtual?.meta_sessoes} format={(v: any) => v != null ? num(v) : "—"} goodWhen="higher" />
      </div>

      {/* Histórico KPIs */}
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico (últimos {kpis.length} meses)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                <th className="py-2 pr-3">Mês</th>
                <th className="py-2 pr-3">Sessões</th>
                <th className="py-2 pr-3">Pedidos</th>
                <th className="py-2 pr-3">Ticket</th>
                <th className="py-2 pr-3">Invest.</th>
                <th className="py-2 pr-3">CPS</th>
                <th className="py-2 pr-3">ROAS</th>
                <th className="py-2 pr-3">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => (
                <tr key={k.mes_referencia} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{k.mes_referencia}</td>
                  <td className="py-2 pr-3">{num(k.total_sessoes)}</td>
                  <td className="py-2 pr-3">{num(k.total_pedidos)}</td>
                  <td className="py-2 pr-3">{brl(k.ticket_medio)}</td>
                  <td className="py-2 pr-3">{brl(k.investimento_total)}</td>
                  <td className="py-2 pr-3">{brl(k.cps)}</td>
                  <td className="py-2 pr-3">{Number(k.roas || 0).toFixed(2)}x</td>
                  <td className="py-2 pr-3">{Number(k.taxa_conversao_pct || 0).toFixed(2)}%</td>
                </tr>
              ))}
              {!kpis.length && (
                <tr><td colSpan={8} className="text-center py-4 text-muted-foreground">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Investimentos editáveis */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Investimentos por mês</CardTitle>
          <Button size="sm" variant="outline" onClick={addMes}>+ Adicionar mês</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                <th className="py-2 pr-3">Mês</th>
                <th className="py-2 pr-3">Facebook</th>
                <th className="py-2 pr-3">Google</th>
                <th className="py-2 pr-3">Outros</th>
                <th className="py-2 pr-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {investimentos.map((i) => {
                const total = Number(i.facebook_ads || 0) + Number(i.google_ads || 0) + Number(i.outros || 0);
                return (
                  <tr key={i.mes_referencia} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{i.mes_referencia}</td>
                    {(["facebook_ads", "google_ads", "outros"] as const).map((f) => (
                      <td key={f} className="py-2 pr-3">
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={i[f] || 0}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== Number(i[f] || 0)) updateInv(i.mes_referencia, f, v);
                          }}
                          className="h-8 w-32"
                        />
                      </td>
                    ))}
                    <td className="py-2 pr-3 font-semibold">{brl(total)}</td>
                  </tr>
                );
              })}
              {!investimentos.length && (
                <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum investimento cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Simulador */}
      <Card className={`border-2 ${semaforoStyle}`}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Simulador de meta</CardTitle>
          <CardDescription>
            Baseado em ticket médio histórico {brl(ticketHist)} e conversão média {conversaoHist.toFixed(2)}%
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Meta de receita (R$)</Label>
              <Input type="number" value={simMeta} onChange={(e) => setSimMeta(e.target.value)} placeholder="Ex: 300000" />
            </div>
            <div>
              <Label>Investimento previsto (R$)</Label>
              <Input type="number" value={simInv} onChange={(e) => setSimInv(e.target.value)} placeholder="Ex: 35000" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <SimBox label="Pedidos" value={num(Math.round(simPedidos))} />
            <SimBox label="Sessões necessárias" value={num(Math.round(simSessoes))} />
            <SimBox label="CPS necessário" value={brl(simCps)} />
            <SimBox label="ROAS necessário" value={`${simRoas.toFixed(2)}x`} />
          </div>
          <div className="text-sm">
            <strong>Viabilidade:</strong>{" "}
            {semaforo === "verde" && "🟢 Plano viável dentro do padrão histórico"}
            {semaforo === "amarelo" && "🟡 Desafiador — exigirá melhoria de eficiência"}
            {semaforo === "vermelho" && "🔴 Muito agressivo — KPIs muito acima do histórico"}
            {semaforo === "muted" && "Informe meta e investimento para simular"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SimBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-2.5 bg-card">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}
