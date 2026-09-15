import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { rpcFluxos, useCatalogoFluxos } from "./api";

export function NovoFluxoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { data: catalogo } = useCatalogoFluxos();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [gatilho, setGatilho] = useState<string>("");

  const criar = useMutation({
    mutationFn: async () =>
      rpcFluxos<{ id: number | string }>("fluxo_criar", {
        p_nome: nome.trim(),
        p_gatilho_tipo: gatilho,
        p_descricao: descricao.trim(),
      }),
    onSuccess: (d) => {
      onOpenChange(false);
      setNome(""); setDescricao(""); setGatilho("");
      navigate(`/automacoes/${d?.id}`);
    },
    onError: (e: any) => toast({ title: "Não deu para criar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo fluxo</DialogTitle>
          <DialogDescription>Escolha o nome e o que faz a cliente entrar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Boas-vindas de lead novo" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Gatilho</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(catalogo?.gatilhos ?? []).map((g) => (
                <button
                  key={g.tipo}
                  type="button"
                  onClick={() => setGatilho(g.tipo)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
                    gatilho === g.tipo ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <p className="text-sm font-medium">{g.rotulo}</p>
                  {g.descricao && <p className="text-[11px] text-muted-foreground">{g.descricao}</p>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!nome.trim() || !gatilho || criar.isPending} onClick={() => criar.mutate()}>
            Criar fluxo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
