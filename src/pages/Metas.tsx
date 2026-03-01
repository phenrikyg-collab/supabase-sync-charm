import { useState } from "react";
import { useMetasFinanceiras, useCreateMeta, useIndicadorRisco, useDashboardExecutivo } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function Metas() {
  const { data: metas, isLoading } = useMetasFinanceiras();
  const { data: risco } = useIndicadorRisco();
  const { data: dash } = useDashboardExecutivo();
  const createMut = useCreateMeta();

  const [open, setOpen] = useState(false);
  const [mes, setMes] = useState("");
  const [metaMensal, setMetaMensal] = useState(0);
  const [diasUteis, setDiasUteis] = useState(22);
  const [ticketMedio, setTicketMedio] = useState(0);

  const r = risco?.[0];
  const d = dash?.[0];

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync({
        mes: mes + "-01",
        meta_mensal: metaMensal,
        dias_uteis: diasUteis,
        meta_ticket_medio: ticketMedio,
      });
      toast.success("Meta criada!");
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Meta Mensal</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle e projeção de metas</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Nova Meta</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Meta do Mês"
          value={formatCurrency(d?.meta_mensal)}
          subtitle={`Vendido: ${formatCurrency(d?.vendido)}`}
          icon={Target}
          variant="primary"
        />
        <StatCard
          title="Projeção Faturamento"
          value={formatCurrency(r?.media_real_diaria && r?.dias_restantes ? (r.faturamento_realizado ?? 0) + r.media_real_diaria * r.dias_restantes : 0)}
          subtitle={`Média diária: ${formatCurrency(r?.media_real_diaria)}`}
          icon={TrendingUp}
          variant="default"
        />
        <StatCard
          title="Risco da Meta"
          value={r?.nivel_risco ?? "—"}
          subtitle={`Necessário/dia: ${formatCurrency(r?.media_necessaria_diaria)}`}
          icon={AlertTriangle}
          variant={r?.nivel_risco === "alto" ? "danger" : r?.nivel_risco === "moderado" ? "warning" : "success"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Metas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Meta Mensal</TableHead>
                  <TableHead className="text-right">Dias Úteis</TableHead>
                  <TableHead className="text-right">Meta Diária</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metas?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.mes ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.meta_mensal)}</TableCell>
                    <TableCell className="text-right">{m.dias_uteis ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {m.meta_mensal && m.dias_uteis ? formatCurrency(m.meta_mensal / m.dias_uteis) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(m.meta_ticket_medio)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Meta Mensal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Meta Mensal (R$)</Label>
              <Input type="number" step="0.01" value={metaMensal} onChange={(e) => setMetaMensal(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Dias Úteis</Label>
              <Input type="number" value={diasUteis} onChange={(e) => setDiasUteis(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Ticket Médio Meta (R$)</Label>
              <Input type="number" step="0.01" value={ticketMedio} onChange={(e) => setTicketMedio(Number(e.target.value))} />
            </div>
            {metaMensal > 0 && diasUteis > 0 && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">Meta Diária Calculada</p>
                <p className="text-lg font-serif font-bold text-foreground">{formatCurrency(metaMensal / diasUteis)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>Criar Meta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
