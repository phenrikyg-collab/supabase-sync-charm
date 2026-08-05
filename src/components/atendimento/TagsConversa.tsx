import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Plus, Tag as TagIcon } from "lucide-react";

export type Tag = { id: number | string; nome: string; cor?: string | null };

const CORES = ["#E8CD7E", "#8B6914", "#1D1D1B", "#4F9D69", "#D96C4A", "#4A7FD9", "#9B5DE5"];

export function TagChip({ tag, className }: { tag: Tag; className?: string }) {
  const cor = tag.cor || "#8B6914";
  return (
    <span
      className={"inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium " + (className ?? "")}
      style={{ borderColor: cor, color: cor, backgroundColor: `${cor}1A` }}
    >
      {tag.nome}
    </span>
  );
}

export function TagsConversa({
  conversaId,
  aplicadas,
}: {
  conversaId: number | string;
  aplicadas: Tag[];
}) {
  const queryClient = useQueryClient();
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(CORES[0]);
  const [criando, setCriando] = useState(false);

  const { data: tags = [] } = useQuery({
    queryKey: ["whatsapp-tags"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_listar_tags" as any);
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
  });

  const aplicadasIds = new Set(aplicadas.map((t) => String(t.id)));

  const toggle = async (tag: Tag, adicionar: boolean) => {
    const { error } = await supabase.rpc("whatsapp_toggle_tag_conversa" as any, {
      p_conversa_id: Number.isNaN(Number(conversaId)) ? conversaId : Number(conversaId),
      p_tag_id: Number.isNaN(Number(tag.id)) ? tag.id : Number(tag.id),
      p_adicionar: adicionar,
    });
    if (error) {
      toast({ title: "Erro ao atualizar tag", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
  };

  const criarTag = async () => {
    if (!novoNome.trim()) return;
    setCriando(true);
    const { error } = await supabase.rpc("whatsapp_criar_tag" as any, {
      p_nome: novoNome.trim(),
      p_cor: novaCor,
    });
    setCriando(false);
    if (error) {
      toast({ title: "Erro ao criar tag", description: error.message, variant: "destructive" });
      return;
    }
    setNovoNome("");
    queryClient.invalidateQueries({ queryKey: ["whatsapp-tags"] });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {aplicadas.map((t) => (
        <TagChip key={String(t.id)} tag={t} />
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]">
            <TagIcon className="h-3 w-3 mr-1" />
            Tags
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3" align="start">
          <div className="space-y-2 max-h-52 overflow-auto">
            {tags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag cadastrada.</p>}
            {tags.map((t) => (
              <label key={String(t.id)} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={aplicadasIds.has(String(t.id))}
                  onCheckedChange={(v) => toggle(t, !!v)}
                />
                <TagChip tag={t} />
              </label>
            ))}
          </div>
          <div className="border-t border-border pt-2 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Nova tag</p>
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome da tag"
              className="h-8 text-xs"
            />
            <div className="flex items-center gap-1.5">
              {CORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNovaCor(c)}
                  className={"h-5 w-5 rounded-full border-2 " + (novaCor === c ? "border-foreground" : "border-transparent")}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
            <Button size="sm" className="w-full h-8" onClick={criarTag} disabled={criando || !novoNome.trim()}>
              <Plus className="h-3 w-3 mr-1" />
              Criar tag
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
