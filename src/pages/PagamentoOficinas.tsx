import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrdensProducao, useOficinas } from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import { chamarRpc } from "@/lib/supabaseRpc";
import { brl, pecasPagaveis, rpcAusente, valorOp } from "@/lib/oficinaFluxo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, DollarSign, Factory, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/printUtils";

const hoje = new Date();
const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
const fimHoje = hoje.toISOString().slice(0, 10);

export default function PagamentoOficinas() {
  const qc = useQueryClient();
  const { data: ordens, isLoading } = useOrdensProducao();
  const { data: oficinas } = useOficinas();

  const [filtroOficina, setFiltroOficina] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("pendente");
  const [de, setDe] = useState(inicioMes);
  const [ate, setAte] = useState(fimHoje);
  const [pagando, setPagando] = useState<string | null>(null);

  const oficinaMap = useMemo(() => Object.fromEntries((oficinas ?? []).map((o) => [o.id, o])), [oficinas]);
  const oficinasExternas = useMemo(
    () => (oficinas ?? []).filter((o) => (o.tipo_oficina ?? "").toLowerCase() !== "interna" && (o.nome_oficina ?? "").toLowerCase() !== "interna" && !o.is_interna),
    [oficinas],
  );
  const externasIds = useMemo(() => new Set(oficinasExternas.map((o) => o.id)), [oficinasExternas]);

  // Só entra no fechamento o que foi entregue no período
  const linhas = useMemo(() => {
    return (ordens ?? [])
      .map((o: any) => ({ ...o, _data: o.data_entrega ?? o.data_fim ?? null }))
      .filter((o: any) => o.oficina_id && externasIds.has(o.oficina_id))
      .filter((o: any) => filtroOficina === "todas" || o.oficina_id === filtroOficina)
      // Sem data de entrega: entra no fechamento enquanto estiver a pagar, para não sumir da tela
      .filter((o: any) => (o._data ? o._data >= de && o._data <= ate : o.pagamento_oficina_status !== "Pago"))
      .filter((o: any) =>
        filtroStatus === "todos" ? true : filtroStatus === "pago" ? o.pagamento_oficina_status === "Pago" : o.pagamento_oficina_status !== "Pago",
      );
  }, [ordens, externasIds, filtroOficina, filtroStatus, de, ate]);

  const grupos = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const o of linhas) m.set(o.oficina_id, [...(m.get(o.oficina_id) ?? []), o]);
    return [...m.entries()].map(([id, ops]) => {
      const custo = oficinaMap[id]?.custo_por_peca ?? 0;
      const pendentes = ops.filter((o) => o.pagamento_oficina_status !== "Pago");
      return {
        id,
        nome: oficinaMap[id]?.nome_oficina ?? "-",
        custo,
        ops,
        pecas: ops.reduce((s, o) => s + pecasPagaveis(o), 0),
        total: ops.reduce((s, o) => s + valorOp(o, custo), 0),
        aPagar: pendentes.reduce((s, o) => s + valorOp(o, custo), 0),
        pendentesIds: pendentes.map((o) => o.id as string),
      };
    });
  }, [linhas, oficinaMap]);

  const totalAPagar = grupos.reduce((s, g) => s + g.aPagar, 0);
  const totalPago = grupos.reduce((s, g) => s + (g.total - g.aPagar), 0);

  const marcarPago = async (ids: string[], chave: string) => {
    if (!ids.length) return;
    setPagando(chave);
    try {
      const { data, error } = await chamarRpc("pagamento_oficinas_marcar_pago", { p_ids: ids });
      if (error && rpcAusente(error)) {
        // SQL ainda não aplicado: mantém o caminho antigo, uma OP por vez
        for (const id of ids) {
          const o = linhas.find((x: any) => x.id === id);
          if (!o) continue;
          const valor = valorOp(o, oficinaMap[o.oficina_id]?.custo_por_peca);
          const { error: e1 } = await supabase.from("ordens_producao").update({ pagamento_oficina_status: "Pago" }).eq("id", id);
          if (e1) throw e1;
          await supabase.from("movimentacoes_financeiras").insert({
            tipo: "Saída",
            descricao: `Pagamento oficina ${oficinaMap[o.oficina_id]?.nome_oficina ?? "-"} - ${o.nome_produto ?? "OP"}`,
            valor,
            data: fimHoje,
            origem: "Pagamento Oficina",
          });
        }
        toast.success("Pagamento registrado");
      } else if (error) {
        throw error;
      } else {
        toast.success(`Pagamento de ${brl(Number(data?.total ?? 0))} registrado e lançado no financeiro`);
      }
      qc.invalidateQueries({ queryKey: ["ordens-producao"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar pagamento");
    } finally {
      setPagando(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Pagamento de <span className="text-primary">Oficinas</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Fechamento por oficina das peças entregues no período</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-l-4 border-l-warning"><CardContent className="flex items-center justify-between py-4">
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">A pagar</p><p className="text-2xl font-bold text-warning">{brl(totalAPagar)}</p></div>
          <AlertCircle className="h-5 w-5 text-warning" />
        </CardContent></Card>
        <Card className="border-l-4 border-l-success"><CardContent className="flex items-center justify-between py-4">
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pago no período</p><p className="text-2xl font-bold text-success">{brl(totalPago)}</p></div>
          <CheckCircle className="h-5 w-5 text-success" />
        </CardContent></Card>
        <Card className="border-l-4 border-l-primary"><CardContent className="flex items-center justify-between py-4">
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ordens no fechamento</p><p className="text-2xl font-bold text-foreground">{linhas.length}</p></div>
          <Factory className="h-5 w-5 text-primary" />
        </CardContent></Card>
      </div>

      <Card><CardContent className="flex flex-wrap items-end gap-4 py-4">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entregue de</label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 w-[160px]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">até</label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 w-[160px]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Oficina</label>
          <Select value={filtroOficina} onValueChange={setFiltroOficina}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as oficinas</SelectItem>
              {oficinasExternas.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome_oficina}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pagamento</label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">A pagar</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      {isLoading ? (
        <p className="py-8 text-center text-muted-foreground">Carregando...</p>
      ) : grupos.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Factory className="mx-auto mb-3 h-10 w-10 opacity-30" />
          Nenhuma entrega de oficina externa neste período
        </CardContent></Card>
      ) : (
        grupos.map((g) => (
          <Card key={g.id}>
            <CardContent className="space-y-4 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-serif text-xl font-semibold text-foreground">{g.nome}</p>
                  <p className="text-sm text-muted-foreground">{g.pecas} peças x {brl(g.custo)} = <strong className="text-foreground">{brl(g.total)}</strong></p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">A pagar: <strong className="text-warning">{brl(g.aPagar)}</strong></span>
                  <Button
                    size="sm"
                    disabled={!g.pendentesIds.length || pagando !== null}
                    onClick={() => marcarPago(g.pendentesIds, g.id)}
                  >
                    <DollarSign className="mr-1 h-3.5 w-3.5" />
                    {pagando === g.id ? "Registrando..." : "Marcar tudo como pago"}
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead className="text-right">Peças</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.ops.map((o: any) => {
                    const pago = o.pagamento_oficina_status === "Pago";
                    return (
                      <TableRow key={o.id} className={pago ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{o.nome_produto ?? "-"}</TableCell>
                        <TableCell>{o._data ? formatDateBR(o._data) : "-"}</TableCell>
                        <TableCell className="text-right">{pecasPagaveis(o)}</TableCell>
                        <TableCell className="text-right">{brl(valorOp(o, g.custo))}</TableCell>
                        <TableCell>
                          {pago ? (
                            <Badge className="gap-1 border-success/30 bg-success/15 text-xs text-success"><CheckCircle className="h-3 w-3" /> Pago {o.data_pagamento ? formatDateBR(o.data_pagamento) : ""}</Badge>
                          ) : (
                            <Badge variant="outline" className="border-warning/30 text-xs text-warning">A pagar</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!pago && (
                            <Button size="sm" variant="outline" disabled={pagando !== null} onClick={() => marcarPago([o.id], o.id)}>Pagar</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
