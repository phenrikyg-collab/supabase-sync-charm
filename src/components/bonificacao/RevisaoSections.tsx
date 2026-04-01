import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, isAfter } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  CalendarIcon, ClipboardCheck, BarChart3, History, ExternalLink,
  CheckCircle, XCircle,
} from "lucide-react";
import { toast } from "sonner";

/* ── helpers ── */

/** Conta dias úteis Seg–Sáb entre duas datas (inclusive) */
function diasUteisSexSab(start: Date, end: Date): number {
  if (isAfter(start, end)) return 0;
  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => d.getDay() !== 0).length; // 0=domingo
}

/* ═══════════════════════════════════════════
   1. Lançamento de Revisão
   ═══════════════════════════════════════════ */

export function LancamentoRevisao() {
  const qc = useQueryClient();

  const empty = {
    revisora_id: "",
    ordem_producao_id: "",
    data_recebimento: undefined as Date | undefined,
    data_conclusao: undefined as Date | undefined,
    quantidade_pecas: 0,
    pecas_aprovadas: 0,
    pecas_reprovadas: 0,
    observacao: "",
  };
  const [form, setForm] = useState(empty);

  const { data: revisoras = [] } = useQuery({
    queryKey: ["revisoras_ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revisoras").select("*").eq("ativa", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: ordens = [] } = useQuery({
    queryKey: ["ordens_producao_todas_rev"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_producao")
        .select("id, nome_produto, quantidade_pecas_ordem, status_ordem")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: configPrazo } = useQuery({
    queryKey: ["config_bonificacao_revisoras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_bonificacao_revisoras")
        .select("prazo_revisao_dias_uteis")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const prazo = configPrazo?.prazo_revisao_dias_uteis ?? 3;

  const calcDentroPrazo = useMemo(() => {
    if (!form.data_recebimento || !form.data_conclusao) return { dias: null, dentro: null };
    const dias = diasUteisSexSab(form.data_recebimento, form.data_conclusao);
    return { dias, dentro: dias <= prazo };
  }, [form.data_recebimento, form.data_conclusao, prazo]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.revisora_id || !form.ordem_producao_id || !form.data_recebimento) {
        throw new Error("Preencha os campos obrigatórios");
      }

      const diasGastos = form.data_conclusao
        ? diasUteisSexSab(form.data_recebimento, form.data_conclusao)
        : null;
      const dentroPrazo = diasGastos !== null ? diasGastos <= prazo : null;

      const { error } = await supabase.from("registros_revisao").insert({
        revisora_id: form.revisora_id,
        ordem_producao_id: form.ordem_producao_id,
        data_recebimento: format(form.data_recebimento, "yyyy-MM-dd"),
        data_conclusao: form.data_conclusao ? format(form.data_conclusao, "yyyy-MM-dd") : null,
        quantidade_pecas: form.quantidade_pecas,
        pecas_aprovadas: form.pecas_aprovadas,
        pecas_reprovadas: form.pecas_reprovadas,
        observacao: form.observacao || null,
        dias_uteis_gastos: diasGastos,
        dentro_prazo: dentroPrazo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registros_revisao"] });
      toast.success("Revisão registrada");
      setForm(empty);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-primary flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" /> Lançamento de Revisão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Revisora */}
          <div>
            <Label>Revisora</Label>
            <Select value={form.revisora_id} onValueChange={(v) => setForm({ ...form, revisora_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {revisoras.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ordem */}
          <div>
            <Label>Ordem de Produção</Label>
            <Select value={form.ordem_producao_id} onValueChange={(v) => setForm({ ...form, ordem_producao_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {ordens.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome_produto || "Sem nome"} — {o.quantidade_pecas_ordem || 0} pçs
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data recebimento */}
          <div>
            <Label>Data de Recebimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.data_recebimento && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.data_recebimento ? format(form.data_recebimento, "dd/MM/yyyy") : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.data_recebimento} onSelect={(d) => setForm({ ...form, data_recebimento: d })} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Data conclusão */}
          <div>
            <Label>Data de Conclusão <span className="text-xs text-muted-foreground">(opcional)</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.data_conclusao && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.data_conclusao ? format(form.data_conclusao, "dd/MM/yyyy") : "Em andamento"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.data_conclusao} onSelect={(d) => setForm({ ...form, data_conclusao: d })} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Quantidade de Peças</Label>
            <Input type="number" min={0} value={form.quantidade_pecas} onChange={(e) => setForm({ ...form, quantidade_pecas: Math.max(0, Number(e.target.value)) })} />
          </div>
          <div>
            <Label>Peças Aprovadas</Label>
            <Input type="number" min={0} value={form.pecas_aprovadas} onChange={(e) => setForm({ ...form, pecas_aprovadas: Math.max(0, Number(e.target.value)) })} />
          </div>
          <div>
            <Label>Peças Reprovadas</Label>
            <Input type="number" min={0} value={form.pecas_reprovadas} onChange={(e) => setForm({ ...form, pecas_reprovadas: Math.max(0, Number(e.target.value)) })} />
          </div>
        </div>

        <div>
          <Label>Observação</Label>
          <Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} rows={2} />
        </div>

        {/* Preview status prazo */}
        {calcDentroPrazo.dias !== null && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Dias úteis gastos: <strong>{calcDentroPrazo.dias}</strong> (prazo: {prazo})</span>
            {calcDentroPrazo.dentro ? (
              <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle className="h-3 w-3 mr-1" /> Dentro do prazo</Badge>
            ) : (
              <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Fora do prazo</Badge>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !form.revisora_id || !form.ordem_producao_id || !form.data_recebimento}>
            {salvar.isPending ? "Salvando..." : "Salvar Revisão"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════
   2. Defeitos Mensais — Troque e Devolva
   ═══════════════════════════════════════════ */

export function DefeitosMensais() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(format(new Date(), "yyyy-MM"));
  const [expedidas, setExpedidas] = useState(0);
  const [defeitos, setDefeitos] = useState(0);

  const { data: existing } = useQuery({
    queryKey: ["defeitos_mensais", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("defeitos_mensais")
        .select("*")
        .eq("mes_referencia", mes)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setExpedidas(data.total_pecas_expedidas);
        setDefeitos(data.total_defeitos_reportados);
      } else {
        setExpedidas(0);
        setDefeitos(0);
      }
      return data;
    },
  });

  const pctDefeito = expedidas > 0 ? ((defeitos / expedidas) * 100) : 0;

  const salvar = useMutation({
    mutationFn: async () => {
      if (existing) {
        const { error } = await supabase.from("defeitos_mensais").update({
          total_pecas_expedidas: expedidas,
          total_defeitos_reportados: defeitos,
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("defeitos_mensais").insert({
          mes_referencia: mes,
          total_pecas_expedidas: expedidas,
          total_defeitos_reportados: defeitos,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["defeitos_mensais"] });
      toast.success("Dados salvos");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-primary flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Defeitos Mensais — Troque e Devolva
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label>Mês de Referência</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div>
            <Label>Total Peças Expedidas</Label>
            <Input type="number" min={0} value={expedidas} onChange={(e) => setExpedidas(Math.max(0, Number(e.target.value)))} />
          </div>
          <div>
            <Label>Total Defeitos Reportados</Label>
            <Input type="number" min={0} value={defeitos} onChange={(e) => setDefeitos(Math.max(0, Number(e.target.value)))} />
          </div>
          <div>
            <Label>% de Defeito</Label>
            <div className={cn(
              "flex items-center h-10 px-3 rounded-md border font-semibold",
              pctDefeito > 3 ? "text-destructive bg-destructive/10" : pctDefeito > 1 ? "text-yellow-600 bg-yellow-50" : "text-green-600 bg-green-50"
            )}>
              {pctDefeito.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
            <a href="https://app.troqueedevolva.com.br/reports/products" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Abrir Troque e Devolva
            </a>
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════
   3. Histórico de Revisões
   ═══════════════════════════════════════════ */

export function HistoricoRevisoes() {
  const [mesFilter, setMesFilter] = useState(format(new Date(), "yyyy-MM"));
  const [revisoraFilter, setRevisoraFilter] = useState("todas");

  const { data: revisoras = [] } = useQuery({
    queryKey: ["revisoras_all_hist"],
    queryFn: async () => {
      const { data, error } = await supabase.from("revisoras").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["registros_revisao", mesFilter, revisoraFilter],
    queryFn: async () => {
      let q = supabase
        .from("registros_revisao")
        .select("*, revisoras(nome), ordens_producao(nome_produto)")
        .gte("data_recebimento", `${mesFilter}-01`)
        .lt("data_recebimento", nextMonth(mesFilter))
        .order("data_recebimento", { ascending: false });

      if (revisoraFilter !== "todas") {
        q = q.eq("revisora_id", revisoraFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-primary flex items-center gap-2">
          <History className="h-5 w-5" /> Histórico de Revisões
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Mês</Label>
            <Input type="month" value={mesFilter} onChange={(e) => setMesFilter(e.target.value)} />
          </div>
          <div>
            <Label>Revisora</Label>
            <Select value={revisoraFilter} onValueChange={setRevisoraFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {revisoras.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Revisora</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead>Recebimento</TableHead>
              <TableHead>Conclusão</TableHead>
              <TableHead className="text-right">Dias</TableHead>
              <TableHead className="text-right">Peças</TableHead>
              <TableHead className="text-right">Aprovadas</TableHead>
              <TableHead className="text-right">Reprovadas</TableHead>
              <TableHead>Prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : registros.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nenhum registro</TableCell></TableRow>
            ) : (
              registros.map((r: any, i: number) => (
                <TableRow key={r.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                  <TableCell className="font-medium">{r.revisoras?.nome || "—"}</TableCell>
                  <TableCell>{r.ordens_producao?.nome_produto || "—"}</TableCell>
                  <TableCell>{format(new Date(r.data_recebimento + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    {r.data_conclusao ? format(new Date(r.data_conclusao + "T12:00:00"), "dd/MM/yyyy") : "Em andamento"}
                  </TableCell>
                  <TableCell className="text-right">{r.dias_uteis_gastos ?? "—"}</TableCell>
                  <TableCell className="text-right">{r.quantidade_pecas}</TableCell>
                  <TableCell className="text-right">{r.pecas_aprovadas}</TableCell>
                  <TableCell className="text-right">{r.pecas_reprovadas}</TableCell>
                  <TableCell>
                    {r.dentro_prazo === null ? (
                      <Badge variant="outline">Pendente</Badge>
                    ) : r.dentro_prazo ? (
                      <Badge className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="h-3 w-3 mr-1" /> OK
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" /> Atrasado
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── helper ── */
function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1); // m is already 0-indexed+1 so next month
  return format(d, "yyyy-MM-dd");
}
