import { useState } from "react";
import { useTecidos, useCores, useCreateEntradaTecido, useCreateRoloTecido } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface RoloForm {
  codigo_rolo: string;
  lote: string;
  tecido_id: string;
  cor_id: string;
  metragem_inicial: number;
  custo_por_metro: number;
}

const emptyRolo: RoloForm = { codigo_rolo: "", lote: "", tecido_id: "", cor_id: "", metragem_inicial: 0, custo_por_metro: 0 };

export default function EntradaNF() {
  const { data: tecidos } = useTecidos();
  const { data: cores } = useCores();
  const createEntrada = useCreateEntradaTecido();
  const createRolo = useCreateRoloTecido();

  const [numeroNf, setNumeroNf] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valorTotal, setValorTotal] = useState(0);
  const [dataEntrada, setDataEntrada] = useState(new Date().toISOString().split("T")[0]);

  const [rolos, setRolos] = useState<RoloForm[]>([]);
  const [novoRolo, setNovoRolo] = useState<RoloForm>({ ...emptyRolo });
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const tecidoMap = Object.fromEntries((tecidos ?? []).map((t) => [t.id, t]));
  const corMap = Object.fromEntries((cores ?? []).map((c) => [c.id, c]));

  const addRolo = () => {
    if (!novoRolo.codigo_rolo || !novoRolo.tecido_id || novoRolo.metragem_inicial <= 0) {
      toast.error("Preencha código, tecido e metragem do rolo");
      return;
    }
    setRolos([...rolos, { ...novoRolo }]);
    setNovoRolo({ ...emptyRolo, tecido_id: novoRolo.tecido_id, cor_id: novoRolo.cor_id, custo_por_metro: novoRolo.custo_por_metro });
  };

  const removeRolo = (i: number) => setRolos(rolos.filter((_, idx) => idx !== i));

  const handleRegistrar = async () => {
    if (!numeroNf || !fornecedor) {
      toast.error("Preencha Nº NF e Fornecedor");
      return;
    }
    if (rolos.length === 0) {
      toast.error("Adicione ao menos um rolo de tecido");
      return;
    }
    setSalvando(true);
    try {
      // 1) Criar entrada
      const entrada = await createEntrada.mutateAsync({
        numero_nf: Number(numeroNf),
        fornecedor,
        data_entrada: dataEntrada,
      });

      // 2) Criar rolos vinculados à entrada
      for (const r of rolos) {
        const cor = cores?.find((c) => c.id === r.cor_id);
        const tecido = tecidos?.find((t) => t.id === r.tecido_id);
        await createRolo.mutateAsync({
          codigo_rolo: r.codigo_rolo,
          lote: r.lote || null,
          tecido_id: r.tecido_id,
          cor_id: r.cor_id || null,
          cor_nome: cor?.nome_cor ?? null,
          cor_hex: cor?.cor_hex ?? null,
          metragem_inicial: r.metragem_inicial,
          metragem_disponivel: r.metragem_inicial,
          entrada_tecido_id: entrada.id,
          fornecedor,
        });
      }

      toast.success(`Entrada registrada com ${rolos.length} rolo(s)!`);
      setSalvo(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleNovaEntrada = () => {
    setNumeroNf("");
    setFornecedor("");
    setValorTotal(0);
    setDataEntrada(new Date().toISOString().split("T")[0]);
    setRolos([]);
    setNovoRolo({ ...emptyRolo });
    setSalvo(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Entrada de <span className="text-primary">Nota Fiscal</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Registre entradas de tecido e gere rolos</p>
      </div>

      {/* Dados da NF */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-serif font-bold text-lg text-foreground">Dados da Nota Fiscal</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Nº NF *</Label>
              <Input value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} placeholder="Ex: 12345" disabled={salvo} />
            </div>
            <div className="space-y-2">
              <Label>Fornecedor *</Label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" disabled={salvo} />
            </div>
            <div className="space-y-2">
              <Label>Data Entrada</Label>
              <Input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} disabled={salvo} />
            </div>
            <div className="space-y-2">
              <Label>Valor Total (R$)</Label>
              <Input type="number" step="0.01" value={valorTotal || ""} onChange={(e) => setValorTotal(Number(e.target.value))} disabled={salvo} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rolos de Tecido */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="font-serif font-bold text-lg text-foreground">Rolos de Tecido</h2>
            </div>
            {!salvo && (
              <Button variant="outline" size="sm" onClick={addRolo} className="gap-1">
                <Plus className="h-4 w-4" /> Adicionar Rolo
              </Button>
            )}
          </div>

          {/* Formulário inline para novo rolo */}
          {!salvo && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 bg-muted/50 rounded-lg border border-border">
              <div className="space-y-1">
                <Label className="text-xs">Código do Rolo *</Label>
                <Input value={novoRolo.codigo_rolo} onChange={(e) => setNovoRolo({ ...novoRolo, codigo_rolo: e.target.value })} placeholder="Ex: 1234" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lote</Label>
                <Input value={novoRolo.lote} onChange={(e) => setNovoRolo({ ...novoRolo, lote: e.target.value })} placeholder="Lote" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tecido *</Label>
                <Select value={novoRolo.tecido_id} onValueChange={(v) => setNovoRolo({ ...novoRolo, tecido_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Tecido" /></SelectTrigger>
                  <SelectContent>
                    {tecidos?.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome_tecido}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cor</Label>
                <Select value={novoRolo.cor_id} onValueChange={(v) => setNovoRolo({ ...novoRolo, cor_id: v })}>
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
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Metragem Total *</Label>
                <Input type="number" step="0.01" value={novoRolo.metragem_inicial || ""} onChange={(e) => setNovoRolo({ ...novoRolo, metragem_inicial: Number(e.target.value) })} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Custo por Metro</Label>
                <Input type="number" step="0.01" value={novoRolo.custo_por_metro || ""} onChange={(e) => setNovoRolo({ ...novoRolo, custo_por_metro: Number(e.target.value) })} placeholder="0.00" />
              </div>
            </div>
          )}

          {/* Lista de rolos adicionados */}
          {rolos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Tecido</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead className="text-right">Metragem</TableHead>
                  <TableHead className="text-right">Custo/m</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  {!salvo && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolos.map((r, i) => {
                  const valorRolo = r.metragem_inicial * r.custo_por_metro;
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
                      <TableCell className="text-right">{r.metragem_inicial.toFixed(1)}m</TableCell>
                      <TableCell className="text-right">R$ {r.custo_por_metro.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">R$ {valorRolo.toFixed(2)}</TableCell>
                      {!salvo && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeRolo(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

          {/* Botão de registrar */}
          {!salvo ? (
            <Button onClick={handleRegistrar} disabled={salvando} className="w-full md:w-auto">
              {salvando ? "Registrando..." : "Registrar Entrada"}
            </Button>
          ) : (
            <div className="flex items-center justify-between p-4 bg-success/10 border border-success/30 rounded-lg">
              <p className="text-sm text-foreground">✓ Entrada registrada com sucesso! {rolos.length} rolo(s) cadastrado(s) na tabela rolos_tecido.</p>
              <Button variant="outline" onClick={handleNovaEntrada}>Nova Entrada</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
