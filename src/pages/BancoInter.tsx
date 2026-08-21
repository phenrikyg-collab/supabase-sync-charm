import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { SeletorDias } from "@/components/financeiro/SeletorDias";
import { brl, pctBr, num, dataCurta, dataBr } from "@/lib/financeiroFormat";
import { Sparkles, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Row = Record<string, any>;

interface InterKpis {
  saldo?: Row;
  resumo?: Row;
  categorizacao?: Row;
  serie_diaria?: Row[];
  por_grupo_dre?: Row[];
  maiores_contrapartes?: Row[];
}

interface Categoria {
  id: string;
  nome: string;
  grupo_dre: string | null;
  tipo: string | null;
}

type FiltroFila = "todas" | "entradas" | "saidas" | "alta" | "sem";

const FILTROS: { key: FiltroFila; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "entradas", label: "Apenas entradas" },
  { key: "saidas", label: "Apenas saídas" },
  { key: "alta", label: "Sugestão alta" },
  { key: "sem", label: "Sem sugestão" },
];

const CORES = ["hsl(var(--primary))", "#8B6914", "#C9A227", "#6B7280", "#9CA3AF", "#B45309", "#4B5563", "#D4AF37"];

function Tile({ label, value, loading, valueClass, hint }: { label: string; value: string; loading: boolean; valueClass?: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className={cn("mt-1 text-2xl font-semibold tabular-nums text-card-foreground", valueClass)}>{value}</p>}
      {hint && <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function Secao({ titulo, children, descricao, id }: { titulo: string; descricao?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-xl border bg-card p-5">
      <div className="mb-4">
        <h2 className="font-serif text-lg font-semibold text-card-foreground">{titulo}</h2>
        {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

function ChipConfianca({ nivel, motivo }: { nivel?: string | null; motivo?: string | null }) {
  if (!nivel) return null;
  const map: Record<string, string> = {
    alta: "bg-success/10 text-success",
    media: "bg-warning/10 text-warning",
    baixa: "bg-muted text-muted-foreground",
  };
  return (
    <span title={motivo ?? undefined} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", map[nivel] ?? "bg-muted text-muted-foreground")}>
      {nivel}
    </span>
  );
}

export default function BancoInter() {
  const [dias, setDias] = useState(30);
  const [filtro, setFiltro] = useState<FiltroFila>("todas");
  const [selecao, setSelecao] = useState<Record<string, string>>({});
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [saindo, setSaindo] = useState<Set<string>>(new Set());
  const [processando, setProcessando] = useState(false);
  const blocoB = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const kpisQuery = useQuery({
    queryKey: ["inter_kpis", dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inter_kpis" as any, { p_dias: dias });
      if (error) throw error;
      return (data ?? {}) as InterKpis;
    },
  });

  const filaQuery = useQuery({
    queryKey: ["inter_fila_categorizacao"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inter_fila_categorizacao" as any, { p_dias: 60 });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const categoriasQuery = useQuery({
    queryKey: ["categorias_para_selecao"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("categorias_para_selecao" as any);
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });

  const previsaoQuery = useQuery({
    queryKey: ["fluxo_caixa_previsto", 30],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fluxo_caixa_previsto" as any, { p_dias: 30 });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const kpis = kpisQuery.data;
  const saldo = kpis?.saldo ?? {};
  const resumo = kpis?.resumo ?? {};
  const cat = kpis?.categorizacao ?? {};

  const categoriasAgrupadas = useMemo(() => {
    const grupos = new Map<string, Categoria[]>();
    for (const c of categoriasQuery.data ?? []) {
      const g = c.grupo_dre || "Outros";
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g)!.push(c);
    }
    return Array.from(grupos.entries());
  }, [categoriasQuery.data]);

  const catPorId = useMemo(() => {
    const m = new Map<string, Categoria>();
    for (const c of categoriasQuery.data ?? []) m.set(String(c.id), c);
    return m;
  }, [categoriasQuery.data]);

  const fila = useMemo(() => {
    const rows = [...(filaQuery.data ?? [])].sort((a, b) => Math.abs(Number(b.valor ?? 0)) - Math.abs(Number(a.valor ?? 0)));
    return rows.filter((r) => {
      const tipo = String(r.tipo ?? "").toLowerCase();
      if (filtro === "entradas") return tipo.startsWith("entrada") || Number(r.valor ?? 0) > 0;
      if (filtro === "saidas") return tipo.startsWith("saida") || tipo.startsWith("saída") || Number(r.valor ?? 0) < 0;
      if (filtro === "alta") return r.sugestao_confianca === "alta";
      if (filtro === "sem") return !r.sugestao_categoria_id;
      return true;
    });
  }, [filaQuery.data, filtro]);

  function valorSelecionado(r: Row) {
    const id = String(r.id);
    return selecao[id] ?? (r.sugestao_categoria_id ? String(r.sugestao_categoria_id) : "");
  }

  async function recarregar() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["inter_fila_categorizacao"] }),
      qc.invalidateQueries({ queryKey: ["inter_kpis"] }),
    ]);
  }

  async function confirmar(r: Row) {
    const categoriaId = valorSelecionado(r);
    if (!categoriaId) {
      toast({ title: "Selecione uma categoria", variant: "destructive" });
      return;
    }
    setSaindo((s) => new Set(s).add(String(r.id)));
    const { error } = await supabase.rpc("inter_confirmar_categoria" as any, {
      p_id: r.id,
      p_categoria_id: categoriaId,
      p_criar_regra: true,
    });
    if (error) {
      setSaindo((s) => {
        const n = new Set(s);
        n.delete(String(r.id));
        return n;
      });
      toast({ title: "Erro ao categorizar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Categorizado.", description: "Próximas transações desta contraparte serão sugeridas automaticamente." });
    setTimeout(() => {
      recarregar();
      setSaindo(new Set());
      setMarcados(new Set());
    }, 250);
  }

  async function confirmarSelecionadas() {
    const alvos = fila.filter((r) => marcados.has(String(r.id)) && valorSelecionado(r));
    if (alvos.length === 0) {
      toast({ title: "Nenhuma linha com categoria definida", variant: "destructive" });
      return;
    }
    setProcessando(true);
    let ok = 0;
    for (const r of alvos) {
      const { error } = await supabase.rpc("inter_confirmar_categoria" as any, {
        p_id: r.id,
        p_categoria_id: valorSelecionado(r),
        p_criar_regra: true,
      });
      if (!error) ok++;
    }
    setProcessando(false);
    setMarcados(new Set());
    await recarregar();
    toast({ title: `${ok} transações categorizadas.`, description: "Próximas transações destas contrapartes serão sugeridas automaticamente." });
  }

  async function aplicarAlta() {
    setProcessando(true);
    const { data, error } = await supabase.rpc("inter_aplicar_sugestoes_alta" as any, { p_dias: 60 });
    setProcessando(false);
    if (error) {
      toast({ title: "Erro ao aplicar sugestões", description: error.message, variant: "destructive" });
      return;
    }
    const total = typeof data === "number" ? data : Number((data as any)?.aplicadas ?? (Array.isArray(data) ? data.length : 0));
    await recarregar();
    toast({ title: `${num(total)} sugestões aplicadas.` });
  }

  const serie = (kpis?.serie_diaria ?? []).map((d) => ({
    dia: dataCurta(d.data ?? d.dia),
    entradas: Number(d.entradas ?? 0),
    saidas: Math.abs(Number(d.saidas ?? 0)),
  }));

  const porGrupo = kpis?.por_grupo_dre ?? [];
  const previsao = previsaoQuery.data ?? [];
  const pendentesAlta = Number(cat.pendentes_com_sugestao_alta ?? 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Banco Inter</h1>
          <p className="text-sm text-muted-foreground">Conta corrente, categorização assistida e previsão de caixa</p>
        </div>
        <SeletorDias valor={dias} onChange={setDias} />
      </div>

      {/* Bloco A */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Saldo disponível"
          value={brl(saldo.disponivel)}
          loading={kpisQuery.isLoading}
          hint={saldo.consultado_em || saldo.data ? `Consultado em ${dataBr(saldo.consultado_em ?? saldo.data)}` : undefined}
        />
        <Tile label="Entradas do período" value={brl(resumo.entradas)} loading={kpisQuery.isLoading} valueClass="text-success" />
        <Tile label="Saídas do período" value={brl(resumo.saidas)} loading={kpisQuery.isLoading} valueClass="text-danger" />
        <Tile
          label="Resultado líquido"
          value={brl(resumo.liquido)}
          loading={kpisQuery.isLoading}
          valueClass={Number(resumo.liquido ?? 0) < 0 ? "text-danger" : "text-success"}
        />
      </div>

      {/* Bloco B */}
      <div ref={blocoB}>
        <Secao titulo="Categorização pendente" descricao="Confirme ou ajuste a sugestão — o sistema aprende a cada confirmação.">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Pendentes: <strong className="text-foreground tabular-nums">{num(cat.pendentes)}</strong>
              </span>
              <span className="text-muted-foreground">
                Valor pendente: <strong className="text-foreground tabular-nums">{brl(cat.valor_pendente)}</strong>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {marcados.size > 0 && (
                <Button size="sm" variant="outline" onClick={confirmarSelecionadas} disabled={processando}>
                  Confirmar selecionadas ({marcados.size})
                </Button>
              )}
              <Button size="sm" onClick={aplicarAlta} disabled={processando || pendentesAlta === 0}>
                {processando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Aplicar {pendentesAlta} sugestões de alta confiança
              </Button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTROS.map((f) => (
              <Button key={f.key} size="sm" variant={filtro === f.key ? "default" : "outline"} className="h-8" onClick={() => setFiltro(f.key)}>
                {f.label}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="w-8 py-2"></th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Contraparte</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Categoria sugerida</th>
                  <th className="py-2 pr-3">Confiança</th>
                  <th className="py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {fila.map((r) => {
                  const id = String(r.id);
                  const selecionado = valorSelecionado(r);
                  const grupo = catPorId.get(selecionado)?.grupo_dre ?? r.sugestao_grupo_dre ?? null;
                  const negativo = Number(r.valor ?? 0) < 0 || String(r.tipo ?? "").toLowerCase().startsWith("sa");
                  return (
                    <tr
                      key={id}
                      className={cn(
                        "border-b align-top transition-all duration-200 last:border-0",
                        saindo.has(id) && "-translate-x-4 opacity-0"
                      )}
                    >
                      <td className="py-2">
                        <Checkbox
                          checked={marcados.has(id)}
                          onCheckedChange={(v) =>
                            setMarcados((s) => {
                              const n = new Set(s);
                              if (v) n.add(id);
                              else n.delete(id);
                              return n;
                            })
                          }
                        />
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{dataCurta(r.data ?? r.data_movimento)}</td>
                      <td className="py-2 pr-3 font-medium text-foreground">{r.contraparte || "—"}</td>
                      <td className="max-w-[220px] truncate py-2 pr-3 text-muted-foreground" title={r.descricao ?? ""}>
                        {r.descricao || "—"}
                      </td>
                      <td className={cn("py-2 pr-3 text-right tabular-nums font-medium", negativo ? "text-danger" : "text-success")}>
                        {brl(Math.abs(Number(r.valor ?? 0)))}
                      </td>
                      <td className="py-2 pr-3 capitalize text-muted-foreground">{r.tipo || "—"}</td>
                      <td className="py-2 pr-3">
                        <select
                          className="h-9 w-[210px] rounded-md border border-input bg-background px-2 text-sm"
                          value={selecionado}
                          onChange={(e) => setSelecao((s) => ({ ...s, [id]: e.target.value }))}
                        >
                          <option value="">Selecionar categoria</option>
                          {categoriasAgrupadas.map(([grupoNome, itens]) => (
                            <optgroup key={grupoNome} label={grupoNome}>
                              {itens.map((c) => (
                                <option key={c.id} value={String(c.id)}>
                                  {c.nome}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {grupo && <p className="mt-1 text-[11px] text-muted-foreground">{grupo}</p>}
                      </td>
                      <td className="py-2 pr-3">
                        <ChipConfianca nivel={r.sugestao_confianca} motivo={r.sugestao_motivo} />
                      </td>
                      <td className="py-2 text-right">
                        <Button size="sm" variant="outline" className="h-8" onClick={() => confirmar(r)} disabled={processando}>
                          Confirmar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!filaQuery.isLoading && fila.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      Nada pendente de categorização.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Secao>
      </div>

      {/* Bloco C */}
      <Secao titulo="Movimentação diária">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="dia" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <RTooltip formatter={(value: any) => brl(Number(value))} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--danger))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Secao>

      {/* Bloco D */}
      <Secao titulo="Saídas por grupo do DRE">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <pattern id="hachurado" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill="hsl(var(--muted))" />
                    <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />
                  </pattern>
                </defs>
                <Pie
                  data={porGrupo.map((g) => ({ name: g.grupo ?? g.grupo_dre ?? "(sem categoria)", value: Math.abs(Number(g.valor ?? 0)) }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                >
                  {porGrupo.map((g, i) => {
                    const nome = String(g.grupo ?? g.grupo_dre ?? "");
                    const sem = !nome || nome.toLowerCase().includes("sem categoria");
                    return <Cell key={i} fill={sem ? "url(#hachurado)" : CORES[i % CORES.length]} />;
                  })}
                </Pie>
                <RTooltip formatter={(value: any) => brl(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Grupo</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2 text-right">Transações</th>
                </tr>
              </thead>
              <tbody>
                {porGrupo.map((g, i) => {
                  const nome = String(g.grupo ?? g.grupo_dre ?? "(sem categoria)");
                  const sem = !nome || nome.toLowerCase().includes("sem categoria");
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <span className={cn(sem && "text-muted-foreground")}>{nome || "(sem categoria)"}</span>
                        {sem && (
                          <button
                            className="ml-2 text-xs text-primary underline"
                            onClick={() => blocoB.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                          >
                            categorizar
                          </button>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{brl(g.valor)}</td>
                      <td className="py-2 text-right tabular-nums">{num(g.transacoes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Secao>

      {/* Bloco E */}
      <Secao titulo="Maiores contrapartes">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Contraparte</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 text-right">Transações</th>
              </tr>
            </thead>
            <tbody>
              {(kpis?.maiores_contrapartes ?? []).slice(0, 15).map((c, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium text-foreground">{c.contraparte || "—"}</td>
                  <td className="py-2 pr-3 capitalize text-muted-foreground">{c.tipo || "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{brl(c.valor)}</td>
                  <td className="py-2 text-right tabular-nums">{num(c.transacoes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      {/* Bloco F */}
      <Secao titulo="Previsão de caixa" descricao="Projeção dos próximos 30 dias">
        <div className="mb-5 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={previsao.map((p) => ({ dia: dataCurta(p.data), entradas: Number(p.entradas_previstas ?? 0), saidas: Math.abs(Number(p.saidas_previstas ?? 0)) }))}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="dia" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <RTooltip formatter={(value: any) => brl(Number(value))} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas previstas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas previstas" fill="hsl(var(--danger))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3 text-right">Entradas previstas</th>
                <th className="py-2 pr-3 text-right">Saídas previstas</th>
                <th className="py-2 text-right">Saldo projetado</th>
              </tr>
            </thead>
            <tbody>
              {previsao.map((p, i) => {
                const saldoProj = Number(p.saldo_projetado ?? 0);
                return (
                  <tr key={i} className={cn("border-b last:border-0", saldoProj < 0 && "bg-danger/5")}>
                    <td className="py-2 pr-3">{dataCurta(p.data)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-success">{brl(p.entradas_previstas)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-danger">{brl(p.saidas_previstas)}</td>
                    <td className={cn("py-2 text-right font-medium tabular-nums", saldoProj < 0 ? "text-danger" : "text-foreground")}>
                      {brl(saldoProj)}
                    </td>
                  </tr>
                );
              })}
              {!previsaoQuery.isLoading && previsao.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">Sem previsão disponível.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Secao>
    </div>
  );
}
