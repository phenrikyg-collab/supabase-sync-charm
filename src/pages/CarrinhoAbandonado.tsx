import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHead, useSortable, useOrdenado } from "@/components/SortableHead";
import { EnviarWhatsAppInline } from "@/components/rfm/EnviarWhatsAppInline";
import { FiltroPeriodo, Periodo, limiteInicio, limiteFim } from "@/components/recuperacao/FiltroPeriodo";
import { SegmentoBadge, CelulaItens, moeda } from "@/components/recuperacao/comum";
import { formatarData } from "@/utils/formatters";
import { Loader2, ShoppingCart, Wallet, Receipt } from "lucide-react";

type Carrinho = {
  session_id: string;
  tray_customer_id: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  total: number | null;
  itens: unknown;
  data_criacao: string | null;
  hora_criacao: string | null;
  dias_desde_abandono: number | null;
  segmento_rfm: string | null;
  rfm_score: number | null;
};

type Chave = "nome" | "telefone" | "total" | "dias_desde_abandono" | "segmento_rfm" | "data_criacao";

export default function CarrinhoAbandonado() {
  const [periodo, setPeriodo] = useState<Periodo>({ inicio: null, fim: null });
  const [segmento, setSegmento] = useState("todos");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [somenteIdentificados, setSomenteIdentificados] = useState(false);

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["vw_carrinhos_abandonados", periodo.inicio, periodo.fim, somenteIdentificados],
    queryFn: async () => {
      let q = supabase.from("vw_carrinhos_abandonados" as any).select("*").limit(5000);
      if (periodo.inicio) q = q.gte("data_criacao", limiteInicio(periodo.inicio)!);
      if (periodo.fim) q = q.lte("data_criacao", limiteFim(periodo.fim)!);
      if (somenteIdentificados) q = q.neq("nome", "Desconhecido");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Carrinho[];
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
      const v = Number(l.total ?? 0);
      if (segmento !== "todos") {
        const s = (l.segmento_rfm ?? "").trim();
        if (segmento === "__sem__" ? !!s : s !== segmento) return false;
      }
      if (min != null && v < min) return false;
      if (max != null && v > max) return false;
      return true;
    });
  }, [linhas, segmento, valorMin, valorMax]);

  const { sort, alternar } = useSortable<Chave>({ key: "total", dir: "desc" });
  const ordenadas = useOrdenado<Carrinho, Chave>(filtradas, sort, {
    nome: (l) => l.nome ?? "",
    telefone: (l) => l.telefone ?? "",
    total: (l) => Number(l.total ?? 0),
    dias_desde_abandono: (l) => Number(l.dias_desde_abandono ?? 0),
    segmento_rfm: (l) => l.segmento_rfm ?? "",
    data_criacao: (l) => `${l.data_criacao ?? ""}T${String(l.hora_criacao ?? "00:00:00")}`,
  });

  const totalValor = filtradas.reduce((s, l) => s + Number(l.total ?? 0), 0);
  const ticket = filtradas.length ? totalValor / filtradas.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">Carrinho Abandonado</h1>
        <p className="text-sm text-muted-foreground">Carrinhos que não viraram pedido — oportunidade de recuperação.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <FiltroPeriodo periodo={periodo} onChange={setPeriodo} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Carrinhos abandonados</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="font-serif text-2xl font-bold">{filtradas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Valor total parado</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="font-serif text-2xl font-bold">{moeda(totalValor)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Ticket médio</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="font-serif text-2xl font-bold">{moeda(ticket)}</p>
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
              <Input
                type="number"
                className="h-9 w-[130px]"
                value={valorMin}
                onChange={(e) => setValorMin(e.target.value)}
                placeholder="R$ 0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor máximo</Label>
              <Input
                type="number"
                className="h-9 w-[130px]"
                value={valorMax}
                onChange={(e) => setValorMax(e.target.value)}
                placeholder="R$ —"
              />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Checkbox
                id="somente-identificados"
                checked={somenteIdentificados}
                onCheckedChange={(v) => setSomenteIdentificados(v === true)}
              />
              <Label htmlFor="somente-identificados" className="text-xs">Mostrar apenas identificados</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : ordenadas.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum carrinho abandonado no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead campo="nome" sort={sort} onSort={alternar}>Cliente</SortableHead>
                    <SortableHead campo="telefone" sort={sort} onSort={alternar}>Telefone</SortableHead>
                    <SortableHead campo="total" sort={sort} onSort={alternar} className="text-right">Valor</SortableHead>
                    <TableHead>Itens</TableHead>
                    <SortableHead campo="dias_desde_abandono" sort={sort} onSort={alternar} className="text-right">Dias</SortableHead>
                    <SortableHead campo="data_criacao" sort={sort} onSort={alternar}>Abandono</SortableHead>
                    <SortableHead campo="segmento_rfm" sort={sort} onSort={alternar}>Segmento</SortableHead>
                    <TableHead>Recuperar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenadas.map((l) => {
                    const identificado = !!l.telefone || !!l.tray_customer_id;
                    return (
                      <TableRow key={l.session_id}>
                        <TableCell className="font-medium">
                          {l.nome?.trim() || <span className="text-muted-foreground">Cliente não identificado</span>}
                          {l.email && <div className="text-[11px] text-muted-foreground">{l.email}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{l.telefone || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{moeda(l.total)}</TableCell>
                        <TableCell><CelulaItens itens={l.itens} /></TableCell>
                        <TableCell className="text-right">{l.dias_desde_abandono ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {formatarData(l.data_criacao)}
                          {l.hora_criacao && <span className="text-muted-foreground"> {String(l.hora_criacao).slice(0, 5)}</span>}
                        </TableCell>
                        <TableCell><SegmentoBadge segmento={l.segmento_rfm} /></TableCell>
                        <TableCell>
                          {identificado && l.telefone ? (
                            <EnviarWhatsAppInline telefone={l.telefone} placeholder="Mensagem de recuperação..." mostrarAviso />
                          ) : (
                            <span className="text-xs text-muted-foreground">Cliente não identificado</span>
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
