import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { gerarPlano, salvarPlano, PlanoPreview } from "@/hooks/usePlanoProducao";
import { formatarSegundos, formatarData } from "@/utils/producao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Eye, Save, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function GerarPlanoProducao({ onSaved }: { onSaved?: () => void }) {
  const [ordens, setOrdens] = useState<any[]>([]);
  const [oficinas, setOficinas] = useState<any[]>([]);
  const [ordemId, setOrdemId] = useState("");
  const [oficinaId, setOficinaId] = useState("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(new Date());
  const [horas, setHoras] = useState(8);
  const [preview, setPreview] = useState<PlanoPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: o }, { data: of }] = await Promise.all([
        supabase
          .from("ordens_producao")
          .select("id, nome_produto, quantidade_pecas_ordem, data_previsao_termino, produto_id, quantidade")
          .neq("status_ordem", "Finalizado")
          .order("created_at", { ascending: false }),
        supabase.from("oficinas").select("id, nome_oficina").order("nome_oficina"),
      ]);
      setOrdens(o || []);
      setOficinas(of || []);
    };
    load();
  }, []);

  const handleVisualizar = async () => {
    if (!ordemId || !oficinaId || !dataInicio) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    setPreview(null);
    try {
      const result = await gerarPlano(ordemId, oficinaId, format(dataInicio, "yyyy-MM-dd"), horas);
      setPreview(result);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      await salvarPlano(preview.diasPlano);
      toast.success("Plano salvo com sucesso!");
      setPreview(null);
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gerar Plano de Produção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ordem de Produção</Label>
              <Select value={ordemId} onValueChange={setOrdemId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {ordens.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome_produto || "Sem nome"} — {o.quantidade_pecas_ordem || o.quantidade || 0} pçs
                      {o.data_previsao_termino ? ` (prev: ${formatarData(o.data_previsao_termino)})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Oficina</Label>
              <Select value={oficinaId} onValueChange={setOficinaId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {oficinas.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nome_oficina}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Horas disponíveis/dia</Label>
              <Input type="number" value={horas} onChange={(e) => setHoras(Number(e.target.value))} min={1} max={24} />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleVisualizar} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Visualizar Plano
            </Button>
            {preview && (
              <Button onClick={handleSalvar} disabled={saving} variant="default">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Confirmar e Salvar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview do Plano</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div><span className="text-muted-foreground">Produto:</span> <strong>{preview.nomeProduto}</strong></div>
              <div><span className="text-muted-foreground">Total de peças:</span> <strong>{preview.totalPecas}</strong></div>
              <div><span className="text-muted-foreground">Tempo efetivo/peça:</span> <strong>{formatarSegundos(preview.tempoEfetivoPorPeca)}</strong></div>
              <div><span className="text-muted-foreground">Peças por dia:</span> <strong>{preview.pecasPorDia}</strong></div>
              {preview.gargalo && (
                <div className="col-span-2 md:col-span-3">
                  <span className="text-muted-foreground">Máquina gargalo:</span>{" "}
                  <Badge variant="destructive">
                    {preview.gargalo.maquina} ({preview.gargalo.quantidade} máq × {horas}h = {formatarSegundos(preview.gargalo.capacidadeSegundos)}/dia)
                  </Badge>
                </div>
              )}
              <div><span className="text-muted-foreground">Dias necessários:</span> <strong>{preview.totalDias}</strong></div>
              <div><span className="text-muted-foreground">Data início:</span> <strong>{formatarData(preview.dataInicio)}</strong></div>
              <div><span className="text-muted-foreground">Data conclusão:</span> <strong>{formatarData(preview.dataConclusao)}</strong></div>
            </div>

            <div>
              <h4 className="font-medium mb-2 text-sm">Capacidade por Máquina</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Máquina</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Cap. dia</TableHead>
                    <TableHead>Peças/dia</TableHead>
                    <TableHead>% Ocup.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.capacidadeMaquinas.map((m) => {
                    const isGargalo = preview.gargalo && m.tipo === preview.gargalo.maquina;
                    return (
                      <TableRow key={m.tipo}>
                        <TableCell className="font-medium">{m.tipo}</TableCell>
                        <TableCell>{m.quantidade} máq</TableCell>
                        <TableCell>
                          {formatarSegundos(m.capSegundos)}
                          {isGargalo && <AlertTriangle className="inline ml-1 h-4 w-4 text-warning" />}
                        </TableCell>
                        <TableCell>{m.pecasDia} peças</TableCell>
                        <TableCell>
                          <span className={cn(
                            m.ocupacao <= 80 ? "text-success" : m.ocupacao <= 95 ? "text-warning" : "text-destructive"
                          )}>
                            {m.ocupacao.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
