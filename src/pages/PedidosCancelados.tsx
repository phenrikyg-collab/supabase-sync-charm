import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHead, useSortable, useOrdenado } from "@/components/SortableHead";
import { EnviarWhatsAppInline } from "@/components/rfm/EnviarWhatsAppInline";
import { FiltroPeriodo, Periodo } from "@/components/recuperacao/FiltroPeriodo";
import { SegmentoBadge, CelulaItens, moeda } from "@/components/recuperacao/comum";
import { formatarData } from "@/utils/formatters";
import { Loader2, PackageX, TrendingDown } from "lucide-react";

type PedidoCancelado = {
  tray_order_id: string;
  tray_customer_id: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  total_amount: number | null;
  date_purchase: string | null;
  dias_desde_cancelamento: number | null;
  status: string | null;
  observacao: string | null;
  itens: unknown;
  segmento_rfm: string | null;
  rfm_score: number | null;
};

type Chave = "nome" | "telefone" | "total_amount" | "date_purchase" | "dias_desde_cancelamento" | "segmento_rfm";

export default function PedidosCancelados() {
  const [periodo, setPeriodo] = useState<Periodo>({ inicio: null, fim: null });
  const [segmento, setSegmento] = useState("todos");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");

  const { data: linhas = [], isLoading, error } = useQuery({
    queryKey: ["vw_pedidos_cancelados_recuperacao", periodo.inicio, periodo.fim],
    queryFn: async () => {
      let q = supabase.from("vw_pedidos_cancelados_recuperacao" as any).select("*").limit(5000);
      if (periodo.inicio) q = q.gte("date_purchase", periodo.inicio);
      if (periodo.fim) q = q.lte("date_purchase", periodo.fim);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PedidoCancelado[];
    },
  });

  const segmentos = useMemo(
    () => Array.from(new Set(linhas.map((l) => (l.segmento_rfm ?? "").trim()).filter(Boolean))).sort(),
    [linhas]
  );

  const filtradas = useMemo(() => {
    const min = valorMin ? Number(valorMin) : null;
    const max = valorMax ? Number(valorMax) : null;
    return linhas.filter((l) => {
      const v = Number(l.total_amount ?? 0);
      if (segmento !== "todos") {
        const s = (l.segmento_rfm ?? "").trim();
        if (segmento === "__sem__" ? !!s : s !== segmento) return false;
      }
      if (min != null && v < min) return false;
      if (max != null && v > max) return false;
      return true;
    });
  }, [linhas, segmento, valorMin, valorMax]);

  const { sort, alternar } = useSortable<Chave>({ key: "date_purchase", dir: "desc" });
  const ordenadas = useOrdenado<PedidoCancelado, Chave>(filtradas, sort, {
    nome: (l) => l.nome ?? "",
    telefone: (l) => l.telefone ?? "",
    total_amount: (l) => Number(l.total_amount ?? 0),
    date_purchase: (l) => l.date_purchase ?? "",
    dias_desde_cancelamento: (l) => Number(l.dias_desde_cancelamento ?? 0),
    segmento_rfm: (l) => l.segmento_rfm ?? "",
  });

  const totalPerdido = filtradas.reduce((s, l) => s + Number(l.total_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">Pedidos Cancelados</h1>
        <p className="text-sm text-muted-foreground">Pedidos cancelados com dados da cliente para recuperação.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <FiltroPeriodo periodo={periodo} onChange={setPeriodo} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Pedidos cancelados</CardTitle>
            <PackageX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="font-serif text-2xl font-bold">{filtradas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Valor total perdido</CardTitle>
            <TrendingDown className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <p className="font-serif text-2xl font-bold text-danger">{moeda(totalPerdido)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Segmento RFM</Label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os segmentos</SelectItem>
                  <SelectItem value="__sem__">Sem segmento</SelectItem>
                  {segmentos.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor mínimo</Label>
              <Input type="number" className="h-9 w-[130px]" value={valorMin} onChange={(e) => setValorMin(e.target.value)} placeholder="R$ 0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor máximo</Label>
              <Input type="number" className="h-9 w-[130px]" value={valorMax} onChange={(e) => setValorMax(e.target.value)} placeholder="R$ —" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-danger">
              Não foi possível carregar os pedidos cancelados. Selecione um período menor (ex: últimos 30 dias) e tente novamente.
            </p>
          ) : ordenadas.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum pedido cancelado no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead campo="nome" sort={sort} onSort={alternar}>Cliente</SortableHead>
                    <SortableHead campo="telefone" sort={sort} onSort={alternar}>Telefone</SortableHead>
                    <SortableHead campo="total_amount" sort={sort} onSort={alternar} className="text-right">Valor</SortableHead>
                    <TableHead>Itens</TableHead>
                    <SortableHead campo="date_purchase" sort={sort} onSort={alternar}>Cancelamento</SortableHead>
                    <SortableHead campo="dias_desde_cancelamento" sort={sort} onSort={alternar} className="text-right">Dias</SortableHead>
                    <SortableHead campo="segmento_rfm" sort={sort} onSort={alternar}>Segmento</SortableHead>
                    <TableHead>Recuperar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenadas.map((l) => (
                    <TableRow key={l.tray_order_id}>
                      <TableCell className="font-medium">
                        {l.nome?.trim() || <span className="text-muted-foreground">Cliente não identificado</span>}
                        <div className="text-[11px] text-muted-foreground">#{l.tray_order_id}</div>
                      </TableCell>
                      <TableCell className="text-xs">{l.telefone || "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{moeda(l.total_amount)}</TableCell>
                      <TableCell><CelulaItens itens={l.itens} /></TableCell>
                      <TableCell className="text-xs">{formatarData(l.date_purchase)}</TableCell>
                      <TableCell className="text-right">{l.dias_desde_cancelamento ?? "—"}</TableCell>
                      <TableCell><SegmentoBadge segmento={l.segmento_rfm} /></TableCell>
                      <TableCell>
                        {l.telefone ? (
                          <EnviarWhatsAppInline telefone={l.telefone} placeholder="Mensagem de recuperação..." mostrarAviso />
                        ) : (
                          <span className="text-xs text-muted-foreground">Cliente não identificado</span>
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
