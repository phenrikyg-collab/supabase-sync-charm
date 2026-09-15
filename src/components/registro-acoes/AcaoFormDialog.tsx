import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { acoesSalvar, type AcoesOpcoes } from "@/lib/registroAcoes";

const SEM_DRIVER = "__sem_driver__";

type Props = {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  opcoes: AcoesOpcoes;
  acao?: any | null;
  onSalvo?: () => void;
};

export default function AcaoFormDialog({ aberto, onOpenChange, opcoes, acao, onSalvo }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!aberto) return;
    setForm({
      id: acao?.id ?? undefined,
      data_inicio: String(acao?.data_inicio ?? acao?.data ?? "").slice(0, 10),
      data_fim: String(acao?.data_fim ?? "").slice(0, 10),
      titulo: acao?.titulo ?? "",
      descricao: acao?.descricao ?? "",
      tipo: acao?.tipo ?? "",
      canais: Array.isArray(acao?.canais) ? acao.canais : [],
      driver_alvo: acao?.driver_alvo ?? "",
      drivers_secundarios: Array.isArray(acao?.drivers_secundarios) ? acao.drivers_secundarios : [],
      publico: acao?.publico ?? "",
      produto_foco: acao?.produto_foco ?? "",
      hipotese: acao?.hipotese ?? "",
      custo: acao?.custo ?? "",
      status: acao?.status ?? "executada",
      referencia: acao?.referencia ?? "",
    });
  }, [aberto, acao]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const alternar = (campo: "canais" | "drivers_secundarios", valor: string) =>
    setForm((f: any) => {
      const atual: string[] = Array.isArray(f[campo]) ? f[campo] : [];
      return {
        ...f,
        [campo]: atual.includes(valor) ? atual.filter((x) => x !== valor) : [...atual, valor],
      };
    });

  const salvar = useMutation({
    mutationFn: async () => {
      const p: Record<string, any> = {
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        titulo: String(form.titulo || "").slice(0, 90),
        descricao: form.descricao || null,
        tipo: form.tipo,
        canais: form.canais ?? [],
        driver_alvo: form.driver_alvo === SEM_DRIVER ? "" : form.driver_alvo || "",
        drivers_secundarios: form.drivers_secundarios ?? [],
        publico: form.publico || null,
        produto_foco: form.produto_foco || null,
        hipotese: form.hipotese || null,
        custo: form.custo === "" || form.custo === null ? null : Number(form.custo),
        status: form.status || "executada",
        referencia: form.referencia || null,
      };
      if (form.id) p.id = form.id;
      return acoesSalvar(p);
    },
    onSuccess: () => {
      toast({ title: form.id ? "Ação atualizada" : "Ação registrada" });
      qc.invalidateQueries({ queryKey: ["acoes"] });
      onOpenChange(false);
      onSalvo?.();
    },
    onError: (e: any) =>
      toast({ title: "Não deu para salvar", description: e.message, variant: "destructive" }),
  });

  const podeSalvar = !!form.data_inicio && !!String(form.titulo || "").trim() && !!form.tipo;

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">{form.id ? "Editar ação" : "Nova ação"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de início</Label>
              <Input
                type="date"
                value={form.data_inicio || ""}
                onChange={(e) => set("data_inicio", e.target.value)}
              />
            </div>
            <div>
              <Label>Data de fim</Label>
              <Input
                type="date"
                value={form.data_fim || ""}
                onChange={(e) => set("data_fim", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Título</Label>
            <Input
              maxLength={90}
              value={form.titulo || ""}
              onChange={(e) => set("titulo", e.target.value)}
              placeholder="O que foi feito"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {String(form.titulo || "").length} de 90 caracteres
            </p>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={form.descricao || ""}
              onChange={(e) => set("descricao", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo || ""} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue placeholder="Escolha o tipo" /></SelectTrigger>
                <SelectContent>
                  {opcoes.tipos.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status || "executada"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(opcoes.status.length ? opcoes.status : [{ valor: "executada", rotulo: "Executada" }]).map((s) => (
                    <SelectItem key={s.valor} value={s.valor}>{s.rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Canais</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {opcoes.canais.map((c) => (
                <label key={c.valor} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={(form.canais ?? []).includes(c.valor)}
                    onCheckedChange={() => alternar("canais", c.valor)}
                  />
                  {c.rotulo}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Driver alvo</Label>
            <Select
              value={form.driver_alvo ? form.driver_alvo : SEM_DRIVER}
              onValueChange={(v) => set("driver_alvo", v === SEM_DRIVER ? "" : v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {opcoes.drivers.map((d) => (
                  <SelectItem key={d.valor} value={d.valor}>{d.rotulo}</SelectItem>
                ))}
                <SelectItem value={SEM_DRIVER}>Sem driver</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Escolha o driver que a ação existe para mover. É por ele que a ação será lida.
            </p>
          </div>

          <div>
            <Label>Drivers secundários</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {opcoes.drivers.map((d) => (
                <label key={d.valor} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={(form.drivers_secundarios ?? []).includes(d.valor)}
                    onCheckedChange={() => alternar("drivers_secundarios", d.valor)}
                  />
                  {d.rotulo}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Público</Label>
              <Input value={form.publico || ""} onChange={(e) => set("publico", e.target.value)} />
            </div>
            <div>
              <Label>Produto foco</Label>
              <Input value={form.produto_foco || ""} onChange={(e) => set("produto_foco", e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Hipótese</Label>
            <Textarea
              rows={2}
              placeholder="Esperamos mover X porque Y"
              value={form.hipotese || ""}
              onChange={(e) => set("hipotese", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Custo</Label>
              <Input
                type="number"
                step="0.01"
                value={form.custo ?? ""}
                onChange={(e) => set("custo", e.target.value)}
              />
            </div>
            <div>
              <Label>Referência</Label>
              <Input value={form.referencia || ""} onChange={(e) => set("referencia", e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!podeSalvar || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
