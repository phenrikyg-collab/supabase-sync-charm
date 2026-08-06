import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Users, Send, Workflow, Search } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { ConfiguracaoRFM } from "@/components/rfm/ConfiguracaoRFM";
import {
  ConfigRFM, carregarConfigRFM, scoreRecencia, scoreFrequencia, scoreMonetario,
  segmentarRFM, SEGMENTOS_RECUPERACAO,
} from "@/lib/rfm";

type ClienteRFM = {
  tray_customer_id: string;
  nome: string | null;
  phone: string | null;
  dias_desde_ultima_compra: number;
  frequencia: number;
  valor_total: number;
  ticket_medio: number | null;
};

type AcaoReativacao = {
  tray_customer_id: string;
  nome: string;
  phone: string | null;
  segmento_rfm: string;
  dias_desde_ultima_compra: number;
  tamanho_preferido: string | null;
  nome_produto: string | null;
  stock: number | null;
  preco_atual: number | null;
};

const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

const fmtInt = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR").format(Math.round(Number(n ?? 0)));

const CORES_SEGMENTO: Record<string, { bar: string; classe: string }> = {
  "Campeões": { bar: "hsl(142 60% 40%)", classe: "border-l-4 border-l-[hsl(142_60%_40%)]" },
  "Clientes Fiéis": { bar: "hsl(160 50% 40%)", classe: "border-l-4 border-l-[hsl(160_50%_40%)]" },
  "Potenciais Fiéis": { bar: "hsl(200 60% 45%)", classe: "border-l-4 border-l-[hsl(200_60%_45%)]" },
  "Novos Clientes": { bar: "hsl(210 70% 55%)", classe: "border-l-4 border-l-[hsl(210_70%_55%)]" },
  "Promissores": { bar: "hsl(190 55% 45%)", classe: "border-l-4 border-l-[hsl(190_55%_45%)]" },
  "Precisam de Atenção": { bar: "hsl(38 92% 50%)", classe: "border-l-4 border-l-[hsl(38_92%_50%)]" },
  "Em Risco": { bar: "hsl(25 90% 50%)", classe: "border-l-4 border-l-[hsl(25_90%_50%)]" },
  "Não Pode Perder": { bar: "hsl(20 90% 48%)", classe: "border-l-4 border-l-[hsl(20_90%_48%)]" },
  "Hibernando": { bar: "hsl(220 9% 55%)", classe: "border-l-4 border-l-[hsl(220_9%_55%)]" },
  "Perdidos": { bar: "hsl(0 72% 51%)", classe: "border-l-4 border-l-[hsl(0_72%_51%)]" },
};

const corSegmento = (s: string) =>
  CORES_SEGMENTO[s] ?? { bar: "hsl(var(--primary))", classe: "border-l-4 border-l-primary" };

async function buscarClientes(): Promise<ClienteRFM[]> {
  const pagina = 1000;
  let inicio = 0;
  const todos: ClienteRFM[] = [];
  // paginação recursiva para ultrapassar o limite de 1000 linhas
  for (;;) {
    const { data, error } = await supabase
      .from("vw_rfm_clientes" as any)
      .select("tray_customer_id,nome,phone,dias_desde_ultima_compra,frequencia,valor_total,ticket_medio")
      .range(inicio, inicio + pagina - 1);
    if (error) throw error;
    const lote = (data ?? []) as unknown as ClienteRFM[];
    todos.push(...lote);
    if (lote.length < pagina) break;
    inicio += pagina;
  }
  return todos;
}

export default function DashboardRFM() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [config, setConfig] = useState<ConfigRFM>(() => carregarConfigRFM());
  const [soPrioritarios, setSoPrioritarios] = useState(true);

  useEffect(() => setConfig(carregarConfigRFM()), []);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["vw_rfm_clientes_full"],
    staleTime: 5 * 60 * 1000,
    queryFn: buscarClientes,
  });

  const { data: acoes = [], isLoading: loadingAcoes } = useQuery({
    queryKey: ["vw_acao_reativacao_por_tamanho"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_acao_reativacao_por_tamanho" as any)
        .select("*")
        .order("dias_desde_ultima_compra", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as AcaoReativacao[];
    },
  });

  // Recalcula scores e segmento de cada cliente com a configuração atual
  const clientesScored = useMemo(
    () =>
      clientes.map((c) => {
        const r = scoreRecencia(Number(c.dias_desde_ultima_compra ?? 9999), config);
        const f = scoreFrequencia(Number(c.frequencia ?? 0), config);
        const m = scoreMonetario(Number(c.valor_total ?? 0), config);
        return { ...c, r, f, m, segmento: segmentarRFM(r, f, m) };
      }),
    [clientes, config]
  );

  const mapaClientes = useMemo(() => {
    const m = new Map<string, (typeof clientesScored)[number]>();
    clientesScored.forEach((c) => m.set(String(c.tray_customer_id), c));
    return m;
  }, [clientesScored]);

  const segmentosOrdenados = useMemo(() => {
    const acc = new Map<string, { total: number; receita: number; freq: number; dias: number }>();
    clientesScored.forEach((c) => {
      const cur = acc.get(c.segmento) ?? { total: 0, receita: 0, freq: 0, dias: 0 };
      cur.total += 1;
      cur.receita += Number(c.valor_total ?? 0);
      cur.freq += Number(c.frequencia ?? 0);
      cur.dias += Number(c.dias_desde_ultima_compra ?? 0);
      acc.set(c.segmento, cur);
    });
    return [...acc.entries()]
      .map(([segmento, v]) => ({
        segmento_rfm: segmento,
        total_clientes: v.total,
        receita_total: v.receita,
        ticket_medio_segmento: v.total ? v.receita / Math.max(v.freq, 1) : 0,
        dias_media_ultima_compra: v.total ? v.dias / v.total : 0,
      }))
      .sort((a, b) => b.receita_total - a.receita_total);
  }, [clientesScored]);

  const totalClientes = clientesScored.length;

  // Ações de recuperação: prioriza clientes de maior valor que estão inativos ou quase
  const acoesPriorizadas = useMemo(() => {
    return acoes
      .map((a) => {
        const c = mapaClientes.get(String(a.tray_customer_id));
        const r = c?.r ?? scoreRecencia(Number(a.dias_desde_ultima_compra ?? 9999), config);
        const f = c?.f ?? 1;
        const m = c?.m ?? 1;
        const segmento = c ? c.segmento : a.segmento_rfm;
        // valor do cliente (F+M) ponderado pelo risco de inatividade (5 - R)
        const prioridade = (f + m) * (5 - r);
        return {
          ...a,
          segmento,
          valor_total: c?.valor_total ?? null,
          frequencia: c?.frequencia ?? null,
          prioridade,
          emRisco: SEGMENTOS_RECUPERACAO.includes(segmento as never) || r <= 3,
        };
      })
      .filter((a) => (soPrioritarios ? a.emRisco && a.prioridade >= 6 : true))
      .sort((a, b) => b.prioridade - a.prioridade || b.dias_desde_ultima_compra - a.dias_desde_ultima_compra);
  }, [acoes, mapaClientes, config, soPrioritarios]);

  const acoesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return acoesPriorizadas;
    return acoesPriorizadas.filter(
      (a) =>
        (a.nome ?? "").toLowerCase().includes(q) ||
        (a.phone ?? "").includes(q) ||
        (a.nome_produto ?? "").toLowerCase().includes(q)
    );
  }, [acoesPriorizadas, busca]);

  const dadosGrafico = useMemo(
    () =>
      segmentosOrdenados.map((s) => ({
        segmento: s.segmento_rfm,
        clientes: s.total_clientes,
        cor: corSegmento(s.segmento_rfm).bar,
      })),
    [segmentosOrdenados]
  );

  const badgePrioridade = (p: number) =>
    p >= 16
      ? { label: "Alta", classe: "bg-danger/10 text-danger border-danger/20" }
      : p >= 10
      ? { label: "Média", classe: "bg-warning/10 text-warning border-warning/20" }
      : { label: "Baixa", classe: "bg-muted text-muted-foreground border-border" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-3xl font-serif font-bold text-foreground">
          Dashboard <span className="text-primary">RFM</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Segmentação de clientes por recência, frequência e valor — {fmtInt(totalClientes)} clientes
        </p>
      </div>

      <ConfiguracaoRFM config={config} onChange={setConfig} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {segmentosOrdenados.map((s) => (
            <Card key={s.segmento_rfm} className={corSegmento(s.segmento_rfm).classe}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>{s.segmento_rfm}</span>
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    {fmtInt(s.total_clientes)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-lg font-bold">{fmtMoney(s.receita_total)}</p>
                <p className="text-xs text-muted-foreground">
                  Ticket médio: {fmtMoney(s.ticket_medio_segmento)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Última compra: {fmtInt(s.dias_media_ultima_compra)} dias (média)
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição de clientes por segmento</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosGrafico} margin={{ top: 8, right: 8, bottom: 60, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="segmento"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [fmtInt(v), "Clientes"]} />
              <Bar dataKey="clientes" radius={[4, 4, 0, 0]}>
                {dadosGrafico.map((d) => (
                  <Cell key={d.segmento} fill={d.cor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base">Ações de Recuperação</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Ordenadas por prioridade: clientes de maior valor (frequência + monetário) que estão
              inativos ou próximos da inatividade
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex items-center gap-2">
              <Switch id="prioritarios" checked={soPrioritarios} onCheckedChange={setSoPrioritarios} />
              <Label htmlFor="prioritarios" className="text-xs">Somente prioritários</Label>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, telefone ou produto"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAcoes ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead className="text-right">Valor gasto</TableHead>
                    <TableHead className="text-right">Dias sem comprar</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Sugestão</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acoesFiltradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  )}
                  {acoesFiltradas.slice(0, 300).map((a, i) => {
                    const bp = badgePrioridade(a.prioridade);
                    return (
                      <TableRow key={`${a.tray_customer_id}-${i}`}>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${bp.classe}`}>
                            {bp.label}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{a.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{a.phone ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{a.segmento}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {a.valor_total != null ? fmtMoney(a.valor_total) : "—"}
                        </TableCell>
                        <TableCell className="text-right">{fmtInt(a.dias_desde_ultima_compra)}</TableCell>
                        <TableCell>{a.tamanho_preferido ?? "—"}</TableCell>
                        <TableCell>{a.nome_produto ?? "—"}</TableCell>
                        <TableCell className="text-right">{fmtInt(a.stock)}</TableCell>
                        <TableCell className="text-right">
                          {a.phone ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/atendimento?telefone=${encodeURIComponent(a.phone!)}`)}
                            >
                              <Send className="h-3.5 w-3.5 mr-1" />
                              Enviar sugestão
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => navigate("/automacoes")}>
                              <Workflow className="h-3.5 w-3.5 mr-1" />
                              Criar automação
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
