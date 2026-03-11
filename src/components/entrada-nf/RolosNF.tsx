import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package, Trash2, Pencil, Check, X } from "lucide-react";
import { useState } from "react";
import type { Tecido, Cor } from "@/types/database";

export interface RoloForm {
  codigo_rolo: string;
  lote: string;
  tecido_id: string;
  cor_id: string;
  peso_kg: number;
  metragem_inicial: number;
  custo_por_metro: number;
}

const emptyRolo: RoloForm = { codigo_rolo: "", lote: "", tecido_id: "", cor_id: "", peso_kg: 0, metragem_inicial: 0, custo_por_metro: 0 };

interface Props {
  rolos: RoloForm[];
  setRolos: (r: RoloForm[]) => void;
  tecidos: Tecido[] | undefined;
  cores: Cor[] | undefined;
  disabled: boolean;
}

export default function RolosNF({ rolos, setRolos, tecidos, cores, disabled }: Props) {
  const [novoRolo, setNovoRolo] = useState<RoloForm>({ ...emptyRolo });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editRolo, setEditRolo] = useState<RoloForm>({ ...emptyRolo });

  const tecidoMap = Object.fromEntries((tecidos ?? []).map((t) => [t.id, t]));
  const corMap = Object.fromEntries((cores ?? []).map((c) => [c.id, c]));

  const getTecidoRendimento = (tecidoId: string) => tecidoMap[tecidoId]?.rendimento_metro_por_kg ?? 0;
  const getTecidoCusto = (tecidoId: string) => tecidoMap[tecidoId]?.custo_por_metro ?? 0;

  const handleTecidoChange = (tecidoId: string, isEdit: boolean) => {
    const custo = getTecidoCusto(tecidoId);
    if (isEdit) {
      const rendimento = getTecidoRendimento(tecidoId);
      const metragem = editRolo.peso_kg > 0 ? editRolo.peso_kg * rendimento : 0;
      setEditRolo({ ...editRolo, tecido_id: tecidoId, custo_por_metro: custo, metragem_inicial: metragem });
    } else {
      const rendimento = getTecidoRendimento(tecidoId);
      const metragem = novoRolo.peso_kg > 0 ? novoRolo.peso_kg * rendimento : 0;
      setNovoRolo({ ...novoRolo, tecido_id: tecidoId, custo_por_metro: custo, metragem_inicial: metragem });
    }
  };

  const handleKgChange = (kg: number, isEdit: boolean) => {
    if (isEdit) {
      const rendimento = getTecidoRendimento(editRolo.tecido_id);
      setEditRolo({ ...editRolo, peso_kg: kg, metragem_inicial: kg * rendimento });
    } else {
      const rendimento = getTecidoRendimento(novoRolo.tecido_id);
      setNovoRolo({ ...novoRolo, peso_kg: kg, metragem_inicial: kg * rendimento });
    }
  };

  const addRolo = () => {
    if (!novoRolo.codigo_rolo || !novoRolo.tecido_id || novoRolo.peso_kg <= 0) {
      return;
    }
    setRolos([...rolos, { ...novoRolo }]);
    setNovoRolo({ ...emptyRolo, tecido_id: novoRolo.tecido_id, cor_id: novoRolo.cor_id, custo_por_metro: novoRolo.custo_por_metro });
  };

  const removeRolo = (i: number) => setRolos(rolos.filter((_, idx) => idx !== i));

  const startEdit = (i: number) => {
    setEditingIndex(i);
    setEditRolo({ ...rolos[i] });
  };

  const confirmEdit = () => {
    if (editingIndex === null) return;
    const updated = [...rolos];
    updated[editingIndex] = { ...editRolo };
    setRolos(updated);
    setEditingIndex(null);
  };

  const cancelEdit = () => setEditingIndex(null);

  const renderTecidoSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Tecido" /></SelectTrigger>
      <SelectContent>
        {tecidos?.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome_tecido}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const renderCorSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Cor" /></SelectTrigger>
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
  );

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="font-serif font-bold text-lg text-foreground">Rolos de Tecido</h2>
          </div>
          {!disabled && (
            <Button variant="outline" size="sm" onClick={addRolo} className="gap-1" disabled={!novoRolo.codigo_rolo || !novoRolo.tecido_id || novoRolo.peso_kg <= 0}>
              <Plus className="h-4 w-4" /> Adicionar Rolo
            </Button>
          )}
        </div>

        {/* Formulário inline para novo rolo */}
        {!disabled && (
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="space-y-1">
              <Label className="text-xs">Código *</Label>
              <Input value={novoRolo.codigo_rolo} onChange={(e) => setNovoRolo({ ...novoRolo, codigo_rolo: e.target.value })} placeholder="Ex: 1234" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lote</Label>
              <Input value={novoRolo.lote} onChange={(e) => setNovoRolo({ ...novoRolo, lote: e.target.value })} placeholder="Lote" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tecido *</Label>
              {renderTecidoSelect(novoRolo.tecido_id, (v) => handleTecidoChange(v, false))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cor</Label>
              {renderCorSelect(novoRolo.cor_id, (v) => setNovoRolo({ ...novoRolo, cor_id: v }))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Peso (kg) *</Label>
              <Input type="number" step="0.01" value={novoRolo.peso_kg || ""} onChange={(e) => handleKgChange(Number(e.target.value), false)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Metragem (calc.)</Label>
              <Input type="number" step="0.01" value={novoRolo.metragem_inicial || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Custo/m (auto)</Label>
              <Input type="number" step="0.01" value={novoRolo.custo_por_metro || ""} disabled className="bg-muted" />
            </div>
          </div>
        )}

        {/* Lista de rolos */}
        {rolos.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Tecido</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead className="text-right">Peso (kg)</TableHead>
                <TableHead className="text-right">Metragem</TableHead>
                <TableHead className="text-right">Custo/m</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                {!disabled && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rolos.map((r, i) => {
                const isEditing = editingIndex === i;
                const row = isEditing ? editRolo : r;
                const valorRolo = row.metragem_inicial * row.custo_por_metro;

                if (isEditing) {
                  return (
                    <TableRow key={i}>
                      <TableCell><Input value={editRolo.codigo_rolo} onChange={(e) => setEditRolo({ ...editRolo, codigo_rolo: e.target.value })} className="w-20" /></TableCell>
                      <TableCell><Input value={editRolo.lote} onChange={(e) => setEditRolo({ ...editRolo, lote: e.target.value })} className="w-20" /></TableCell>
                      <TableCell className="min-w-[140px]">{renderTecidoSelect(editRolo.tecido_id, (v) => handleTecidoChange(v, true))}</TableCell>
                      <TableCell className="min-w-[120px]">{renderCorSelect(editRolo.cor_id, (v) => setEditRolo({ ...editRolo, cor_id: v }))}</TableCell>
                      <TableCell><Input type="number" step="0.01" value={editRolo.peso_kg || ""} onChange={(e) => handleKgChange(Number(e.target.value), true)} className="w-20 text-right" /></TableCell>
                      <TableCell className="text-right text-muted-foreground">{editRolo.metragem_inicial.toFixed(1)}m</TableCell>
                      <TableCell className="text-right text-muted-foreground">R$ {editRolo.custo_por_metro.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">R$ {valorRolo.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={confirmEdit}><Check className="h-4 w-4 text-green-600" /></Button>
                          <Button variant="ghost" size="icon" onClick={cancelEdit}><X className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow key={i}>
                    <TableCell className="text-primary font-medium">{r.codigo_rolo}</TableCell>
                    <TableCell className="text-muted-foreground">{r.lote || "—"}</TableCell>
                    <TableCell className="font-medium">{tecidoMap[r.tecido_id]?.nome_tecido ?? "—"}</TableCell>
                    <TableCell>
                      {r.cor_id && corMap[r.cor_id] ? (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: corMap[r.cor_id].cor_hex ?? "#ccc" }} />
                          {corMap[r.cor_id].nome_cor}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{r.peso_kg.toFixed(2)}kg</TableCell>
                    <TableCell className="text-right">{r.metragem_inicial.toFixed(1)}m</TableCell>
                    <TableCell className="text-right">R$ {r.custo_por_metro.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">R$ {valorRolo.toFixed(2)}</TableCell>
                    {!disabled && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(i)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => removeRolo(i)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-6">
            Nenhum rolo adicionado. Preencha os campos acima e clique em "Adicionar Rolo".
          </p>
        )}
      </CardContent>
    </Card>
  );
}
