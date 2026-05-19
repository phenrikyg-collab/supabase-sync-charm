import { useMemo, useState } from "react";
import { useProdutos } from "@/hooks/useSupabase";
import { useTrayProdutos, type TrayProd } from "@/hooks/useTrayProdutos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Edit, Package, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

type Row =
  | { kind: "produto"; id: string; sku: string | null; nome: string; tecido: string | null; custo: number | null; venda: number | null; margem: number | null; ativo: boolean }
  | { kind: "tray"; id: string; sku: string | null; nome: string; tecido: string | null; custo: number | null; venda: number | null; tray: TrayProd };

export default function Produtos() {
  const { data: produtos, isLoading } = useProdutos();
  const { data: tray, loading: loadingTray } = useTrayProdutos(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [origemFilter, setOrigemFilter] = useState("todos");
  const navigate = useNavigate();

  const rows: Row[] = useMemo(() => {
    const prodRows: Row[] = (produtos || []).map((p) => ({
      kind: "produto" as const,
      id: p.id,
      sku: p.codigo_sku,
      nome: p.nome_do_produto,
      tecido: p.tecido_do_produto,
      custo: p.preco_custo,
      venda: p.preco_venda,
      margem: p.margem_real_percentual,
      ativo: !!p.ativo,
    }));
    const trayRows: Row[] = (tray || [])
      .filter((t) => !t.jaCadastrado)
      .map((t) => ({
        kind: "tray" as const,
        id: t.id,
        sku: t.reference,
        nome: t.nome,
        tecido: null,
        custo: t.custo,
        venda: t.preco,
        tray: t,
      }));
    return [...prodRows, ...trayRows];
  }, [produtos, tray]);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.nome.toLowerCase().includes(q) || (r.sku ?? "").toLowerCase().includes(q);
    const matchOrigem = origemFilter === "todos" || origemFilter === r.kind;
    const matchStatus =
      statusFilter === "todos" ||
      (r.kind === "produto" && ((statusFilter === "ativo" && r.ativo) || (statusFilter === "inativo" && !r.ativo)));
    return matchSearch && matchOrigem && matchStatus;
  });

  const importarTray = (t: TrayProd) => {
    toast.success("Importando produto da Tray", { description: t.nome });
    navigate("/produtos/novo", { state: { tray: t } });
  };

  const totalTrayNovos = (tray || []).filter((t) => !t.jaCadastrado).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          <span className="text-primary">Produtos</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Listagem e gestão de produtos cadastrados
          {loadingTray ? " · sincronizando Tray…" : totalTrayNovos > 0 ? ` · ${totalTrayNovos} produtos novos da Tray` : ""}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="font-serif font-bold text-lg text-foreground">Produtos</h2>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome ou código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64"
                />
              </div>
              <Select value={origemFilter} onValueChange={setOrigemFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas origens</SelectItem>
                  <SelectItem value="produto">Cadastrados</SelectItem>
                  <SelectItem value="tray">Tray (novos)</SelectItem>
                </SelectContent>
              </Select>
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
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-primary font-medium">{r.sku ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{r.tecido ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.custo)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.venda)}</TableCell>
                    <TableCell className="text-right">
                      {r.kind === "produto" && r.margem != null ? `${Number(r.margem).toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell>
                      {r.kind === "produto" ? (
                        <Badge
                          variant={r.ativo ? "default" : "secondary"}
                          className={r.ativo ? "bg-success/20 text-success border-success/30" : ""}
                        >
                          {r.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      ) : (
                        <Badge className="bg-primary/15 text-primary border-primary/30">Tray · Novo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.kind === "produto" ? (
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/produtos/${r.id}/editar`)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => importarTray(r.tray)}>
                          <Download className="h-4 w-4 mr-1" />
                          Importar da Tray
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum produto encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
