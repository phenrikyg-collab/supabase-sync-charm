import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInBusinessDays, isBefore, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CalendarIcon, ClipboardList, Target, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

/* ═══════════════════════════════════════════
   Lançamento Diário
   ═══════════════════════════════════════════ */

export function LancamentoDiario() {
  const qc = useQueryClient();
  const [data, setData] = useState<Date>(new Date());
  const [ordemId, setOrdemId] = useState("");

  // Costureiras ativas
  const { data: costureiras = [] } = useQuery({
    queryKey: ["costureiras_ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("costureiras")
        .select("*")
        .eq("ativa", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Ordens de produção ativas (não finalizadas)
  const { data: ordens = [] } = useQuery({
    queryKey: ["ordens_producao_ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_producao")
        .select("id, nome_produto, quantidade_pecas_ordem, data_previsao_termino, status_ordem")
        .not("status_ordem", "eq", "Finalizado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Registros já existentes para essa data+ordem (para pré-preencher)
  const { data: existingRecords = [] } = useQuery({
    queryKey: ["registros_dia", ordemId, format(data, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!ordemId) return [];
      const { data: records, error } = await supabase
        .from("registros_producao_diaria")
        .select("*")
        .eq("ordem_producao_id", ordemId)
        .eq("data", format(data, "yyyy-MM-dd"));
      if (error) throw error;
      return records;
    },
    enabled: !!ordemId,
  });

  // Total já produzido na ordem
  const { data: totalProduzido = 0 } = useQuery({
    queryKey: ["total_produzido", ordemId],
    queryFn: async () => {
      if (!ordemId) return 0;
      const { data: records, error } = await supabase
        .from("registros_producao_diaria")
        .select("pecas_produzidas")
        .eq("ordem_producao_id", ordemId);
      if (error) throw error;
      return records.reduce((s: number, r: any) => s + (r.pecas_produzidas || 0), 0);
    },
    enabled: !!ordemId,
  });

  const ordemSelecionada = ordens.find((o: any) => o.id === ordemId);

  const metaDiaria = useMemo(() => {
    if (!ordemSelecionada) return 0;
    const qtdOrdem = ordemSelecionada.quantidade_pecas_ordem || 0;
    const restante = qtdOrdem - totalProduzido;
    if (restante <= 0) return 0;
    const prazo = ordemSelecionada.data_previsao_termino;
    if (!prazo) return restante;
    const diasUteis = differenceInBusinessDays(new Date(prazo + "T23:59:59"), new Date());
    return diasUteis > 0 ? Math.ceil(restante / diasUteis) : restante;
  }, [ordemSelecionada, totalProduzido]);

  // Linhas de lançamento por costureira
  type LinhaLanc = {
    costureira_id: string;
    pecas_produzidas: number;
    pecas_defeituosas: number;
    tempo_reta: number;
    tempo_overloque: number;
    tempo_galoneira: number;
  };

  const [linhas, setLinhas] = useState<LinhaLanc[]>([]);

  // Inicializar linhas quando costureiras ou existingRecords mudam
  useEffect(() => {
    if (costureiras.length === 0) return;
    setLinhas(
      costureiras.map((c: any) => {
        const existing = existingRecords.find((r: any) => r.costureira_id === c.id);
        return {
          costureira_id: c.id,
          pecas_produzidas: existing?.pecas_produzidas || 0,
          pecas_defeituosas: existing?.pecas_defeituosas || 0,
          tempo_reta: existing?.tempo_reta || 0,
          tempo_overloque: existing?.tempo_overloque || 0,
          tempo_galoneira: existing?.tempo_galoneira || 0,
        };
      })
    );
  }, [costureiras, existingRecords]);

  function updateLinha(idx: number, field: keyof LinhaLanc, value: number) {
    setLinhas((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // Defeituosas não pode superar produzidas
      if (field === "pecas_defeituosas" && value > next[idx].pecas_produzidas) {
        next[idx].pecas_defeituosas = next[idx].pecas_produzidas;
      }
      if (field === "pecas_produzidas" && next[idx].pecas_defeituosas > value) {
        next[idx].pecas_defeituosas = value;
      }
      return next;
    });
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!ordemId) throw new Error("Selecione uma ordem");
      const dataStr = format(data, "yyyy-MM-dd");

      // Delete existing for this date+order then insert
      await supabase
        .from("registros_producao_diaria")
        .delete()
        .eq("ordem_producao_id", ordemId)
        .eq("data", dataStr);

      const rows = linhas
        .filter((l) => l.pecas_produzidas > 0 || l.tempo_reta > 0 || l.tempo_overloque > 0 || l.tempo_galoneira > 0)
        .map((l) => ({
          ...l,
          ordem_producao_id: ordemId,
          data: dataStr,
        }));

      if (rows.length > 0) {
        const { error } = await supabase.from("registros_producao_diaria").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registros_dia"] });
      qc.invalidateQueries({ queryKey: ["total_produzido"] });
      qc.invalidateQueries({ queryKey: ["registros_ordem"] });
      toast.success("Lançamento salvo com sucesso");
    },
    onError: () => toast.error("Erro ao salvar lançamento"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-primary flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> Lançamento Diário
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Data */}
          <div>
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !data && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(data, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={data} onSelect={(d) => d && setData(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Ordem de Produção */}
          <div>
            <Label>Ordem de Produção</Label>
            <Select value={ordemId} onValueChange={setOrdemId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma ordem" /></SelectTrigger>
              <SelectContent>
                {ordens.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome_produto || "Sem nome"} — {o.quantidade_pecas_ordem || 0} pçs
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meta diária */}
          {ordemId && (
            <div>
              <Label>Meta Diária Sugerida</Label>
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50">
                <Target className="h-4 w-4 mr-2 text-primary" />
                <span className="font-semibold text-primary">{metaDiaria} peças</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabela de lançamentos por costureira */}
        {ordemId && costureiras.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Costureira</TableHead>
                  <TableHead className="w-28">Produzidas</TableHead>
                  <TableHead className="w-28">Defeituosas</TableHead>
                  <TableHead className="w-28">Reta (min)</TableHead>
                  <TableHead className="w-28">Overloque (min)</TableHead>
                  <TableHead className="w-28">Galoneira (min)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l, i) => {
                  const cost = costureiras.find((c: any) => c.id === l.costureira_id);
                  return (
                    <TableRow key={l.costureira_id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                      <TableCell className="font-medium">{(cost as any)?.nome}</TableCell>
                      <TableCell>
                        <Input type="number" min={0} value={l.pecas_produzidas} onChange={(e) => updateLinha(i, "pecas_produzidas", Math.max(0, Number(e.target.value)))} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} max={l.pecas_produzidas} value={l.pecas_defeituosas} onChange={(e) => updateLinha(i, "pecas_defeituosas", Math.max(0, Number(e.target.value)))} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} step="0.1" value={l.tempo_reta} onChange={(e) => updateLinha(i, "tempo_reta", Math.max(0, Number(e.target.value)))} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} step="0.1" value={l.tempo_overloque} onChange={(e) => updateLinha(i, "tempo_overloque", Math.max(0, Number(e.target.value)))} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} step="0.1" value={l.tempo_galoneira} onChange={(e) => updateLinha(i, "tempo_galoneira", Math.max(0, Number(e.target.value)))} className="h-8" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-end">
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando..." : "Salvar Lançamento"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════
   Acompanhamento por Ordem
   ═══════════════════════════════════════════ */

export function AcompanhamentoOrdem() {
  const [ordemId, setOrdemId] = useState("");

  const { data: ordens = [] } = useQuery({
    queryKey: ["ordens_producao_todas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_producao")
        .select("id, nome_produto, quantidade_pecas_ordem, data_previsao_termino, status_ordem")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: registros = [] } = useQuery({
    queryKey: ["registros_ordem", ordemId],
    queryFn: async () => {
      if (!ordemId) return [];
      const { data, error } = await supabase
        .from("registros_producao_diaria")
        .select("*, costureiras(nome)")
        .eq("ordem_producao_id", ordemId)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!ordemId,
  });

  const ordem = ordens.find((o: any) => o.id === ordemId);

  const stats = useMemo(() => {
    const totalProduzido = registros.reduce((s: number, r: any) => s + (r.pecas_produzidas || 0), 0);
    const totalDefeituosas = registros.reduce((s: number, r: any) => s + (r.pecas_defeituosas || 0), 0);
    const meta = ordem?.quantidade_pecas_ordem || 0;
    const pctConcluido = meta > 0 ? (totalProduzido / meta) * 100 : 0;
    const pctDefeito = totalProduzido > 0 ? (totalDefeituosas / totalProduzido) * 100 : 0;

    let defeitoColor: "green" | "yellow" | "red" = "green";
    if (pctDefeito > 3) defeitoColor = "red";
    else if (pctDefeito > 1) defeitoColor = "yellow";

    const prazo = ordem?.data_previsao_termino;
    const emAtraso = prazo ? isBefore(new Date(prazo + "T23:59:59"), startOfDay(new Date())) && pctConcluido < 100 : false;

    return { totalProduzido, totalDefeituosas, meta, pctConcluido, pctDefeito, defeitoColor, emAtraso };
  }, [registros, ordem]);

  const fmtNum = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const progressColor = stats.defeitoColor === "red"
    ? "bg-destructive"
    : stats.defeitoColor === "yellow"
      ? "bg-yellow-500"
      : "bg-green-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-primary flex items-center gap-2">
          <CheckCircle className="h-5 w-5" /> Acompanhamento por Ordem
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Ordem de Produção</Label>
          <Select value={ordemId} onValueChange={setOrdemId}>
            <SelectTrigger><SelectValue placeholder="Selecione uma ordem" /></SelectTrigger>
            <SelectContent>
              {ordens.map((o: any) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome_produto || "Sem nome"} — {o.quantidade_pecas_ordem || 0} pçs ({o.status_ordem})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {ordemId && (
          <>
            {/* Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase">Total Produzido</p>
                  <p className="text-2xl font-bold text-primary">{stats.totalProduzido}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase">Meta da Ordem</p>
                  <p className="text-2xl font-bold text-primary">{stats.meta}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase">% Concluído</p>
                  <p className="text-2xl font-bold text-primary">{fmtNum(Math.min(stats.pctConcluido, 100))}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase">% Defeituosas</p>
                  <p className={cn("text-2xl font-bold", stats.defeitoColor === "red" ? "text-destructive" : stats.defeitoColor === "yellow" ? "text-yellow-600" : "text-green-600")}>
                    {fmtNum(stats.pctDefeito)}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Barra de progresso */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso da Ordem</span>
                <span>{fmtNum(Math.min(stats.pctConcluido, 100))}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", progressColor)} style={{ width: `${Math.min(stats.pctConcluido, 100)}%` }} />
              </div>
            </div>

            {/* Status do prazo */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status do prazo:</span>
              {stats.emAtraso ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Em Atraso
                </Badge>
              ) : (
                <Badge className="bg-green-600 hover:bg-green-700 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> No Prazo
                </Badge>
              )}
              {ordem?.data_previsao_termino && (
                <span className="text-xs text-muted-foreground">
                  (Prazo: {format(new Date(ordem.data_previsao_termino + "T12:00:00"), "dd/MM/yyyy")})
                </span>
              )}
            </div>

            {/* Tabela de lançamentos */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Costureira</TableHead>
                  <TableHead className="text-right">Produzidas</TableHead>
                  <TableHead className="text-right">Defeituosas</TableHead>
                  <TableHead className="text-right">Reta (min)</TableHead>
                  <TableHead className="text-right">Overloque (min)</TableHead>
                  <TableHead className="text-right">Galoneira (min)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhum lançamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  registros.map((r: any, i: number) => (
                    <TableRow key={r.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                      <TableCell>{format(new Date(r.data + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-medium">{r.costureiras?.nome || "—"}</TableCell>
                      <TableCell className="text-right">{r.pecas_produzidas}</TableCell>
                      <TableCell className="text-right">{r.pecas_defeituosas}</TableCell>
                      <TableCell className="text-right">{r.tempo_reta}</TableCell>
                      <TableCell className="text-right">{r.tempo_overloque}</TableCell>
                      <TableCell className="text-right">{r.tempo_galoneira}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
