import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useProduto, useCreateProduto, useUpdateProduto, useAviamentos, useProdutoAviamentos, useSaveProdutoAviamentos, useTecidos, useCreateAviamento } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, DollarSign } from "lucide-react";

interface ProdutoFormData {
  nome_do_produto: string;
  codigo_sku: string;
  preco_venda: number;
  preco_custo: number;
  consumo_de_tecido: number;
  tipo_do_produto: string;
  tecido_do_produto: string;
  imposto_percentual: number;
  comissao_percentual: number;
  cupom_percentual: number;
  parcelamento_percentual: number;
  custo_corte: number;
  custo_costura: number;
  custo_embalagem: number;
  custo_marketing: number;
  custo_frete: number;
}

interface AviamentoItem {
  aviamento_id: string;
  quantidade_por_peca: number;
  custo_unitario: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function ProdutoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== "novo";
  const { data: produto } = useProduto(isEdit ? id : "");
  const { data: aviamentos } = useAviamentos();
  const { data: tecidos } = useTecidos();
  const createAviamentoMut = useCreateAviamento();
  const [novoAviamento, setNovoAviamento] = useState({ nome_aviamento: "", unidade_medida: "", custo_aviamento: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: produtoAviamentos } = useProdutoAviamentos(isEdit ? id : "");
  const createMut = useCreateProduto();
  const updateMut = useUpdateProduto();
  const saveAviamentosMut = useSaveProdutoAviamentos();

  const { register, handleSubmit, watch, reset, setValue } = useForm<ProdutoFormData>({
    defaultValues: {
      nome_do_produto: "",
      codigo_sku: "",
      preco_venda: 0,
      preco_custo: 0,
      consumo_de_tecido: 0,
      tipo_do_produto: "",
      tecido_do_produto: "",
      imposto_percentual: 10,
      comissao_percentual: 1,
      cupom_percentual: 12,
      parcelamento_percentual: 9.05,
      custo_corte: 0,
      custo_costura: 0,
      custo_embalagem: 0,
      custo_marketing: 0,
      custo_frete: 0,
    },
  });
  const [aviItems, setAviItems] = useState<AviamentoItem[]>([]);

  useEffect(() => {
    if (produto && isEdit) {
      reset({
        nome_do_produto: produto.nome_do_produto,
        codigo_sku: produto.codigo_sku ?? "",
        preco_venda: produto.preco_venda ?? 0,
        preco_custo: produto.preco_custo ?? 0,
        consumo_de_tecido: produto.consumo_de_tecido ?? 0,
        tipo_do_produto: produto.tipo_do_produto ?? "",
        tecido_do_produto: produto.tecido_do_produto ?? "",
        imposto_percentual: produto.imposto_percentual ?? 10,
        comissao_percentual: produto.comissao_percentual ?? 1,
        cupom_percentual: produto.cupom_percentual ?? 12,
        parcelamento_percentual: produto.parcelamento_percentual ?? 9.05,
        custo_corte: produto.custo_corte ?? 0,
        custo_costura: produto.custo_costura ?? 0,
        custo_embalagem: produto.custo_embalagem ?? 0,
        custo_marketing: (produto as any).custo_marketing ?? 0,
        custo_frete: (produto as any).custo_frete ?? 0,
      });
    }
  }, [produto, isEdit, reset]);

  useEffect(() => {
    if (produtoAviamentos?.length) {
      setAviItems(produtoAviamentos.map((pa) => ({
        aviamento_id: pa.aviamento_id ?? "",
        quantidade_por_peca: pa.quantidade_por_peca ?? 0,
        custo_unitario: pa.custo_unitario ?? 0,
      })));
    }
  }, [produtoAviamentos]);

  // Watch all cost fields
  const precoVenda = toNumber(watch("preco_venda"));
  const precoCusto = toNumber(watch("preco_custo"));
  const consumoTecido = toNumber(watch("consumo_de_tecido"));
  const impostoPerc = toNumber(watch("imposto_percentual"));
  const comissaoPerc = toNumber(watch("comissao_percentual"));
  const cupomPerc = toNumber(watch("cupom_percentual"));
  const parcelamentoPerc = toNumber(watch("parcelamento_percentual"));
  const custoCorte = toNumber(watch("custo_corte"));
  const custoCostura = toNumber(watch("custo_costura"));
  const custoEmbalagem = toNumber(watch("custo_embalagem"));
  const custoMarketing = toNumber(watch("custo_marketing"));
  const custoFrete = toNumber(watch("custo_frete"));

  const custoAviamentos = aviItems.reduce((a, item) => a + (item.quantidade_por_peca * item.custo_unitario), 0);

  // Deductions (percentages over sale price)
  const deducoesPercentual = impostoPerc + comissaoPerc + cupomPerc + parcelamentoPerc;
  const deducoesValor = precoVenda * (deducoesPercentual / 100);

  // Variable costs (production)
  const custosVariaveis = custoCorte + custoCostura;

  // Fixed costs
  const custosFixos = custoEmbalagem;

  // Total cost = tecido + aviamentos + variable + fixed
  const custoTotalProduto = precoCusto + custoAviamentos + custosVariaveis + custosFixos;

  // Receita líquida = preço de venda - deduções
  const receitaLiquida = precoVenda - deducoesValor;

  // Margem bruta = receita líquida - custo total
  const margemBrutaValor = receitaLiquida - custoTotalProduto;
  const margemBrutaPerc = precoVenda > 0 ? (margemBrutaValor / precoVenda) * 100 : 0;

  // Margem líquida (after all costs)
  const margemLiquidaValor = precoVenda - deducoesValor - custoTotalProduto;
  const margemLiquidaPerc = precoVenda > 0 ? (margemLiquidaValor / precoVenda) * 100 : 0;

  // Preço sugerido (markup ×5 over custo tecido)
  const precoSugerido = precoCusto * 5;

  // Auto-update custo de tecido when tecido or consumo changes
  const tecidoSelecionado = watch("tecido_do_produto");
  useEffect(() => {
    if (tecidoSelecionado && tecidos) {
      const tecido = tecidos.find((t) => t.nome_tecido === tecidoSelecionado);
      if (tecido?.custo_por_metro && consumoTecido > 0) {
        const custoTecido = tecido.custo_por_metro * consumoTecido;
        setValue("preco_custo", Number(custoTecido.toFixed(2)));
      }
    }
  }, [tecidoSelecionado, consumoTecido, tecidos, setValue]);

  const addAviamento = () => setAviItems([...aviItems, { aviamento_id: "", quantidade_por_peca: 1, custo_unitario: 0 }]);
  const removeAviamento = (i: number) => setAviItems(aviItems.filter((_, idx) => idx !== i));
  const updateAvi = (i: number, field: keyof AviamentoItem, value: any) => {
    const items = [...aviItems];
    items[i] = { ...items[i], [field]: value };
    if (field === "aviamento_id") {
      const avi = aviamentos?.find((a) => a.id === value);
      if (avi) items[i].custo_unitario = avi.custo_aviamento ?? 0;
    }
    setAviItems(items);
  };

  const handleCreateAviamento = async () => {
    if (!novoAviamento.nome_aviamento) {
      toast.error("Informe o nome do aviamento");
      return;
    }
    try {
      const created = await createAviamentoMut.mutateAsync(novoAviamento);
      setAviItems([...aviItems, { aviamento_id: created.id, quantidade_por_peca: 1, custo_unitario: created.custo_aviamento ?? 0 }]);
      setNovoAviamento({ nome_aviamento: "", unidade_medida: "", custo_aviamento: 0 });
      setDialogOpen(false);
      toast.success("Aviamento cadastrado!");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onSubmit = async (data: ProdutoFormData) => {
    try {
      const sanitizedData: ProdutoFormData = {
        ...data,
        preco_venda: toNumber(data.preco_venda),
        preco_custo: toNumber(data.preco_custo),
        consumo_de_tecido: toNumber(data.consumo_de_tecido),
        imposto_percentual: toNumber(data.imposto_percentual),
        comissao_percentual: toNumber(data.comissao_percentual),
        cupom_percentual: toNumber(data.cupom_percentual),
        parcelamento_percentual: toNumber(data.parcelamento_percentual),
        custo_corte: toNumber(data.custo_corte),
        custo_costura: toNumber(data.custo_costura),
        custo_embalagem: toNumber(data.custo_embalagem),
      };

      const payload = {
        ...sanitizedData,
        margem_real_percentual: toNumber(margemLiquidaPerc),
        preco_venda_sugerido: toNumber(precoSugerido),
        ativo: true,
      };

      let prodId = id;
      if (isEdit) {
        await updateMut.mutateAsync({ id, ...payload });
      } else {
        const result = await createMut.mutateAsync(payload);
        prodId = result.id;
      }

      if (prodId) {
        await saveAviamentosMut.mutateAsync({
          produtoId: prodId,
          aviamentos: aviItems.filter((a) => a.aviamento_id),
        });
      }

      toast.success(isEdit ? "Produto atualizado!" : "Produto criado!");
      navigate("/produtos");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold text-foreground">
        {isEdit ? "Editar " : "Novo "}<span className="text-primary">Produto</span>
      </h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados básicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Produto</Label>
                <Input {...register("nome_do_produto", { required: true })} placeholder="Ex: Camiseta Básica" />
              </div>
              <div className="space-y-2">
                <Label>Código SKU</Label>
                <Input {...register("codigo_sku")} placeholder="Ex: CAM-001" />
              </div>
              <div className="space-y-2">
                <Label>Tipo do Produto</Label>
                <Input {...register("tipo_do_produto")} placeholder="Ex: Camiseta, Calça..." />
              </div>
              <div className="space-y-2">
                <Label>Tecido do Produto</Label>
                <input type="hidden" {...register("tecido_do_produto")} />
                <Select
                  value={watch("tecido_do_produto") ?? ""}
                  onValueChange={(v) =>
                    setValue("tecido_do_produto", v, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o tecido" /></SelectTrigger>
                  <SelectContent>
                    {tecidos?.map((t) => (
                      <SelectItem key={t.id} value={t.nome_tecido ?? t.id}>{t.nome_tecido}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Consumo de Tecido (m)</Label>
                <Input type="number" step="0.01" {...register("consumo_de_tecido", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Custo do Tecido (calculado)</Label>
                <Input type="number" step="0.01" {...register("preco_custo", { valueAsNumber: true })} />
                <p className="text-xs text-muted-foreground">Custo/m do tecido × consumo</p>
              </div>
              <div className="space-y-2">
                <Label>Preço de Venda (R$)</Label>
                <Input type="number" step="0.01" {...register("preco_venda", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Valor Sugerido (Markup ×5)
                </Label>
                <div className="h-10 flex items-center px-3 rounded-md border border-border bg-muted text-foreground font-medium">
                  {fmt(precoSugerido)}
                </div>
              </div>
            </div>

            {/* Deduções (Custos Variáveis %) */}
            <div className="space-y-3">
              <h3 className="font-serif font-bold text-foreground flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-destructive/60" />
                Deduções sobre Venda (%)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg border border-border bg-destructive/5">
                <div className="space-y-1">
                  <Label className="text-xs">Imposto (%)</Label>
                  <Input type="number" step="0.01" {...register("imposto_percentual", { valueAsNumber: true })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Comissão (%)</Label>
                  <Input type="number" step="0.01" {...register("comissao_percentual", { valueAsNumber: true })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cupom (%)</Label>
                  <Input type="number" step="0.01" {...register("cupom_percentual", { valueAsNumber: true })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Parcelamento (%)</Label>
                  <Input type="number" step="0.01" {...register("parcelamento_percentual", { valueAsNumber: true })} />
                </div>
              </div>
            </div>

            {/* Custos Variáveis (Produção) */}
            <div className="space-y-3">
              <h3 className="font-serif font-bold text-foreground flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-warning/60" />
                Custos Variáveis (Produção)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-warning/5">
                <div className="space-y-1">
                  <Label className="text-xs">Corte (R$)</Label>
                  <Input type="number" step="0.01" {...register("custo_corte", { valueAsNumber: true })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">MDO - Costura (R$)</Label>
                  <Input type="number" step="0.01" {...register("custo_costura", { valueAsNumber: true })} />
                </div>
              </div>
            </div>

            {/* Custos Fixos */}
            <div className="space-y-3">
              <h3 className="font-serif font-bold text-foreground flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-primary/60" />
                Custos Fixos
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-primary/5">
                <div className="space-y-1">
                  <Label className="text-xs">Embalagem (R$)</Label>
                  <Input type="number" step="0.01" {...register("custo_embalagem", { valueAsNumber: true })} />
                </div>
              </div>
            </div>

            {/* Aviamentos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif font-bold text-foreground">Aviamentos do Produto</h3>
                <div className="flex gap-2">
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="gap-1">
                        <Plus className="h-3 w-3" /> Novo Aviamento
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Cadastrar Aviamento</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input value={novoAviamento.nome_aviamento} onChange={(e) => setNovoAviamento({...novoAviamento, nome_aviamento: e.target.value})} placeholder="Ex: Botão, Zíper..." />
                        </div>
                        <div className="space-y-2">
                          <Label>Unidade de Medida</Label>
                          <Input value={novoAviamento.unidade_medida} onChange={(e) => setNovoAviamento({...novoAviamento, unidade_medida: e.target.value})} placeholder="Ex: un, m, kg..." />
                        </div>
                        <div className="space-y-2">
                          <Label>Custo Unitário</Label>
                          <Input type="number" step="0.01" value={novoAviamento.custo_aviamento} onChange={(e) => setNovoAviamento({...novoAviamento, custo_aviamento: Number(e.target.value)})} />
                        </div>
                        <Button type="button" onClick={handleCreateAviamento} disabled={createAviamentoMut.isPending} className="w-full">Cadastrar</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button type="button" variant="outline" size="sm" onClick={addAviamento} className="gap-1">
                    <Plus className="h-3 w-3" /> Adicionar Existente
                  </Button>
                </div>
              </div>
              {aviItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aviamento</TableHead>
                      <TableHead className="text-right">Qtd/Peça</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aviItems.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Select value={item.aviamento_id} onValueChange={(v) => updateAvi(i, "aviamento_id", v)}>
                            <SelectTrigger className="w-48"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {aviamentos?.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome_aviamento}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" step="0.01" className="w-20 ml-auto" value={item.quantidade_por_peca}
                            onChange={(e) => updateAvi(i, "quantidade_por_peca", Number(e.target.value))} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" step="0.01" className="w-24 ml-auto" value={item.custo_unitario}
                            onChange={(e) => updateAvi(i, "custo_unitario", Number(e.target.value))} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {fmt(item.quantidade_por_peca * item.custo_unitario)}
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeAviamento(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum aviamento adicionado.</p>
              )}
            </div>

            {/* Resumo financeiro completo */}
            <div className="p-5 rounded-lg bg-muted/50 border border-border space-y-3">
              <h3 className="font-serif font-bold text-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Análise de Margens
              </h3>

              {/* Receita */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Preço de Venda</span>
                <span className="font-medium">{fmt(precoVenda)}</span>
              </div>

              {/* Deduções */}
              <div className="pl-4 space-y-1 border-l-2 border-destructive/30">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Imposto ({impostoPerc}%)</span>
                  <span className="text-destructive">- {fmt(precoVenda * impostoPerc / 100)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Comissão ({comissaoPerc}%)</span>
                  <span className="text-destructive">- {fmt(precoVenda * comissaoPerc / 100)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Cupom ({cupomPerc}%)</span>
                  <span className="text-destructive">- {fmt(precoVenda * cupomPerc / 100)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Parcelamento ({parcelamentoPerc}%)</span>
                  <span className="text-destructive">- {fmt(precoVenda * parcelamentoPerc / 100)}</span>
                </div>
              </div>

              <div className="flex justify-between text-sm border-t border-border pt-2">
                <span className="text-muted-foreground">Receita Líquida</span>
                <span className="font-medium">{fmt(receitaLiquida)}</span>
              </div>

              {/* Custos */}
              <div className="pl-4 space-y-1 border-l-2 border-warning/30">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tecido</span>
                  <span>- {fmt(precoCusto)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Aviamentos</span>
                  <span>- {fmt(custoAviamentos)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Corte</span>
                  <span>- {fmt(custoCorte)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">MDO - Costura</span>
                  <span>- {fmt(custoCostura)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Embalagem</span>
                  <span>- {fmt(custoEmbalagem)}</span>
                </div>
              </div>

              <div className="flex justify-between text-sm border-t border-border pt-2">
                <span className="text-muted-foreground">Custo Total por Peça</span>
                <span className="font-medium">{fmt(custoTotalProduto)}</span>
              </div>

              {/* Margens */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                <div className="p-3 rounded-lg bg-background border border-border text-center">
                  <p className="text-xs text-muted-foreground mb-1">Margem Bruta</p>
                  <p className={`text-2xl font-serif font-bold ${margemBrutaPerc >= 0 ? "text-success" : "text-destructive"}`}>
                    {margemBrutaPerc.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">{fmt(margemBrutaValor)}</p>
                </div>
                <div className="p-3 rounded-lg bg-background border border-border text-center">
                  <p className="text-xs text-muted-foreground mb-1">Margem Líquida</p>
                  <p className={`text-2xl font-serif font-bold ${margemLiquidaPerc >= 0 ? "text-success" : "text-destructive"}`}>
                    {margemLiquidaPerc.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">{fmt(margemLiquidaValor)}</p>
                </div>
              </div>

              {/* Alerta de preço */}
              {precoVenda > 0 && precoSugerido > 0 && precoVenda < precoSugerido * 0.8 && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                  <TrendingUp className="h-4 w-4" />
                  Preço de venda abaixo de 80% do sugerido ({fmt(precoSugerido)}). Considere ajustar.
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => navigate("/produtos")}>Cancelar</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {isEdit ? "Salvar Alterações" : "Criar Produto"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
