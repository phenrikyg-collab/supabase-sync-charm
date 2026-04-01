import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Plus, Pencil, CalendarIcon, Clock, DollarSign, ChevronDown, ChevronRight, Trash2, ArrowUp, ArrowDown,
} from "lucide-react";
import { toast } from "sonner";

/* ── Types ── */

interface Etapa {
  nome: string;
  maquina: "Reta" | "Overloque" | "Galoneira";
  tempo_minutos: number;
  observacao: string;
}

interface ModalForm {
  produto_id: string;
  tipo_peca: string;
  etapas: Etapa[];
  cronometrado_por: string;
  data_medicao: Date | undefined;
  num_amostras: number;
}

const emptyEtapa: Etapa = { nome: "", maquina: "Reta", tempo_minutos: 0, observacao: "" };

const emptyForm: ModalForm = {
  produto_id: "",
  tipo_peca: "Recorrente",
  etapas: [{ ...emptyEtapa }],
  cronometrado_por: "",
  data_medicao: undefined,
  num_amostras: 1,
};

const MAQUINA_COLORS: Record<string, string> = {
  Reta: "bg-blue-100 text-blue-800 border-blue-300",
  Overloque: "bg-purple-100 text-purple-800 border-purple-300",
  Galoneira: "bg-green-100 text-green-800 border-green-300",
};

/* ── Component ── */

export default function TabFichasTecnicas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [editProdutoId, setEditProdutoId] = useState<string | null>(null);
  const [form, setForm] = useState<ModalForm>({ ...emptyForm, etapas: [{ ...emptyEtapa }] });
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  /* ── Queries ── */

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
        .from("custo_fixo_oficina").select("valor").eq("mes", mesAtual).maybeSingle();
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
        .order("numero_etapa", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos_select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos").select("id, nome_do_produto").eq("ativo", true).order("nome_do_produto");
      if (error) throw error;
      return data;
    },
  });

  /* ── Calculations ── */

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

  /* ── Group fichas by product ── */

  const fichasAgrupadas = useMemo(() => {
    const map = new Map<string, { produto_id: string; produto_nome: string; tipo_peca: string; etapas: any[]; cronometrado_por: string | null; data_medicao: string | null; num_amostras: number | null }>();
    fichas.forEach((f: any) => {
      if (!map.has(f.produto_id)) {
        map.set(f.produto_id, {
          produto_id: f.produto_id,
          produto_nome: f.produtos?.nome_do_produto || "—",
          tipo_peca: f.tipo_peca,
          etapas: [],
          cronometrado_por: f.cronometrado_por,
          data_medicao: f.data_medicao,
          num_amostras: f.num_amostras,
        });
      }
      map.get(f.produto_id)!.etapas.push(f);
    });
    return Array.from(map.values());
  }, [fichas]);

  /* ── Mutations ── */

  const saveFicha = useMutation({
    mutationFn: async () => {
      if (!form.produto_id) throw new Error("Selecione um produto");
      if (form.etapas.length === 0) throw new Error("Adicione ao menos uma etapa");

      const common = {
        produto_id: form.produto_id,
        tipo_peca: form.tipo_peca,
        cronometrado_por: form.cronometrado_por || null,
        data_medicao: form.data_medicao ? format(form.data_medicao, "yyyy-MM-dd") : null,
        num_amostras: form.num_amostras || null,
      };

      // Delete old records
      const targetId = editProdutoId || form.produto_id;
      await supabase.from("fichas_tecnicas_tempo").delete().eq("produto_id", targetId);

      const rows = form.etapas.map((e, i) => ({
        ...common,
        operacao: e.nome,
        tempo_minutos: e.tempo_minutos,
        observacao: e.observacao || null,
        numero_etapa: i + 1,
      }));

      // We need a way to store the machine type. The current schema uses "operacao" as text.
      // Let's store as "maquina:nome" pattern, or better use observacao for machine.
      // Actually, the schema has "operacao" as text — let's use it to store the step name
      // and we'll encode machine in a structured way.
      // Better approach: store machine in a separate way. Looking at schema, we only have operacao + observacao.
      // Let's put machine type as prefix in operacao: "Reta|Fechar lateral"
      const rowsWithMachine = form.etapas.map((e, i) => ({
        ...common,
        operacao: `${e.maquina}|${e.nome}`,
        tempo_minutos: e.tempo_minutos,
        observacao: e.observacao || null,
        numero_etapa: i + 1,
      }));

      const { error } = await supabase.from("fichas_tecnicas_tempo").insert(rowsWithMachine);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fichas_tecnicas_tempo"] });
      toast.success(editProdutoId ? "Ficha atualizada" : "Ficha cadastrada");
      closeModal();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar ficha"),
  });

  /* ── Helpers ── */

  function parseOperacao(op: string): { maquina: string; nome: string } {
    if (op.includes("|")) {
      const [maquina, ...rest] = op.split("|");
      return { maquina, nome: rest.join("|") };
    }
    // Legacy: operacao was "reta"/"overloque"/"galoneira"
    const maqMap: Record<string, string> = { reta: "Reta", overloque: "Overloque", galoneira: "Galoneira" };
    return { maquina: maqMap[op.toLowerCase()] || "Reta", nome: op };
  }

  function openNew() {
    setEditProdutoId(null);
    setForm({ ...emptyForm, etapas: [{ ...emptyEtapa }] });
    setStep(1);
    setOpen(true);
  }

  function openEdit(row: any) {
    setEditProdutoId(row.produto_id);
    const etapas: Etapa[] = row.etapas
      .sort((a: any, b: any) => (a.numero_etapa || 1) - (b.numero_etapa || 1))
      .map((e: any) => {
        const parsed = parseOperacao(e.operacao);
        return {
          nome: parsed.nome,
          maquina: parsed.maquina as Etapa["maquina"],
          tempo_minutos: e.tempo_minutos || 0,
          observacao: e.observacao || "",
        };
      });
    setForm({
      produto_id: row.produto_id,
      tipo_peca: row.tipo_peca || "Recorrente",
      etapas: etapas.length > 0 ? etapas : [{ ...emptyEtapa }],
      cronometrado_por: row.cronometrado_por || "",
      data_medicao: row.data_medicao ? new Date(row.data_medicao + "T12:00:00") : undefined,
      num_amostras: row.num_amostras || 1,
    });
    setStep(1);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditProdutoId(null);
  }

  function addEtapa() {
    setForm((f) => ({ ...f, etapas: [...f.etapas, { ...emptyEtapa }] }));
  }

  function removeEtapa(idx: number) {
    setForm((f) => ({ ...f, etapas: f.etapas.filter((_, i) => i !== idx) }));
  }

  function updateEtapa(idx: number, field: keyof Etapa, value: any) {
    setForm((f) => {
      const etapas = [...f.etapas];
      etapas[idx] = { ...etapas[idx], [field]: value };
      return { ...f, etapas };
    });
  }

  function moveEtapa(idx: number, direction: -1 | 1) {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= form.etapas.length) return;
    setForm((f) => {
      const etapas = [...f.etapas];
      [etapas[idx], etapas[newIdx]] = [etapas[newIdx], etapas[idx]];
      return { ...f, etapas };
    });
  }

  const fmtNum = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      {/* ── Cards Resumo ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Capacidade Total (min/mês)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{capacidadeTotal.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo por Minuto (R$)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">R$ {fmtNum(custoMinuto)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabela de Fichas ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-primary">Fichas Cadastradas</CardTitle>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nova Ficha Técnica
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Nº Etapas</TableHead>
                <TableHead className="text-right">Tempo Total (min)</TableHead>
                <TableHead className="text-right">Custo MO (R$)</TableHead>
                <TableHead>Última Medição</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fichasLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : fichasAgrupadas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma ficha cadastrada</TableCell>
                </TableRow>
              ) : (
                fichasAgrupadas.map((row, i) => {
                  const totalTempo = row.etapas.reduce((s: number, e: any) => s + (e.tempo_minutos || 0), 0);
                  const custoMO = totalTempo * custoMinuto;
                  const isExpanded = expandedProduct === row.produto_id;

                  return (
                    <>
                      <TableRow
                        key={row.produto_id}
                        className={cn(i % 2 === 0 ? "bg-muted/30" : "", "cursor-pointer")}
                        onClick={() => setExpandedProduct(isExpanded ? null : row.produto_id)}
                      >
                        <TableCell>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-medium">{row.produto_nome}</TableCell>
                        <TableCell>{row.tipo_peca}</TableCell>
                        <TableCell className="text-right">{row.etapas.length}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtNum(totalTempo)}</TableCell>
                        <TableCell className="text-right font-semibold">R$ {fmtNum(custoMO)}</TableCell>
                        <TableCell>
                          {row.data_medicao
                            ? format(new Date(row.data_medicao + "T12:00:00"), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Sub-table: etapas */}
                      {isExpanded && (
                        <TableRow key={`${row.produto_id}-detail`}>
                          <TableCell colSpan={8} className="p-0">
                            <div className="bg-muted/20 px-8 py-3">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12">Nº</TableHead>
                                    <TableHead>Etapa</TableHead>
                                    <TableHead>Máquina</TableHead>
                                    <TableHead className="text-right">Tempo (min)</TableHead>
                                    <TableHead>Cronometrado por</TableHead>
                                    <TableHead className="text-right">Amostras</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {row.etapas
                                    .sort((a: any, b: any) => (a.numero_etapa || 1) - (b.numero_etapa || 1))
                                    .map((etapa: any) => {
                                      const parsed = parseOperacao(etapa.operacao);
                                      return (
                                        <TableRow key={etapa.id}>
                                          <TableCell className="font-mono text-muted-foreground">{etapa.numero_etapa}</TableCell>
                                          <TableCell className="font-medium">{parsed.nome}</TableCell>
                                          <TableCell>
                                            <Badge variant="outline" className={MAQUINA_COLORS[parsed.maquina] || ""}>
                                              {parsed.maquina}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-right">{fmtNum(etapa.tempo_minutos)}</TableCell>
                                          <TableCell>{etapa.cronometrado_por || "—"}</TableCell>
                                          <TableCell className="text-right">{etapa.num_amostras || "—"}</TableCell>
                                        </TableRow>
                                      );
                                    })}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Modal 2 passos ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editProdutoId ? "Editar Ficha Técnica" : "Nova Ficha Técnica"} — Passo {step}/2
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {step === 1 && (
              <>
                <div>
                  <Label>Produto</Label>
                  <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v })} disabled={!!editProdutoId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                    <SelectContent>
                      {produtos.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome_do_produto}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo da Peça</Label>
                  <Select value={form.tipo_peca} onValueChange={(v) => setForm({ ...form, tipo_peca: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Recorrente">Recorrente</SelectItem>
                      <SelectItem value="Nova">Nova</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-sm text-muted-foreground">Adicione as etapas na ordem real de produção.</p>

                {form.etapas.map((etapa, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 rounded-md border bg-muted/20">
                    <div className="flex flex-col items-center gap-1 pt-6">
                      <span className="text-xs font-mono text-muted-foreground font-bold">{idx + 1}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveEtapa(idx, -1)} disabled={idx === 0}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveEtapa(idx, 1)} disabled={idx === form.etapas.length - 1}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div className="md:col-span-2">
                        <Label className="text-xs">Nome da Etapa</Label>
                        <Input value={etapa.nome} onChange={(e) => updateEtapa(idx, "nome", e.target.value)} placeholder="Ex: Fechar lateral" className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Máquina</Label>
                        <Select value={etapa.maquina} onValueChange={(v) => updateEtapa(idx, "maquina", v)}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Reta">Reta</SelectItem>
                            <SelectItem value="Overloque">Overloque</SelectItem>
                            <SelectItem value="Galoneira">Galoneira</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Tempo (min)</Label>
                        <Input type="number" step="0.1" min={0} value={etapa.tempo_minutos} onChange={(e) => updateEtapa(idx, "tempo_minutos", Number(e.target.value))} className="h-8" />
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-xs">Observação (opcional)</Label>
                        <Input value={etapa.observacao} onChange={(e) => updateEtapa(idx, "observacao", e.target.value)} className="h-8" placeholder="Opcional" />
                      </div>
                      <div className="flex items-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeEtapa(idx)} disabled={form.etapas.length <= 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addEtapa}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Etapa
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t">
                  <div>
                    <Label>Cronometrado por</Label>
                    <Input value={form.cronometrado_por} onChange={(e) => setForm({ ...form, cronometrado_por: e.target.value })} className="h-8" />
                  </div>
                  <div>
                    <Label>Data da Medição</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-8", !form.data_medicao && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.data_medicao ? format(form.data_medicao, "dd/MM/yyyy") : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={form.data_medicao} onSelect={(d) => setForm({ ...form, data_medicao: d })} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Nº de Amostras</Label>
                    <Input type="number" min={1} value={form.num_amostras} onChange={(e) => setForm({ ...form, num_amostras: Number(e.target.value) })} className="h-8" />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            {step === 2 && (
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
            )}
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            {step === 1 ? (
              <Button onClick={() => setStep(2)} disabled={!form.produto_id}>Próximo</Button>
            ) : (
              <Button
                onClick={() => saveFicha.mutate()}
                disabled={saveFicha.isPending || form.etapas.some((e) => !e.nome.trim())}
              >
                {saveFicha.isPending ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
