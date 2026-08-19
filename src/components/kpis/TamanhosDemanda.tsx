import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Ruler } from "lucide-react";

type Row = Record<string, any>;

const num = (v: any) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v));
const fmtPct = (v: number, d = 1) => `${Number(v ?? 0).toFixed(d).replace(".", ",")}%`;

/** Primeiro campo existente entre candidatos. */
function pega(row: Row | undefined, candidatos: string[], fallback = 0): number {
  if (!row) return fallback;
  for (const c of candidatos) if (row[c] !== undefined && row[c] !== null) return num(row[c]);
  return fallback;
}
function pegaTxt(row: Row | undefined, candidatos: string[], fallback = "—"): string {
  if (!row) return fallback;
  for (const c of candidatos) if (row[c] !== undefined && row[c] !== null && row[c] !== "") return String(row[c]);
  return fallback;
}

const ORDEM_TAM = ["P", "M", "G", "GG", "EG"];
const ordemTamanho = (t: string) => {
  const i = ORDEM_TAM.indexOf(t.trim().toUpperCase());
  return i === -1 ? 99 : i;
};

const PERIODOS = [7, 30, 90];

function isoDiasAtras(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function corSituacao(s: string) {
  const v = s.toLowerCase();
  if (v.startsWith("esgot")) return "border-danger/30 bg-danger/10 text-danger";
  if (v.startsWith("crit") || v.startsWith("crít")) return "border-warning/40 bg-warning/15 text-warning";
  if (v.startsWith("baix")) return "border-amber-500/40 bg-amber-500/10 text-amber-600";
  return "border-success/30 bg-success/10 text-success";
}

function Erro({ msg }: { msg: string }) {
  return <p className="text-sm text-muted-foreground">{msg}</p>;
}

export default function TamanhosDemanda() {
  const { toast } = useToast();
  const [dias, setDias] = useState(30);
  const desde = isoDiasAtras(dias);

  const onErro = (titulo: string) => (e: unknown) => {
    toast({ variant: "destructive", title: titulo, description: (e as Error)?.message ?? "Erro ao carregar dados." });
  };

  const consulta = (view: string, campoData?: string) =>
    useQuery({
      queryKey: [view, campoData ? dias : "all"],
      queryFn: async () => {
        let q = supabase.from(view as any).select("*");
        if (campoData) q = q.gte(campoData, desde);
        const { data, error } = await q;
        if (error) {
          if (campoData) {
            const { data: d2, error: e2 } = await supabase.from(view as any).select("*");
            if (!e2) return (d2 ?? []) as Row[];
          }
          throw error;
        }
        return (data ?? []) as Row[];
      },
    });

  const demanda = consulta("vw_kpi_demanda_tamanho");
  const rupturas = consulta("vw_kpi_tamanho_produto");
  const funil = consulta("vw_kpi_funil_dia", "dia");
  const ausentes = consulta("vw_pdp_tamanho_ausente");

  [
    [demanda, "Demanda por tamanho"],
    [rupturas, "Rupturas por produto"],
    [funil, "Funil de conversão"],
    [ausentes, "Grade incompleta"],
  ].forEach(([q, titulo]: any) => {
    if (q.isError && q.error) {
      // dispara apenas quando o erro muda
      const key = `${titulo}:${(q.error as Error).message}`;
      if ((window as any).__kpiTamErro !== key) {
        (window as any).__kpiTamErro = key;
        onErro(titulo)(q.error);
      }
    }
  });

  /* ---------- Bloco 1 ---------- */
  const dadosDemanda = useMemo(() => {
    return (demanda.data ?? [])
      .filter((r) => pega(r, ["vendas_30d", "vendas"]) > 0 && pega(r, ["variantes_total", "variantes"]) >= 5)
      .map((r) => ({
        tamanho: pegaTxt(r, ["tamanho", "size"]),
        interesse: pega(r, ["pct_interesse"]),
        vendas: pega(r, ["pct_vendas"]),
        grade: pega(r, ["pct_grade_disponivel"]),
      }))
      .sort((a, b) => ordemTamanho(a.tamanho) - ordemTamanho(b.tamanho));
  }, [demanda.data]);

  const alertasGrade = dadosDemanda.filter((d) => d.grade < d.vendas);

  /* ---------- Bloco 2 ---------- */
  const [situacoes, setSituacoes] = useState<string[]>(["Esgotado"]);
  const [busca, setBusca] = useState("");

  const situacoesDisponiveis = useMemo(() => {
    const s = new Set<string>();
    (rupturas.data ?? []).forEach((r) => s.add(pegaTxt(r, ["situacao", "situação", "status"])));
    return [...s].filter((v) => v !== "—");
  }, [rupturas.data]);

  const linhasRuptura = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (rupturas.data ?? [])
      .map((r) => ({
        produto: pegaTxt(r, ["produto", "nome_produto", "nome", "produto_nome"]),
        tamanho: pegaTxt(r, ["tamanho", "size"]),
        visitas: pega(r, ["pdp_views_30d", "pdp_views"]),
        vendas: pega(r, ["vendas_30d", "vendas"]),
        situacao: pegaTxt(r, ["situacao", "situação", "status"]),
      }))
      .filter((r) => r.visitas > 0)
      .filter((r) => (situacoes.length ? situacoes.includes(r.situacao) : true))
      .filter((r) => (termo ? r.produto.toLowerCase().includes(termo) : true))
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, 20);
  }, [rupturas.data, situacoes, busca]);

  const alternarSituacao = (s: string) =>
    setSituacoes((prev) => (prev.includes(s) ? prev.filter((v) => v !== s) : [...prev, s]));

  /* ---------- Bloco 3 ---------- */
  const dadosFunil = useMemo(() => {
    return (funil.data ?? [])
      .map((r) => ({
        dia: pegaTxt(r, ["dia", "data", "event_date"]).slice(0, 10),
        pct_site_pdp: pega(r, ["pct_site_pdp"]),
        pct_pdp_variante: pega(r, ["pct_pdp_variante"]),
        pct_pdp_cart: pega(r, ["pct_pdp_cart"]),
        sessoes: pega(r, ["sessoes", "sessoes_site", "sessions"]),
        sessoes_pdp: pega(r, ["sessoes_pdp"]),
        sessoes_variante: pega(r, ["sessoes_variante"]),
        sessoes_add_cart: pega(r, ["sessoes_add_cart"]),
      }))
      .sort((a, b) => a.dia.localeCompare(b.dia));
  }, [funil.data]);

  const totaisFunil = useMemo(() => {
    return dadosFunil.reduce(
      (acc, d) => ({
        sessoes: acc.sessoes + d.sessoes,
        pdp: acc.pdp + d.sessoes_pdp,
        variante: acc.variante + d.sessoes_variante,
        cart: acc.cart + d.sessoes_add_cart,
      }),
      { sessoes: 0, pdp: 0, variante: 0, cart: 0 },
    );
  }, [dadosFunil]);

  const semAddCart = dadosFunil.length > 0 && totaisFunil.cart === 0;

  /* ---------- Bloco 4 ---------- */
  const gradeIncompleta = useMemo(() => {
    const mapa = new Map<string, { produto: string; visitas: number; soma: number; tamanhos: Set<string> }>();
    (ausentes.data ?? []).forEach((r) => {
      const produto = pegaTxt(r, ["produto", "nome_produto", "nome", "produto_nome"]);
      const atual = mapa.get(produto) ?? { produto, visitas: 0, soma: 0, tamanhos: new Set<string>() };
      atual.visitas += 1;
      atual.soma += pega(r, ["fracao_demanda_perdida"]);
      const t = pegaTxt(r, ["tamanho", "tamanhos_ausentes", "size"], "");
      t.split(/[,;/]/).map((x) => x.trim()).filter(Boolean).forEach((x) => atual.tamanhos.add(x));
      mapa.set(produto, atual);
    });
    return [...mapa.values()]
      .map((v) => ({
        produto: v.produto,
        visitas: v.visitas,
        perda: v.visitas ? (v.soma / v.visitas) * 100 : 0,
        tamanhos: [...v.tamanhos].sort((a, b) => ordemTamanho(a) - ordemTamanho(b)),
      }))
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, 15);
  }, [ausentes.data]);

  const Carregando = () => <Skeleton className="h-56 w-full rounded-lg" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Ruler className="h-5 w-5 text-primary" /> Tamanhos &amp; Demanda
          </h2>
          <p className="text-sm text-muted-foreground">
            Onde a grade não acompanha o interesse das clientes.
          </p>
        </div>
        <div className="flex gap-1.5">
          {PERIODOS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={dias === d ? "default" : "outline"}
              onClick={() => setDias(d)}
            >
              {d} dias
            </Button>
          ))}
        </div>
      </div>

      {/* BLOCO 1 */}
      <Card className="rounded-xl p-5">
        <h3 className="font-semibold">Demanda x Oferta por tamanho</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Participação de interesse, vendas e grade disponível por tamanho.
        </p>
        {demanda.isLoading ? (
          <Carregando />
        ) : demanda.isError ? (
          <Erro msg="Não foi possível carregar a demanda por tamanho." />
        ) : dadosDemanda.length === 0 ? (
          <Erro msg="Sem dados de demanda por tamanho no período." />
        ) : (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosDemanda}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="tamanho" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: any) => fmtPct(num(v))} />
                  <Legend />
                  <Bar name="Interesse" dataKey="interesse" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar name="Vendas" dataKey="vendas" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  <Bar name="Grade disponível" dataKey="grade" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {alertasGrade.length > 0 && (
              <div className="mt-4 space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                {alertasGrade.map((a) => (
                  <p key={a.tamanho} className="flex items-start gap-2 text-sm text-warning">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <strong>{a.tamanho}:</strong> {fmtPct(a.vendas)} das vendas, apenas{" "}
                      {fmtPct(a.grade)} da grade disponível
                    </span>
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* BLOCO 2 */}
      <Card className="rounded-xl p-5">
        <h3 className="font-semibold">Rupturas que custam visita</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Tamanhos esgotados em produtos que continuam recebendo visitas.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {situacoesDisponiveis.map((s) => (
            <Badge
              key={s}
              variant="outline"
              onClick={() => alternarSituacao(s)}
              className={cn(
                "cursor-pointer",
                situacoes.includes(s) ? corSituacao(s) : "text-muted-foreground",
              )}
            >
              {s}
            </Badge>
          ))}
          <Input
            placeholder="Buscar produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 w-full sm:w-64"
          />
        </div>
        {rupturas.isLoading ? (
          <Carregando />
        ) : rupturas.isError ? (
          <Erro msg="Não foi possível carregar as rupturas." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead className="text-right">Visitas 30d</TableHead>
                  <TableHead className="text-right">Vendas 30d</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasRuptura.map((r, i) => (
                  <TableRow key={`${r.produto}-${r.tamanho}-${i}`}>
                    <TableCell className="max-w-[280px] truncate font-medium">{r.produto}</TableCell>
                    <TableCell>{r.tamanho}</TableCell>
                    <TableCell className="text-right">{fmtNum(r.visitas)}</TableCell>
                    <TableCell className="text-right">{fmtNum(r.vendas)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={corSituacao(r.situacao)}>{r.situacao}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {linhasRuptura.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Nenhuma ruptura com visitas no filtro atual.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* BLOCO 3 */}
      <Card className="rounded-xl p-5">
        <h3 className="font-semibold">Funil de conversão</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Site → PDP → escolha de variante → carrinho ({dias} dias).
        </p>
        {funil.isLoading ? (
          <Carregando />
        ) : funil.isError ? (
          <Erro msg="Não foi possível carregar o funil." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="h-72 lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosFunil}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: any) => fmtPct(num(v))} />
                  <Legend />
                  <Line name="Site → PDP" type="monotone" dataKey="pct_site_pdp" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                  <Line name="PDP → variante" type="monotone" dataKey="pct_pdp_variante" stroke="hsl(var(--warning))" dot={false} strokeWidth={2} />
                  <Line name="PDP → carrinho" type="monotone" dataKey="pct_pdp_cart" stroke="hsl(var(--muted-foreground))" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              {[
                { label: "Sessões", valor: totaisFunil.sessoes },
                { label: "Sessões que viram PDP", valor: totaisFunil.pdp },
                { label: "Escolheram variante", valor: totaisFunil.variante },
                { label: "Adicionaram ao carrinho", valor: totaisFunil.cart, alerta: semAddCart },
              ].map((c) => (
                <Card key={c.label} className="rounded-lg p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                  {c.alerta ? (
                    <p className="mt-1 text-sm font-medium text-warning">
                      Evento add_to_cart sem registro — verificar rastreamento
                    </p>
                  ) : (
                    <p className="mt-1 font-serif text-2xl font-bold">{fmtNum(c.valor)}</p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* BLOCO 4 */}
      <Card className="rounded-xl p-5">
        <h3 className="font-semibold">Grade incompleta vista pela cliente</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Produtos visitados sem todos os tamanhos disponíveis.
        </p>
        {ausentes.isLoading ? (
          <Carregando />
        ) : ausentes.isError ? (
          <Erro msg="Não foi possível carregar a grade incompleta." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Visitas</TableHead>
                  <TableHead>Tamanhos ausentes</TableHead>
                  <TableHead className="w-[200px]">Perda estimada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradeIncompleta.map((g) => (
                  <TableRow key={g.produto}>
                    <TableCell className="max-w-[280px] truncate font-medium">{g.produto}</TableCell>
                    <TableCell className="text-right">{fmtNum(g.visitas)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {g.tamanhos.map((t) => (
                          <Badge key={t} variant="outline" className="border-danger/30 bg-danger/10 text-danger">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(g.perda, 100)} className="h-2 flex-1" />
                        <span className="w-14 text-right text-xs text-muted-foreground">{fmtPct(g.perda)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {gradeIncompleta.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Sem registros de grade incompleta.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
