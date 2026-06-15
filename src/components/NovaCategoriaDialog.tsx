import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface NovaCategoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string, nome: string) => void;
  defaultNome?: string;
}

export function NovaCategoriaDialog({ open, onOpenChange, onCreated, defaultNome = "" }: NovaCategoriaDialogProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(defaultNome);
  const [tipo, setTipo] = useState<string>("");
  const [grupoDre, setGrupoDre] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(defaultNome);
      setTipo("");
      setGrupoDre("");
      setDescricao("");
    }
  }, [open, defaultNome]);

  const { data: gruposDreData } = useQuery({
    queryKey: ["categorias_grupos_dre"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("grupo_dre")
        .not("grupo_dre", "is", null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const gruposDre = useMemo(() => {
    const set = new Set<string>();
    (gruposDreData ?? []).forEach((d: any) => {
      const g = (d.grupo_dre || "").trim();
      if (g) set.add(g);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [gruposDreData]);

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }
    if (!tipo) {
      toast.error("Selecione o tipo.");
      return;
    }
    if (!grupoDre) {
      toast.error("Selecione o grupo DRE.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .insert({
          nome_categoria: nome.trim(),
          tipo,
          grupo_dre: grupoDre,
          descricao_categoria: descricao.trim() || null,
        })
        .select("id, nome_categoria")
        .single();
      if (error) throw error;
      toast.success("Categoria criada!");
      await queryClient.invalidateQueries({ queryKey: ["categorias"] });
      await queryClient.invalidateQueries({ queryKey: ["categorias_grupos_dre"] });
      onCreated?.(data.id, data.nome_categoria ?? nome.trim());
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar categoria.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar nova categoria</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome da categoria *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Crédito">Crédito</SelectItem>
                <SelectItem value="Débito">Débito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Grupo DRE *</Label>
            <Select value={grupoDre} onValueChange={setGrupoDre}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {gruposDre.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar categoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
