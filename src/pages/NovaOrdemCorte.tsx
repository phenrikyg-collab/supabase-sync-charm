import { useState, useMemo } from "react";
import { useProdutos, useRolosTecido, useTecidos, useCreateOrdemCorte, useOrdensCorte } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Search, X, Plus } from "lucide-react";

const TAMANHOS = ["PP", "P", "M", "G", "GG", "EG"];

interface ProdutoSelecionado {
  id: string;
  nome: string;
  consumo: number;
}

export default function NovaOrdemCorte() {
  const { data: produtos } = useProdutos();
  const { data: rolos } = useRolosTecido();
  const { data: tecidos } = useTecidos();
  const createMut = useCreateOrdemCorte();
  const navigate = useNavigate();

  const [produtosSelecionados, setProdutosSelecionados] = useState<ProdutoSelecionado[]>([]);
  const [searchProduto, setSearchProduto] = useState("");
  const [gradeMultiCor, setGradeMultiCor] = useState<Record<string, Record<string, number>>>({});
  const [selectedRolos, setSelectedRolos] = useState<Set<string>>(new Set());
  const [metrosRolo, setMetrosRolo] = useState<Record<string, number>>({});
  const [roloMode, setRoloMode] = useState<Record<string, "total" | "parcial">>({});
  const [metrosRisco, setMetrosRisco] = useState(0);
  const [folhas, setFolhas] = useState(1);
  const [searchRolo, setSearchRolo] = useState("");

  // Sequential OC number from MAX in DB
  const { data: ordensExistentes } = useOrdensCorte();
  const numeroOC = useMemo(() => {
    if (!ordensExistentes?.length) return "OC-0001";
    const nums = ordensExistentes.map((o) => {
      const match = o.numero_oc?.match(/OC-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const max = Math.max(...nums);
    return `OC-${String(max + 1).padStart(4, "0")}`;
  }, [ordensExistentes]);

  const tecidoMap = Object.fromEntries((tecidos ?? []).map((t) => [t.id, t]));

  // Filter products by search (exclude already selected)
  const produtosFiltrados = useMemo(() => {
    if (!produtos) return [];
    const selectedIds = new Set(produtosSelecionados.map((p) => p.id));
    const ativos = produtos.filter((p) => p.ativo && !selectedIds.has(p.id));
    if (!searchProduto) return ativos;
    const term = searchProduto.toLowerCase();
    return ativos.filter((p) =>
      p.nome_do_produto?.toLowerCase().includes(term) ||
      p.codigo_sku?.toLowerCase().includes(term)
    );
  }, [produtos, searchProduto, produtosSelecionados]);

  const addProduto = (produtoId: string) => {
    const p = produtos?.find((pr) => pr.id === produtoId);
    if (!p) return;
    setProdutosSelecionados((prev) => [
      ...prev,
      { id: p.id, nome: p.nome_do_produto, consumo: p.consumo_de_tecido ?? 0 },
    ]);
    setSearchProduto("");
  };

  const removeProduto = (produtoId: string) => {
    setProdutosSelecionados((prev) => prev.filter((p) => p.id !== produtoId));
  };

  // Derive unique colors from selected rolls with per-color meters
  const coresFromRolos = useMemo(() => {
    const map = new Map<string, { cor_id: string | null; cor_nome: string; cor_hex: string; metrosCor: number }>();
    for (const roloId of selectedRolos) {
      const rolo = rolos?.find((r) => r.id === roloId);
      if (rolo) {
        const key = rolo.cor_id ?? rolo.cor_nome ?? "sem-cor";
        const existing = map.get(key);
        const metrosRoloVal = metrosRolo[roloId] ?? 0;
        if (existing) {
          existing.metrosCor += metrosRoloVal;
        } else {
          map.set(key, { cor_id: rolo.cor_id ?? null, cor_nome: rolo.cor_nome ?? "Sem cor", cor_hex: rolo.cor_hex ?? "#ccc", metrosCor: metrosRoloVal });
        }
      }
    }
    return Array.from(map.entries());
  }, [selectedRolos, rolos, metrosRolo]);

  // Calculate folhas per color = metros da cor / metragem do risco
  const folhasPorCor = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [corKey, corInfo] of coresFromRolos) {
      result[corKey] = metrosRisco > 0 ? Math.floor(corInfo.metrosCor / metrosRisco) : 0;
    }
    return result;
  }, [coresFromRolos, metrosRisco]);

  const setGradeForCor = (corKey: string, tamanho: string, qty: number) => {
    setGradeMultiCor((prev) => ({
      ...prev,
      [corKey]: { ...(prev[corKey] ?? {}), [tamanho]: qty },
    }));
  };

  const totalPecas = Object.values(gradeMultiCor).reduce(
    (sum, grades) => sum + Object.values(grades).reduce((a, b) => a + (b || 0), 0), 0
  );

  // Average consumption across selected products (same fabric/risco shared)
  const consumoMedio = produtosSelecionados.length > 0
    ? produtosSelecionados.reduce((sum, p) => sum + p.consumo, 0) / produtosSelecionados.length
    : 0;
  const consumoTotal = totalPecas * consumoMedio;
  const metrosAlocados = Array.from(selectedRolos).reduce((a, id) => a + (metrosRolo[id] ?? 0), 0);
  const estoqueInsuficiente = consumoTotal > 0 && metrosAlocados < consumoTotal;

  // Filter available rolos
  const rolosDisponiveis = useMemo(() => {
    return (rolos?.filter((r) => (r.metragem_disponivel ?? 0) > 0) ?? []).filter((r) => {
      if (!searchRolo) return true;
      const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
      const text = `${r.codigo_rolo} ${tecido?.nome_tecido} ${r.cor_nome} ${r.lote}`.toLowerCase();
      return text.includes(searchRolo.toLowerCase());
    });
  }, [rolos, searchRolo, tecidoMap]);

  const toggleRolo = (roloId: string) => {
    const newSet = new Set(selectedRolos);
    const rolo = rolos?.find((r) => r.id === roloId);
    if (newSet.has(roloId)) {
      newSet.delete(roloId);
      const newMetros = { ...metrosRolo };
      delete newMetros[roloId];
      setMetrosRolo(newMetros);
      const newMode = { ...roloMode };
      delete newMode[roloId];
      setRoloMode(newMode);
    } else {
      newSet.add(roloId);
      setRoloMode({ ...roloMode, [roloId]: "total" });
      setMetrosRolo({ ...metrosRolo, [roloId]: rolo?.metragem_disponivel ?? 0 });
    }
    setSelectedRolos(newSet);
  };

  const handleRoloModeChange = (roloId: string, mode: "total" | "parcial") => {
    const rolo = rolos?.find((r) => r.id === roloId);
    setRoloMode({ ...roloMode, [roloId]: mode });
    if (mode === "total") {
      setMetrosRolo({ ...metrosRolo, [roloId]: rolo?.metragem_disponivel ?? 0 });
    } else {
      setMetrosRolo({ ...metrosRolo, [roloId]: 0 });
    }
  };

  const handleSubmit = async () => {
    if (produtosSelecionados.length === 0) { toast.error("Selecione ao menos um produto"); return; }
    if (selectedRolos.size === 0) { toast.error("Selecione ao menos um rolo"); return; }
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
        produtos: produtosSelecionados.map((p) => ({ produto_id: p.id, nome_produto: p.nome })),
        grade: gradeItems,
        rolos: rolosItems,
      });
      toast.success(`Ordem de corte criada com ${produtosSelecionados.length} produto(s)!`);
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
              <Label>Total de Folhas (calculado)</Label>
              <Input value={Object.values(folhasPorCor).reduce((a, b) => a + b, 0)} readOnly className="bg-muted" />
            </div>
          </div>

          {/* Multiple product selection */}
          <div className="space-y-3">
            <Label>Produtos ({produtosSelecionados.length} selecionado{produtosSelecionados.length !== 1 ? "s" : ""})</Label>
            
            {/* Selected products chips */}
            {produtosSelecionados.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {produtosSelecionados.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 text-sm">
                    <span className="font-medium text-foreground">{p.nome}</span>
                    <span className="text-xs text-muted-foreground">({p.consumo}m/pç)</span>
                    <button onClick={() => removeProduto(p.id)} className="ml-1 text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Product search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto por nome ou SKU para adicionar..."
                value={searchProduto}
                onChange={(e) => setSearchProduto(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchProduto && produtosFiltrados.length > 0 && (
              <div className="border border-border rounded-lg max-h-48 overflow-y-auto bg-popover shadow-md">
                {produtosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-accent text-sm flex items-center justify-between"
                    onClick={() => addProduto(p.id)}
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-popover-foreground">{p.nome_do_produto}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      {p.consumo_de_tecido != null && (
                        <span className="text-muted-foreground text-xs">{p.consumo_de_tecido}m/pç</span>
                      )}
                      {p.codigo_sku && <span className="text-muted-foreground text-xs">{p.codigo_sku}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {searchProduto && produtosFiltrados.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">Nenhum produto encontrado</p>
            )}
          </div>

          {/* Rolos selection with total/parcial mode */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Rolos Disponíveis</Label>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar rolo..." value={searchRolo} onChange={(e) => setSearchRolo(e.target.value)} className="w-56" />
              </div>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {rolosDisponiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum rolo disponível</p>
              ) : (
                rolosDisponiveis.map((r) => {
                  const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
                  const isSelected = selectedRolos.has(r.id);
                  const mode = roloMode[r.id] ?? "total";
                  return (
                    <div key={r.id} className="p-3 rounded-lg border border-border space-y-2">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleRolo(r.id)} />
                        <div className="flex-1 flex items-center gap-2 text-sm">
                          {r.cor_hex && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.cor_hex }} />}
                          <span className="text-primary font-medium">{r.codigo_rolo}</span>
                          <span className="text-muted-foreground">{tecido?.nome_tecido ?? ""}</span>
                          <span className="text-muted-foreground">{r.cor_nome ?? ""}</span>
                          <span className="text-muted-foreground">({(r.metragem_disponivel ?? 0).toFixed(1)}m disp.)</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="ml-8 flex items-center gap-4">
                          <RadioGroup
                            value={mode}
                            onValueChange={(v) => handleRoloModeChange(r.id, v as "total" | "parcial")}
                            className="flex gap-4"
                          >
                            <div className="flex items-center gap-1.5">
                              <RadioGroupItem value="total" id={`total-${r.id}`} />
                              <Label htmlFor={`total-${r.id}`} className="text-xs cursor-pointer">Toda metragem</Label>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <RadioGroupItem value="parcial" id={`parcial-${r.id}`} />
                              <Label htmlFor={`parcial-${r.id}`} className="text-xs cursor-pointer">Parcial</Label>
                            </div>
                          </RadioGroup>
                          {mode === "parcial" && (
                            <Input
                              type="number" step="0.01" className="w-28"
                              placeholder="Metros"
                              max={r.metragem_disponivel ?? 0}
                              value={metrosRolo[r.id] ?? ""}
                              onChange={(e) => setMetrosRolo({ ...metrosRolo, [r.id]: Number(e.target.value) })}
                            />
                          )}
                          <span className="text-xs text-muted-foreground">
                            Usar: {(metrosRolo[r.id] ?? 0).toFixed(1)}m
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Grade per color */}
          {coresFromRolos.length > 0 && (
            <div className="space-y-4">
              <Label>Grade de Tamanhos por Cor</Label>
              {coresFromRolos.map(([corKey, corInfo]) => (
                <div key={corKey} className="p-4 rounded-lg border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: corInfo.cor_hex }} />
                      <span className="font-medium text-sm text-foreground">{corInfo.cor_nome}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{corInfo.metrosCor.toFixed(1)}m alocados</span>
                      <span className="font-medium text-primary">{folhasPorCor[corKey] ?? 0} folha(s)</span>
                    </div>
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
              <p className="text-xs text-muted-foreground">Consumo Total (estimado)</p>
              <p className="text-xl font-serif font-bold text-foreground">{consumoTotal.toFixed(2)}m</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Metros Alocados</p>
              <p className={`text-xl font-serif font-bold ${estoqueInsuficiente ? "text-destructive" : "text-foreground"}`}>
                {metrosAlocados.toFixed(2)}m
              </p>
            </div>
          </div>

          {produtosSelecionados.length > 1 && (
            <div className="p-3 bg-accent/50 border border-accent rounded-lg text-sm text-muted-foreground">
              <strong className="text-foreground">Múltiplos produtos:</strong> Esta OC gerará {produtosSelecionados.length} ordens de produção separadas ao avançar para produção.
            </div>
          )}

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
