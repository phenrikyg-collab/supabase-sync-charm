import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Scissors } from "lucide-react";
import { useRolosTecido, useTecidos } from "@/hooks/useSupabase";
import { chamarRpc } from "@/lib/supabaseRpc";
import { rpcAusente, somaMetragem } from "@/lib/oficinaFluxo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/** Etapa 2: informa folhas e rolos usados; a RPC multiplica a grade, abate tecido e gera as OPs. */
export function CortarOrdemCorte({ ordemCorteId, pecasPorFolha }: { ordemCorteId: string; pecasPorFolha: number }) {
  const { data: rolos } = useRolosTecido();
  const { data: tecidos } = useTecidos();
  const qc = useQueryClient();
  const [folhas, setFolhas] = useState(0);
  const [busca, setBusca] = useState("");
  const [metros, setMetros] = useState<Record<string, number>>({});
  const [modo, setModo] = useState<Record<string, "total" | "parcial">>({});
  const [salvando, setSalvando] = useState(false);

  const tecidoMap = useMemo(() => Object.fromEntries((tecidos ?? []).map((t) => [t.id, t])), [tecidos]);
  const disponiveis = useMemo(() => (rolos ?? []).filter((r) => {
    if ((r.metragem_disponivel ?? 0) <= 0) return false;
    if (!busca) return true;
    const t = r.tecido_id ? tecidoMap[r.tecido_id] : null;
    return `${r.codigo_rolo} ${r.lote} ${t?.nome_tecido} ${r.cor_nome}`.toLowerCase().includes(busca.toLowerCase());
  }), [rolos, busca, tecidoMap]);

  const selecionados = Object.keys(metros);
  const itens = selecionados.map((rolo_id) => ({ rolo_id, metragem_utilizada: metros[rolo_id] ?? 0 }));
  const totalMetros = somaMetragem(itens);

  const alternar = (id: string, disp: number) => {
    setMetros((m) => { const n = { ...m }; if (id in n) delete n[id]; else n[id] = disp; return n; });
    setModo((m) => ({ ...m, [id]: "total" }));
  };

  const cortar = async () => {
    if (folhas <= 0) { toast.error("Informe a quantidade de folhas"); return; }
    if (!itens.length) { toast.error("Selecione ao menos um rolo"); return; }
    for (const it of itens) {
      const r = rolos?.find((x) => x.id === it.rolo_id);
      if (it.metragem_utilizada <= 0) { toast.error(`Informe os metros do rolo ${r?.codigo_rolo ?? ""}`); return; }
      if (r && it.metragem_utilizada > (r.metragem_disponivel ?? 0)) { toast.error(`O rolo ${r.codigo_rolo} não tem metragem suficiente`); return; }
    }
    setSalvando(true);
    try {
      const { data, error } = await chamarRpc("cortar_ordem_corte", { p: { ordem_corte_id: ordemCorteId, quantidade_folhas: folhas, rolos: itens } });
      if (error) {
        if (rpcAusente(error)) { toast.error("O corte em duas etapas ainda não foi ativado no banco."); return; }
        if (/ordem_ja_cortada/.test(error.message ?? "")) { toast.error("Esta ordem já foi cortada."); qc.invalidateQueries({ queryKey: ["oc-detalhe", ordemCorteId] }); return; }
        throw error;
      }
      toast.success(`Corte registrado, ${data?.ops_criadas ?? 0} ordem(ns) de produção gerada(s)`);
      for (const k of [["oc-detalhe", ordemCorteId], ["ordens-corte"], ["ordens-producao"], ["rolos-tecido"]]) qc.invalidateQueries({ queryKey: k });
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string };
      toast.error([err?.message, err?.details].filter(Boolean).join(" | ") || "Erro ao registrar o corte");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="sem-impressao space-y-4 rounded-md border border-primary/30 bg-primary/5 p-3">
      <h2 className="flex items-center gap-2 font-semibold text-foreground"><Scissors className="h-4 w-4" />Cortar</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Folhas cortadas</Label>
          <Input type="number" min={0} inputMode="numeric" value={folhas || ""} placeholder="0" onChange={(e) => setFolhas(Math.max(0, Math.floor(Number(e.target.value))))} />
        </div>
        <div className="space-y-1">
          <Label>Peças cortadas</Label>
          <Input readOnly className="bg-muted" value={pecasPorFolha * folhas} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Rolos usados</Label>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Código ou lote do rolo" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {disponiveis.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhum rolo disponível</p>
          ) : disponiveis.map((r) => {
            const disp = r.metragem_disponivel ?? 0;
            const sel = r.id in metros;
            const m = modo[r.id] ?? "total";
            return (
              <div key={r.id} className="space-y-2 rounded-lg border border-border bg-background p-3">
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <Checkbox checked={sel} onCheckedChange={() => alternar(r.id, disp)} />
                  {r.cor_hex && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: r.cor_hex }} />}
                  <span className="font-medium text-primary">{r.codigo_rolo ?? "-"}</span>
                  <span className="min-w-0 truncate text-muted-foreground">{[r.tecido_id ? tecidoMap[r.tecido_id]?.nome_tecido : null, r.cor_nome, r.lote ? `lote ${r.lote}` : null].filter(Boolean).join(" · ")}</span>
                  <span className="ml-auto shrink-0 text-muted-foreground">{disp.toFixed(1)} m disp.</span>
                </label>
                {sel && (
                  <div className="ml-8 flex flex-wrap items-center gap-4">
                    <RadioGroup value={m} onValueChange={(v) => { setModo({ ...modo, [r.id]: v as "total" | "parcial" }); setMetros({ ...metros, [r.id]: v === "total" ? disp : 0 }); }} className="flex gap-4">
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="total" id={`t-${r.id}`} /><Label htmlFor={`t-${r.id}`} className="cursor-pointer text-xs">Toda metragem</Label></div>
                      <div className="flex items-center gap-1.5"><RadioGroupItem value="parcial" id={`p-${r.id}`} /><Label htmlFor={`p-${r.id}`} className="cursor-pointer text-xs">Parcial</Label></div>
                    </RadioGroup>
                    {m === "parcial" && (
                      <Input type="number" step="0.01" inputMode="decimal" className="w-28" placeholder="Metros" max={disp}
                        value={metros[r.id] || ""} onChange={(e) => setMetros({ ...metros, [r.id]: Number(e.target.value) })} />
                    )}
                    <span className="text-xs text-muted-foreground">Usar: {(metros[r.id] ?? 0).toFixed(1)} m</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Tecido: <strong className="text-foreground">{totalMetros.toFixed(2)} m</strong> em {itens.length} rolo(s)</span>
        <Button onClick={cortar} disabled={salvando}>{salvando ? "Registrando..." : "Confirmar corte"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">Ao confirmar, o tecido é abatido dos rolos, a ordem passa para Cortada e as ordens de produção são geradas.</p>
    </div>
  );
}
