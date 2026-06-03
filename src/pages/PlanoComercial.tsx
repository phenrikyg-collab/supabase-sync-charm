import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Target,
  RefreshCw,
  CheckCircle2,
  Calendar as CalendarIcon,
  Flame,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useNavigate } from "react-router-dom";

const formatBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

const formatDDMM = (d: string | null | undefined) => {
  if (!d) return "—";
  const p = d.split("-");
  if (p.length !== 3) return d;
  return `${p[2]}/${p[1]}`;
};

const mesLabel = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${nomes[m - 1]} ${a}`;
};

const addMonths = (mes: string, delta: number) => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const currentMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const loadingMessages = [
  "Analisando dados do negócio...",
  "Identificando oportunidades do mês...",
  "Estruturando as 4 campanhas...",
  "Definindo ofertas e gatilhos...",
];

const corBorda = (n: number) => {
  const m: Record<number, string> = {
    1: "border-l-blue-500",
    2: "border-l-green-500",
    3: "border-l-orange-500",
    4: "border-l-purple-500",
  };
  return m[n] ?? "border-l-gray-400";
};

const corFase = (fase: string) => {
  const f = (fase || "").toLowerCase();
  if (f.includes("pre")) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (f.includes("abertura")) return "bg-green-100 text-green-800 border-green-300";
  if (f.includes("meio")) return "bg-blue-100 text-blue-800 border-blue-300";
  if (f.includes("encerr")) return "bg-red-100 text-red-800 border-red-300";
  return "bg-gray-100 text-gray-800 border-gray-300";
};

type Plano = any;
type Campanha = any;

export default function PlanoComercial() {
  const navigate = useNavigate();
  const [mesAtual, setMesAtual] = useState<string>(currentMes());
  const [plano, setPlano] = useState<Plano | null>(null);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado 1
  const [metaReceita, setMetaReceita] = useState<string>("");
  const [metaImportada, setMetaImportada] = useState(false);
  const [pctAquisicao, setPctAquisicao] = useState<number>(60);
  const [briefing, setBriefing] = useState<string>("");
  const [gerando, setGerando] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // Expansão
  const [expandida, setExpandida] = useState<string | null>(null);

  // Regenerar campanha
  const [regenAlvo, setRegenAlvo] = useState<Campanha | null>(null);
  const [regenInstr, setRegenInstr] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);

  // Exportar calendário
  const [exportConfirm, setExportConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setExpandida(null);
    const dataInicio = `${mesAtual}-01`;

    const { data: p } = await supabase
      .from("planos_comerciais")
      .select("*")
      .eq("mes_referencia", mesAtual)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setPlano(p);

    if (p) {
      const { data: c } = await supabase
        .from("campanhas_comerciais")
        .select("*")
        .eq("mes_referencia", mesAtual)
        .order("numero", { ascending: true });
      setCampanhas(c ?? []);
    } else {
      setCampanhas([]);
      // Buscar meta financeira
      const { data: meta } = await supabase
        .from("metas_financeiras")
        .select("meta_mensal")
        .gte("mes", dataInicio)
        .lte("mes", dataInicio)
        .maybeSingle();
      if (meta?.meta_mensal) {
        setMetaReceita(String(meta.meta_mensal));
        setMetaImportada(true);
      } else {
        setMetaReceita("");
        setMetaImportada(false);
      }
      setBriefing("");
      setPctAquisicao(60);
    }
    setLoading(false);
  }, [mesAtual]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Animação loading messages
  useEffect(() => {
    if (!gerando) return;
    const i = window.setInterval(() => {
      setLoadingMsgIdx((x) => (x + 1) % loadingMessages.length);
    }, 2500);
    return () => window.clearInterval(i);
  }, [gerando]);

  const handleGerar = async () => {
    const meta = parseFloat(metaReceita);
    if (!meta || meta <= 0) {
      toast.error("Informe uma meta de receita válida");
      return;
    }
    setGerando(true);
    setLoadingMsgIdx(0);
    try {
      const body = {
        mes_referencia: mesAtual,
        meta_receita: meta,
        pct_aquisicao: pctAquisicao,
        pct_retencao: 100 - pctAquisicao,
        briefing,
      };
      await invokeEdgeFunction("generate-commercial-plan", body, {
        timeoutMs: 120_000,
      });
      toast.success("Plano gerado com sucesso!");
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar plano");
    } finally {
      setGerando(false);
    }
  };

  const handleAprovarPlano = async () => {
    if (!plano) return;
    const { error } = await supabase
      .from("planos_comerciais")
      .update({ status: "aprovado" })
      .eq("id", plano.id);
    if (error) {
      toast.error("Erro ao aprovar plano");
      return;
    }
    toast.success("Plano aprovado!");
    carregar();
  };

  const handleAprovarCampanha = async (c: Campanha) => {
    const { error } = await supabase
      .from("campanhas_comerciais")
      .update({ status: "aprovado" })
      .eq("id", c.id);
    if (error) {
      toast.error("Erro ao aprovar campanha");
      return;
    }
    toast.success("Campanha aprovada");
    carregar();
  };

  const handleRegenerarPlano = async () => {
    if (!plano) return;
    if (!confirm("Apagar este plano e suas campanhas para gerar um novo?")) return;
    await supabase.from("campanhas_comerciais").delete().eq("mes_referencia", mesAtual);
    await supabase.from("planos_comerciais").delete().eq("id", plano.id);
    toast.success("Plano apagado. Configure um novo.");
    carregar();
  };

  const handleSalvarCopy = async (c: Campanha, campo: string, valor: string) => {
    if (valor === (c[campo] ?? "")) return;
    const { error } = await supabase
      .from("campanhas_comerciais")
      .update({ [campo]: valor })
      .eq("id", c.id);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Salvo");
    setCampanhas((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, [campo]: valor } : x)),
    );
  };

  const handleRegenerarCampanha = async () => {
    if (!regenAlvo) return;
    setRegenLoading(true);
    try {
      const prompt = `Regenere esta campanha aplicando o ajuste solicitado. Mantenha a estrutura JSON.

CAMPANHA ATUAL: ${JSON.stringify(regenAlvo)}

AJUSTE: ${regenInstr}

Retorne APENAS JSON puro (sem markdown) com os mesmos campos da campanha atualizada, no formato:
{
  "nome_comercial": "...",
  "subtitulo": "...",
  "conceito_narrativo": "...",
  "novos": { "oferta": "...", "gatilho": "...", "mecanica": "..." },
  "recorrentes": { "oferta": "...", "gatilho": "...", "mecanica": "..." },
  "kits": [{ "nome": "...", "produtos": "...", "mecanica": "...", "preco_sugerido": "..." }],
  "plano_diario": [{ "data": "YYYY-MM-DD", "fase": "...", "canal_novos": "...", "mensagem_novos": "...", "canal_vip": "...", "mensagem_vip": "...", "gatilho": "..." }],
  "estrategia_canais": {
    "instagram_reels": "...", "instagram_feed": "...", "instagram_stories": "...",
    "email": "...", "whatsapp_vip": "...", "midia_paga": "..."
  },
  "metricas": ["..."],
  "kpi_prioritario": "...",
  "resultado_esperado": { "receita_novos": 0, "receita_recorrentes": 0, "pedidos_totais": 0 }
}`;
      const raw = await callClaude(prompt);
      const nova = safeParseJSONObject(raw);
      if (!nova || !Object.keys(nova).length) throw new Error("Resposta inválida da IA");
      const upd: any = {
        nome_comercial: nova.nome_comercial ?? regenAlvo.nome_comercial,
        subtitulo: nova.subtitulo ?? regenAlvo.subtitulo,
        conceito_narrativo: nova.conceito_narrativo ?? regenAlvo.conceito_narrativo,
        novos_oferta: nova.novos?.oferta ?? regenAlvo.novos_oferta,
        novos_gatilho: nova.novos?.gatilho ?? regenAlvo.novos_gatilho,
        novos_mecanica: nova.novos?.mecanica ?? regenAlvo.novos_mecanica,
        rec_oferta: nova.recorrentes?.oferta ?? regenAlvo.rec_oferta,
        rec_gatilho: nova.recorrentes?.gatilho ?? regenAlvo.rec_gatilho,
        rec_mecanica: nova.recorrentes?.mecanica ?? regenAlvo.rec_mecanica,
        kits: nova.kits ?? regenAlvo.kits,
        plano_diario: nova.plano_diario ?? regenAlvo.plano_diario,
        estrategia_instagram_reels: nova.estrategia_canais?.instagram_reels ?? regenAlvo.estrategia_instagram_reels,
        estrategia_instagram_feed: nova.estrategia_canais?.instagram_feed ?? regenAlvo.estrategia_instagram_feed,
        estrategia_instagram_stories: nova.estrategia_canais?.instagram_stories ?? regenAlvo.estrategia_instagram_stories,
        estrategia_email: nova.estrategia_canais?.email ?? regenAlvo.estrategia_email,
        estrategia_whatsapp: nova.estrategia_canais?.whatsapp_vip ?? regenAlvo.estrategia_whatsapp,
        estrategia_midia_paga: nova.estrategia_canais?.midia_paga ?? regenAlvo.estrategia_midia_paga,
        metricas: nova.metricas ?? regenAlvo.metricas,
        kpi_prioritario: nova.kpi_prioritario ?? regenAlvo.kpi_prioritario,
        receita_esperada_novos: nova.resultado_esperado?.receita_novos ?? regenAlvo.receita_esperada_novos,
        receita_esperada_rec: nova.resultado_esperado?.receita_recorrentes ?? regenAlvo.receita_esperada_rec,
        pedidos_esperados: nova.resultado_esperado?.pedidos_totais ?? regenAlvo.pedidos_esperados,
      };
      const { error } = await supabase
        .from("campanhas_comerciais")
        .update(upd)
        .eq("id", regenAlvo.id);
      if (error) throw error;
      toast.success("Campanha regenerada!");
      setRegenAlvo(null);
      setRegenInstr("");
      carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao regenerar");
    } finally {
      setRegenLoading(false);
    }
  };

  const handleExportar = async () => {
    if (!plano) return;
    setExporting(true);
    try {
      await invokeEdgeFunction("export-plan-to-calendar", {
        plano_id: plano.id,
        mes_referencia: mesAtual,
      });
      toast.success("Calendário gerado!", {
        action: {
          label: "Ver Calendário →",
          onClick: () => navigate("/conteudo-crm"),
        },
      });
      setExportConfirm(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao exportar");
    } finally {
      setExporting(false);
    }
  };

  // ============ RENDER ============
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Target className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Plano Comercial</h1>
          {plano && (
            <Badge
              variant={plano.status === "aprovado" ? "default" : "secondary"}
              className={plano.status === "aprovado" ? "bg-green-600" : ""}
            >
              {plano.status}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setMesAtual(addMonths(mesAtual, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-4 py-2 border rounded-md font-medium min-w-[160px] text-center">
            {mesLabel(mesAtual)}
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setMesAtual(addMonths(mesAtual, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
        </div>
      )}

      {/* ESTADO 1 - SEM PLANO */}
      {!loading && !plano && (
        <div className="flex items-center justify-center py-10">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-500" />
                Criar Plano para {mesLabel(mesAtual)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label>Meta de receita (R$)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={metaReceita}
                    onChange={(e) => {
                      setMetaReceita(e.target.value);
                      setMetaImportada(false);
                    }}
                    placeholder="Ex: 150000"
                  />
                  {metaImportada && (
                    <Badge className="bg-green-100 text-green-800 border border-green-300 whitespace-nowrap">
                      ✓ Meta importada
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <Label>Distribuição Aquisição × Retenção</Label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div>
                    <Label className="text-xs text-muted-foreground">% Aquisição</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={pctAquisicao}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        setPctAquisicao(v);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">% Retenção</Label>
                    <Input type="number" value={100 - pctAquisicao} disabled />
                  </div>
                </div>
              </div>

              <div>
                <Label>Briefing do mês</Label>
                <Textarea
                  rows={8}
                  value={briefing}
                  onChange={(e) => setBriefing(e.target.value)}
                  placeholder={`Descreva o que acontece neste mês:
• Lançamentos e datas (ex: lançamento dia 02, live dia 09)
• Campanhas planejadas (ex: Campanha Dia das Mães 01-10/05)
• Eventos especiais, temas, foco estratégico
• Produtos em destaque, estoque alto, prioridades`}
                />
              </div>

              <Button
                onClick={handleGerar}
                disabled={gerando}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                size="lg"
              >
                {gerando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Gerar Plano com IA
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading overlay ao gerar */}
      {gerando && (
        <div className="fixed inset-0 bg-background/85 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-lg font-medium animate-pulse">
              {loadingMessages[loadingMsgIdx]}
            </p>
          </div>
        </div>
      )}

      {/* ESTADO 2/3 - PLANO GERADO */}
      {!loading && plano && (
        <div className="space-y-6">
          {/* Botões de ação */}
          <div className="flex flex-wrap gap-2 justify-end">
            {plano.status !== "aprovado" && (
              <Button
                onClick={handleAprovarPlano}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4" /> Aprovar Plano
              </Button>
            )}
            <Button variant="outline" onClick={handleRegenerarPlano}>
              <RefreshCw className="h-4 w-4" /> Regenerar
            </Button>
          </div>

          {/* Estado 3 banner */}
          {plano.status === "aprovado" && (
            <Card className="bg-green-50 border-green-300">
              <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-green-800 font-semibold">
                  <CheckCircle2 className="h-5 w-5" /> Plano Aprovado
                </div>
                <Button
                  onClick={() => setExportConfirm(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <CalendarIcon className="h-4 w-4" /> Gerar Calendário de Conteúdo
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Narrativa do mês */}
          <Card className="bg-amber-50/60 border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-amber-700" />
                Estratégia de {mesLabel(mesAtual).split(" ")[0]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {plano.resumo_ia || "—"}
              </p>
              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-amber-200">
                <div>
                  <p className="text-xs text-muted-foreground">Meta</p>
                  <p className="text-lg font-bold">{formatBRL(plano.meta_receita)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pedidos</p>
                  <p className="text-lg font-bold">{plano.meta_pedidos ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ticket Médio</p>
                  <p className="text-lg font-bold">
                    {formatBRL(plano.meta_ticket_medio)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Campanhas */}
          {campanhas.length === 0 && (
            <p className="text-center text-muted-foreground py-10">
              Nenhuma campanha encontrada para este plano.
            </p>
          )}

          {campanhas.map((c) => (
            <Card key={c.id} className={cn("border-l-4", corBorda(c.numero))}>
              <CardContent className="p-5 space-y-4">
                {/* Linha 1 - Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">CAMPANHA {c.numero}</Badge>
                  {c.tipo && <Badge variant="outline">{c.tipo}</Badge>}
                  {c.peso_pct != null && <Badge variant="outline">{c.peso_pct}%</Badge>}
                  {c.meta_receita != null && (
                    <Badge className="bg-primary/10 text-primary border-primary/30">
                      {formatBRL(c.meta_receita)}
                    </Badge>
                  )}
                  {c.status === "aprovado" && (
                    <Badge className="bg-green-600">aprovado</Badge>
                  )}
                </div>

                {/* Linha 2 - Nome */}
                <div>
                  <h3 className="text-xl font-bold">{c.nome_comercial}</h3>
                  {c.subtitulo && (
                    <p className="text-sm text-muted-foreground mt-0.5">{c.subtitulo}</p>
                  )}
                </div>

                {/* Linha 3 - Período */}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    {formatDDMM(c.periodo_inicio)} a {formatDDMM(c.periodo_fim)}
                  </span>
                  {c.pre_aquecimento_inicio && (
                    <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                      <Flame className="h-3 w-3 mr-1" /> Pré-aquecimento: {formatDDMM(c.pre_aquecimento_inicio)}
                    </Badge>
                  )}
                </div>

                {/* Linha 4 - Dois blocos */}
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-lg p-4 bg-blue-50 border border-blue-200">
                    <p className="font-semibold text-blue-900 mb-2">👥 Clientes Novos</p>
                    <div className="space-y-1.5 text-sm">
                      <p><span className="font-medium">Oferta:</span> {c.novos_oferta || "—"}</p>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Gatilho:</span>
                        {c.novos_gatilho ? (
                          <Badge variant="outline">{c.novos_gatilho}</Badge>
                        ) : "—"}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(c.novos_canais ?? []).map((ch: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{ch}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg p-4 bg-amber-50 border border-amber-200">
                    <p className="font-semibold text-amber-900 mb-2">⭐ Clientes VIP</p>
                    <div className="space-y-1.5 text-sm">
                      <p><span className="font-medium">Oferta:</span> {c.rec_oferta || "—"}</p>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Gatilho:</span>
                        {c.rec_gatilho ? (
                          <Badge variant="outline">{c.rec_gatilho}</Badge>
                        ) : "—"}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(c.rec_canais ?? []).map((ch: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{ch}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linha 5 - Kits */}
                {Array.isArray(c.kits) && c.kits.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">🎁 Kits:</span>
                    {c.kits.map((k: any, i: number) => (
                      <Badge key={i} variant="outline">{k?.nome || `Kit ${i + 1}`}</Badge>
                    ))}
                  </div>
                )}

                {/* Linha 6 - Botões */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandida(expandida === c.id ? null : c.id)}
                  >
                    {expandida === c.id ? "Ocultar detalhes ↑" : "Ver detalhes ↓"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRegenAlvo(c);
                      setRegenInstr("");
                    }}
                  >
                    <RefreshCw className="h-3 w-3" /> Regenerar campanha
                  </Button>
                  {c.status !== "aprovado" && (
                    <Button
                      size="sm"
                      onClick={() => handleAprovarCampanha(c)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Aprovar campanha
                    </Button>
                  )}
                </div>

                {/* Expansão */}
                {expandida === c.id && <DetalheCampanha campanha={c} onSalvarCopy={handleSalvarCopy} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Regenerar */}
      <Dialog open={!!regenAlvo} onOpenChange={(o) => !o && setRegenAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerar: {regenAlvo?.nome_comercial}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>O que deseja ajustar?</Label>
            <Textarea
              rows={5}
              value={regenInstr}
              onChange={(e) => setRegenInstr(e.target.value)}
              placeholder="Ex: aumentar foco em novos clientes, trocar gatilho para urgência, adicionar kit especial para Dia dos Namorados..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenAlvo(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegenerarCampanha}
              disabled={regenLoading || !regenInstr.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {regenLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Regenerar com IA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Exportar */}
      <Dialog open={exportConfirm} onOpenChange={setExportConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar calendário de conteúdo</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Criar entradas no calendário para as {campanhas.length} campanhas de {mesLabel(mesAtual)}?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportConfirm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExportar} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarIcon className="h-4 w-4" />}
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Sub-componente: Detalhe ============
function DetalheCampanha({
  campanha,
  onSalvarCopy,
}: {
  campanha: any;
  onSalvarCopy: (c: any, campo: string, valor: string) => void;
}) {
  const c = campanha;
  const planoDiario: any[] = Array.isArray(c.plano_diario) ? c.plano_diario : [];
  const metricas: string[] = Array.isArray(c.metricas) ? c.metricas : [];
  const kits: any[] = Array.isArray(c.kits) ? c.kits : [];

  return (
    <div className="pt-4 border-t">
      <Tabs defaultValue="estrategia">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="estrategia">📋 Estratégia</TabsTrigger>
          <TabsTrigger value="diario">📅 Plano Diário</TabsTrigger>
          <TabsTrigger value="copies">📢 Copies por Canal</TabsTrigger>
          <TabsTrigger value="metricas">📊 Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="estrategia" className="space-y-4 mt-4">
          {c.conceito_narrativo && (
            <Card className="bg-muted/40">
              <CardContent className="p-4 text-sm whitespace-pre-wrap leading-relaxed">
                {c.conceito_narrativo}
              </CardContent>
            </Card>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 space-y-2 text-sm">
                <p className="font-semibold text-blue-900">Clientes Novos</p>
                <p><span className="font-medium">Oferta:</span> {c.novos_oferta || "—"}</p>
                <p><span className="font-medium">Gatilho:</span> {c.novos_gatilho || "—"}</p>
                <p><span className="font-medium">Mecânica:</span> {c.novos_mecanica || "—"}</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 space-y-2 text-sm">
                <p className="font-semibold text-amber-900">Clientes VIP</p>
                <p><span className="font-medium">Oferta:</span> {c.rec_oferta || "—"}</p>
                <p><span className="font-medium">Gatilho:</span> {c.rec_gatilho || "—"}</p>
                <p><span className="font-medium">Mecânica:</span> {c.rec_mecanica || "—"}</p>
              </CardContent>
            </Card>
          </div>
          {kits.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-sm">🎁 Combos e Ofertas</p>
              <div className="grid gap-2">
                {kits.map((k, i) => (
                  <Card key={i}>
                    <CardContent className="p-3 text-sm space-y-1">
                      <p className="font-semibold">{k.nome || `Combo ${i + 1}`}</p>
                      {k.produtos && <p><span className="text-muted-foreground">Produtos:</span> {k.produtos}</p>}
                      {k.condicao && <p><span className="text-muted-foreground">Condição:</span> {k.condicao}</p>}
                      {k.mecanica && !k.condicao && <p><span className="text-muted-foreground">Mecânica:</span> {k.mecanica}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="diario" className="mt-4">
          {planoDiario.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sem plano diário definido.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead>Canal Novos</TableHead>
                    <TableHead>Mensagem Novos</TableHead>
                    <TableHead>Canal VIP</TableHead>
                    <TableHead>Mensagem VIP</TableHead>
                    <TableHead>Gatilho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planoDiario.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{formatDDMM(d.data)}</TableCell>
                      <TableCell>
                        {d.fase && (
                          <Badge variant="outline" className={cn("border", corFase(d.fase))}>
                            {d.fase}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{d.canal_novos || "—"}</TableCell>
                      <TableCell className="text-xs max-w-xs">{d.mensagem_novos || "—"}</TableCell>
                      <TableCell className="text-xs">{d.canal_vip || "—"}</TableCell>
                      <TableCell className="text-xs max-w-xs">{d.mensagem_vip || "—"}</TableCell>
                      <TableCell className="text-xs">{d.gatilho || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="copies" className="mt-4 space-y-4">
          <CopyEditor
            label="📱 Instagram Reels — Copy pronta"
            valorInicial={c.estrategia_instagram_reels || ""}
            onSave={(v) => onSalvarCopy(c, "estrategia_instagram_reels", v)}
          />
          <CopyEditor
            label="🖼️ Instagram Feed — Copy pronta"
            valorInicial={c.estrategia_instagram_feed || ""}
            onSave={(v) => onSalvarCopy(c, "estrategia_instagram_feed", v)}
          />
          <CopyJsonFrames
            label="⭕ Instagram Stories"
            valor={c.estrategia_instagram_stories}
            campos={[
              { key: "f1", label: "Frame 1" },
              { key: "f2", label: "Frame 2" },
              { key: "f3", label: "Frame 3 (CTA)" },
            ]}
            onSave={(novo) => onSalvarCopy(c, "estrategia_instagram_stories", novo)}
          />
          <CopyEditor
            label="💬 Grupo VIP — Mensagem exclusiva"
            valorInicial={c.estrategia_whatsapp || ""}
            onSave={(v) => onSalvarCopy(c, "estrategia_whatsapp", v)}
          />
          <CopyJsonFrames
            label="🆕 Novos Clientes"
            valor={c.estrategia_midia_paga}
            campos={[
              { key: "abordagem", label: "Abordagem" },
              { key: "oferta", label: "Oferta de entrada" },
              { key: "cta", label: "CTA" },
            ]}
            onSave={(novo) => onSalvarCopy(c, "estrategia_midia_paga", novo)}
          />
          <CopyJsonFrames
            label="🔁 Conversão 2ª Compra"
            valor={c.estrategia_email}
            campos={[
              { key: "gatilho", label: "Gatilho" },
              { key: "oferta", label: "Oferta" },
              { key: "mensagem", label: "Mensagem WhatsApp" },
            ]}
            onSave={(novo) => onSalvarCopy(c, "estrategia_email", novo)}
          />
        </TabsContent>

        <TabsContent value="metricas" className="mt-4 space-y-4">
          {metricas.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-sm">Métricas</p>
              <ul className="text-sm list-disc list-inside space-y-0.5">
                {metricas.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          {c.kpi_prioritario && (
            <Card className="bg-primary/5 border-primary/30">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground mb-1">KPI Prioritário</p>
                <p className="text-lg font-bold text-primary">{c.kpi_prioritario}</p>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Receita Novos</p>
                <p className="text-lg font-bold">{formatBRL(c.receita_esperada_novos)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Receita VIP</p>
                <p className="text-lg font-bold">{formatBRL(c.receita_esperada_rec)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Pedidos</p>
                <p className="text-lg font-bold">{c.pedidos_esperados ?? "—"}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CopyEditor({
  label,
  valorInicial,
  onSave,
}: {
  label: string;
  valorInicial: string;
  onSave: (v: string) => void;
}) {
  const [valor, setValor] = useState(valorInicial);
  useEffect(() => setValor(valorInicial), [valorInicial]);
  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      <Textarea
        rows={4}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => onSave(valor)}
        className="mt-1"
      />
    </div>
  );
}

function safeParseJson(v: any): Record<string, any> | null {
  if (!v) return null;
  if (typeof v === "object") return v;
  try {
    const p = JSON.parse(v);
    return typeof p === "object" && p ? p : null;
  } catch {
    return null;
  }
}

function CopyJsonFrames({
  label,
  valor,
  campos,
  onSave,
}: {
  label: string;
  valor: any;
  campos: { key: string; label: string }[];
  onSave: (novoJson: string) => void;
}) {
  const parsed = safeParseJson(valor);
  const [state, setState] = useState<Record<string, string>>(() => {
    if (parsed) {
      const o: Record<string, string> = {};
      campos.forEach((c) => (o[c.key] = parsed[c.key] ?? ""));
      return o;
    }
    return Object.fromEntries(campos.map((c) => [c.key, ""]));
  });
  useEffect(() => {
    const p = safeParseJson(valor);
    if (p) {
      const o: Record<string, string> = {};
      campos.forEach((c) => (o[c.key] = p[c.key] ?? ""));
      setState(o);
    }
  }, [valor]);

  // Texto direto fallback (quando não é JSON válido)
  if (valor && !parsed) {
    return (
      <CopyEditor
        label={label}
        valorInicial={typeof valor === "string" ? valor : String(valor)}
        onSave={onSave}
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium">{label}</p>
        {campos.map((c) => (
          <div key={c.key}>
            <Label className="text-xs text-muted-foreground">{c.label}</Label>
            <Textarea
              rows={2}
              value={state[c.key] || ""}
              onChange={(e) => setState((s) => ({ ...s, [c.key]: e.target.value }))}
              onBlur={() => onSave(JSON.stringify({ ...state }))}
              className="mt-1"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
