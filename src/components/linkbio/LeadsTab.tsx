import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Download, Loader2, MousePointerClick, TrendingUp, Users } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 50;

const formatarData = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const formatarDiaMes = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
};



type Lead = {
  id?: string;
  nome?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  cupom_gerado?: string | null;
  origem?: string | null;
  created_at?: string | null;
};

export function LeadsTab() {
  const [dias, setDias] = useState("30");
  const [semanas, setSemanas] = useState("8");
  const [pagina, setPagina] = useState(0);

  const { data: comparativo, isLoading: loadingComparativo } = useQuery({
    queryKey: ["linkbio-comparativo-semanal", semanas],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("linkbio_admin_comparativo_semanal" as any, {
        p_semanas: Number(semanas),
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as any;
    },
  });

  const comp = comparativo?.semana_atual_vs_anterior ?? null;
  const variacao = comp?.variacao_pct === null || comp?.variacao_pct === undefined ? null : Number(comp.variacao_pct);
  const serieSemanas = useMemo(() => {
    const raw = comparativo?.semanas;
    if (!Array.isArray(raw)) return [];
    return raw.map((s: any) => ({
      semana: formatarDiaMes(s.semana_inicio),
      sessoes: Number(s.total_sessoes ?? 0),
      leads: Number(s.total_leads ?? 0),
    }));
  }, [comparativo]);



  const { data: metricas, isLoading: loadingMetricas } = useQuery({
    queryKey: ["linkbio-metricas", dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("linkbio_admin_metricas" as any, { p_dias: Number(dias) });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as any;
    },
  });

  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["linkbio-leads", pagina],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("linkbio_admin_list_leads" as any, {
        p_limit: PAGE_SIZE,
        p_offset: pagina * PAGE_SIZE,
      });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  const sessoes = Number(metricas?.total_sessoes ?? 0);
  const totalLeads = Number(metricas?.total_leads ?? 0);
  const conversao = sessoes > 0 ? (totalLeads / sessoes) * 100 : 0;

  const cliquesBotao: any[] = useMemo(() => {
    const raw = metricas?.cliques_por_botao;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : Object.entries(raw).map(([label, cliques]) => ({ label, cliques }));
  }, [metricas]);

  const cliquesProduto: any[] = useMemo(() => {
    const raw = metricas?.cliques_por_produto;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : Object.entries(raw).map(([titulo, cliques]) => ({ titulo, cliques }));
  }, [metricas]);

  const exportarCSV = () => {
    if (!leads.length) return toast.error("Nenhum lead para exportar.");
    const head = ["Nome", "WhatsApp", "E-mail", "Cupom", "Origem", "Data"];
    const linhas = leads.map((l) => [
      l.nome ?? "", l.whatsapp ?? "", l.email ?? "", l.cupom_gerado ?? "", l.origem ?? "", formatarData(l.created_at),
    ]);
    const csv = [head, ...linhas]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-linkbio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportarCSV}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { titulo: "Sessões", valor: sessoes.toLocaleString("pt-BR"), icone: Users },
          { titulo: "Leads capturados", valor: totalLeads.toLocaleString("pt-BR"), icone: MousePointerClick },
          { titulo: "Taxa de conversão", valor: `${conversao.toFixed(1)}%`, icone: TrendingUp },
        ].map((c) => (
          <Card key={c.titulo}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.titulo}</CardTitle>
              <c.icone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {loadingMetricas ? <Loader2 className="h-5 w-5 animate-spin" /> : c.valor}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Botões mais clicados</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Botão</TableHead><TableHead className="text-right">Cliques</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {cliquesBotao.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">Sem dados no período.</TableCell></TableRow>
                )}
                {cliquesBotao.map((b, i) => (
                  <TableRow key={i}>
                    <TableCell>{b.label ?? b.botao ?? "—"}</TableCell>
                    <TableCell className="text-right">{Number(b.cliques ?? b.total ?? 0).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Produtos mais clicados</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Cliques</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {cliquesProduto.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">Sem dados no período.</TableCell></TableRow>
                )}
                {cliquesProduto.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>{p.titulo ?? p.produto ?? "—"}</TableCell>
                    <TableCell className="text-right">{Number(p.cliques ?? p.total ?? 0).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Leads capturados</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cupom</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLeads && (
                  <TableRow><TableCell colSpan={6} className="text-center py-6"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                )}
                {!loadingLeads && leads.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow>
                )}
                {leads.map((l, i) => (
                  <TableRow key={l.id ?? i}>
                    <TableCell>{l.nome ?? "—"}</TableCell>
                    <TableCell>{l.whatsapp ?? "—"}</TableCell>
                    <TableCell>{l.email ?? "—"}</TableCell>
                    <TableCell>{l.cupom_gerado ?? "—"}</TableCell>
                    <TableCell>{l.origem ?? "—"}</TableCell>
                    <TableCell>{formatarData(l.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Página {pagina + 1}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={leads.length < PAGE_SIZE} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
