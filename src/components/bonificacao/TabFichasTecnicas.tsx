import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Plus, Pencil, CalendarIcon, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface FichaForm {
  produto_id: string;
  tipo_peca: string;
  tempo_overloque: number;
  tempo_reta: number;
  tempo_galoneira: number;
  cronometrado_por: string;
  data_medicao: Date | undefined;
  num_amostras: number;
  observacao: string;
}

const emptyForm: FichaForm = {
  produto_id: "",
  tipo_peca: "Recorrente",
  tempo_overloque: 0,
  tempo_reta: 0,
  tempo_galoneira: 0,
  cronometrado_por: "",
  data_medicao: undefined,
  num_amostras: 1,
  observacao: "",
};

export default function TabFichasTecnicas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editProdutoId, setEditProdutoId] = useState<string | null>(null);
  const [form, setForm] = useState<FichaForm>({ ...emptyForm });

  // ── Queries ──

  const { data: maquinas = [] } = useQuery({
    queryKey: ["config_maquinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("config_maquinas").select("*");
      if (error) throw error;
      return data;
    },
  });

  const mesAtual = format(new Date(), "yyyy-MM");

  const { data: custoFixo } = useQuery({
    queryKey: ["custo_fixo_oficina", mesAtual],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custo_fixo_oficina")
        .select("valor")
        .eq("mes", mesAtual)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: fichas = [], isLoading: fichasLoading } = useQuery({
    queryKey: ["fichas_tecnicas_tempo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fichas_tecnicas_tempo")
        .select("*, produtos(nome_do_produto)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos_select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome_do_produto")
        .eq("ativo", true)
        .order("nome_do_produto");
      if (error) throw error;
      return data;
    },
  });

  // ── Cálculos ──

  const capacidadeTotal = useMemo(() => {
    return maquinas.reduce(
      (sum: number, m: any) =>
        sum + (m.quantidade_maquinas || 0) * (m.horas_por_dia || 0) * 60 * (m.dias_uteis_mes || 0),
      0
    );
  }, [maquinas]);

  const custoMinuto = useMemo(() => {
    if (!custoFixo?.valor || capacidadeTotal === 0) return 0;
    return custoFixo.valor / capacidadeTotal;
  }, [custoFixo, capacidadeTotal]);

  // ── Agrupar fichas por produto ──

  const fichasAgrupadas = useMemo(() => {
    const map = new Map<string, any>();
    fichas.forEach((f: any) => {
      if (!map.has(f.produto_id)) {
        map.set(f.produto_id, {
          produto_id: f.produto_id,
          produto_nome: f.produtos?.nome_do_produto || "—",
          tipo_peca: f.tipo_peca,
          overloque: 0,
          reta: 0,
          galoneira: 0,
          cronometrado_por: f.cronometrado_por,
          data_medicao: f.data_medicao,
          num_amostras: f.num_amostras,
          observacao: f.observacao,
        });
      }
      const entry = map.get(f.produto_id)!;
      if (f.operacao === "overloque") entry.overloque = f.tempo_minutos;
      if (f.operacao === "reta") entry.reta = f.tempo_minutos;
      if (f.operacao === "galoneira") entry.galoneira = f.tempo_minutos;
    });
    return Array.from(map.values());
  }, [fichas]);

  // ── Mutations ──

  const saveFicha = useMutation({
    mutationFn: async () => {
      const ops: { operacao: string; tempo: number }[] = [
        { operacao: "overloque", tempo: form.tempo_overloque },
        { operacao: "reta", tempo: form.tempo_reta },
        { operacao: "galoneira", tempo: form.tempo_galoneira },
      ];

      const common = {
        produto_id: form.produto_id,
        tipo_peca: form.tipo_peca,
        cronometrado_por: form.cronometrado_por || null,
        data_medicao: form.data_medicao ? format(form.data_medicao, "yyyy-MM-dd") : null,
        num_amostras: form.num_amostras || null,
        observacao: form.observacao || null,
      };

      if (editProdutoId) {
        // Delete old records and insert new
        const { error: delErr } = await supabase
          .from("fichas_tecnicas_tempo")
          .delete()
          .eq("produto_id", editProdutoId);
        if (delErr) throw delErr;
      }

      const rows = ops.map((o) => ({
        ...common,
        operacao: o.operacao,
        tempo_minutos: o.tempo,
      }));

      const { error } = await supabase.from("fichas_tecnicas_tempo").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fichas_tecnicas_tempo"] });
      toast.success(editProdutoId ? "Ficha atualizada" : "Ficha cadastrada");
      closeModal();
    },
    onError: () => toast.error("Erro ao salvar ficha"),
  });

  function openNew() {
    setEditProdutoId(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(row: any) {
    setEditProdutoId(row.produto_id);
    setForm({
      produto_id: row.produto_id,
      tipo_peca: row.tipo_peca || "Recorrente",
      tempo_overloque: row.overloque || 0,
      tempo_reta: row.reta || 0,
      tempo_galoneira: row.galoneira || 0,
      cronometrado_por: row.cronometrado_por || "",
      data_medicao: row.data_medicao ? new Date(row.data_medicao + "T12:00:00") : undefined,
      num_amostras: row.num_amostras || 1,
      observacao: row.observacao || "",
    });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditProdutoId(null);
  }

  const fmtNum = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      {/* ── Cards Resumo ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Capacidade Total (min/mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {capacidadeTotal.toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo por Minuto (R$)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              R$ {fmtNum(custoMinuto)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabela de Fichas ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-primary">Fichas Cadastradas</CardTitle>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nova Ficha
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Overloque</TableHead>
                <TableHead className="text-right">Reta</TableHead>
                <TableHead className="text-right">Galoneira</TableHead>
                <TableHead className="text-right">Total (min)</TableHead>
                <TableHead className="text-right">Custo MO (R$)</TableHead>
                <TableHead>Medido por</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fichasLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : fichasAgrupadas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Nenhuma ficha cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                fichasAgrupadas.map((row, i) => {
                  const total = (row.overloque || 0) + (row.reta || 0) + (row.galoneira || 0);
                  const custoMO = total * custoMinuto;
                  return (
                    <TableRow key={row.produto_id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                      <TableCell className="font-medium">{row.produto_nome}</TableCell>
                      <TableCell>{row.tipo_peca}</TableCell>
                      <TableCell className="text-right">{fmtNum(row.overloque)}</TableCell>
                      <TableCell className="text-right">{fmtNum(row.reta)}</TableCell>
                      <TableCell className="text-right">{fmtNum(row.galoneira)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtNum(total)}</TableCell>
                      <TableCell className="text-right font-semibold">R$ {fmtNum(custoMO)}</TableCell>
                      <TableCell>{row.cronometrado_por || "—"}</TableCell>
                      <TableCell>
                        {row.data_medicao
                          ? format(new Date(row.data_medicao + "T12:00:00"), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Modal ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editProdutoId ? "Editar Ficha Técnica" : "Nova Ficha Técnica"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label>Produto</Label>
              <Select
                value={form.produto_id}
                onValueChange={(v) => setForm({ ...form, produto_id: v })}
                disabled={!!editProdutoId}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                <SelectContent>
                  {produtos.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome_do_produto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo da Peça</Label>
              <Select
                value={form.tipo_peca}
                onValueChange={(v) => setForm({ ...form, tipo_peca: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Recorrente">Recorrente</SelectItem>
                  <SelectItem value="Nova">Nova</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Overloque (min)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.tempo_overloque}
                  onChange={(e) => setForm({ ...form, tempo_overloque: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Reta (min)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.tempo_reta}
                  onChange={(e) => setForm({ ...form, tempo_reta: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Galoneira (min)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.tempo_galoneira}
                  onChange={(e) => setForm({ ...form, tempo_galoneira: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>Cronometrado por</Label>
              <Input
                value={form.cronometrado_por}
                onChange={(e) => setForm({ ...form, cronometrado_por: e.target.value })}
              />
            </div>

            <div>
              <Label>Data da Medição</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.data_medicao && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.data_medicao
                      ? format(form.data_medicao, "dd/MM/yyyy")
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.data_medicao}
                    onSelect={(d) => setForm({ ...form, data_medicao: d })}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Nº de Amostras</Label>
              <Input
                type="number"
                value={form.num_amostras}
                onChange={(e) => setForm({ ...form, num_amostras: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label>Observação</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button
              onClick={() => saveFicha.mutate()}
              disabled={!form.produto_id}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
