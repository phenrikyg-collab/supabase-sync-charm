import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useProduto, useCreateProduto, useUpdateProduto, useAviamentos, useProdutoAviamentos, useSaveProdutoAviamentos } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface ProdutoFormData {
  nome_do_produto: string;
  codigo_sku: string;
  preco_venda: number;
  preco_custo: number;
  consumo_de_tecido: number;
  tipo_do_produto: string;
  tecido_do_produto: string;
}

interface AviamentoItem {
  aviamento_id: string;
  quantidade_por_peca: number;
  custo_unitario: number;
}

export default function ProdutoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== "novo";
  const { data: produto } = useProduto(isEdit ? id : "");
  const { data: aviamentos } = useAviamentos();
  const { data: produtoAviamentos } = useProdutoAviamentos(isEdit ? id : "");
  const createMut = useCreateProduto();
  const updateMut = useUpdateProduto();
  const saveAviamentosMut = useSaveProdutoAviamentos();

  const { register, handleSubmit, watch, reset } = useForm<ProdutoFormData>();
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

  const precoVenda = watch("preco_venda") ?? 0;
  const precoCusto = watch("preco_custo") ?? 0;
  const custoAviamentos = aviItems.reduce((a, item) => a + (item.quantidade_por_peca * item.custo_unitario), 0);
  const custoTotal = precoCusto + custoAviamentos;
  const margem = precoVenda > 0 ? ((precoVenda - custoTotal) / precoVenda) * 100 : 0;

  const addAviamento = () => setAviItems([...aviItems, { aviamento_id: "", quantidade_por_peca: 1, custo_unitario: 0 }]);
  const removeAviamento = (i: number) => setAviItems(aviItems.filter((_, idx) => idx !== i));
  const updateAvi = (i: number, field: keyof AviamentoItem, value: any) => {
    const items = [...aviItems];
    items[i] = { ...items[i], [field]: value };
    // Auto-fill custo_unitario from aviamento
    if (field === "aviamento_id") {
      const avi = aviamentos?.find((a) => a.id === value);
      if (avi) items[i].custo_unitario = avi.custo_unitario ?? 0;
    }
    setAviItems(items);
  };

  const aviMap = Object.fromEntries((aviamentos ?? []).map((a) => [a.id, a]));

  const onSubmit = async (data: ProdutoFormData) => {
    try {
      const payload = { ...data, margem_real_percentual: margem, ativo: true };
      let prodId = id;
      if (isEdit) {
        await updateMut.mutateAsync({ id, ...payload });
      } else {
        const result = await createMut.mutateAsync(payload);
        prodId = result.id;
      }
      // Save aviamentos
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
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold text-foreground">
        {isEdit ? "Editar " : "Novo "}<span className="text-primary">Produto</span>
      </h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                <Label>Preço de Venda</Label>
                <Input type="number" step="0.01" {...register("preco_venda", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Preço de Custo (Tecido)</Label>
                <Input type="number" step="0.01" {...register("preco_custo", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Consumo de Tecido (m)</Label>
                <Input type="number" step="0.01" {...register("consumo_de_tecido", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo do Produto</Label>
                <Input {...register("tipo_do_produto")} placeholder="Ex: Camiseta, Calça..." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Tecido do Produto</Label>
                <Input {...register("tecido_do_produto")} placeholder="Nome do tecido" />
              </div>
            </div>

            {/* Aviamentos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif font-bold text-foreground">Aviamentos do Produto</h3>
                <Button type="button" variant="outline" size="sm" onClick={addAviamento} className="gap-1">
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
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
                          R$ {(item.quantidade_por_peca * item.custo_unitario).toFixed(2)}
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

            {/* Resumo de custos */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Custo Tecido</span>
                <span className="text-foreground">R$ {precoCusto.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Custo Aviamentos</span>
                <span className="text-foreground">R$ {custoAviamentos.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium border-t border-border pt-2">
                <span className="text-muted-foreground">Custo Total</span>
                <span className="text-foreground">R$ {custoTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Margem Calculada</span>
                <span className="text-xl font-serif font-bold text-foreground">{margem.toFixed(1)}%</span>
              </div>
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
