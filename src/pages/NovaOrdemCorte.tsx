import { useState } from "react";
import { useProdutos, useRolosTecido, useTecidos, useCreateOrdemCorte, useOrdensCorte } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Search } from "lucide-react";

const TAMANHOS = ["PP", "P", "M", "G", "GG", "EG"];

export default function NovaOrdemCorte() {
  const { data: produtos } = useProdutos();
  const { data: rolos } = useRolosTecido();
  const { data: tecidos } = useTecidos();
  const createMut = useCreateOrdemCorte();
  const navigate = useNavigate();

  const [produtoId, setProdutoId] = useState("");
  // Grade now supports multiple colors: { [corKey]: { tamanho: qty } }
  const [gradeMultiCor, setGradeMultiCor] = useState<Record<string, Record<string, number>>>({});
  const [selectedRolos, setSelectedRolos] = useState<Set<string>>(new Set());
  const [metrosRolo, setMetrosRolo] = useState<Record<string, number>>({});
  const [metrosRisco, setMetrosRisco] = useState(0);
  const [folhas, setFolhas] = useState(1);
  const [searchRolo, setSearchRolo] = useState("");

  // Auto-generate OC number
  const { data: ordensExistentes } = useOrdensCorte();
  const numeroOC = `OC-${String((ordensExistentes?.length ?? 0) + 1).padStart(4, "0")}`;

  const produtoSelecionado = produtos?.find((p) => p.id === produtoId);
  const tecidoMap = Object.fromEntries((tecidos ?? []).map((t) => [t.id, t]));

  // Derive unique colors from selected rolls
  const coresFromRolos = (() => {
    const map = new Map<string, { cor_id: string | null; cor_nome: string; cor_hex: string }>();
    for (const roloId of selectedRolos) {
      const rolo = rolos?.find((r) => r.id === roloId);
      if (rolo) {
        const key = rolo.cor_id ?? rolo.cor_nome ?? "sem-cor";
        if (!map.has(key)) {
          map.set(key, { cor_id: rolo.cor_id ?? null, cor_nome: rolo.cor_nome ?? "Sem cor", cor_hex: rolo.cor_hex ?? "#ccc" });
        }
      }
    }
    return Array.from(map.entries());
  })();

  // Update grade for a specific color
  const setGradeForCor = (corKey: string, tamanho: string, qty: number) => {
    setGradeMultiCor((prev) => ({
      ...prev,
      [corKey]: { ...(prev[corKey] ?? {}), [tamanho]: qty },
    }));
  };

  const totalPecas = Object.values(gradeMultiCor).reduce(
    (sum, grades) => sum + Object.values(grades).reduce((a, b) => a + (b || 0), 0), 0
  );
  const consumoUnitario = produtoSelecionado?.consumo_de_tecido ?? 0;
  const consumoTotal = totalPecas * consumoUnitario;
  const metrosAlocados = Array.from(selectedRolos).reduce((a, id) => a + (metrosRolo[id] ?? 0), 0);
  const estoqueInsuficiente = consumoTotal > 0 && metrosAlocados < consumoTotal;

  // Filter available rolos
  const rolosDisponiveis = (rolos?.filter((r) => (r.metragem_disponivel ?? 0) > 0) ?? []).filter((r) => {
    if (!searchRolo) return true;
    const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
    const text = `${r.codigo_rolo} ${tecido?.nome_tecido} ${r.cor_nome} ${r.lote}`.toLowerCase();
    return text.includes(searchRolo.toLowerCase());
  });

  const toggleRolo = (roloId: string) => {
    const newSet = new Set(selectedRolos);
    if (newSet.has(roloId)) newSet.delete(roloId);
    else newSet.add(roloId);
    setSelectedRolos(newSet);
  };

  const handleSubmit = async () => {
    if (!produtoId) { toast.error("Selecione um produto"); return; }
    if (estoqueInsuficiente) { toast.error("Metragem alocada insuficiente para o consumo total"); return; }
    for (const roloId of selectedRolos) {
      const rolo = rolos?.find((r) => r.id === roloId);
      const alocado = metrosRolo[roloId] ?? 0;
      if (rolo && alocado > (rolo.metragem_disponivel ?? 0)) {
        toast.error(`Metragem alocada do rolo ${rolo.codigo_rolo} excede a disponível`);
        return;
      }
    }

    try {
      // Build grade items from all colors
      const gradeItems: { cor_id: string | null; tamanho: string; quantidade: number }[] = [];
      for (const [corKey, grades] of Object.entries(gradeMultiCor)) {
        const corInfo = coresFromRolos.find(([k]) => k === corKey);
        const corId = corInfo?.[1]?.cor_id ?? null;
        for (const [tamanho, quantidade] of Object.entries(grades)) {
          if (quantidade > 0) gradeItems.push({ cor_id: corId, tamanho, quantidade });
        }
      }

      const rolosItems = Array.from(selectedRolos).map((rolo_id) => ({
        rolo_id,
        metragem_utilizada: metrosRolo[rolo_id] ?? 0,
      }));

      const allTamanhos = [...new Set(gradeItems.map((g) => g.tamanho))];

      await createMut.mutateAsync({
        ordem: {
          numero_oc: numeroOC,
          grade_tamanhos: allTamanhos,
          metragem_risco: metrosRisco,
          quantidade_folhas: folhas,
          status: "Planejada",
        },
        produtos: [{ produto_id: produtoId, nome_produto: produtoSelecionado?.nome_do_produto ?? "" }],
        grade: gradeItems,
        rolos: rolosItems,
      });
      toast.success("Ordem de corte criada com baixa automática de estoque!");
      navigate("/ordens-corte");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold text-foreground">
        Nova <span className="text-primary">Ordem de Corte</span>
      </h1>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Número da OC</Label>
              <Input value={numeroOC} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Metros do Risco</Label>
              <Input type="number" step="0.01" value={metrosRisco} onChange={(e) => setMetrosRisco(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Quantidade de Folhas</Label>
              <Input type="number" value={folhas} onChange={(e) => setFolhas(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Produto</Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {produtos?.filter((p) => p.ativo).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome_do_produto}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {produtoSelecionado && (
              <p className="text-xs text-muted-foreground">Consumo: {consumoUnitario}m/peça · Tecido: {produtoSelecionado.tecido_do_produto ?? "—"}</p>
            )}
          </div>

          {/* Rolos selection - colors are determined by selected rolls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Rolos Disponíveis</Label>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar rolo..." value={searchRolo} onChange={(e) => setSearchRolo(e.target.value)} className="w-56" />
              </div>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {rolosDisponiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum rolo disponível</p>
              ) : (
                rolosDisponiveis.map((r) => {
                  const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                      <Checkbox checked={selectedRolos.has(r.id)} onCheckedChange={() => toggleRolo(r.id)} />
                      <div className="flex-1 flex items-center gap-2 text-sm">
                        {r.cor_hex && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.cor_hex }} />}
                        <span className="text-primary font-medium">{r.codigo_rolo}</span>
                        <span className="text-muted-foreground">{tecido?.nome_tecido ?? ""}</span>
                        <span className="text-muted-foreground">{r.cor_nome ?? ""}</span>
                        <span className="text-muted-foreground">({(r.metragem_disponivel ?? 0).toFixed(1)}m)</span>
                      </div>
                      {selectedRolos.has(r.id) && (
                        <Input
                          type="number" step="0.01" className="w-24"
                          placeholder="Metros"
                          max={r.metragem_disponivel ?? 0}
                          value={metrosRolo[r.id] ?? ""}
                          onChange={(e) => setMetrosRolo({ ...metrosRolo, [r.id]: Number(e.target.value) })}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Grade per color - colors come from selected rolls */}
          {coresFromRolos.length > 0 && (
            <div className="space-y-4">
              <Label>Grade de Tamanhos por Cor</Label>
              {coresFromRolos.map(([corKey, corInfo]) => (
                <div key={corKey} className="p-4 rounded-lg border border-border space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: corInfo.cor_hex }} />
                    <span className="font-medium text-sm text-foreground">{corInfo.cor_nome}</span>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {TAMANHOS.map((t) => (
                      <div key={t} className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">{t}</span>
                        <Input
                          type="number" min={0}
                          value={gradeMultiCor[corKey]?.[t] ?? ""}
                          onChange={(e) => setGradeForCor(corKey, t, Number(e.target.value))}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 rounded-lg bg-muted/50 border border-border grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total de Peças</p>
              <p className="text-xl font-serif font-bold text-foreground">{totalPecas}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Consumo Total</p>
              <p className="text-xl font-serif font-bold text-foreground">{consumoTotal.toFixed(2)}m</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Metros Alocados</p>
              <p className={`text-xl font-serif font-bold ${estoqueInsuficiente ? "text-destructive" : "text-foreground"}`}>
                {metrosAlocados.toFixed(2)}m
              </p>
            </div>
          </div>

          {estoqueInsuficiente && consumoTotal > 0 && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Metragem alocada ({metrosAlocados.toFixed(2)}m) é menor que o consumo necessário ({consumoTotal.toFixed(2)}m)
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate("/ordens-corte")}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending}>Criar Ordem de Corte</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
