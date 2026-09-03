import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  brl,
  COORTES,
  COORTE_ORDEM,
  CoorteKey,
  dataBR,
  dataDDMM,
  DOW_CURTO,
  num,
  pct,
  pick,
} from "@/lib/coortes";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const hoje = new Date();

const coorteDaSemana = (s: any, k: CoorteKey) => {
  if (!s) return {};
  if (k === "aquisicao") return pick(s, "aquisicao", "novos", "novo") ?? {};
  if (k === "segunda_compra") return pick(s, "segunda_compra", "segunda") ?? {};
  return pick(s, "fieis", "fiel", "recorrentes_fieis") ?? {};
};

const n = (v: unknown) => Number(v ?? 0);

const csvEscape = (v: unknown) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/* ------------------------------------------------------------------ */
/* página                                                              */
/* ------------------------------------------------------------------ */

export default function PlanoComercial() {
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);

  const [plano, setPlano] = useState<any>(null);
  const [estoque, setEstoque] = useState<any>(null);
  const [padrao, setPadrao] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erroRpc, setErroRpc] = useState<string | null>(null);
  const [erroEstoque, setErroEstoque] = useState<string | null>(null);
  const [pctAquisicao, setPctAquisicao] = useState(80);
  const [pctAquisicaoInput, setPctAquisicaoInput] = useState("80");
  const TOP_PRODUTOS = 8;

  const commitPctAquisicao = () => {
    const v = Math.min(100, Math.max(0, Math.round(Number(pctAquisicaoInput) || 0)));
    setPctAquisicaoInput(String(v));
    setPctAquisicao(v);
  };

  // meta de lançamento p/ fiéis
  const [planoComercialId, setPlanoComercialId] = useState<string | null>(null);
  const [metaFieisPedidos, setMetaFieisPedidos] = useState("");
  const [metaFieisTicket, setMetaFieisTicket] = useState("");
  const [salvandoMeta, setSalvandoMeta] = useState(false);

  const mesRef = `${ano}-${String(mes).padStart(2, "0")}`;

  const carregar = useCallback(async () => {
    setLoading(true);
    setErroRpc(null);
    setErroEstoque(null);
    try {
      const [r1, r2, r3] = await Promise.all([
        supabase.rpc("plano_comercial_semanal", {
          p_ano: ano,
          p_mes: mes,
          p_meses_padrao: 6,
          p_pct_midia_aquisicao: pctAquisicao,
        }),
        supabase.rpc("necessidade_estoque_plano", {
          p_ano: ano,
          p_mes: mes,
          p_top_produtos: TOP_PRODUTOS,
        }),
        supabase.rpc("padrao_pedidos", { p_meses: 6 }),
      ]);
      if (r1.error) throw r1.error;
      setPlano(r1.data ?? null);
      if (r2.error) {
        setEstoque(null);
        setErroEstoque(r2.error.message || "Falha ao carregar necessidade de estoque");
      } else if (!r2.data) {
        setEstoque(null);
        setErroEstoque("A RPC necessidade_estoque_plano não retornou dados.");
      } else {
        setEstoque(r2.data);
      }
      setPadrao(r3.error ? null : r3.data ?? null);
    } catch (e: any) {
      setErroRpc(e?.message || "Erro ao carregar o plano comercial");
      setPlano(null);
      setEstoque(null);
      setPadrao(null);
    } finally {
      setLoading(false);
    }
  }, [ano, mes, pctAquisicao]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("planos_comerciais")
        .select("*")
        .eq("mes_referencia", mesRef)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPlanoComercialId((data as any)?.id ?? null);
      setMetaFieisPedidos(
        (data as any)?.meta_lancamento_fieis_pedidos != null
          ? String((data as any).meta_lancamento_fieis_pedidos)
          : "",
      );
      setMetaFieisTicket(
        (data as any)?.meta_lancamento_fieis_ticket != null
          ? String((data as any).meta_lancamento_fieis_ticket)
          : "",
      );
    })();
  }, [mesRef]);

  const navegar = (delta: number) => {
    const d = new Date(ano, mes - 1 + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth() + 1);
  };

  /* ---------------- dados derivados ---------------- */

  const erroPlano: string | null = plano?.erro ?? null;
  const meta = plano?.meta_mes ?? null;
  const semanas: any[] = Array.isArray(plano?.semanas) ? plano.semanas : [];
  const dias: any[] = Array.isArray(plano?.dias) ? plano.dias : [];
  const topDias: any[] = Array.isArray(plano?.top_dias_investimento)
    ? plano.top_dias_investimento
    : [];
  const jornada = plano?.jornada_produtos ?? {};
  const topDiasAquisicao: any[] = Array.isArray(plano?.top_dias_aquisicao)
    ? plano.top_dias_aquisicao
    : [];
  const topDiasBase: any[] = Array.isArray(plano?.top_dias_base)
    ? plano.top_dias_base
    : [];

  const contagemFoco = useMemo(() => {
    const c = { aquisicao: 0, base: 0, misto: 0 };
    dias.forEach((d) => {
      const f = String(pick(d, "foco") ?? "misto");
      if (f === "aquisicao") c.aquisicao += 1;
      else if (f === "base") c.base += 1;
      else c.misto += 1;
    });
    return c;
  }, [dias]);

  const necessidadeSemana = useMemo(() => {
    const src: any[] = Array.isArray(estoque?.necessidade_por_semana)
      ? estoque.necessidade_por_semana
      : [];
    return src.map((l, i) => {
      const tamanhos: Record<string, number> = {};
      const bruto: any = pick(l, "tamanhos", "por_tamanho") ?? l;
      TAMANHOS.forEach((t) => {
        tamanhos[t] = n(
          bruto?.[t] ?? bruto?.[t.toLowerCase()] ?? pick(l, t, t.toLowerCase()),
        );
      });
      const total = n(pick(l, "total")) || TAMANHOS.reduce((a, t) => a + tamanhos[t], 0);
      const ini = pick(l, "inicio", "data_inicio");
      const fim = pick(l, "fim", "data_fim");
      const rotulo = ini
        ? `S${num(pick(l, "semana") ?? i + 1)} · ${dataDDMM(String(ini))}${fim ? ` a ${dataDDMM(String(fim))}` : ""}`
        : `Semana ${num(pick(l, "semana") ?? i + 1)}`;
      return { rotulo, tamanhos, total };
    });
  }, [estoque]);

  const exportarNecessidadeSemana = () => {
    const linhas = [
      ["semana", ...TAMANHOS, "total"].join(";"),
      ...necessidadeSemana.map((l) =>
        [l.rotulo, ...TAMANHOS.map((t) => l.tamanhos[t] ?? 0), l.total]
          .map(csvEscape)
          .join(";"),
      ),
    ].join("\n");
    const blob = new Blob(["\ufeff" + linhas], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `necessidade-semana-${mesRef}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };


  const maiorPeso = useMemo(
    () => Math.max(0, ...semanas.map((s) => n(pick(s, "peso_pct")))),
    [semanas],
  );

  const totalCoorte = useCallback(
    (k: CoorteKey) => {
      let pedidos = 0;
      let receita = 0;
      semanas.forEach((s) => {
        const c: any = coorteDaSemana(s, k);
        pedidos += n(pick(c, "pedidos"));
        receita += n(pick(c, "receita"));
      });
      return { pedidos, receita, ticket: pedidos > 0 ? receita / pedidos : 0 };
    },
    [semanas],
  );

  const tAquisicao = totalCoorte("aquisicao");
  const tSegunda = totalCoorte("segunda_compra");
  const tFieis = totalCoorte("fieis");

  const receitaSemanas = semanas.reduce((a, s) => a + n(pick(s, "receita")), 0);
  const receitaMeta = n(pick(meta, "receita_faturada", "receita"));
  const divergencia =
    receitaMeta > 0 ? Math.abs(receitaSemanas - receitaMeta) / receitaMeta : 0;

  // estoque por produto (badge)
  const estoquePorProduto = useMemo(() => {
    const det: any[] = Array.isArray(estoque?.detalhe) ? estoque.detalhe : [];
    const map = new Map<string, { faltas: { tamanho: string; faltam: number }[] }>();
    det.forEach((d) => {
      const id = String(pick(d, "produto_id", "tray_product_id") ?? "");
      if (!id) return;
      if (!map.has(id)) map.set(id, { faltas: [] });
      const saldo = n(pick(d, "saldo"));
      if (saldo < 0) {
        map.get(id)!.faltas.push({
          tamanho: String(pick(d, "tamanho") ?? "—"),
          faltam: Math.abs(saldo),
        });
      }
    });
    return map;
  }, [estoque]);

  const badgeEstoque = (produtoId: any) => {
    const info = estoquePorProduto.get(String(produtoId ?? ""));
    if (!info)
      return (
        <Badge variant="outline" className="text-xs">
          fora do top {TOP_PRODUTOS}
        </Badge>
      );
    if (!info.faltas.length)
      return (
        <Badge className="bg-emerald-600 text-xs hover:bg-emerald-600">
          grade ok
        </Badge>
      );
    const txt = info.faltas
      .map((f) => `faltam ${num(f.faltam)} em ${f.tamanho}`)
      .join(", ");
    return (
      <Badge variant="destructive" className="text-xs">
        {txt}
      </Badge>
    );
  };

  const tabelaJornada = (lista: any[], titulo: string) => (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{titulo}</h4>
      {(!lista || !lista.length) && (
        <p className="text-sm text-muted-foreground">Sem produtos no período.</p>
      )}
      {!!lista?.length && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Clientes</TableHead>
              <TableHead className="text-right">% dos clientes</TableHead>
              <TableHead>Estoque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((p, i) => (
              <TableRow key={i}>
                <TableCell>
                  {pick(p, "produto", "nome", "nome_produto", "produto_nome") ?? "—"}
                </TableCell>
                <TableCell className="text-right">{num(pick(p, "clientes"))}</TableCell>
                <TableCell className="text-right">
                  {pct(pick(p, "pct_dos_clientes", "pct"))}
                </TableCell>
                <TableCell>
                  {badgeEstoque(pick(p, "produto_id", "tray_product_id"))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  const salvarMetaFieis = async () => {
    setSalvandoMeta(true);
    try {
      const payload: any = {
        meta_lancamento_fieis_pedidos: metaFieisPedidos
          ? parseInt(metaFieisPedidos, 10)
          : null,
        meta_lancamento_fieis_ticket: metaFieisTicket
          ? parseFloat(metaFieisTicket)
          : null,
      };
      const { error } = planoComercialId
        ? await supabase.from("planos_comerciais").update(payload).eq("id", planoComercialId)
        : await supabase.from("planos_comerciais").insert({ ...payload, mes_referencia: mesRef });
      if (error) throw error;
      toast.success("Meta de lançamento salva");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar a meta");
    } finally {
      setSalvandoMeta(false);
    }
  };

  const exportarRupturas = () => {
    const rupturas: any[] = Array.isArray(estoque?.rupturas) ? estoque.rupturas : [];
    const linhas = [
      ["produto", "tamanho", "necessario", "estoque", "faltam", "novo", "segunda", "fiel"].join(";"),
      ...rupturas.map((r) => {
        const pc = pick<any>(r, "por_coorte") ?? {};
        return [
          pick(r, "produto", "nome"),
          pick(r, "tamanho"),
          pick(r, "necessario", "necessário"),
          pick(r, "estoque"),
          pick(r, "faltam"),
          pick(pc, "novo", "aquisicao"),
          pick(pc, "segunda", "segunda_compra"),
          pick(pc, "fiel", "fieis"),
        ]
          .map(csvEscape)
          .join(";");
      }),
    ].join("\n");
    const blob = new Blob(["\ufeff" + linhas], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rupturas-${mesRef}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ---------------- render ---------------- */

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Plano Comercial</h1>
        <p className="text-sm text-muted-foreground">
          Meta do mês quebrada por semana, por dia e por coorte de cliente.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => navegar(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[150px] text-center font-medium">
          {MESES[mes - 1]} {ano}
        </span>
        <Button variant="outline" size="icon" onClick={() => navegar(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={carregar}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const politica = plano?.politica_midia ?? null;

  const politicaBar = (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Verba para aquisição</Label>
          <Input
            className="w-20"
            inputMode="numeric"
            value={pctAquisicaoInput}
            onChange={(e) => setPctAquisicaoInput(e.target.value)}
            onBlur={commitPctAquisicao}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitPctAquisicao();
            }}
          />
          <span className="text-sm text-muted-foreground">
            % · base: {num(100 - pctAquisicao)}%
          </span>
        </div>
        {politica && (
          <div className="flex flex-wrap gap-3 text-sm">
            <Badge variant="outline" className="text-xs">
              Aquisição {brl(pick(politica, "verba_aquisicao"))}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Base {brl(pick(politica, "verba_base"))}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando plano...
        </div>
      </div>
    );
  }

  if (erroRpc || erroPlano) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <Card className="border-destructive/40">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm">{erroPlano || erroRpc}</p>
            </div>
            <Link
              to="/planejamento-mensal"
              className="inline-block text-sm font-medium text-primary underline"
            >
              Abrir Planejamento Mensal
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fonte = plano?.fonte_padrao;
  const fonteTxt =
    typeof fonte === "string"
      ? fonte
      : fonte
        ? `Padrão medido em ${num(pick(fonte, "meses", "janela_meses"))} meses, ${num(
            pick(fonte, "pedidos", "pedidos_analisados", "pedidos_janela"),
          )} pedidos analisados`
        : null;

  const cards = [
    { t: "Receita Faturada", v: brl(pick(meta, "receita_faturada", "receita")) },
    { t: "Pedidos Faturados", v: num(pick(meta, "pedidos_faturados", "pedidos")) },
    { t: "Investimento", v: brl(pick(meta, "investimento", "investimento_total")) },
    { t: "Sessões Totais", v: num(pick(meta, "sessoes_totais", "sessoes")) },
    { t: "CPS Mídia", v: brl(pick(meta, "cps_midia"), 2) },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        {header}

        {politicaBar}


        {/* 1. cabeçalho */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((c) => (
            <Card key={c.t}>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {c.t}
                </p>
                <p className="mt-1 text-xl font-semibold">{c.v}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {fonteTxt && (
          <Badge variant="outline" className="text-xs">
            {fonteTxt}
          </Badge>
        )}

        {/* 7. coerência */}
        {semanas.length > 0 && divergencia > 0.01 && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              A soma das receitas semanais ({brl(receitaSemanas)}) diverge{" "}
              {pct(divergencia * 100)} da meta do mês ({brl(receitaMeta)}).
            </span>
          </div>
        )}

        <Tabs defaultValue="semanas">
          <TabsList className="flex-wrap">
            <TabsTrigger value="semanas">Semanas</TabsTrigger>
            <TabsTrigger value="calendario">Calendário de investimento</TabsTrigger>
            <TabsTrigger value="aquisicao">Aquisição</TabsTrigger>
            <TabsTrigger value="recorrentes">Recorrentes</TabsTrigger>
            <TabsTrigger value="estoque">Estoque x Demanda</TabsTrigger>
          </TabsList>

          {/* 2. linha do tempo semanal */}
          <TabsContent value="semanas" className="mt-4">
            {!semanas.length && (
              <p className="text-sm text-muted-foreground">Sem semanas no plano.</p>
            )}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {semanas.map((s, i) => {
                const peso = n(pick(s, "peso_pct"));
                const destaque = peso > 0 && peso === maiorPeso;
                return (
                  <Card
                    key={i}
                    className={cn(destaque && "border-primary ring-1 ring-primary/40")}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>{pick(s, "rotulo", "label") ?? `S${i + 1}`}</span>
                        <Badge variant={destaque ? "default" : "outline"} className="text-xs">
                          {pct(peso)}
                        </Badge>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {pick(s, "periodo") ??
                          `${dataDDMM(pick(s, "inicio", "data_inicio"))} a ${dataDDMM(
                            pick(s, "fim", "data_fim"),
                          )}`}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pedidos</span>
                        <span className="font-medium">{num(pick(s, "pedidos"))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Receita</span>
                        <span className="font-medium">{brl(pick(s, "receita"))}</span>
                      </div>

                      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        {COORTE_ORDEM.map((k) => {
                          const c: any = coorteDaSemana(s, k);
                          const p = n(pick(c, "pct_do_bloco", "pct"));
                          return (
                            <div
                              key={k}
                              className={COORTES[k].bar}
                              style={{ width: `${p}%` }}
                              title={`${COORTES[k].label}: ${pct(p)}`}
                            />
                          );
                        })}
                      </div>

                      <div className="space-y-1.5">
                        {COORTE_ORDEM.map((k) => {
                          const c: any = coorteDaSemana(s, k);
                          return (
                            <div key={k} className="text-xs">
                              <div className="flex items-center gap-1.5 font-medium">
                                <span
                                  className={cn("h-2 w-2 rounded-full", COORTES[k].dot)}
                                />
                                {COORTES[k].label}
                                <span className="ml-auto text-muted-foreground">
                                  {pct(pick(c, "pct_do_bloco", "pct"))}
                                </span>
                              </div>
                              <p className="pl-3.5 text-muted-foreground">
                                {num(pick(c, "pedidos"))} ped · {brl(pick(c, "ticket"))} tk ·{" "}
                                {brl(pick(c, "receita"))}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="space-y-1 border-t pt-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Investimento sugerido </span>
                          <span className="font-semibold">
                            {brl(pick(s, "investimento_sugerido", "investimento"))}
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          Aquisição {brl(pick(s, "investimento_aquisicao"))} · Base{" "}
                          {brl(pick(s, "investimento_base"))}
                        </div>
                        {(() => {
                          const pv = n(pick(s, "pct_verba_do_mes"));
                          const diverge = Math.abs(pv - peso) > 2;
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant={diverge ? "destructive" : "outline"}
                                  className="text-[10px]"
                                >
                                  {pct(pv)} da verba
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[260px]">
                                Esta semana entrega {pct(peso)} dos pedidos mas recebe{" "}
                                {pct(pv)} da verba, porque o mix dela é mais de
                                base/aquisição.
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}
                        <div className="text-muted-foreground">
                          CAC previsto{" "}
                          <span className="font-medium text-foreground">
                            {brl(pick(coorteDaSemana(s, "aquisicao"), "cac"), 2)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* 3. calendário */}
          <TabsContent value="calendario" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">
                {num(contagemFoco.aquisicao)} dias de aquisição ·{" "}
                {num(contagemFoco.base)} de base · {num(contagemFoco.misto)} mistos
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> aquisição = mais
                de 40% novos
                <span className="ml-2 h-2.5 w-2.5 rounded-full bg-emerald-600" /> base =
                mais de 55% fiéis
                <span className="ml-2 h-2.5 w-2.5 rounded-full bg-amber-500" /> misto
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {topDias.map((d, i) => {
                const data = String(pick(d, "data") ?? "");
                const dow = data
                  ? DOW_CURTO[new Date(`${data.slice(0, 10)}T12:00:00`).getDay()]
                  : (pick(d, "dow_nome", "dia_semana") ?? "");
                return (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {data ? dataDDMM(data) : num(pick(d, "dia"))} {dow} ·{" "}
                    {pct(pick(d, "peso_pct"), 2)} · {brl(pick(d, "investimento"))}
                  </Badge>
                );
              })}
              {!topDias.length && (
                <p className="text-sm text-muted-foreground">Sem dias destacados.</p>
              )}
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
                  {DOW_CURTO.map((d) => (
                    <div key={d} className="pb-1 font-medium text-muted-foreground">
                      {d}
                    </div>
                  ))}
                  {(() => {
                    const primeiro = new Date(ano, mes - 1, 1).getDay();
                    const celulas: JSX.Element[] = [];
                    for (let i = 0; i < primeiro; i++)
                      celulas.push(<div key={`v${i}`} />);
                    dias.forEach((d, i) => {
                      const peso = n(pick(d, "peso_pct"));
                      const dataStr = String(pick(d, "data") ?? "");
                      const diaNum =
                        pick(d, "dia") ??
                        (dataStr ? Number(dataStr.slice(8, 10)) : i + 1);
                      const foco = String(pick(d, "foco") ?? "misto");
                      const aq: any = pick(d, "aquisicao") ?? {};
                      const sc: any = pick(d, "segunda_compra") ?? {};
                      const fi: any = pick(d, "fieis") ?? {};
                      celulas.push(
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "rounded-md border p-1.5 text-left text-white",
                                foco === "aquisicao" && "bg-sky-500",
                                foco === "base" && "bg-emerald-600",
                                foco !== "aquisicao" && foco !== "base" && "bg-amber-500",
                              )}
                            >
                              <div className="text-[11px] font-semibold">{diaNum}</div>
                              <div className="text-[10px] opacity-90">{pct(peso, 2)}</div>
                              <div className="text-[10px] font-medium">
                                {brl(pick(d, "investimento"))}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="space-y-1 text-xs">
                            <p className="font-medium">
                              {dataStr ? dataBR(dataStr) : `Dia ${diaNum}`} · foco {foco}
                            </p>
                            <p>
                              Investimento {brl(pick(d, "investimento"))} · aquisição{" "}
                              {brl(pick(d, "investimento_aquisicao"))} · base{" "}
                              {brl(pick(d, "investimento_base"))}
                            </p>
                            <p>
                              Novos {num(pick(aq, "pedidos"))} ped ({pct(pick(aq, "pct"))})
                            </p>
                            <p>2ª compra {num(pick(sc, "pedidos"))} ped</p>
                            <p>
                              Fiéis {num(pick(fi, "pedidos"))} ped ({pct(pick(fi, "pct"))})
                            </p>
                          </TooltipContent>
                        </Tooltip>,
                      );
                    });
                    return celulas;
                  })()}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Peso = índice do dia do mês x índice do dia da semana, medido no
                  histórico real de pedidos.
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                { titulo: "Onde colocar a verba de prospecção", lista: topDiasAquisicao, campo: "investimento_aquisicao" },
                { titulo: "Onde acionar a base", lista: topDiasBase, campo: "investimento_base" },
              ].map((bloco) => (
                <Card key={bloco.titulo}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{bloco.titulo}</CardTitle>
                    {bloco.titulo === "Onde acionar a base" && (
                      <p className="text-xs text-muted-foreground">
                        CRM e remarketing, não mídia fria.
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {!bloco.lista.length && (
                      <p className="text-sm text-muted-foreground">Sem dias listados.</p>
                    )}
                    {bloco.lista.map((d: any, i: number) => {
                      const dt = String(pick(d, "data") ?? "");
                      return (
                        <div key={i} className="flex justify-between text-sm">
                          <span>
                            {dt ? dataBR(dt) : `Dia ${num(pick(d, "dia"))}`}
                            {dt && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                {DOW_CURTO[new Date(`${dt.slice(0, 10)}T12:00:00`).getDay()]}
                              </span>
                            )}
                          </span>
                          <span className="font-medium">
                            {brl(pick(d, bloco.campo, "investimento"))}
                          </span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>


          {/* 4. aquisição */}
          <TabsContent value="aquisicao" className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Pedidos novos no mês
                  </p>
                  <p className="mt-1 text-xl font-semibold">{num(tAquisicao.pedidos)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase text-muted-foreground">Ticket médio</p>
                  <p className="mt-1 text-xl font-semibold">{brl(tAquisicao.ticket, 2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase text-muted-foreground">Receita</p>
                  <p className="mt-1 text-xl font-semibold">{brl(tAquisicao.receita)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-4">
                {tabelaJornada(jornada?.primeira_compra, "Produtos de primeira compra")}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 p-4">
                <h4 className="text-sm font-semibold">Melhores dias para aquisição</h4>
                <p className="text-xs text-muted-foreground">
                  Sábado e domingo concentram o maior mix de clientes novos (51,1% no
                  domingo no histórico). É uma recomendação de ênfase, não um número
                  fechado.
                </p>
                <div className="flex flex-wrap gap-2">
                  {dias
                    .filter((d) => {
                      const dt = String(pick(d, "data") ?? "");
                      const dow = dt
                        ? new Date(`${dt.slice(0, 10)}T12:00:00`).getDay()
                        : new Date(ano, mes - 1, n(pick(d, "dia"))).getDay();
                      return dow === 0 || dow === 6;
                    })
                    .map((d, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {pick(d, "data")
                          ? dataDDMM(pick(d, "data"))
                          : `${num(pick(d, "dia"))}/${String(mes).padStart(2, "0")}`}{" "}
                        · {brl(pick(d, "investimento"))}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 5. recorrentes */}
          <TabsContent value="recorrentes" className="mt-4 space-y-6">
            {/* 5a */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Segunda compra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Pedidos</p>
                    <p className="text-xl font-semibold">{num(tSegunda.pedidos)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Ticket médio</p>
                    <p className="text-xl font-semibold">{brl(tSegunda.ticket, 2)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Receita</p>
                    <p className="text-xl font-semibold">{brl(tSegunda.receita)}</p>
                  </div>
                </div>

                {tabelaJornada(jornada?.segunda_compra, "Produtos de segunda compra")}

                {(() => {
                  const rec = jornada?.recompra;
                  const tmp = jornada?.tempo_entre_compras;
                  const recPct = typeof rec === "object" ? pick(rec, "pct", "taxa") : rec;
                  const mediana =
                    typeof tmp === "object" ? pick(tmp, "mediana", "mediana_dias") : tmp;
                  return (
                    <div className="rounded-md border bg-muted/40 p-3 text-sm">
                      {pct(recPct)} dos clientes fazem a 2ª compra. Mediana de{" "}
                      {num(mediana)} dias.
                    </div>
                  );
                })()}

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Régua sugerida</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coorte de 1ª compra</TableHead>
                        <TableHead>Data prevista da 2ª compra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const tmp = jornada?.tempo_entre_compras;
                        const mediana =
                          n(
                            typeof tmp === "object"
                              ? pick(tmp, "mediana", "mediana_dias")
                              : tmp,
                          ) || 44;
                        const linhas: JSX.Element[] = [];
                        for (let i = 8; i >= 1; i--) {
                          const ini = new Date(hoje);
                          ini.setDate(ini.getDate() - i * 7);
                          const fim = new Date(ini);
                          fim.setDate(fim.getDate() + 6);
                          const prev = new Date(ini);
                          prev.setDate(prev.getDate() + mediana);
                          const iso = (d: Date) => d.toISOString().slice(0, 10);
                          linhas.push(
                            <TableRow key={i}>
                              <TableCell>
                                {dataBR(iso(ini))} a {dataBR(iso(fim))}
                              </TableCell>
                              <TableCell>{dataBR(iso(prev))}</TableCell>
                            </TableRow>,
                          );
                        }
                        return linhas;
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* 5b */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fiéis (3ª compra ou mais)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Pedidos</p>
                    <p className="text-xl font-semibold">{num(tFieis.pedidos)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Ticket médio</p>
                    <p className="text-xl font-semibold text-emerald-700">
                      {brl(tFieis.ticket, 2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Maior ticket das três coortes.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Receita</p>
                    <p className="text-xl font-semibold">{brl(tFieis.receita)}</p>
                  </div>
                </div>

                {tabelaJornada(jornada?.terceira_compra, "Produtos de terceira compra")}

                <div className="rounded-md border p-3">
                  <h4 className="mb-2 text-sm font-semibold">
                    Meta de lançamento para fiéis
                  </h4>
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <Label className="text-xs">Pedidos</Label>
                      <Input
                        className="w-28"
                        value={metaFieisPedidos}
                        onChange={(e) => setMetaFieisPedidos(e.target.value)}
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Ticket médio</Label>
                      <Input
                        className="w-32"
                        value={metaFieisTicket}
                        onChange={(e) => setMetaFieisTicket(e.target.value)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Receita da meta: </span>
                      <span className="font-semibold">
                        {brl(
                          (parseFloat(metaFieisPedidos) || 0) *
                            (parseFloat(metaFieisTicket) || 0),
                        )}
                      </span>
                    </div>
                    <Button onClick={salvarMetaFieis} disabled={salvandoMeta}>
                      {salvandoMeta && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Referência: ticket de fiel projetado no mês {brl(tFieis.ticket, 2)}.
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  Melhores dias: terça e quarta das semanas S4 e S5, quando a coorte fiel
                  chega a 63% do mix.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 6. estoque */}
          <TabsContent value="estoque" className="mt-4 space-y-4">
            {(erroEstoque || estoque?.erro) && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Não foi possível carregar a necessidade de estoque:{" "}
                  {erroEstoque || estoque?.erro}
                </span>
              </div>
            )}

            {!erroEstoque && (
            <>


            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo por tamanho</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tamanho</TableHead>
                      <TableHead className="text-right">Necessário</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Cobertura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(estoque?.resumo_por_tamanho ?? []).map((r: any, i: number) => {
                      const cob = n(pick(r, "cobertura_pct"));
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{pick(r, "tamanho")}</TableCell>
                          <TableCell className="text-right">
                            {num(pick(r, "necessario", "necessário"))}
                          </TableCell>
                          <TableCell className="text-right">{num(pick(r, "estoque"))}</TableCell>
                          <TableCell
                            className={cn(
                              "text-right",
                              n(pick(r, "saldo")) < 0 && "text-destructive",
                            )}
                          >
                            {num(pick(r, "saldo"))}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-medium",
                              cob < 100 && "text-destructive",
                            )}
                          >
                            {pct(cob)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!(estoque?.resumo_por_tamanho ?? []).length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground">
                          Sem dados de estoque.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mix de tamanho por coorte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const raw = estoque?.mix_tamanho_por_coorte;
                  const mapa: Record<string, Record<string, number>> = {};
                  if (Array.isArray(raw)) {
                    raw.forEach((r: any) => {
                      const c = String(pick(r, "coorte") ?? "");
                      const t = String(pick(r, "tamanho") ?? "");
                      if (!mapa[c]) mapa[c] = {};
                      mapa[c][t] = n(pick(r, "pct", "pct_tamanho"));
                    });
                  } else if (raw && typeof raw === "object") {
                    Object.entries(raw).forEach(([c, v]: any) => {
                      mapa[c] = {};
                      Object.entries(v ?? {}).forEach(([t, p]: any) => {
                        mapa[c][t] = n(p);
                      });
                    });
                  }
                  const coortes = Object.keys(mapa);
                  if (!coortes.length)
                    return (
                      <p className="text-sm text-muted-foreground">Sem mix disponível.</p>
                    );
                  const tamanhos = Array.from(
                    new Set(coortes.flatMap((c) => Object.keys(mapa[c]))),
                  );
                  const alerta = tamanhos.filter((t) => {
                    const vals = coortes.map((c) => mapa[c][t] ?? 0);
                    return Math.max(...vals) - Math.min(...vals) > 3;
                  });
                  return (
                    <>
                      {coortes.map((c) => (
                        <div key={c}>
                          <p className="mb-1 text-sm font-medium capitalize">{c}</p>
                          <div className="flex h-4 w-full overflow-hidden rounded bg-muted text-[10px] text-white">
                            {tamanhos.map((t, i) => (
                              <div
                                key={t}
                                className={cn(
                                  "flex items-center justify-center",
                                  ["bg-sky-500", "bg-amber-500", "bg-emerald-600", "bg-violet-500", "bg-rose-500"][
                                    i % 5
                                  ],
                                )}
                                style={{ width: `${mapa[c][t] ?? 0}%` }}
                                title={`${t}: ${pct(mapa[c][t] ?? 0)}`}
                              >
                                {(mapa[c][t] ?? 0) > 8 ? t : ""}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {!!alerta.length && (
                        <p className="text-xs text-destructive">
                          Diferença acima de 3 pontos percentuais entre coortes em:{" "}
                          {alerta.join(", ")}.
                        </p>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  Rupturas — lista de produção do mês
                </CardTitle>
                <Button variant="outline" size="sm" onClick={exportarRupturas}>
                  <Download className="mr-2 h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tam.</TableHead>
                      <TableHead className="text-right">Necessário</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead className="text-right">Faltam</TableHead>
                      <TableHead>Por coorte</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...((estoque?.rupturas ?? []) as any[])]
                      .sort((a, b) => n(pick(b, "faltam")) - n(pick(a, "faltam")))
                      .map((r, i) => {
                        const pc: any = pick(r, "por_coorte") ?? {};
                        return (
                          <TableRow key={i}>
                            <TableCell>{pick(r, "produto", "nome")}</TableCell>
                            <TableCell>{pick(r, "tamanho")}</TableCell>
                            <TableCell className="text-right">
                              {num(pick(r, "necessario", "necessário"))}
                            </TableCell>
                            <TableCell className="text-right">{num(pick(r, "estoque"))}</TableCell>
                            <TableCell className="text-right font-semibold text-destructive">
                              {num(pick(r, "faltam"))}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    novo {num(pick(pc, "novo", "aquisicao"))} · 2ª{" "}
                                    {num(pick(pc, "segunda", "segunda_compra"))} · fiel{" "}
                                    {num(pick(pc, "fiel", "fieis"))}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Quebra da necessidade por coorte de cliente
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {!(estoque?.rupturas ?? []).length && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-sm text-muted-foreground">
                          Nenhuma ruptura prevista.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  Necessidade por semana — cronograma de produção
                </CardTitle>
                <Button variant="outline" size="sm" onClick={exportarNecessidadeSemana}>
                  <Download className="mr-2 h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Semana</TableHead>
                      {TAMANHOS.map((t) => (
                        <TableHead key={t} className="text-right">
                          {t}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {necessidadeSemana.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{l.rotulo}</TableCell>
                        {TAMANHOS.map((t) => (
                          <TableCell key={t} className="text-right">
                            {num(l.tamanhos[t] ?? 0)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold">
                          {num(l.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!necessidadeSemana.length && (
                      <TableRow>
                        <TableCell
                          colSpan={TAMANHOS.length + 2}
                          className="text-sm text-muted-foreground"
                        >
                          Sem necessidade semanal calculada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            </>
            )}
          </TabsContent>
        </Tabs>

        {padrao?.janela_meses && (
          <p className="text-xs text-muted-foreground">
            Padrão de pedidos medido em {num(padrao.janela_meses)} meses ·{" "}
            {num(padrao.pedidos_janela)} pedidos · {brl(padrao.receita_janela)}.
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
