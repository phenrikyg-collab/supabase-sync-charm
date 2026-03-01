import { useState } from "react";
import { useProdutos } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function Produtos() {
  const { data: produtos, isLoading } = useProdutos();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = produtos?.filter((p) =>
    p.nome_do_produto.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo_sku?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} produtos encontrados</p>
        </div>
        <Button onClick={() => navigate("/produtos/novo")} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Produto
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Preço Venda</TableHead>
                  <TableHead className="text-right">Preço Custo</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome_do_produto}</TableCell>
                    <TableCell className="text-muted-foreground">{p.codigo_sku ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.preco_venda)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.preco_custo)}</TableCell>
                    <TableCell className="text-right">
                      {p.margem_real_percentual != null ? `${Number(p.margem_real_percentual).toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.ativo ? "default" : "secondary"}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/produtos/${p.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/produtos/${p.id}/editar`)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
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
