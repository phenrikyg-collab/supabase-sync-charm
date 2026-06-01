import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Target,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Activity,
  CheckCircle2,
  RefreshCw,
  Calendar as CalendarIcon,
  X,
  Trophy,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { callClaude, safeParseJSONObject } from "@/lib/claudeApi";
import { cn } from "@/lib/utils";

const EXTERNAL_SUPABASE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6ZHR1bGNycXptZ29jYW1qd3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjIwMzAsImV4cCI6MjA4NzE5ODAzMH0.7CyKzK3cs-Cd-Wrh69oUAEtxW95l8iZLMCXi_3nAIPU";

// ---------------- Helpers ----------------
const formatBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

const formatBRLDec = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(v || 0));

const formatNumber = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR").format(Number(v || 0));

const formatMes = (mes: string) => {
  const [y, m] = mes.split("-");
  const nomes = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${nomes[Number(m) - 1]} / ${y}`;
};

const navegarMes = (mes: string, dir: number) => {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// ---------------- Tipos de ação ----------------
const TIPO_ACAO_META: Record<
  string,
  { label: string; emoji: string; className: string }
> = {
  kit_oferta: {
    label: "Kit",
    emoji: "🎁",
    className: "bg-success/15 text-success border-success/30",
  },
  live: {
    label: "Live",
    emoji: "🔴",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  lancamento: {
    label: "Lançamento",
    emoji: "✨",
    className: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  },
  reposicao: {
    label: "Reposição",
    emoji: "🔄",
    className: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  },
  reativacao: {
    label: "Reativação",
    emoji: "💌",
    className: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  },
  novos_clientes: {
    label: "Novos",
    emoji: "🆕",
    className: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
  },
  trafego_pago: {
    label: "Tráfego",
    emoji: "📱",
    className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  },
  email_mkt: {
    label: "E-mail",
    emoji: "✉️",
    className: "bg-muted text-muted-foreground border-border",
  },
  whatsapp: {
    label: "WhatsApp",
    emoji: "💬",
    className: "bg-emerald-700/15 text-emerald-700 border-emerald-700/30",
  },
};

const STATUS_BADGE: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  aprovado: "bg-success/15 text-success border-success/30",
  exportado: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  cancelado: "bg-destructive/15 text-destructive border-destructive/30",
  em_execucao: "bg-warning/15 text-warning border-warning/30",
};

// ---------------- Componente principal ----------------
export default function PlanoComercial() {
  const [mes, setMes] = useState("2026-07");
  const [plano, setPlano] = useState<any>(null);
  const [acoes, setAcoes] = useState<any[]>([]);
  const [distribuicao, setDistribuicao] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);
  const [investimentos, setInvestimentos] = useState<any[]>([]);
  const [metaFin, setMetaFin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const fetchRef = useRef(false);

  // formulário criação
  const [metaReceita, setMetaReceita] = useState<string>("");
  const [contextoIA, setContextoIA] = useState<string>("");
  const [gerando, setGerando] = useState(false);
  const [confirmGerar, setConfirmGerar] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  // drawer da ação
  const [acaoAberta, setAcaoAberta] = useState<any>(null);
  const [exportarOpen, setExportarOpen] = useState(false);
  const [dataExport, setDataExport] = useState("");

  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    carregarDados(mes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarDados = async (mesRef: string) => {
    setLoading(true);
    setErro(null);
    setMes(mesRef);

    try {
      const { data: planoData, error: planoErro } = await supabase
        .from("planos_comerciais" as any)
        .select("*")
        .eq("mes_referencia", mesRef)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (planoErro) throw new Error("Erro plano: " + planoErro.message);
      setPlano(planoData);

      const { data: acoesData, error: acoesErro } = await supabase
        .from("acoes_comerciais" as any)
        .select("*")
        .eq("mes_referencia", mesRef)
        .order("semana", { ascending: true });
      if (acoesErro) throw new Error("Erro acoes: " + acoesErro.message);
      setAcoes(acoesData || []);

      const { data: padrao } = await supabase
        .from("vw_padroes_pedidos" as any)
        .select("semana_do_mes, receita_total, total_pedidos");

      if (padrao) {
        const resumo: Record<number, number> = {};
        (padrao as any[]).forEach((r: any) => {
          const s = Number(r.semana_do_mes);
          resumo[s] = (resumo[s] || 0) + Number(r.receita_total);
        });
        const total = Object.values(resumo).reduce((s, v) => s + v, 0);
        const dist = Object.entries(resumo)
          .map(([s, v]) => ({
            semana: parseInt(s),
            percentual: total ? Math.round((v / total) * 100) : 0,
            meta_receita:
              planoData && total
                ? Math.round(((planoData as any).meta_receita * v) / total)
                : 0,
          }))
          .sort((a, b) => a.semana - b.semana);
        setDistribuicao(dist);
      }

      const { data: kpisData } = await supabase
        .from("vw_kpis_trafego" as any)
        .select("*")
        .order("mes_referencia", { ascending: false })
        .limit(6);
      setKpis((kpisData as any[]) || []);

      const { data: invData } = await supabase
        .from("investimentos_midia" as any)
        .select("*")
        .order("mes_referencia", { ascending: false })
        .limit(12);
      setInvestimentos((invData as any[]) || []);

      // meta financeira
      const mesData = `${mesRef}-01`;
      const { data: metaData } = await supabase
        .from("metas_financeiras" as any)
        .select("*")
        .eq("mes", mesData)
        .maybeSingle();
      setMetaFin(metaData);

      // Pré-preencher form se não tem plano
      if (!planoData) {
        const inv = (invData as any[])?.find(
          (i: any) => i.mes_referencia === mesRef,
        );
        setMetaReceita(
          metaData ? String((metaData as any).meta_mensal || "") : "",
        );
        setContextoIA("");
      }
    } catch (e: any) {
      setErro(e.message);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMudarMes = (dir: number) => {
    carregarDados(navegarMes(mes, dir));
  };

  const gerarPlano = async () => {
    setGerando(true);
    setConfirmGerar(false);
    setConfirmRegen(false);
    try {
      // 1. Buscar SEMPRE a meta financeira do mês antes de chamar a IA
      const dataInicio = `${mes}-01`;
      const { data: metaFinDb } = await supabase
        .from("metas_financeiras" as any)
        .select("meta_mensal, meta_ticket_medio")
        .eq("mes", dataInicio)
        .maybeSingle();

      const metaReceitaAuto =
        Number((metaFinDb as any)?.meta_mensal) || Number(metaReceita) || 0;

      if (!metaReceitaAuto) {
        toast.error(
          "Cadastre a meta financeira do mês em Meta Mensal antes de gerar o plano.",
        );
        setGerando(false);
        return;
      }

      await invokeEdgeFunction(
        "generate-commercial-plan",
        {
          mes_referencia: mes,
          meta_receita: metaReceitaAuto,
          contexto_ia: contextoIA,
        },
        {
          baseUrl: EXTERNAL_SUPABASE_URL,
          anonKey: EXTERNAL_SUPABASE_ANON_KEY,
          timeoutMs: 300_000,
        },
      );
      toast.success("Plano gerado!");
      await carregarDados(mes);
    } catch (e: any) {
      toast.error("Erro ao gerar plano: " + (e?.message || "falha desconhecida"));
    } finally {
      setGerando(false);
    }
  };

  const aprovarPlano = async () => {
    if (!plano) return;
    const { error } = await supabase
      .from("planos_comerciais" as any)
      .update({ status: "aprovado" } as any)
      .eq("id", plano.id);
    if (error) return toast.error("Erro: " + error.message);
    setPlano({ ...plano, status: "aprovado" });
    toast.success("Plano aprovado!");
  };

  // ---- Atualizações ações ----
  const atualizarAcaoCampo = async (id: string, campo: string, valor: any) => {
    const { error } = await supabase
      .from("acoes_comerciais" as any)
      .update({ [campo]: valor, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    setAcoes((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [campo]: valor } : a)),
    );
    if (acaoAberta?.id === id) setAcaoAberta({ ...acaoAberta, [campo]: valor });
  };

  const aprovarAcao = (id: string) =>
    atualizarAcaoCampo(id, "status", "aprovado").then(() =>
      toast.success("Ação aprovada"),
    );
  const cancelarAcao = (id: string) =>
    atualizarAcaoCampo(id, "status", "cancelado").then(() =>
      toast.success("Ação cancelada"),
    );

  const exportarParaCalendario = async () => {
    if (!acaoAberta || !dataExport) return;
    try {
      const { data: cal, error: e1 } = await supabase
        .from("calendario_comercial" as any)
        .insert({
          data: dataExport,
          titulo: acaoAberta.titulo,
          tipo: "conteudo",
          descricao: acaoAberta.descricao,
          canal: acaoAberta.canais,
          mes_referencia: mes,
          criado_por_ia: true,
        } as any)
        .select()
        .single();
      if (e1) throw e1;

      const inserts: any[] = [];
      const mapCopy: Record<string, string | null> = {
        instagram_reels: acaoAberta.copy_instagram,
        instagram_feed: acaoAberta.copy_instagram,
        email: acaoAberta.copy_email,
        whatsapp_vip: acaoAberta.copy_whatsapp,
        anuncio: acaoAberta.copy_anuncio,
      };
      (acaoAberta.canais || []).forEach((c: string) => {
        const copy = mapCopy[c];
        if (copy) {
          inserts.push({
            calendario_id: (cal as any).id,
            canal: c,
            copy_principal: copy,
            status: "rascunho",
          });
        }
      });
      if (inserts.length) {
        await supabase.from("conteudos_gerados" as any).insert(inserts as any);
      }
      await atualizarAcaoCampo(acaoAberta.id, "exportado_calendario", true);
      await atualizarAcaoCampo(acaoAberta.id, "status", "exportado");
      toast.success("Exportado para o calendário!");
      setExportarOpen(false);
      setDataExport("");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const salvarInvestimento = async (
    mesRef: string,
    campo: string,
    valor: number,
  ) => {
    const existe = investimentos.find((i) => i.mes_referencia === mesRef);
    if (existe) {
      const { error } = await supabase
        .from("investimentos_midia" as any)
        .update({ [campo]: valor, updated_at: new Date().toISOString() } as any)
        .eq("id", existe.id);
      if (error) return toast.error("Erro: " + error.message);
      setInvestimentos((prev) =>
        prev.map((i) =>
          i.mes_referencia === mesRef ? { ...i, [campo]: valor } : i,
        ),
      );
    } else {
      const { data, error } = await supabase
        .from("investimentos_midia" as any)
        .insert({ mes_referencia: mesRef, [campo]: valor } as any)
        .select()
        .single();
      if (error) return toast.error("Erro: " + error.message);
      setInvestimentos((prev) => [data as any, ...prev]);
    }
  };

  // ---------------- Render ----------------
  if (loading) return <LoadingSkeleton />;
  if (erro)
    return (
      <div className="p-8 text-destructive">
        <h2 className="font-bold mb-2">Erro</h2>
        <pre className="whitespace-pre-wrap">{erro}</pre>
        <Button className="mt-4" onClick={() => carregarDados(mes)}>
          Tentar novamente
        </Button>
      </div>
    );

  return (
    <TooltipProvider>
      <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold tracking-tight flex items-center gap-3">
              <Target className="h-7 w-7 text-primary" />
              Plano Comercial
            </h1>
            <p className="text-muted-foreground mt-1">
              Planejamento estratégico por semana
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => carregarDados(mes)}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Recarregar
            </Button>
            <div className="flex items-center gap-2 bg-card border rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleMudarMes(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-4 py-2 min-w-[180px] text-center font-medium">
                {formatMes(mes)}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleMudarMes(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Tabs key={mes} defaultValue="visao" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="acoes">Ações por Semana</TabsTrigger>
            <TabsTrigger value="kpis">KPIs de Tráfego</TabsTrigger>
          </TabsList>

          {/* ============ ABA 1 ============ */}
          <TabsContent value="visao" className="space-y-6">
            {!plano ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Criar plano para {formatMes(mes)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-w-2xl">
                  <div>
                    <Label>Meta de receita (R$)</Label>
                    <Input
                      type="number"
                      value={metaReceita}
                      onChange={(e) => setMetaReceita(e.target.value)}
                      placeholder="Ex: 300000"
                    />
                    {metaFin && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Sugerido: {formatBRL(metaFin.meta_mensal)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Informações para a IA</Label>
                    <Textarea
                      value={contextoIA}
                      onChange={(e) => setContextoIA(e.target.value)}
                      placeholder="Ex: foco em lançamento de cápsula de inverno, estoque alto de vestidos, campanha de Dia das Mães, evitar promoções agressivas, priorizar live de quarta..."
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Contextos, prioridades, eventos e restrições do mês que a IA deve considerar.
                    </p>
                  </div>
                  <Button
                    onClick={() => setConfirmGerar(true)}
                    disabled={!metaReceita || gerando}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {gerando ? "Gerando..." : "Gerar Plano com IA"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CardTitle>Resumo do plano</CardTitle>
                          <Badge
                            className={cn(
                              "border",
                              STATUS_BADGE[plano.status] || STATUS_BADGE.rascunho,
                            )}
                            variant="outline"
                          >
                            {plano.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {plano.status !== "aprovado" && (
                          <Button onClick={aprovarPlano} variant="default">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Aprovar plano
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => setConfirmRegen(true)}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Regenerar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {plano.resumo_ia}
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <KpiPill
                        icon={DollarSign}
                        label="Meta receita"
                        value={formatBRL(plano.meta_receita)}
                      />
                      <KpiPill
                        icon={ShoppingBag}
                        label="Meta pedidos"
                        value={`${formatNumber(plano.meta_pedidos)} pedidos`}
                      />
                      <KpiPill
                        icon={Activity}
                        label="CPS máximo"
                        value={formatBRLDec(plano.meta_cps_maximo)}
                        tooltip="Custo por Sessão máximo para atingir a meta"
                      />
                      <KpiPill
                        icon={TrendingUp}
                        label="ROAS necessário"
                        value={`${Number(plano.meta_roas || 0).toFixed(2)}x`}
                        tooltip="Retorno sobre investimento necessário"
                      />
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <h2 className="text-lg font-semibold mb-3">
                    Distribuição por semana
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {distribuicao.map((d) => (
                      <Card key={d.semana}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Semana {d.semana}
                            </span>
                            {d.semana === 2 && (
                              <Badge className="bg-success/15 text-success border-success/30" variant="outline">
                                <Trophy className="h-3 w-3 mr-1" /> Pico
                              </Badge>
                            )}
                            {d.semana === 3 && (
                              <Badge className="bg-destructive/15 text-destructive border-destructive/30" variant="outline">
                                <AlertTriangle className="h-3 w-3 mr-1" /> Fraca
                              </Badge>
                            )}
                          </div>
                          <div className="text-2xl font-serif font-bold">
                            {d.percentual}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatBRL(d.meta_receita)}
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(d.percentual * 3, 100)}%` }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ============ ABA 2 ============ */}
          <TabsContent value="acoes" className="space-y-6">
            {!plano ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Gere um plano na aba "Visão Geral" para visualizar as ações.
                </CardContent>
              </Card>
            ) : (
              [1, 2, 3, 4].map((sem) => {
                const semAcoes = acoes.filter((a) => a.semana === sem);
                const distSem = distribuicao.find((d) => d.semana === sem);
                return (
                  <SemanaSection
                    key={sem}
                    semana={sem}
                    mes={mes}
                    metaReceita={distSem?.meta_receita || 0}
                    metaPercentual={distSem?.percentual || 0}
                    metaTotalPlano={Number(plano?.meta_receita || 0)}
                    acoes={semAcoes}
                    onAbrir={setAcaoAberta}
                  />
                );
              })
            )}
          </TabsContent>

          {/* ============ ABA 3 ============ */}
          <TabsContent value="kpis" className="space-y-6">
            <KpisTrafegoTab
              kpis={kpis}
              plano={plano}
              investimentos={investimentos}
              mes={mes}
              onSalvarInvestimento={salvarInvestimento}
            />
          </TabsContent>
        </Tabs>

        {/* Drawer Ação */}
        <Sheet open={!!acaoAberta} onOpenChange={(o) => !o && setAcaoAberta(null)}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            {acaoAberta && (
              <DrawerAcao
                acao={acaoAberta}
                onChange={(c, v) => atualizarAcaoCampo(acaoAberta.id, c, v)}
                onAprovar={() => aprovarAcao(acaoAberta.id)}
                onCancelar={() => cancelarAcao(acaoAberta.id)}
                onExportar={() => setExportarOpen(true)}
              />
            )}
          </SheetContent>
        </Sheet>

        {/* Modal exportar */}
        <Dialog open={exportarOpen} onOpenChange={setExportarOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exportar para calendário</DialogTitle>
              <DialogDescription>
                Escolha a data para publicação. Os canais serão exportados conforme a ação.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Data de publicação</Label>
              <Input
                type="date"
                value={dataExport}
                onChange={(e) => setDataExport(e.target.value)}
              />
              {acaoAberta && (
                <div className="flex flex-wrap gap-1">
                  {(acaoAberta.canais || []).map((c: string) => (
                    <Badge key={c} variant="secondary">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExportarOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={exportarParaCalendario} disabled={!dataExport}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmar gerar */}
        <Dialog open={confirmGerar} onOpenChange={setConfirmGerar}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerar plano com IA?</DialogTitle>
              <DialogDescription>
                Vamos criar o plano comercial completo para {formatMes(mes)} com
                meta {formatBRL(Number(metaReceita))}
                {contextoIA ? ", considerando o contexto informado" : ""}.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmGerar(false)}>
                Cancelar
              </Button>
              <Button onClick={gerarPlano} disabled={gerando}>
                {gerando ? "Gerando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmar regenerar */}
        <Dialog open={confirmRegen} onOpenChange={setConfirmRegen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Regenerar o plano?</DialogTitle>
              <DialogDescription>
                O plano atual e suas ações serão substituídos por uma nova versão gerada pela IA.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmRegen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={gerarPlano}
                disabled={gerando}
              >
                {gerando ? "Regenerando..." : "Regenerar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// ---------------- Sub-componentes ----------------

function LoadingSkeleton() {
  return (
    <div className="p-8 space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-12 w-full max-w-2xl" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function KpiPill({
  icon: Icon,
  label,
  value,
  tooltip,
}: {
  icon: any;
  label: string;
  value: string;
  tooltip?: string;
}) {
  const content = (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" /> {label}
        {tooltip && <Info className="h-3 w-3 opacity-60" />}
      </div>
      <div className="text-xl font-serif font-bold">{value}</div>
    </div>
  );
  if (!tooltip) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// Datas reais da semana N do mês "YYYY-MM"
function datasSemanaN(semana: number, mes: string) {
  const [ano, mesNum] = mes.split("-").map(Number);
  const inicio = new Date(ano, mesNum - 1, (semana - 1) * 7 + 1);
  const fim = new Date(ano, mesNum - 1, semana * 7);
  const ultimoDia = new Date(ano, mesNum, 0);
  if (fim > ultimoDia) fim.setDate(ultimoDia.getDate());
  if (inicio > ultimoDia) return null;
  return { inicio, fim };
}

const ddmm = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

// Dia da semana ideal por tipo de ação (para o calendário)
const DIA_IDEAL_POR_TIPO: Record<string, string> = {
  live: "Terça-feira",
  kit_oferta: "Segunda ou Terça",
  novos_clientes: "Segunda ou Terça",
  reativacao: "Domingo",
  whatsapp: "Domingo",
  email_mkt: "Quinta-feira",
  lancamento: "Terça-feira",
  reposicao: "Terça-feira",
};
const diaIdealParaTipo = (tipo: string) =>
  DIA_IDEAL_POR_TIPO[tipo] || "Sexta-feira";

// ---- Conteúdo por dia (kpis_trafego) ----
const DIA_SEMANA_META: Record<
  number,
  { nome: string; abrev: string; className: string }
> = {
  0: { nome: "Domingo", abrev: "DOM", className: "bg-muted text-muted-foreground border-border" },
  1: { nome: "Segunda", abrev: "SEG", className: "bg-blue-900 text-white border-blue-900" },
  2: { nome: "Terça", abrev: "TER", className: "bg-purple-700 text-white border-purple-700" },
  3: { nome: "Quarta", abrev: "QUA", className: "bg-green-700 text-white border-green-700" },
  4: { nome: "Quinta", abrev: "QUI", className: "bg-orange-600 text-white border-orange-600" },
  5: { nome: "Sexta", abrev: "SEX", className: "bg-pink-600 text-white border-pink-600" },
  6: { nome: "Sábado", abrev: "SAB", className: "bg-primary text-primary-foreground border-primary" },
};

function parseLocalDate(s?: string | null): Date | null {
  if (!s) return null;
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function getKT(acao: any): any {
  const k = acao?.kpis_trafego;
  return k && typeof k === "object" && !Array.isArray(k) ? k : {};
}

function getDiaAcao(acao: any): Date | null {
  return parseLocalDate(getKT(acao).data);
}

function SemanaSection({
  semana,
  mes,
  metaReceita,
  metaPercentual,
  metaTotalPlano,
  acoes,
  onAbrir,
}: {
  semana: number;
  mes: string;
  metaReceita: number;
  metaPercentual: number;
  metaTotalPlano: number;
  acoes: any[];
  onAbrir: (a: any) => void;
}) {
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroPublico, setFiltroPublico] = useState("");

  const tipos = useMemo(
    () => Array.from(new Set(acoes.map((a) => a.tipo_acao).filter(Boolean))),
    [acoes],
  );
  const publicos = useMemo(
    () => Array.from(new Set(acoes.map((a) => a.publico_alvo).filter(Boolean))),
    [acoes],
  );

  const filtradas = acoes
    .filter(
      (a) =>
        (!filtroTipo || a.tipo_acao === filtroTipo) &&
        (!filtroPublico || a.publico_alvo === filtroPublico),
    )
    .sort((a, b) => {
      const da = getKT(a).data || "";
      const db = getKT(b).data || "";
      return String(da).localeCompare(String(db));
    });

  // Canais cobertos a partir do conteúdo dos dias
  const canaisCobertos = new Set<string>();
  acoes.forEach((a) => {
    const k = getKT(a);
    if (k.reels || a.copy_instagram) canaisCobertos.add("Instagram");
    if (k.email_assunto || k.email_copy || a.copy_email) canaisCobertos.add("Email");
    if (k.whatsapp || a.copy_whatsapp) canaisCobertos.add("WhatsApp");
  });
  const diasPlanejados = acoes.filter((a) => getKT(a).data).length;

  // Resumo da semana
  const datas = datasSemanaN(semana, mes);
  const pct = metaPercentual || (metaTotalPlano ? Math.round((metaReceita / metaTotalPlano) * 100) : 0);

  const isNovo = (p?: string) =>
    !!p && /(novo|aquisi|prospec)/i.test(p);
  const isRecorrente = (p?: string) =>
    !!p && /(recorr|fidel|vip|cliente|reat)/i.test(p);

  const totalAlvo = acoes.length || 1;
  const qtdNovos = acoes.filter((a) => isNovo(a.publico_alvo)).length;
  const qtdRecorrentes = acoes.filter((a) => isRecorrente(a.publico_alvo)).length;
  const pctNovos = Math.round((qtdNovos / totalAlvo) * 100);
  const pctRecorrentes = Math.round((qtdRecorrentes / totalAlvo) * 100);

  const contagemTipos = acoes.reduce<Record<string, number>>((acc, a) => {
    if (!a.tipo_acao) return acc;
    acc[a.tipo_acao] = (acc[a.tipo_acao] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex-1 min-w-[260px] space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle>
                Semana {semana}
                {datas && (
                  <span className="text-muted-foreground font-normal text-base ml-2">
                    — {ddmm(datas.inicio)} a {ddmm(datas.fim)}
                  </span>
                )}
              </CardTitle>
              {semana === 2 && (
                <Badge className="bg-success/15 text-success border-success/30" variant="outline">
                  <Trophy className="h-3 w-3 mr-1" /> Semana pico
                </Badge>
              )}
              {semana === 3 && (
                <Badge className="bg-destructive/15 text-destructive border-destructive/30" variant="outline">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Semana fraca
                </Badge>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              Meta: <strong className="text-foreground">{formatBRL(metaReceita)}</strong>
              {pct > 0 && <span> ({pct}% da meta total)</span>} · {acoes.length} ações
            </div>

            {(qtdNovos + qtdRecorrentes) > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Novos {pctNovos}%</span>
                  <span>Recorrentes {pctRecorrentes}%</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden bg-muted flex">
                  <div className="h-full bg-cyan-500" style={{ width: `${pctNovos}%` }} />
                  <div className="h-full bg-primary" style={{ width: `${pctRecorrentes}%` }} />
                </div>
              </div>
            )}

            {Object.keys(contagemTipos).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(contagemTipos).map(([t, n]) => {
                  const m = TIPO_ACAO_META[t];
                  return (
                    <Badge
                      key={t}
                      variant="outline"
                      className={cn("border text-xs", m?.className || "bg-muted text-muted-foreground border-border")}
                    >
                      {m?.emoji || "•"} {n} {m?.label || t}
                    </Badge>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground pt-1">
              {diasPlanejados > 0 && (
                <span>
                  📅 <strong className="text-foreground">{diasPlanejados}</strong>{" "}
                  {diasPlanejados === 1 ? "dia planejado" : "dias planejados"}
                </span>
              )}
              {canaisCobertos.size > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span>Canais:</span>
                  {Array.from(canaisCobertos).map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px]">
                      {c === "Instagram" && "📸 "}
                      {c === "Email" && "✉️ "}
                      {c === "WhatsApp" && "💬 "}
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>


          <div className="flex gap-2">
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Todos os tipos</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {TIPO_ACAO_META[t]?.label || t}
                </option>
              ))}
            </select>
            <select
              value={filtroPublico}
              onChange={(e) => setFiltroPublico(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Todos públicos</option>
              {publicos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma ação para esta semana.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtradas.map((acao) => (
              <AcaoCard key={acao.id} acao={acao} onClick={() => onAbrir(acao)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AcaoCard({ acao, onClick }: { acao: any; onClick: () => void }) {
  const meta = TIPO_ACAO_META[acao.tipo_acao] || {
    label: acao.tipo_acao,
    emoji: "•",
    className: "bg-muted text-muted-foreground border-border",
  };
  return (
    <motion.button
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="text-left rounded-lg border bg-card p-4 space-y-2 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={cn("border", meta.className)}>
          {meta.emoji} {meta.label}
        </Badge>
        {acao.publico_alvo && (
          <Badge variant="secondary">{acao.publico_alvo}</Badge>
        )}
        <Badge
          variant="outline"
          className={cn("border ml-auto", STATUS_BADGE[acao.status] || "")}
        >
          {acao.status}
        </Badge>
      </div>
      <h3 className="font-semibold leading-snug">{acao.titulo}</h3>
      {acao.produto_foco && (
        <p className="text-xs text-muted-foreground">📦 {acao.produto_foco}</p>
      )}
      {acao.canais?.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {acao.canais.map((c: string) => (
            <span
              key={c}
              className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground pt-1 border-t mt-2">
        📅 Será exportado para o calendário em{" "}
        <strong className="text-foreground">{diaIdealParaTipo(acao.tipo_acao)}</strong>
      </p>
    </motion.button>
  );
}

function DrawerAcao({
  acao,
  onChange,
  onAprovar,
  onCancelar,
  onExportar,
}: {
  acao: any;
  onChange: (campo: string, valor: any) => void;
  onAprovar: () => void;
  onCancelar: () => void;
  onExportar: () => void;
}) {
  const meta = TIPO_ACAO_META[acao.tipo_acao];
  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2 flex-wrap">
          {meta && (
            <Badge variant="outline" className={cn("border", meta.className)}>
              {meta.emoji} {meta.label}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn("border", STATUS_BADGE[acao.status] || "")}
          >
            {acao.status}
          </Badge>
        </div>
        <SheetTitle className="font-serif">{acao.titulo}</SheetTitle>
        <SheetDescription className="whitespace-pre-wrap">
          {acao.descricao}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-6">
        {/* KPIs trafego */}
        {(acao.cps_alvo ||
          acao.roas_alvo ||
          acao.budget_semana ||
          acao.sessoes_alvo) && (
          <div className="grid grid-cols-2 gap-2">
            {acao.cps_alvo && (
              <KpiPill icon={Activity} label="CPS alvo" value={formatBRLDec(acao.cps_alvo)} />
            )}
            {acao.roas_alvo && (
              <KpiPill icon={TrendingUp} label="ROAS alvo" value={`${Number(acao.roas_alvo).toFixed(2)}x`} />
            )}
            {acao.budget_semana && (
              <KpiPill icon={DollarSign} label="Budget" value={formatBRL(acao.budget_semana)} />
            )}
            {acao.sessoes_alvo && (
              <KpiPill icon={Activity} label="Sessões" value={formatNumber(acao.sessoes_alvo)} />
            )}
          </div>
        )}

        {/* Copies */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Copies
          </h3>
          <RegenerarCopyButton acao={acao} onChange={onChange} />
        </div>
        <Tabs defaultValue="instagram">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="instagram">📸 Insta</TabsTrigger>
            <TabsTrigger value="email">✉️ E-mail</TabsTrigger>
            <TabsTrigger value="whatsapp">💬 WhatsApp</TabsTrigger>
            <TabsTrigger value="anuncio">📢 Anúncio</TabsTrigger>
          </TabsList>
          {[
            ["instagram", "copy_instagram"],
            ["email", "copy_email"],
            ["whatsapp", "copy_whatsapp"],
            ["anuncio", "copy_anuncio"],
          ].map(([k, campo]) => (
            <TabsContent key={k} value={k}>
              <Textarea
                defaultValue={acao[campo] || ""}
                onBlur={(e) =>
                  e.target.value !== (acao[campo] || "") &&
                  onChange(campo, e.target.value)
                }
                rows={10}
                placeholder="Copy ainda não gerado"
              />
            </TabsContent>
          ))}
        </Tabs>

        {/* Ações */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          {acao.status !== "aprovado" && (
            <Button onClick={onAprovar}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
            </Button>
          )}
          <Button variant="outline" onClick={onExportar}>
            <CalendarIcon className="mr-2 h-4 w-4" /> Exportar p/ calendário
          </Button>
          {acao.status !== "cancelado" && (
            <Button variant="destructive" onClick={onCancelar}>
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------- Regenerar Copy ----------------
const COPY_CHIPS: { label: string; text: string }[] = [
  { label: "🧵 Foco no tecido e qualidade", text: "Quero focar mais no tecido, caimento e durabilidade da peça." },
  { label: "⏰ Criar urgência elegante", text: "Criar urgência elegante, sem pressão agressiva — escassez sofisticada." },
  { label: "💝 Tom emocional e pessoal", text: "Tom mais íntimo e emocional, como uma mensagem pessoal de uma amiga." },
  { label: "👗 Destaque lifestyle", text: "Menos produto, mais estilo de vida, autoestima e empoderamento." },
  { label: "⭐ História de cliente", text: "Construir a copy a partir de uma história de cliente que transformou o look." },
  { label: "🎯 Mais direto e objetivo", text: "Tom mais direto e objetivo, sem floreios — convite claro à ação." },
];

function RegenerarCopyButton({
  acao,
  onChange,
}: {
  acao: any;
  onChange: (campo: string, valor: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [contexto, setContexto] = useState("");
  const [gerando, setGerando] = useState(false);
  const [preview, setPreview] = useState<{
    copy_instagram: string;
    copy_email: string;
    copy_whatsapp: string;
  } | null>(null);

  const addChip = (texto: string) => {
    setContexto((prev) => (prev ? `${prev.trim()}\n- ${texto}` : `- ${texto}`));
  };

  const gerar = async () => {
    setGerando(true);
    try {
      const produtoFoco = acao.produto_foco || "—";
      const userPrompt = `Acao comercial para Use Mariana Cardoso (marca premium moda feminina):

Tipo: ${acao.tipo_acao}
Titulo: ${acao.titulo}
Produto: ${produtoFoco}
Publico: ${acao.publico_alvo || "—"}
Canais: ${(acao.canais || []).join(", ")}
Meta da semana: R$ ${Number(acao.meta_receita_semana || 0).toLocaleString("pt-BR")}

INSTRUCOES ESPECIFICAS DO USUARIO:
${contexto || "Manter tom sofisticado e lifestyle da marca"}

Regras: NUNCA preco transacional. SEMPRE investimento exclusividade custo-por-uso.
Tom: sofisticado autentico empoderador como amiga que entende de moda.

Retorne JSON puro:
{
  "copy_instagram": "copy reels/feed lifestyle aspiracional max 5 linhas emojis sutis",
  "copy_email": "assunto: [titulo atrativo] | corpo: [narrativa 3-4 linhas investimento qualidade]",
  "copy_whatsapp": "mensagem pessoal exclusiva grupo VIP max 4 linhas como amiga de confianca"
}`;

      const raw = await callClaude(userPrompt);
      const json = safeParseJSONObject(raw);
      if (!json.copy_instagram && !json.copy_email && !json.copy_whatsapp) {
        throw new Error("IA não retornou copies válidas");
      }
      setPreview({
        copy_instagram: json.copy_instagram || "",
        copy_email: json.copy_email || "",
        copy_whatsapp: json.copy_whatsapp || "",
      });
    } catch (e: any) {
      toast.error("Erro ao gerar copy: " + (e?.message || "falha"));
    } finally {
      setGerando(false);
    }
  };

  const salvarTudo = async () => {
    if (!preview) return;
    await Promise.all([
      onChange("copy_instagram", preview.copy_instagram),
      onChange("copy_email", preview.copy_email),
      onChange("copy_whatsapp", preview.copy_whatsapp),
    ]);
    toast.success("Copies salvas!");
    setOpen(false);
    setPreview(null);
    setContexto("");
  };

  const fechar = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setPreview(null);
      setContexto("");
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-primary/40 text-primary hover:bg-primary/10"
      >
        <Sparkles className="mr-2 h-3.5 w-3.5" /> Regenerar copy
      </Button>

      <Dialog open={open} onOpenChange={fechar}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Regenerar copy — {acao.titulo}
            </DialogTitle>
            <DialogDescription>
              Oriente a IA sobre o que ajustar. Você pode revisar antes de salvar.
            </DialogDescription>
          </DialogHeader>

          {!preview ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">
                  O que você quer mudar ou aprofundar?
                </Label>
                <Textarea
                  value={contexto}
                  onChange={(e) => setContexto(e.target.value)}
                  rows={5}
                  className="mt-2"
                  placeholder={`Descreva livremente o que quer ajustar. Exemplos:
- Quero focar mais no tecido e durabilidade da peça
- Mencionar que é Dia das Mães e criar urgência elegante
- Tom mais íntimo, como se fosse uma mensagem pessoal
- Destacar que só tem tamanhos M e G disponíveis
- Criar uma história de cliente que transformou o look
- Menos produto, mais estilo de vida e empoderamento`}
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Sugestões rápidas (clique para adicionar):
                </p>
                <div className="flex flex-wrap gap-2">
                  {COPY_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => addChip(chip.text)}
                      className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/15 text-foreground transition-colors"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => fechar(false)}>
                  Cancelar
                </Button>
                <Button onClick={gerar} disabled={gerando}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {gerando ? "Gerando..." : "Gerar copies"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Revise e ajuste cada copy antes de salvar.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { key: "copy_instagram", icon: "📸", label: "Instagram" },
                  { key: "copy_email", icon: "✉️", label: "E-mail" },
                  { key: "copy_whatsapp", icon: "💬", label: "WhatsApp" },
                ].map((c) => (
                  <Card key={c.key} className="border-primary/20">
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                        <span>{c.icon}</span> {c.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <Textarea
                        value={(preview as any)[c.key]}
                        onChange={(e) =>
                          setPreview((prev) =>
                            prev ? { ...prev, [c.key]: e.target.value } : prev,
                          )
                        }
                        rows={10}
                        className="text-xs resize-none"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setPreview(null)}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Gerar novamente
                </Button>
                <Button onClick={salvarTudo}>
                  💾 Salvar todas as copies
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function KpisTrafegoTab({
  kpis,
  plano,
  investimentos,
  mes,
  onSalvarInvestimento,
}: {
  kpis: any[];
  plano: any;
  investimentos: any[];
  mes: string;
  onSalvarInvestimento: (mes: string, campo: string, v: number) => void;
}) {
  const ultimo = kpis[0];
  const ticketMedio =
    kpis.slice(0, 3).reduce((s, k) => s + Number(k.ticket_medio || 0), 0) /
    Math.max(kpis.slice(0, 3).length, 1);
  const taxaConv =
    kpis.slice(0, 3).reduce((s, k) => s + Number(k.taxa_conversao_pct || 0), 0) /
    Math.max(kpis.slice(0, 3).length, 1);
  const cpsHist =
    kpis.slice(0, 3).reduce((s, k) => s + Number(k.cps || 0), 0) /
    Math.max(kpis.slice(0, 3).length, 1);

  const [simReceita, setSimReceita] = useState("");
  const [simInv, setSimInv] = useState("");
  const sim = useMemo(() => {
    const r = Number(simReceita);
    const i = Number(simInv);
    if (!r || !i || !ticketMedio || !taxaConv)
      return null;
    const pedidos = r / ticketMedio;
    const sessoes = pedidos / (taxaConv / 100);
    const cps = i / sessoes;
    const roas = r / i;
    let cor: "success" | "warning" | "destructive" = "success";
    let label = "Viável";
    if (cps > cpsHist * 2) {
      cor = "destructive";
      label = "Agressivo";
    } else if (cps > cpsHist * 1.2) {
      cor = "warning";
      label = "Desafiador";
    }
    return { pedidos, sessoes, cps, roas, cor, label };
  }, [simReceita, simInv, ticketMedio, taxaConv, cpsHist]);

  return (
    <div className="space-y-6">
      {/* Cards atuais vs plano */}
      {ultimo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ComparativoCard
            label="CPS"
            atual={formatBRLDec(ultimo.cps)}
            meta={plano ? formatBRLDec(plano.meta_cps_maximo) : "—"}
            ok={plano ? Number(ultimo.cps) <= Number(plano.meta_cps_maximo) : true}
          />
          <ComparativoCard
            label="ROAS"
            atual={`${Number(ultimo.roas || 0).toFixed(2)}x`}
            meta={plano ? `${Number(plano.meta_roas || 0).toFixed(2)}x` : "—"}
            ok={plano ? Number(ultimo.roas) >= Number(plano.meta_roas) : true}
          />
          <ComparativoCard
            label="Tx Conversão"
            atual={`${Number(ultimo.taxa_conversao_pct || 0).toFixed(2)}%`}
            meta={plano ? `${Number(plano.meta_conversao || 0).toFixed(2)}%` : "—"}
            ok={
              plano
                ? Number(ultimo.taxa_conversao_pct) >=
                  Number(plano.meta_conversao)
                : true
            }
          />
          <ComparativoCard
            label="Sessões"
            atual={formatNumber(ultimo.total_sessoes)}
            meta={plano ? formatNumber(plano.meta_sessoes) : "—"}
            ok={plano ? Number(ultimo.total_sessoes) >= Number(plano.meta_sessoes) : true}
          />
        </div>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico (últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Sessões</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead>Invest.</TableHead>
                <TableHead>CPS</TableHead>
                <TableHead>ROAS</TableHead>
                <TableHead>Conv.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.map((k) => (
                <TableRow key={k.mes_referencia}>
                  <TableCell className="font-medium">{k.mes_referencia}</TableCell>
                  <TableCell>{formatNumber(k.total_sessoes)}</TableCell>
                  <TableCell>{formatNumber(k.total_pedidos)}</TableCell>
                  <TableCell>{formatBRLDec(k.ticket_medio)}</TableCell>
                  <TableCell>{formatBRL(k.investimento_total)}</TableCell>
                  <TableCell>{formatBRLDec(k.cps)}</TableCell>
                  <TableCell>{Number(k.roas || 0).toFixed(2)}x</TableCell>
                  <TableCell>
                    {Number(k.taxa_conversao_pct || 0).toFixed(2)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Simulador */}
      <Card>
        <CardHeader>
          <CardTitle>Simulador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Meta receita (R$)</Label>
              <Input
                type="number"
                value={simReceita}
                onChange={(e) => setSimReceita(e.target.value)}
              />
            </div>
            <div>
              <Label>Investimento (R$)</Label>
              <Input
                type="number"
                value={simInv}
                onChange={(e) => setSimInv(e.target.value)}
              />
            </div>
          </div>
          {sim && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiPill icon={ShoppingBag} label="Pedidos" value={formatNumber(Math.round(sim.pedidos))} />
                <KpiPill icon={Activity} label="Sessões" value={formatNumber(Math.round(sim.sessoes))} />
                <KpiPill icon={DollarSign} label="CPS" value={formatBRLDec(sim.cps)} />
                <KpiPill icon={TrendingUp} label="ROAS" value={`${sim.roas.toFixed(2)}x`} />
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "border text-sm px-3 py-1",
                  sim.cor === "success" &&
                    "bg-success/15 text-success border-success/30",
                  sim.cor === "warning" &&
                    "bg-warning/15 text-warning border-warning/30",
                  sim.cor === "destructive" &&
                    "bg-destructive/15 text-destructive border-destructive/30",
                )}
              >
                {sim.label}
              </Badge>
            </>
          )}
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Info className="h-3 w-3" />
            Baseado em conversão de {taxaConv.toFixed(2)}% e ticket médio de{" "}
            {formatBRLDec(ticketMedio)} (últimos 3 meses)
          </p>
        </CardContent>
      </Card>

      {/* Investimentos */}
      <Card>
        <CardHeader>
          <CardTitle>Investimentos por mês</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Facebook</TableHead>
                <TableHead>Google</TableHead>
                <TableHead>Outros</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investimentos.map((inv) => {
                const total =
                  Number(inv.facebook_ads || 0) +
                  Number(inv.google_ads || 0) +
                  Number(inv.outros || 0);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {inv.mes_referencia}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="h-8 w-28"
                        defaultValue={inv.facebook_ads || 0}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== Number(inv.facebook_ads || 0))
                            onSalvarInvestimento(inv.mes_referencia, "facebook_ads", v);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="h-8 w-28"
                        defaultValue={inv.google_ads || 0}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== Number(inv.google_ads || 0))
                            onSalvarInvestimento(inv.mes_referencia, "google_ads", v);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="h-8 w-28"
                        defaultValue={inv.outros || 0}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== Number(inv.outros || 0))
                            onSalvarInvestimento(inv.mes_referencia, "outros", v);
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatBRL(total)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ComparativoCard({
  label,
  atual,
  meta,
  ok,
}: {
  label: string;
  atual: string;
  meta: string;
  ok: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-1",
        ok ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30",
      )}
    >
      <div className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-serif font-bold">{atual}</div>
      <div className="text-xs text-muted-foreground">Meta: {meta}</div>
    </div>
  );
}
