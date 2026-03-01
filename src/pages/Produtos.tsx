import { useState } from "react";
import { useProdutos } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Edit, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function Produtos() {
  const { data: produtos, isLoading } = useProdutos();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const navigate = useNavigate();

  const filtered = produtos?.filter((p) => {
    const matchSearch = p.nome_do_produto.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo_sku?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || (statusFilter === "ativo" ? p.ativo : !p.ativo);
    return matchSearch && matchStatus;
  }) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          <span className="text-primary">Produtos</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Listagem e gestão de produtos cadastrados</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="font-serif font-bold text-lg text-foreground">Produtos</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome ou código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tecido</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-primary font-medium">{p.codigo_sku ?? "—"}</TableCell>
                    <TableCell className="font-medium">{p.nome_do_produto}</TableCell>
                    <TableCell className="text-muted-foreground">{p.tecido_do_produto ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.preco_custo)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.preco_venda)}</TableCell>
                    <TableCell className="text-right">
                      {p.margem_real_percentual != null ? `${Number(p.margem_real_percentual).toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.ativo ? "default" : "secondary"} className={p.ativo ? "bg-success/20 text-success border-success/30" : ""}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/produtos/${p.id}/editar`)}>
                        <Edit className="h-4 w-4" />
                      </Button>
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
