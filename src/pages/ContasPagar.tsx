import { useState, useMemo } from "react";
import { useMovimentacoesFinanceiras, useCategorias, useCentrosCusto, useCreateMovimentacao, useUpdateMovimentacao } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateBR } from "@/lib/printUtils";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths, parseISO, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, TrendingDown, AlertTriangle, Calendar as CalendarIcon, Search, Plus, Check, CreditCard, Pencil, Trash2 } from "lucide-react";
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line } from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MovimentacaoFinanceira } from "@/types/database";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function getStatusPagamento(mov: { data: string; tipo: string | null; status_pagamento: string | null; status_bling: string | null }) {
  if (mov.status_pagamento === "pago" || mov.status_bling === "pago") return "pago";
  if (mov.tipo === "entrada") return "recebido";
  const hoje = new Date();
  const dataMov = parseISO(mov.data);
  if (isBefore(dataMov, hoje)) return "vencido";
  const em7dias = new Date(hoje);
  em7dias.setDate(hoje.getDate() + 7);
  if (isBefore(dataMov, em7dias)) return "proximo";
  return "pendente";
}

// ── Dar Baixa Dialog ──
function DarBaixaDialog({ mov, onClose }: { mov: MovimentacaoFinanceira & { statusPagamento: string }; onClose: () => void }) {
  const updateMov = useUpdateMovimentacao();
  const [dataPgto, setDataPgto] = useState<Date>(new Date());
  const [salvando, setSalvando] = useState(false);

  const handleConfirm = async () => {
    setSalvando(true);
    try {
      await updateMov.mutateAsync({
        id: mov.id,
        status_pagamento: "pago",
        data_envio: format(dataPgto, "yyyy-MM-dd"),
      });
      toast.success("Pagamento registrado com sucesso");
      onClose();
    } catch {
      toast.error("Erro ao registrar pagamento");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Dar Baixa no Pagamento</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="p-3 rounded-lg bg-muted/50 space-y-1">
          <p className="text-sm font-medium">{mov.descricao ?? "—"}</p>
          <p className="text-lg font-bold text-destructive">{formatCurrency(mov.valor)}</p>
          <p className="text-xs text-muted-foreground">Vencimento: {formatDateBR(mov.data)}</p>
        </div>
        <div className="space-y-2">
          <Label>Data do Pagamento</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dataPgto, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataPgto}
                onSelect={(d) => d && setDataPgto(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancelar</Button>
        </DialogClose>
        <Button onClick={handleConfirm} disabled={salvando}>
          {salvando ? "Salvando..." : "Confirmar Baixa"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Editar Conta Dialog ──
function EditarContaDialog({
  mov,
  categorias,
  onClose,
}: {
  mov: MovimentacaoFinanceira & { statusPagamento: string };
  categorias: { id: string; descricao_categoria: string | null; nome_categoria: string | null }[];
  onClose: () => void;
}) {
  const updateMov = useUpdateMovimentacao();
  const [descricao, setDescricao] = useState(mov.descricao ?? "");
  const [valor, setValor] = useState(String(mov.valor ?? 0).replace(".", ","));
  const [categoriaId, setCategoriaId] = useState(mov.categoria_id ?? "");
  const [dataVenc, setDataVenc] = useState<Date>(parseISO(mov.data));
  const [salvando, setSalvando] = useState(false);

  const handleSave = async () => {
    const valorNum = parseFloat(valor.replace(",", "."));
    if (!valorNum || valorNum <= 0) return toast.error("Informe um valor válido");
    setSalvando(true);
    try {
      await updateMov.mutateAsync({
        id: mov.id,
        descricao,
        valor: valorNum,
        categoria_id: categoriaId || null,
        data: format(dataVenc, "yyyy-MM-dd"),
      });
      toast.success("Conta atualizada com sucesso");
      onClose();
    } catch {
      toast.error("Erro ao atualizar conta");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Editar Conta a Pagar</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ""))}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-2">
            <Label>Vencimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataVenc, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataVenc}
                  onSelect={(d) => d && setDataVenc(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
            <SelectContent>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.descricao_categoria ?? c.nome_categoria ?? "Sem descrição"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancelar</Button>
        </DialogClose>
        <Button onClick={handleSave} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Editar Parcelas Dialog ──
function EditarParcelasDialog({
  parcelas,
  categorias,
  onClose,
}: {
  parcelas: (MovimentacaoFinanceira & { statusPagamento: string; parcelaIdx: number; parcelaTotal: number })[];
  categorias: { id: string; descricao_categoria: string | null; nome_categoria: string | null }[];
  onClose: () => void;
}) {
  const updateMov = useUpdateMovimentacao();
  const [items, setItems] = useState(
    parcelas.map((p) => ({
      id: p.id,
      descricao: p.descricao ?? "",
      valor: String(p.valor ?? 0).replace(".", ","),
      data: parseISO(p.data),
      categoria_id: p.categoria_id ?? "",
      parcelaIdx: p.parcelaIdx,
      parcelaTotal: p.parcelaTotal,
    }))
  );
  const [salvando, setSalvando] = useState(false);

  const updateItem = (idx: number, field: string, value: any) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const handleSave = async () => {
    setSalvando(true);
    try {
      for (const item of items) {
        const valorNum = parseFloat(item.valor.replace(",", "."));
        await updateMov.mutateAsync({
          id: item.id,
          descricao: item.descricao,
          valor: valorNum > 0 ? valorNum : 0,
          data: format(item.data, "yyyy-MM-dd"),
          categoria_id: item.categoria_id || null,
        });
      }
      toast.success("Parcelas atualizadas com sucesso");
      onClose();
    } catch {
      toast.error("Erro ao atualizar parcelas");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Editar Parcelas ({items.length}x)</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="space-y-2">
          <Label>Categoria (todas as parcelas)</Label>
          <Select
            value={items[0]?.categoria_id ?? ""}
            onValueChange={(v) => setItems((prev) => prev.map((it) => ({ ...it, categoria_id: v })))}
          >
            <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
            <SelectContent>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.descricao_categoria ?? c.nome_categoria ?? "Sem descrição"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="border rounded-lg divide-y">
          {items.map((item, idx) => (
            <div key={item.id} className="p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Parcela {item.parcelaIdx}/{item.parcelaTotal}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Vencimento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal text-xs")}>
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {format(item.data, "dd/MM/yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={item.data}
                        onSelect={(d) => d && updateItem(idx, "data", d)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    className="h-8 text-xs"
                    value={item.valor}
                    onChange={(e) => updateItem(idx, "valor", e.target.value.replace(/[^0-9.,]/g, ""))}
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    className="h-8 text-xs"
                    value={item.descricao}
                    onChange={(e) => updateItem(idx, "descricao", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancelar</Button>
        </DialogClose>
        <Button onClick={handleSave} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar Todas"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}


interface ParcelaManual {
  valor: string;
  data: Date;
}

function NovaContaDialog({ categorias }: { categorias: { id: string; descricao_categoria: string | null; nome_categoria: string | null }[] }) {
  const createMov = useCreateMovimentacao();
  const [open, setOpen] = useState(false);
  const [fornecedor, setFornecedor] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [valor, setValor] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [vencimento, setVencimento] = useState<Date>();
  const [temParcelas, setTemParcelas] = useState(false);
  const [qtdParcelas, setQtdParcelas] = useState("2");
  const [cartaoCredito, setCartaoCredito] = useState(false);
  const [parcelasManual, setParcelasManual] = useState<ParcelaManual[]>([]);
  const [salvando, setSalvando] = useState(false);

  const resetForm = () => {
    setFornecedor("");
    setNotaFiscal("");
    setValor("");
    setCategoriaId("");
    setVencimento(undefined);
    setTemParcelas(false);
    setQtdParcelas("2");
    setCartaoCredito(false);
    setParcelasManual([]);
  };

  // Quando ativa parcelas manuais (NF), inicializa lista
  const addParcelaManual = () => {
    setParcelasManual((prev) => [
      ...prev,
      { valor: "", data: prev.length > 0 ? addMonths(prev[prev.length - 1].data, 1) : (vencimento ?? new Date()) },
    ]);
  };

  const updateParcelaManual = (idx: number, field: keyof ParcelaManual, value: any) => {
    setParcelasManual((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const removeParcelaManual = (idx: number) => {
    setParcelasManual((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    const valorNum = parseFloat(valor.replace(",", "."));
    if (!fornecedor.trim()) return toast.error("Informe o fornecedor");
    if (!cartaoCredito && temParcelas && parcelasManual.length === 0) return toast.error("Adicione ao menos uma parcela");
    if (!cartaoCredito && !temParcelas && (!valorNum || valorNum <= 0)) return toast.error("Informe um valor válido");
    if (!cartaoCredito && !temParcelas && !vencimento) return toast.error("Informe a data de vencimento");
    if (cartaoCredito && (!valorNum || valorNum <= 0)) return toast.error("Informe um valor válido");
    if (cartaoCredito && !vencimento) return toast.error("Informe a data de vencimento");

    setSalvando(true);
    try {
      let descricao = notaFiscal.trim()
        ? `${fornecedor.trim()} - NF ${notaFiscal.trim()}`
        : fornecedor.trim();

      if (cartaoCredito) descricao = `💳 ${descricao}`;

      const origem = cartaoCredito ? "cartao_credito" : "manual";

      if (cartaoCredito && temParcelas) {
        // Cartão de crédito: parcelas automáticas mensais
        const parcelas = Math.min(Math.max(parseInt(qtdParcelas) || 1, 2), 60);
        const valorParcela = Math.round((valorNum / parcelas) * 100) / 100;
        for (let i = 0; i < parcelas; i++) {
          const dataVenc = addMonths(vencimento!, i);
          await createMov.mutateAsync({
            tipo: "saida",
            descricao: `${descricao} (${i + 1}/${parcelas})`,
            valor: valorParcela,
            data: format(dataVenc, "yyyy-MM-dd"),
            categoria_id: categoriaId || null,
            origem,
          });
        }
        toast.success(`${parcelas} parcelas de ${formatCurrency(valorParcela)} cadastradas`);
      } else if (!cartaoCredito && temParcelas) {
        // NF faturada: parcelas manuais com valor e data individuais
        const totalParcelas = parcelasManual.length;
        for (let i = 0; i < totalParcelas; i++) {
          const p = parcelasManual[i];
          const vp = parseFloat(p.valor.replace(",", "."));
          if (!vp || vp <= 0) {
            toast.error(`Parcela ${i + 1} com valor inválido`);
            setSalvando(false);
            return;
          }
          await createMov.mutateAsync({
            tipo: "saida",
            descricao: `${descricao} (${i + 1}/${totalParcelas})`,
            valor: vp,
            data: format(p.data, "yyyy-MM-dd"),
            categoria_id: categoriaId || null,
            origem,
          });
        }
        toast.success(`${totalParcelas} parcelas cadastradas com sucesso`);
      } else {
        // Pagamento único
        await createMov.mutateAsync({
          tipo: "saida",
          descricao,
          valor: valorNum,
          data: format(vencimento!, "yyyy-MM-dd"),
          categoria_id: categoriaId || null,
          origem,
        });
        toast.success("Conta a pagar cadastrada com sucesso");
      }

      resetForm();
      setOpen(false);
    } catch {
      toast.error("Erro ao cadastrar conta");
    } finally {
      setSalvando(false);
    }
  };

  const parcelasNum = parseInt(qtdParcelas) || 0;
  const valorNum = parseFloat(valor.replace(",", ".")) || 0;
  const valorParcelaCC = parcelasNum > 0 ? valorNum / parcelasNum : 0;

  const totalParcelasManual = parcelasManual.reduce((acc, p) => acc + (parseFloat(p.valor.replace(",", ".")) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nova Conta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Conta a Pagar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Fornecedor *</Label>
            <Input placeholder="Nome do fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Nota Fiscal</Label>
            <Input placeholder="Número da NF (opcional)" value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} maxLength={50} />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
              <SelectContent>
                {categorias.filter((c) => !!c.descricao_categoria).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.descricao_categoria}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="cartao" checked={cartaoCredito} onCheckedChange={(v) => {
              setCartaoCredito(v === true);
              if (v === true) setParcelasManual([]);
            }} />
            <Label htmlFor="cartao" className="flex items-center gap-1.5 cursor-pointer text-sm font-normal">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Cartão de Crédito
            </Label>
          </div>

          {/* Valor e Vencimento - sempre visíveis se não for parcela manual */}
          {(!temParcelas || cartaoCredito) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor Total (R$) *</Label>
                <Input placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !vencimento && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {vencimento ? format(vencimento, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={vencimento} onSelect={setVencimento} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox id="parcelas" checked={temParcelas} onCheckedChange={(v) => {
              setTemParcelas(v === true);
              if (v === true && !cartaoCredito) setParcelasManual([]);
            }} />
            <Label htmlFor="parcelas" className="cursor-pointer text-sm font-normal">
              {cartaoCredito ? "Repetir Mensalmente" : "Parcelado (NF Faturada)"}
            </Label>
          </div>

          {/* Cartão de crédito: parcelas automáticas mensais */}
          {temParcelas && cartaoCredito && (
            <div className="space-y-2 pl-6 border-l-2 border-primary/20">
              <Label>Número de Parcelas</Label>
              <Input type="number" min={2} max={60} value={qtdParcelas} onChange={(e) => setQtdParcelas(e.target.value)} placeholder="2" />
              {parcelasNum >= 2 && valorNum > 0 && (
                <p className="text-xs text-muted-foreground">
                  {parcelasNum}x de {formatCurrency(valorParcelaCC)} com vencimento mensal a partir de {vencimento ? format(vencimento, "dd/MM/yyyy") : "—"}
                </p>
              )}
            </div>
          )}

          {/* NF faturada: parcelas manuais */}
          {temParcelas && !cartaoCredito && (
            <div className="space-y-3 pl-6 border-l-2 border-primary/20">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Parcelas ({parcelasManual.length})</Label>
                <Button type="button" variant="outline" size="sm" onClick={addParcelaManual} className="gap-1">
                  <Plus className="h-3 w-3" /> Adicionar Parcela
                </Button>
              </div>
              {parcelasManual.length === 0 && (
                <p className="text-xs text-muted-foreground">Clique em "Adicionar Parcela" para inserir valor e data de cada parcela.</p>
              )}
              {parcelasManual.map((p, idx) => (
                <div key={idx} className="flex items-end gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Parcela {idx + 1} - Valor (R$)</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="0,00"
                      value={p.valor}
                      onChange={(e) => updateParcelaManual(idx, "valor", e.target.value.replace(/[^0-9.,]/g, ""))}
                      inputMode="decimal"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Vencimento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal text-xs")}>
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {format(p.data, "dd/MM/yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={p.data}
                          onSelect={(d) => d && updateParcelaManual(idx, "data", d)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeParcelaManual(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {parcelasManual.length > 0 && (
                <p className="text-xs text-muted-foreground font-medium">
                  Total das parcelas: {formatCurrency(totalParcelasManual)}
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={salvando}>
            {salvando ? "Salvando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ContasPagar() {
  const { data: movs, isLoading } = useMovimentacoesFinanceiras();
  const { data: categorias } = useCategorias();
  const { data: centros } = useCentrosCusto();

  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("urgentes");
  const [busca, setBusca] = useState("");
  const [baixaMovId, setBaixaMovId] = useState<string | null>(null);
  const [editMovId, setEditMovId] = useState<string | null>(null);
  const [editParcelasBase, setEditParcelasBase] = useState<string | null>(null);

  const catMap = Object.fromEntries((categorias ?? []).map((c) => [c.id, c.descricao_categoria ?? c.nome_categoria]));

  const saidas = useMemo(() => {
    return (movs ?? [])
      .filter((m) => m.tipo === "saida")
      .map((m) => ({ ...m, statusPagamento: getStatusPagamento(m) }));
  }, [movs]);

  const filtered = useMemo(() => {
    return saidas.filter((m) => {
      if (filtroCategoria !== "todos" && m.categoria_id !== filtroCategoria) return false;
      if (filtroStatus === "urgentes" && m.statusPagamento !== "vencido" && m.statusPagamento !== "proximo") return false;
      if (filtroStatus !== "todos" && filtroStatus !== "urgentes" && m.statusPagamento !== filtroStatus) return false;
      if (busca) {
        const search = busca.toLowerCase();
        const desc = (m.descricao ?? "").toLowerCase();
        const cat = (m.categoria_id ? catMap[m.categoria_id] ?? "" : "").toLowerCase();
        if (!desc.includes(search) && !cat.includes(search)) return false;
      }
      return true;
    });
  }, [saidas, filtroCategoria, filtroStatus, busca, catMap]);

  const totalPendente = saidas.filter((s) => s.statusPagamento === "pendente").reduce((acc, s) => acc + (s.valor ?? 0), 0);
  const totalVencido = saidas.filter((s) => s.statusPagamento === "vencido").reduce((acc, s) => acc + (s.valor ?? 0), 0);
  const totalProximo = saidas.filter((s) => s.statusPagamento === "proximo").reduce((acc, s) => acc + (s.valor ?? 0), 0);
  const totalMes = saidas
    .filter((s) => {
      const d = parseISO(s.data);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((acc, s) => acc + (s.valor ?? 0), 0);

  const fluxoCaixa = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(subMonths(now, 5));
    const end = endOfMonth(addMonths(now, 2));
    const months = eachMonthOfInterval({ start, end });
    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const movsDoMes = (movs ?? []).filter((m) => {
        const d = parseISO(m.data);
        return !isBefore(d, monthStart) && !isAfter(d, monthEnd);
      });
      const entradas = movsDoMes.filter((m) => m.tipo === "entrada").reduce((acc, m) => acc + (m.valor ?? 0), 0);
      const saidasMes = movsDoMes.filter((m) => m.tipo === "saida").reduce((acc, m) => acc + (m.valor ?? 0), 0);
      return { mes: format(month, "MMM/yy", { locale: ptBR }), entradas, saidas: saidasMes, saldo: entradas - saidasMes };
    });
  }, [movs]);

  const fluxoComSaldo = useMemo(() => {
    let acumulado = 0;
    return fluxoCaixa.map((item) => {
      acumulado += item.saldo;
      return { ...item, saldoAcumulado: acumulado };
    });
  }, [fluxoCaixa]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "pago": return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Pago</Badge>;
      case "vencido": return <Badge variant="destructive">Vencido</Badge>;
      case "proximo": return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Próximo</Badge>;
      case "pendente": return <Badge variant="secondary">Pendente</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const movBaixa = saidas.find((m) => m.id === baixaMovId);
  const movEdit = saidas.find((m) => m.id === editMovId);

  const parcelasMov = useMemo(() => {
    if (!editParcelasBase) return [];
    return saidas
      .filter((m) => {
        const desc = m.descricao ?? "";
        const match = desc.match(/^(.+?)\s*\((\d+)\/(\d+)\)$/);
        if (!match) return false;
        return match[1] === editParcelasBase;
      })
      .map((m) => {
        const match = (m.descricao ?? "").match(/\((\d+)\/(\d+)\)$/);
        return {
          ...m,
          parcelaIdx: match ? parseInt(match[1]) : 1,
          parcelaTotal: match ? parseInt(match[2]) : 1,
        };
      })
      .sort((a, b) => a.parcelaIdx - b.parcelaIdx);
  }, [editParcelasBase, saidas]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle de pagamentos e fluxo de caixa</p>
        </div>
        <NovaContaDialog categorias={categorias ?? []} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencidos</p>
                <p className="text-lg font-bold text-destructive">{formatCurrency(totalVencido)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <CalendarIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Próximos 7 dias</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(totalProximo)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-lg font-bold">{formatCurrency(totalPendente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingDown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Mês</p>
                <p className="text-lg font-bold">{formatCurrency(totalMes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="contas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contas">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
            </div>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Categorias</SelectItem>
                {categorias?.map((c) => <SelectItem key={c.id} value={c.id}>{c.descricao_categoria ?? c.nome_categoria}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="urgentes">Vencidos + Próximos 7 dias</SelectItem>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
                <SelectItem value="proximo">Próximos 7 dias</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">
                {filtered.length} pagamento{filtered.length !== 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum pagamento encontrado</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m) => (
                      <TableRow key={m.id} className={cn(
                        m.statusPagamento === "vencido" && "bg-destructive/5",
                        m.statusPagamento === "pago" && "opacity-60"
                      )}>
                        <TableCell className="text-muted-foreground">
                          <div>{formatDateBR(m.data)}</div>
                          {m.statusPagamento === "pago" && m.data_envio && (
                            <div className="text-[10px] text-emerald-600">Pago em {formatDateBR(m.data_envio)}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium max-w-xs truncate">{m.descricao ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.categoria_id ? catMap[m.categoria_id] ?? "—" : "—"}</TableCell>
                        <TableCell>
                          {m.origem === "cartao_credito" ? (
                            <Badge variant="outline" className="gap-1">
                              <CreditCard className="h-3 w-3" /> Cartão
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{statusBadge(m.statusPagamento)}</TableCell>
                        <TableCell className="text-right font-semibold text-destructive">{formatCurrency(m.valor)}</TableCell>
                        <TableCell className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              // Check if it's an installment (X/Y) pattern
                              const parcelaMatch = (m.descricao ?? "").match(/\((\d+)\/(\d+)\)$/);
                              if (parcelaMatch) {
                                // Extract base description to find all related installments
                                const baseDesc = (m.descricao ?? "").replace(/\s*\(\d+\/\d+\)$/, "");
                                setEditParcelasBase(baseDesc);
                              } else {
                                setEditMovId(m.id);
                              }
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Editar
                          </Button>
                          {m.statusPagamento !== "pago" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              onClick={() => setBaixaMovId(m.id)}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Baixa
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fluxo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Fluxo de Caixa — Últimos 6 meses + Projeção</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={fluxoComSaldo}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="saldoAcumulado" name="Saldo Acumulado" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Resumo Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Saídas</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fluxoComSaldo.map((item) => (
                    <TableRow key={item.mes}>
                      <TableCell className="font-medium capitalize">{item.mes}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatCurrency(item.entradas)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(item.saidas)}</TableCell>
                      <TableCell className={`text-right font-medium ${item.saldo >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatCurrency(item.saldo)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${item.saldoAcumulado >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatCurrency(item.saldoAcumulado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dar Baixa Dialog */}
      <Dialog open={!!baixaMovId} onOpenChange={(open) => !open && setBaixaMovId(null)}>
        {movBaixa && <DarBaixaDialog mov={movBaixa} onClose={() => setBaixaMovId(null)} />}
      </Dialog>

      {/* Editar Conta Dialog */}
      <Dialog open={!!editMovId} onOpenChange={(open) => !open && setEditMovId(null)}>
        {movEdit && <EditarContaDialog mov={movEdit} categorias={categorias ?? []} onClose={() => setEditMovId(null)} />}
      </Dialog>

      {/* Editar Parcelas Dialog */}
      <Dialog open={!!editParcelasBase && parcelasMov.length > 0} onOpenChange={(open) => !open && setEditParcelasBase(null)}>
        {parcelasMov.length > 0 && (
          <EditarParcelasDialog parcelas={parcelasMov} categorias={categorias ?? []} onClose={() => setEditParcelasBase(null)} />
        )}
      </Dialog>
    </div>
  );
}
