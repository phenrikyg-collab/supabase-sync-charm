import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Users, Send, Workflow, Search } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

type ResumoRFM = {
  segmento_rfm: string;
  total_clientes: number;
  receita_total: number;
  ticket_medio_segmento: number;
  frequencia_media: number | null;
  dias_media_ultima_compra: number;
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

export default function DashboardRFM() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");

  const { data: resumo = [], isLoading } = useQuery({
    queryKey: ["vw_rfm_dashboard_resumo"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_rfm_dashboard_resumo" as any)
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as ResumoRFM[];
    },
  });

  const { data: acoes = [], isLoading: loadingAcoes } = useQuery({
    queryKey: ["vw_acao_reativacao_por_tamanho"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_acao_reativacao_por_tamanho" as any)
        .select("*")
        .order("dias_desde_ultima_compra", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AcaoReativacao[];
    },
  });

  const segmentosOrdenados = useMemo(
    () => [...resumo].sort((a, b) => Number(b.receita_total) - Number(a.receita_total)),
    [resumo]
  );

  const totalClientes = useMemo(
    () => resumo.reduce((acc, r) => acc + Number(r.total_clientes ?? 0), 0),
    [resumo]
  );

  const acoesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return acoes;
    return acoes.filter(
      (a) =>
        (a.nome ?? "").toLowerCase().includes(q) ||
        (a.phone ?? "").includes(q) ||
        (a.nome_produto ?? "").toLowerCase().includes(q)
    );
  }, [acoes, busca]);

  const dadosGrafico = useMemo(
    () =>
      segmentosOrdenados.map((s) => ({
        segmento: s.segmento_rfm,
        clientes: Number(s.total_clientes ?? 0),
        cor: corSegmento(s.segmento_rfm).bar,
      })),
    [segmentosOrdenados]
  );

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
              Clientes em risco cruzados com o tamanho preferido e produtos disponíveis em estoque
            </p>
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
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Segmento</TableHead>
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
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  )}
                  {acoesFiltradas.map((a, i) => (
                    <TableRow key={`${a.tray_customer_id}-${i}`}>
                      <TableCell className="font-medium">{a.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{a.phone ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{a.segmento_rfm}</Badge>
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
