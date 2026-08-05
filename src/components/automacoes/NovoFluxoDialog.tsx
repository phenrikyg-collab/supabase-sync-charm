import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { GATILHOS, SEGMENTOS_RFM } from "./tipos";

export function NovoFluxoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [gatilho, setGatilho] = useState("rfm_segmento");
  const [segmento, setSegmento] = useState(SEGMENTOS_RFM[0]);
  const [dias, setDias] = useState(30);
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    if (!nome.trim()) {
      toast({ title: "Informe o nome do fluxo", variant: "destructive" });
      return;
    }
    const config =
      gatilho === "rfm_segmento" ? { segmento } : gatilho === "dias_sem_comprar" ? { dias: Number(dias) } : {};
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc("automacoes_criar_fluxo" as any, {
        p_nome: nome.trim(),
        p_descricao: descricao.trim(),
        p_gatilho_tipo: gatilho,
        p_gatilho_config: config,
      });
      if (error) throw error;
      const id = typeof data === "object" && data !== null ? (data as any).id ?? (data as any).fluxo_id : data;
      onOpenChange(false);
      setNome("");
      setDescricao("");
      if (id) navigate(`/automacoes/${id}`);
    } catch (e: any) {
      toast({ title: "Erro ao criar fluxo", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo fluxo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Reativação Em Risco" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo de gatilho</Label>
            <Select value={gatilho} onValueChange={setGatilho}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GATILHOS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {gatilho === "rfm_segmento" && (
            <div className="space-y-1">
              <Label className="text-xs">Segmento</Label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTOS_RFM.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {gatilho === "dias_sem_comprar" && (
            <div className="space-y-1">
              <Label className="text-xs">Dias sem comprar</Label>
              <Input type="number" min={1} value={dias} onChange={(e) => setDias(Number(e.target.value))} />
            </div>
          )}

          {gatilho === "aniversario" && (
            <p className="text-xs text-muted-foreground">Dispara automaticamente no aniversário da cliente.</p>
          )}
          {gatilho === "manual" && (
            <p className="text-xs text-muted-foreground">
              Inicia apenas por chamada manual — não roda automaticamente.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? "Criando…" : "Criar fluxo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
