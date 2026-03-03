import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Sparkles, Check, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCategorias } from "@/hooks/useSupabase";
import { useQueryClient } from "@tanstack/react-query";

interface LancamentoImportado {
  descricao: string;
  valor: number;
  data: string;
  tipo: "entrada" | "saida";
  categoria_id?: string | null;
  categoria_sugerida?: string | null;
}

interface ReviewRow extends LancamentoImportado {
  selecionado: boolean;
}

interface Props {
  lancamentosImportados: LancamentoImportado[];
  onConcluir: () => void;
  onVoltar: () => void;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function RevisaoLancamentos({ lancamentosImportados, onConcluir, onVoltar }: Props) {
  const { data: categorias } = useCategorias();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ReviewRow[]>(
    lancamentosImportados.map((l) => ({ ...l, selecionado: true }))
  );
  const [isCategorizando, setIsCategorizando] = useState(false);
  const [isSalvando, setIsSalvando] = useState(false);

  const categorizarComIA = async () => {
    if (rows.length === 0) return;
    setIsCategorizando(true);
    try {
      const { data, error } = await supabase.functions.invoke("categorizar-despesa", {
        body: {
          action: "categorize",
          items: rows.map((r) => ({ descricao: r.descricao, valor: r.valor, tipo: r.tipo })),
          categorias: categorias?.map((c) => ({ id: c.id, nome: c.nome_categoria, grupo_dre: c.grupo_dre })),
        },
      });
      if (error) throw error;

      if (data?.categorized) {
        setRows((prev) =>
          prev.map((r, i) => ({
            ...r,
            categoria_id: data.categorized[i]?.categoria_id ?? r.categoria_id,
            categoria_sugerida: data.categorized[i]?.categoria_nome ?? r.categoria_sugerida,
          }))
        );
        toast.success("Categorização automática concluída!");
      }
    } catch (err: any) {
      toast.error("Erro na categorização: " + (err.message || "erro desconhecido"));
    } finally {
      setIsCategorizando(false);
    }
  };

  const salvarMovimentacoes = async () => {
    const selecionados = rows.filter((r) => r.selecionado);
    if (selecionados.length === 0) {
      toast.error("Selecione ao menos um lançamento.");
      return;
    }
    setIsSalvando(true);
    try {
      const inserts = selecionados.map((r) => ({
        data: r.data,
        descricao: r.descricao,
        valor: r.valor,
        tipo: r.tipo,
        categoria_id: r.categoria_id || null,
        origem: "extrato_importado",
      }));

      const { error } = await supabase.from("movimentacoes_financeiras").insert(inserts);
      if (error) throw error;

      toast.success(`${selecionados.length} lançamentos salvos!`);
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      onConcluir();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "erro desconhecido"));
    } finally {
      setIsSalvando(false);
    }
  };

  const toggleAll = (v: boolean) => setRows((prev) => prev.map((r) => ({ ...r, selecionado: v })));

  const totalEntradas = rows.filter((r) => r.selecionado && r.tipo === "entrada").reduce((s, r) => s + r.valor, 0);
  const totalSaidas = rows.filter((r) => r.selecionado && r.tipo === "saida").reduce((s, r) => s + r.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onVoltar}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Revisar Lançamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revise, categorize e selecione os lançamentos antes de salvar
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-3 flex-wrap">
          <Badge variant="outline" className="text-success border-success/30">
            Entradas: {formatCurrency(totalEntradas)}
          </Badge>
          <Badge variant="outline" className="text-destructive border-destructive/30">
            Saídas: {formatCurrency(totalSaidas)}
          </Badge>
          <Badge variant="secondary">{rows.filter((r) => r.selecionado).length} selecionados</Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>Selecionar Todos</Button>
          <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>Desmarcar Todos</Button>
          <Button onClick={categorizarComIA} disabled={isCategorizando} className="gap-2">
            {isCategorizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Categorizar com IA
          </Button>
          <Button onClick={salvarMovimentacoes} disabled={isSalvando} variant="default" className="gap-2">
            {isSalvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar Selecionados
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">✓</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i} className={r.selecionado ? "" : "opacity-40"}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={r.selecionado}
                      onChange={(e) =>
                        setRows((prev) => prev.map((row, j) => j === i ? { ...row, selecionado: e.target.checked } : row))
                      }
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{r.data}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.descricao}</TableCell>
                  <TableCell>
                    <Badge variant={r.tipo === "entrada" ? "default" : "secondary"}>{r.tipo}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.categoria_id || "none"}
                      onValueChange={(v) =>
                        setRows((prev) => prev.map((row, j) => j === i ? { ...row, categoria_id: v === "none" ? null : v } : row))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs w-[180px]">
                        <SelectValue placeholder={r.categoria_sugerida || "Sem categoria"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {categorias?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome_categoria}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className={`text-right font-mono ${r.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                    {r.tipo === "saida" ? "-" : ""}{formatCurrency(r.valor)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
