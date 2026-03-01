import { useState } from "react";
import { useRolosTecido, useTecidos } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Search } from "lucide-react";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function EstoqueTecidos() {
  const { data: rolos, isLoading } = useRolosTecido();
  const { data: tecidos } = useTecidos();
  const [search, setSearch] = useState("");

  const tecidoMap = Object.fromEntries((tecidos ?? []).map((t) => [t.id, t]));
  const todosRolos = rolos ?? [];

  const filtered = todosRolos.filter((r) => {
    const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
    const text = `${r.codigo_rolo} ${tecido?.nome_tecido} ${r.cor_nome} ${r.lote}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const custoTotal = filtered.reduce((a, r) => {
    const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
    return a + (r.metragem_disponivel ?? 0) * (tecido?.custo_por_metro ?? 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Estoque de <span className="text-primary">Tecidos</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Controle de rolos e metragem disponível</p>
      </div>

      <Card>
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Custo Total de Tecido em Estoque</p>
              <p className="text-2xl font-serif font-bold text-foreground mt-1">{formatCurrency(custoTotal)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground/30" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif font-bold text-lg text-foreground">Rolos Disponíveis</h2>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar tecido, cor ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Tecido</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Custo/M</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
                  const custoMetro = tecido?.custo_por_metro ?? 0;
                  const custoRolo = (r.metragem_disponivel ?? 0) * custoMetro;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-primary font-medium">{r.codigo_rolo ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{(r as any).lote ?? "—"}</TableCell>
                      <TableCell className="font-medium">{tecido?.nome_tecido ?? "—"}</TableCell>
                      <TableCell>{r.cor_nome ?? "—"}</TableCell>
                      <TableCell className="text-right">{(r.metragem_disponivel ?? 0).toFixed(1)}m</TableCell>
                      <TableCell>
                        {(r.metragem_disponivel ?? 0) > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Disponível</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Usado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(custoMetro)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(custoRolo)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
