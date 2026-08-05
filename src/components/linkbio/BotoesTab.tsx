import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GripVertical, Loader2, Plus, Save, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type Botao = {
  id?: string;
  label: string;
  url_destino: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  icone: string;
  cor_destaque: string;
  destaque: boolean;
  ativo: boolean;
  ordem: number;
};

const vazio = (ordem: number): Botao => ({
  label: "",
  url_destino: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  icone: "",
  cor_destaque: "",
  destaque: false,
  ativo: true,
  ordem,
});

const MAX_ATIVOS = 5;

export function BotoesTab() {
  const qc = useQueryClient();
  const [itens, setItens] = useState<Botao[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<{ idx: number; item: Botao } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["linkbio-config"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("linkbio_get_config" as any);
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (!data) return;
    const lista = (Array.isArray(data) ? data[0]?.botoes ?? data : (data as any).botoes) ?? [];
    setItens(
      (lista as any[]).map((b, i) => ({
        id: b.id,
        label: b.label ?? "",
        url_destino: b.url_destino ?? "",
        utm_source: b.utm_source ?? "",
        utm_medium: b.utm_medium ?? "",
        utm_campaign: b.utm_campaign ?? "",
        icone: b.icone ?? "",
        cor_destaque: b.cor_destaque ?? "",
        destaque: !!b.destaque,
        ativo: b.ativo ?? true,
        ordem: b.ordem ?? i + 1,
      })).sort((a, b) => a.ordem - b.ordem),
    );
  }, [data]);

  const upd = (idx: number, patch: Partial<Botao>) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const toggleAtivo = (idx: number, valor: boolean) => {
    if (valor) {
      const ativos = itens.filter((it, i) => it.ativo && i !== idx).length;
      if (ativos >= MAX_ATIVOS) {
        toast.error(`Máximo de ${MAX_ATIVOS} botões ativos. Desative outro antes.`);
        return;
      }
    }
    upd(idx, { ativo: valor });
  };

  const onDrop = (destino: number) => {
    if (dragIdx === null || dragIdx === destino) return;
    setItens((prev) => {
      const copia = [...prev];
      const [mov] = copia.splice(dragIdx, 1);
      copia.splice(destino, 0, mov);
      return copia.map((it, i) => ({ ...it, ordem: i + 1 }));
    });
    setDragIdx(null);
  };

  const validar = (b: Botao) => {
    if (!b.label.trim()) return "Informe o texto do botão.";
    if (!b.url_destino.trim()) return "Informe a URL de destino.";
    return null;
  };

  const salvarTudo = async () => {
    for (const b of itens) {
      const erro = validar(b);
      if (erro) return toast.error(erro);
    }
    setSalvando(true);
    try {
      for (const [i, b] of itens.entries()) {
        const { error } = await supabase.rpc("linkbio_admin_upsert_botao" as any, {
          p_id: b.id ?? null,
          p_label: b.label,
          p_url_destino: b.url_destino,
          p_utm_source: b.utm_source || null,
          p_utm_medium: b.utm_medium || null,
          p_utm_campaign: b.utm_campaign || null,
          p_icone: b.icone || null,
          p_cor_destaque: b.cor_destaque || null,
          p_destaque: b.destaque,
          p_ativo: b.ativo,
          p_ordem: i + 1,
        });
        if (error) throw error;
      }
      toast.success("Botões salvos com sucesso.");
      qc.invalidateQueries({ queryKey: ["linkbio-config"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar botões.");
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    const { idx, item } = excluir;
    setExcluir(null);
    if (!item.id) {
      setItens((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    const { error } = await supabase.rpc("linkbio_admin_delete_botao" as any, { p_id: item.id });
    if (error) return toast.error(error.message);
    toast.success("Botão excluído.");
    qc.invalidateQueries({ queryKey: ["linkbio-config"] });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const ativos = itens.filter((i) => i.ativo).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {ativos} de {MAX_ATIVOS} botões ativos · arraste pelo ícone para reordenar
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setItens((prev) => [...prev, vazio(prev.length + 1)])}
          >
            <Plus className="h-4 w-4 mr-2" /> Adicionar novo botão
          </Button>
          <Button onClick={salvarTudo} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {itens.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum botão cadastrado ainda.
        </CardContent></Card>
      )}

      {itens.map((b, idx) => (
        <Card
          key={b.id ?? `novo-${idx}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(idx)}
          className={dragIdx === idx ? "opacity-60" : ""}
        >
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-start gap-3">
              <div
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragEnd={() => setDragIdx(null)}
                className="cursor-grab pt-2 text-muted-foreground"
                aria-label="Reordenar botão"
              >
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="grid flex-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Texto do botão *</Label>
                  <Input value={b.label} onChange={(e) => upd(idx, { label: e.target.value })} placeholder="Ex: Loja oficial" />
                </div>
                <div className="space-y-1.5">
                  <Label>URL de destino *</Label>
                  <Input value={b.url_destino} onChange={(e) => upd(idx, { url_destino: e.target.value })} placeholder="https://..." />
                </div>
                <div className="space-y-1.5">
                  <Label>utm_source</Label>
                  <Input value={b.utm_source} onChange={(e) => upd(idx, { utm_source: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>utm_medium</Label>
                  <Input value={b.utm_medium} onChange={(e) => upd(idx, { utm_medium: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>utm_campaign</Label>
                  <Input value={b.utm_campaign} onChange={(e) => upd(idx, { utm_campaign: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ícone (opcional)</Label>
                  <Input value={b.icone} onChange={(e) => upd(idx, { icone: e.target.value })} placeholder="Ex: shopping-bag" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cor do botão (opcional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      className="h-10 w-14 p-1"
                      value={b.cor_destaque || "#000000"}
                      onChange={(e) => upd(idx, { cor_destaque: e.target.value })}
                      aria-label="Selecionar cor do botão"
                    />
                    <Input
                      value={b.cor_destaque}
                      onChange={(e) => upd(idx, { cor_destaque: e.target.value })}
                      placeholder="#25D366"
                    />
                    {b.cor_destaque && (
                      <Button variant="ghost" size="sm" onClick={() => upd(idx, { cor_destaque: "" })}>
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pl-7">
              <div className="flex items-center gap-2">
                <Switch checked={b.ativo} onCheckedChange={(v) => toggleAtivo(idx, v)} id={`ativo-${idx}`} />
                <Label htmlFor={`ativo-${idx}`} className="cursor-pointer">Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={b.destaque} onCheckedChange={(v) => upd(idx, { destaque: v })} id={`destaque-${idx}`} />
                <Label htmlFor={`destaque-${idx}`} className="cursor-pointer flex items-center gap-1">
                  <Star className="h-3.5 w-3.5" /> Destaque
                </Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive"
                onClick={() => setExcluir({ idx, item: b })}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir botão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O botão deixará de aparecer na página pública.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
