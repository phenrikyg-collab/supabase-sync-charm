import { useState } from "react";
import { useProdutos, useCores, useRolosTecido, useCreateOrdemCorte } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const TAMANHOS = ["PP", "P", "M", "G", "GG", "XGG"];

export default function NovaOrdemCorte() {
  const { data: produtos } = useProdutos();
  const { data: cores } = useCores();
  const { data: rolos } = useRolosTecido();
  const createMut = useCreateOrdemCorte();
  const navigate = useNavigate();

  const [produtoId, setProdutoId] = useState("");
  const [corId, setCorId] = useState("");
  const [grade, setGrade] = useState<Record<string, number>>({});
  const [selectedRolos, setSelectedRolos] = useState<Set<string>>(new Set());
  const [metrosRolo, setMetrosRolo] = useState<Record<string, number>>({});
  const [numeroOC, setNumeroOC] = useState("");
  const [metrosRisco, setMetrosRisco] = useState(0);
  const [folhas, setFolhas] = useState(1);

  const produtoSelecionado = produtos?.find((p) => p.id === produtoId);
  const rolosDisponiveis = rolos?.filter((r) => (r.metragem_disponivel ?? 0) > 0) ?? [];

  const totalPecas = Object.values(grade).reduce((a, b) => a + (b || 0), 0);
  const consumoUnitario = produtoSelecionado?.consumo_de_tecido ?? 0;
  const consumoTotal = totalPecas * consumoUnitario;

  const toggleRolo = (roloId: string) => {
    const newSet = new Set(selectedRolos);
    if (newSet.has(roloId)) newSet.delete(roloId);
    else newSet.add(roloId);
    setSelectedRolos(newSet);
  };

  const handleSubmit = async () => {
    if (!numeroOC || !produtoId) {
      toast.error("Preencha o número da OC e selecione um produto");
      return;
    }
    try {
      const gradeItems = Object.entries(grade)
        .filter(([, qty]) => qty > 0)
        .map(([tamanho, quantidade]) => ({ cor_id: corId || null, tamanho, quantidade }));

      const rolosItems = Array.from(selectedRolos).map((rolo_id) => ({
        rolo_id,
        metragem_utilizada: metrosRolo[rolo_id] ?? 0,
      }));

      await createMut.mutateAsync({
        ordem: {
          numero_oc: numeroOC,
          grade_tamanhos: Object.keys(grade).filter((t) => (grade[t] ?? 0) > 0),
          metragem_risco: metrosRisco,
          quantidade_folhas: folhas,
          status: "Planejada",
        },
        produtos: [{ produto_id: produtoId, nome_produto: produtoSelecionado?.nome_do_produto ?? "" }],
        grade: gradeItems,
        rolos: rolosItems,
      });
      toast.success("Ordem de corte criada!");
      navigate("/ordens-corte");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold text-foreground">Nova Ordem de Corte</h1>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Número da OC</Label>
              <Input value={numeroOC} onChange={(e) => setNumeroOC(e.target.value)} placeholder="OC-001" />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Select value={corId} onValueChange={setCorId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {cores?.filter((c) => c.ativo).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.cor_hex ?? "#ccc" }} />
                        {c.nome_cor}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Grade de Tamanhos</Label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {TAMANHOS.map((t) => (
                <div key={t} className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">{t}</span>
                  <Input
                    type="number"
                    min={0}
                    value={grade[t] ?? ""}
                    onChange={(e) => setGrade({ ...grade, [t]: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50 border border-border grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total de Peças</p>
              <p className="text-xl font-serif font-bold text-foreground">{totalPecas}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Consumo Total Estimado</p>
              <p className="text-xl font-serif font-bold text-foreground">{consumoTotal.toFixed(2)}m</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rolos Utilizados</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {rolosDisponiveis.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  <Checkbox checked={selectedRolos.has(r.id)} onCheckedChange={() => toggleRolo(r.id)} />
                  <div className="flex-1 flex items-center gap-2 text-sm">
                    {r.cor_hex && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.cor_hex }} />}
                    <span className="text-foreground">{r.codigo_rolo}</span>
                    <span className="text-muted-foreground">({(r.metragem_disponivel ?? 0).toFixed(2)}m)</span>
                  </div>
                  {selectedRolos.has(r.id) && (
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24"
                      placeholder="Metros"
                      value={metrosRolo[r.id] ?? ""}
                      onChange={(e) => setMetrosRolo({ ...metrosRolo, [r.id]: Number(e.target.value) })}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate("/ordens-corte")}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending}>Criar Ordem de Corte</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
