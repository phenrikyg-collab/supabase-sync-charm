import { useState } from "react";
import { useMetasFinanceiras, useCreateMeta, useUpdateMeta, useDeleteMeta, useIndicadorRisco, useDashboardExecutivo } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { Plus, Target, TrendingUp, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

// Total de dias do mês (para e-commerce geral)
function totalDiasMes(mesISO: string): number {
  // mesISO no formato "YYYY-MM"
  const [y, m] = mesISO.split("-").map(Number);
  if (!y || !m) return 0;
  return new Date(y, m, 0).getDate();
}

// Dias úteis (seg-sex) do mês — usado pelo canal WhatsApp
function diasUteisMes(mesISO: string): number {
  const [y, m] = mesISO.split("-").map(Number);
  if (!y || !m) return 0;
  const total = new Date(y, m, 0).getDate();
  let count = 0;
  for (let d = 1; d <= total; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

type Canal = "ecommerce" | "whatsapp";

export default function Metas() {
  const { data: metas, isLoading } = useMetasFinanceiras();
  const { data: risco } = useIndicadorRisco();
  const { data: dash } = useDashboardExecutivo();
  const createMut = useCreateMeta();
  const updateMut = useUpdateMeta();
  const deleteMut = useDeleteMeta();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | string | null>(null);
  const [mes, setMes] = useState("");
  const [metaMensal, setMetaMensal] = useState(0);
  const [canal, setCanal] = useState<Canal>("ecommerce");
  const [ticketMedio, setTicketMedio] = useState(0);

  const r = risco?.[0];
  const d = dash?.[0];

  const diasCalculados = mes ? (canal === "whatsapp" ? diasUteisMes(mes) : totalDiasMes(mes)) : 0;

  const resetForm = () => {
    setEditId(null);
    setMes("");
    setMetaMensal(0);
    setCanal("ecommerce");
    setTicketMedio(0);
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (m: any) => {
    setEditId(m.id);
    setMes(m.mes ? String(m.mes).substring(0, 7) : "");
    setMetaMensal(Number(m.meta_mensal ?? 0));
    setTicketMedio(Number(m.meta_ticket_medio ?? 0));
    // Heurística: se dias_uteis < 28 assume whatsapp; senão ecommerce
    const du = Number(m.dias_uteis ?? 0);
    setCanal(du > 0 && du < 28 ? "whatsapp" : "ecommerce");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!mes) return toast.error("Informe o mês");
    if (metaMensal <= 0) return toast.error("Informe a meta mensal");
    const payload = {
      mes: mes + "-01",
      meta_mensal: metaMensal,
      dias_uteis: diasCalculados,
      meta_ticket_medio: ticketMedio,
    };
    try {
      if (editId != null) {
        await updateMut.mutateAsync({ id: editId, ...payload });
        toast.success("Meta atualizada!");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Meta criada!");
      }
      setOpen(false);
      resetForm();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: number | string) => {
    if (!confirm("Excluir esta meta?")) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Meta excluída");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Meta Mensal</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle e projeção de metas</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nova Meta</Button>
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
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead className="text-right">Meta Diária</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(m.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId != null ? "Editar Meta Mensal" : "Nova Meta Mensal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Canal</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={canal === "ecommerce" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setCanal("ecommerce")}
                >
                  E-commerce geral
                </Button>
                <Button
                  type="button"
                  variant={canal === "whatsapp" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setCanal("whatsapp")}
                >
                  WhatsApp
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {canal === "ecommerce"
                  ? "Considera todos os dias do mês."
                  : "Considera apenas dias úteis (seg–sex)."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Meta Mensal (R$)</Label>
              <Input type="number" step="0.01" value={metaMensal} onChange={(e) => setMetaMensal(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Ticket Médio Meta (R$)</Label>
              <Input type="number" step="0.01" value={ticketMedio} onChange={(e) => setTicketMedio(Number(e.target.value))} />
            </div>
            {metaMensal > 0 && diasCalculados > 0 && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">
                  Meta Diária Calculada ({diasCalculados} {canal === "whatsapp" ? "dias úteis" : "dias"})
                </p>
                <p className="text-lg font-serif font-bold text-foreground">{formatCurrency(metaMensal / diasCalculados)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {editId != null ? "Salvar alterações" : "Criar Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
