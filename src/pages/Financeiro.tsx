import { useState } from "react";
import { useMovimentacoesFinanceiras, useCategorias, useCentrosCusto } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/printUtils";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function Financeiro() {
  const { data: movs, isLoading } = useMovimentacoesFinanceiras();
  const { data: categorias } = useCategorias();
  const { data: centros } = useCentrosCusto();

  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroCentro, setFiltroCentro] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todos");

  const catMap = Object.fromEntries((categorias ?? []).map((c) => [c.id, c.nome_categoria]));
  const centroMap = Object.fromEntries((centros ?? []).map((c) => [c.id, c.nome_centro]));

  const filtered = movs?.filter((m) => {
    if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
    if (filtroCategoria !== "todos" && m.categoria_id !== filtroCategoria) return false;
    if (filtroCentro !== "todos" && m.centro_custo_id !== filtroCentro) return false;
    if (filtroOrigem !== "todos" && m.origem !== filtroOrigem) return false;
    return true;
  }) ?? [];

  const origens = [...new Set(movs?.map((m) => m.origem).filter(Boolean) ?? [])];
  const tipos = [...new Set(movs?.map((m) => m.tipo).filter(Boolean) ?? [])];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">{filtered.length} movimentações</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tipos</SelectItem>
            {tipos.map((t) => <SelectItem key={t} value={t!}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {categorias?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_categoria}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCentro} onValueChange={setFiltroCentro}>
          <SelectTrigger><SelectValue placeholder="Centro Custo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {centros?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_centro}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
          <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {origens.map((o) => <SelectItem key={o} value={o!}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{formatDateBR(m.data)}</TableCell>
                    <TableCell className="font-medium max-w-xs truncate">{m.descricao ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={m.tipo === "entrada" ? "default" : "secondary"}>
                        {m.tipo ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.categoria_id ? catMap[m.categoria_id] ?? "—" : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.origem ?? "—"}</TableCell>
                    <TableCell className={`text-right font-medium ${m.tipo === "entrada" ? "text-success" : "text-danger"}`}>
                      {formatCurrency(m.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
