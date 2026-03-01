import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useProduto, useCreateProduto, useUpdateProduto, useTecidos } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useEffect } from "react";

interface ProdutoForm {
  nome_do_produto: string;
  codigo_sku: string;
  preco_venda: number;
  preco_custo: number;
  consumo_de_tecido: number;
  tipo_do_produto: string;
  tecido_do_produto: string;
}

export default function ProdutoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== "novo";
  const { data: produto } = useProduto(isEdit ? id : "");
  const { data: tecidos } = useTecidos();
  const createMut = useCreateProduto();
  const updateMut = useUpdateProduto();

  const { register, handleSubmit, setValue, watch, reset } = useForm<ProdutoForm>();

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

  const precoVenda = watch("preco_venda") ?? 0;
  const precoCusto = watch("preco_custo") ?? 0;
  const margem = precoVenda > 0 ? ((precoVenda - precoCusto) / precoVenda) * 100 : 0;

  const onSubmit = async (data: ProdutoForm) => {
    try {
      const payload = {
        ...data,
        margem_real_percentual: margem,
        ativo: true,
      };
      if (isEdit) {
        await updateMut.mutateAsync({ id, ...payload });
        toast.success("Produto atualizado!");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Produto criado!");
      }
      navigate("/produtos");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold text-foreground">
        {isEdit ? "Editar Produto" : "Novo Produto"}
      </h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                <Label>Preço de Custo</Label>
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

            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground">Margem Calculada</p>
              <p className="text-2xl font-serif font-bold text-foreground">{margem.toFixed(1)}%</p>
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
