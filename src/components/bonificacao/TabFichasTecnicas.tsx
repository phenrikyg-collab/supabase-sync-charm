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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Plus, Pencil, CalendarIcon, Clock, DollarSign, ChevronDown, ChevronRight, Trash2, ArrowUp, ArrowDown, Link2,
} from "lucide-react";
import FichaTecnicaReadOnly from "./FichaTecnicaReadOnly";
import { toast } from "sonner";

/* ── Types ── */

interface Etapa {
  nome: string;
  maquina: string;
  tempo_segundos: number;
  observacao: string;
  grupo: number; // 0 = sequencial, >0 = etapas no mesmo grupo são em conjunto
}

interface ModalForm {
  produto_id: string;
  produto_nome: string;
  tipo_peca: string;
  etapas: Etapa[];
  cronometrado_por: string;
  data_medicao: Date | undefined;
  num_amostras: number;
}

const emptyEtapa: Etapa = { nome: "", maquina: "", tempo_segundos: 0, observacao: "", grupo: 0 };

const emptyForm: ModalForm = {
  produto_id: "",
  produto_nome: "",
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

/* ── Helpers ── */

function calcTempoEfetivo(etapas: Etapa[]): number {
  // Group sequential and parallel steps
  // grupo=0 are sequential (sum their times)
  // grupo>0: within the same grupo, take the max time
  const grupos = new Map<number, number>();
  let totalSeq = 0;

  for (const e of etapas) {
    if (e.grupo === 0) {
      totalSeq += e.tempo_segundos;
    } else {
      const current = grupos.get(e.grupo) || 0;
      grupos.set(e.grupo, Math.max(current, e.tempo_segundos));
    }
  }

  let totalGrupos = 0;
  grupos.forEach((v) => { totalGrupos += v; });

  return totalSeq + totalGrupos;
}

/* ── Component ── */

export default function TabFichasTecnicas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [editProdutoId, setEditProdutoId] = useState<string | null>(null);
  const [form, setForm] = useState<ModalForm>({ ...emptyForm, etapas: [{ ...emptyEtapa }] });
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ produto_id: string; produto_nome: string } | null>(null);

  /* ── Queries ── */

  const { data: maquinas = [] } = useQuery({
    queryKey: ["config_maquinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("config_maquinas").select("*").order("tipo_maquina");
      if (error) throw error;
      return data;
    },
  });

  const tiposMaquina = useMemo(() => maquinas.map((m: any) => m.tipo_maquina), [maquinas]);

  const mesAtual = format(new Date(), "yyyy-MM");

  const { data: custoFixo } = useQuery({
    queryKey: ["custo_fixo_oficina", mesAtual],
    queryFn: async () => {
      // Try current month first
      const { data, error } = await supabase
        .from("custo_fixo_oficina").select("valor").eq("mes", mesAtual).maybeSingle();
      if (error) throw error;
      if (data) return data;
      // Fallback: most recent month
      const { data: latest, error: err2 } = await supabase
        .from("custo_fixo_oficina").select("valor").order("mes", { ascending: false }).limit(1).maybeSingle();
      if (err2) throw err2;
      return latest;
    },
  });

  const { data: fichas = [], isLoading: fichasLoading } = useQuery({
    queryKey: ["fichas_tecnicas_tempo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fichas_tecnicas_tempo")
        .select("*")
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
  // Capacidade = horas/dia × 3600s × dias úteis/mês (linha de produção sequencial, não soma máquinas)
  const capacidadeTotal = useMemo(() => {
    if (maquinas.length === 0) return 0;
    const first = maquinas[0] as any;
    const horasDia = first.horas_por_dia || 8;
    const diasUteis = first.dias_uteis_mes || 22;
    return horasDia * 3600 * diasUteis;
  }, [maquinas]);

  const custoSegundo = useMemo(() => {
    if (!custoFixo?.valor || capacidadeTotal === 0) return 0;
    return custoFixo.valor / capacidadeTotal;
  }, [custoFixo, capacidadeTotal]);

  /* ── Group fichas by product ── */

  const fichasAgrupadas = useMemo(() => {
      // Build a lookup for product names
      const produtoMap = new Map<string, string>();
      produtos.forEach((p: any) => { produtoMap.set(p.id, p.nome_do_produto); });

      const map = new Map<string, { produto_id: string; produto_nome: string; tipo_peca: string; etapas: any[]; cronometrado_por: string | null; data_medicao: string | null; num_amostras: number | null }>();
    fichas.forEach((f: any) => {
      if (!map.has(f.produto_id)) {
        map.set(f.produto_id, {
          produto_id: f.produto_id,
            produto_nome: produtoMap.get(f.produto_id) || "—",
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
    }, [fichas, produtos]);

  /* ── Mutations ── */

  const saveFicha = useMutation({
    mutationFn: async () => {
      if (!form.produto_id) throw new Error("Selecione um produto");
      if (form.etapas.length === 0) throw new Error("Adicione ao menos uma etapa");
      if (form.etapas.some((e) => !e.nome.trim())) {
        throw new Error("Preencha o nome de todas as etapas");
      }

      const targetId = editProdutoId || form.produto_id;

      const tipoPeca = form.tipo_peca?.toLowerCase() === "nova" ? "nova" : "recorrente";

      // Get max numero_etapa for this produto_id
      const { data: maxData } = await supabase
        .from("fichas_tecnicas_tempo")
        .select("numero_etapa")
        .eq("produto_id", targetId)
        .order("numero_etapa", { ascending: false })
        .limit(1);
      const baseEtapa = (maxData && maxData.length > 0) ? (maxData[0] as any).numero_etapa : 0;

      // Delete existing entries for this product when editing
      if (editProdutoId) {
        const { error: delError } = await supabase
          .from("fichas_tecnicas_tempo")
          .delete()
          .eq("produto_id", targetId);
        if (delError) throw delError;
      }

      const rows = form.etapas.map((e, i) => ({
        produto_id: targetId,
        tipo_peca: tipoPeca,
        cronometrado_por: form.cronometrado_por || null,
        data_medicao: form.data_medicao ? format(form.data_medicao, "yyyy-MM-dd") : null,
        num_amostras: form.num_amostras || null,
        operacao: "costura",
        nome_etapa: e.nome.trim(),
        tempo_minutos: e.tempo_segundos / 60,
        observacao: e.observacao || null,
        numero_etapa: baseEtapa + i + 1,
      }));

      console.log("[FichaTecnica] Inserting rows:", JSON.stringify(rows, null, 2));

      const { error } = await supabase.from("fichas_tecnicas_tempo").insert(rows as any);
      if (error) {
        console.error("[FichaTecnica] Insert error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fichas_tecnicas_tempo"] });
      toast.success(editProdutoId ? "Ficha atualizada" : "Ficha cadastrada");
      closeModal();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar ficha"),
  });

  const deleteFicha = useMutation({
    mutationFn: async (produtoId: string) => {
      const { error } = await supabase
        .from("fichas_tecnicas_tempo")
        .delete()
        .eq("produto_id", produtoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fichas_tecnicas_tempo"] });
      toast.success("Ficha técnica excluída");
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir ficha"),
  });

  /* ── Helpers ── */

  function parseOperacao(op: string): { maquina: string; nome: string; grupo: number } {
    const parts = op.split("|");
    if (parts.length >= 3) {
      return { maquina: parts[0], nome: parts.slice(1, -1).join("|"), grupo: parseInt(parts[parts.length - 1]) || 0 };
    }
    if (parts.length === 2) {
      return { maquina: parts[0], nome: parts[1], grupo: 0 };
    }
    // Legacy
    const maqMap: Record<string, string> = { reta: "Reta", overloque: "Overloque", galoneira: "Galoneira" };
    return { maquina: maqMap[op.toLowerCase()] || "Reta", nome: op, grupo: 0 };
  }

  function openNew() {
    setEditProdutoId(null);
    const defaultMaq = tiposMaquina.length > 0 ? tiposMaquina[0] : "";
    setForm({ ...emptyForm, etapas: [{ ...emptyEtapa, maquina: defaultMaq }] });
    setStep(1);
    setOpen(true);
  }

  function openEdit(row: any) {
    setEditProdutoId(row.produto_id);
    const etapas: Etapa[] = row.etapas
      .sort((a: any, b: any) => (a.numero_etapa || 1) - (b.numero_etapa || 1))
      .map((e: any) => {
        // Support both new format (nome_etapa field) and legacy (operacao encoded)
        const hasNomeEtapa = e.nome_etapa && e.nome_etapa.trim();
        const parsed = parseOperacao(e.operacao);
        return {
          nome: hasNomeEtapa ? e.nome_etapa : parsed.nome,
          maquina: hasNomeEtapa ? (parsed.maquina === e.operacao ? "Reta" : parsed.maquina) : parsed.maquina,
          tempo_segundos: (e.tempo_minutos || 0) * 60,
          observacao: e.observacao || "",
          grupo: hasNomeEtapa ? 0 : parsed.grupo,
        };
      });
    setForm({
      produto_id: row.produto_id,
      produto_nome: row.produto_nome || "",
      tipo_peca: row.tipo_peca === "nova" ? "Nova" : "Recorrente",
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
    const defaultMaq = tiposMaquina.length > 0 ? tiposMaquina[0] : "";
    setForm((f) => ({ ...f, etapas: [...f.etapas, { ...emptyEtapa, maquina: defaultMaq }] }));
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

  // Get next available grupo number
  function nextGrupo(): number {
    const maxG = form.etapas.reduce((m, e) => Math.max(m, e.grupo), 0);
    return maxG + 1;
  }

  // Toggle conjunto: if two adjacent steps, link them to same grupo
  function toggleConjunto(idx: number) {
    setForm((f) => {
      const etapas = [...f.etapas];
      const current = etapas[idx];

      if (current.grupo > 0) {
        // Remove from grupo
        const oldGrupo = current.grupo;
        etapas[idx] = { ...current, grupo: 0 };
        // If only one left in that grupo, remove it too
        const remaining = etapas.filter((e, i) => i !== idx && e.grupo === oldGrupo);
        if (remaining.length === 1) {
          const singleIdx = etapas.findIndex((e, i) => i !== idx && e.grupo === oldGrupo);
          if (singleIdx >= 0) etapas[singleIdx] = { ...etapas[singleIdx], grupo: 0 };
        }
      } else {
        // Link with next step if available, or previous
        const nextIdx = idx + 1 < etapas.length ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= etapas.length) return { ...f, etapas };

        const partner = etapas[nextIdx];
        if (partner.grupo > 0) {
          // Join existing grupo
          etapas[idx] = { ...current, grupo: partner.grupo };
        } else {
          // Create new grupo
          const maxG = etapas.reduce((m, e) => Math.max(m, e.grupo), 0);
          const newG = maxG + 1;
          etapas[idx] = { ...current, grupo: newG };
          etapas[nextIdx] = { ...partner, grupo: newG };
        }
      }

      return { ...f, etapas };
    });
  }

  const fmtNum = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Color map for grupo badges
  const grupoColors = ["bg-orange-100 text-orange-800", "bg-cyan-100 text-cyan-800", "bg-pink-100 text-pink-800", "bg-lime-100 text-lime-800", "bg-indigo-100 text-indigo-800"];

  return (
    <div className="space-y-4">
      {/* ── Cards Resumo ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Capacidade Total (seg/mês)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{capacidadeTotal.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo por Segundo (R$)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">R$ {fmtNum(custoSegundo)}</p>
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
          {tiposMaquina.length === 0 && (
            <div className="mb-4 p-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-sm">
              ⚠️ Nenhuma máquina cadastrada. Cadastre máquinas na aba <strong>Configurações</strong> para criar fichas técnicas.
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Nº Etapas</TableHead>
                <TableHead className="text-right">Tempo Efetivo (seg)</TableHead>
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
                  // Parse etapas for effective time calc (tempo_minutos stored in minutes, convert to seconds)
                  const parsedEtapas: Etapa[] = row.etapas.map((e: any) => {
                    const parsed = parseOperacao(e.operacao);
                    const hasNomeEtapa = e.nome_etapa && e.nome_etapa.trim();
                    return { nome: hasNomeEtapa ? e.nome_etapa : parsed.nome, maquina: parsed.maquina, tempo_segundos: (e.tempo_minutos || 0) * 60, observacao: "", grupo: hasNomeEtapa ? 0 : parsed.grupo };
                  });
                  const tempoEfetivo = calcTempoEfetivo(parsedEtapas);
                  const custoMO = tempoEfetivo * custoSegundo;
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
                        <TableCell className="text-right font-semibold">{fmtNum(tempoEfetivo)}</TableCell>
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

                      {isExpanded && (
                        <TableRow key={`${row.produto_id}-detail`}>
                          <TableCell colSpan={8} className="p-0">
                            <div className="bg-muted/20 px-8 py-4">
                              <FichaTecnicaReadOnly
                                produtoNome={row.produto_nome}
                                etapas={row.etapas}
                              />
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
                  <Select
                    value={form.produto_id}
                    onValueChange={(v) => {
                      const produtoSelecionado = produtos.find((p: any) => p.id === v);
                      setForm({
                        ...form,
                        produto_id: v,
                        produto_nome: produtoSelecionado?.nome_do_produto || "",
                      });
                    }}
                    disabled={!!editProdutoId}
                  >
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
                <p className="text-sm text-muted-foreground">
                  Adicione as etapas na ordem real de produção. Use o ícone <Link2 className="inline h-3 w-3" /> para agrupar etapas em conjunto (executadas simultaneamente).
                </p>

                {form.etapas.map((etapa, idx) => (
                  <div key={idx} className={cn(
                    "flex items-start gap-2 p-3 rounded-md border",
                    etapa.grupo > 0
                      ? "border-l-4 border-l-orange-400 bg-orange-50/50"
                      : "bg-muted/20"
                  )}>
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
                          <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {tiposMaquina.map((t: string) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Tempo (seg)</Label>
                        <Input type="number" step="1" min={0} value={etapa.tempo_segundos} onChange={(e) => updateEtapa(idx, "tempo_segundos", Number(e.target.value))} className="h-8" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">Observação (opcional)</Label>
                        <Input value={etapa.observacao} onChange={(e) => updateEtapa(idx, "observacao", e.target.value)} className="h-8" placeholder="Opcional" />
                      </div>
                      <div className="flex items-end gap-1">
                        <Button
                          variant={etapa.grupo > 0 ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleConjunto(idx)}
                          title={etapa.grupo > 0 ? "Remover do conjunto" : "Produzir em conjunto com etapa adjacente"}
                          disabled={form.etapas.length <= 1}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                        {etapa.grupo > 0 && (
                          <Badge variant="outline" className={grupoColors[(etapa.grupo - 1) % grupoColors.length] + " text-[10px]"}>
                            Conjunto {etapa.grupo}
                          </Badge>
                        )}
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

                {/* Resumo de Tempos */}
                {form.etapas.length > 0 && (() => {
                  const temposPorMaq: Record<string, { seg: number; count: number }> = {};
                  form.etapas.forEach((e) => {
                    if (!e.maquina) return;
                    if (!temposPorMaq[e.maquina]) temposPorMaq[e.maquina] = { seg: 0, count: 0 };
                    temposPorMaq[e.maquina].seg += e.tempo_segundos;
                    temposPorMaq[e.maquina].count += 1;
                  });
                  const totalBruto = form.etapas.reduce((s, e) => s + e.tempo_segundos, 0);
                  const tempoEfetivo = calcTempoEfetivo(form.etapas);
                  const hasConjuntos = form.etapas.some(e => e.grupo > 0);
                  const icons: Record<string, string> = { Reta: "🧵", Overloque: "🔵", Galoneira: "🟡" };
                  return (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumo de Tempos</p>
                      {Object.keys(temposPorMaq).map((m) => (
                        <div key={m} className="flex items-center gap-2 text-sm">
                          <span>{icons[m] || "⚙️"}</span>
                          <span className="font-medium w-24">{m}</span>
                          <span className="tabular-nums">{temposPorMaq[m].seg} seg</span>
                          <span className="text-muted-foreground text-xs">({temposPorMaq[m].count} {temposPorMaq[m].count === 1 ? "etapa" : "etapas"})</span>
                        </div>
                      ))}
                      <div className="border-t border-border pt-1 space-y-1">
                        {hasConjuntos && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>📊</span>
                            <span>Tempo Bruto (soma)</span>
                            <span className="tabular-nums">{totalBruto} seg</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <span>⏱</span>
                          <span>Tempo Efetivo</span>
                          <span className="tabular-nums">{tempoEfetivo} seg</span>
                          {hasConjuntos && (
                            <span className="text-xs text-green-600 font-normal">(etapas em conjunto contam pelo maior tempo)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
                disabled={saveFicha.isPending || form.etapas.some((e) => !e.nome.trim() || !e.maquina)}
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
