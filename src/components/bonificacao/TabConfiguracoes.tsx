import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

/* ═══════════════════════════════════════════
   Config Costureiras
   ═══════════════════════════════════════════ */
function ConfigCostureiras() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useQuery({
    queryKey: ["config_bonificacao_costureiras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_bonificacao_costureiras").select("*").limit(1).maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: created, error: insertErr } = await supabase
          .from("config_bonificacao_costureiras").insert({}).select().single();
        if (insertErr) throw insertErr;
        return created;
      }
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (config) setForm({ ...config }); }, [config]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form?.id) return;
      const { id, created_at, ...rest } = form;
      const { error } = await supabase.from("config_bonificacao_costureiras").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["config_bonificacao_costureiras"] }); toast.success("Configuração salva"); },
    onError: (e: any) => toast.error("Erro ao salvar: " + (e?.message || "desconhecido")),
  });

  if (isLoading || !form) return null;

  const field = (label: string, key: string) => (
    <div key={key}>
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.01" value={form[key] ?? 0} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} className="h-8" />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-primary flex items-center gap-2">
          <Settings className="h-4 w-4" /> Costureiras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase">Prazo</p>
        <div className="grid grid-cols-2 gap-3">
          {field("No Prazo (R$)", "bonus_prazo_no_prazo")}
          {field("1 dia atraso (R$)", "bonus_prazo_1_dia_atraso")}
          {field("2 dias atraso (R$)", "bonus_prazo_2_dias_atraso")}
          {field("Acima 2 dias (R$)", "bonus_prazo_acima_2_dias")}
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase">Qualidade</p>
        <div className="grid grid-cols-2 gap-3">
          {field("0% defeito (R$)", "bonus_qualidade_0_pct")}
          {field("Até 1% defeito (R$)", "bonus_qualidade_ate_1_pct")}
          {field("Até 3% defeito (R$)", "bonus_qualidade_ate_3_pct")}
          {field("Acima 3% defeito (R$)", "bonus_qualidade_acima_3_pct")}
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════
   Config Revisoras
   ═══════════════════════════════════════════ */
function ConfigRevisoras() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useQuery({
    queryKey: ["config_bonificacao_revisoras_full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_bonificacao_revisoras").select("*").limit(1).maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: created, error: insertErr } = await supabase
          .from("config_bonificacao_revisoras").insert({}).select().single();
        if (insertErr) throw insertErr;
        return created;
      }
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (config) setForm({ ...config }); }, [config]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form?.id) return;
      const { id, created_at, ...rest } = form;
      const { error } = await supabase.from("config_bonificacao_revisoras").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["config_bonificacao_revisoras_full"] }); toast.success("Configuração salva"); },
    onError: (e: any) => toast.error("Erro ao salvar: " + (e?.message || "desconhecido")),
  });

  if (isLoading || !form) return null;

  const field = (label: string, key: string) => (
    <div key={key}>
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.01" value={form[key] ?? 0} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} className="h-8" />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-primary flex items-center gap-2">
          <Settings className="h-4 w-4" /> Revisoras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase">SLA de Revisão</p>
        <div className="grid grid-cols-2 gap-3">
          {field("Prazo Revisão (dias úteis)", "prazo_revisao_dias_uteis")}
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase">Prazo</p>
        <div className="grid grid-cols-2 gap-3">
          {field("Dentro do Prazo (R$)", "bonus_prazo_dentro")}
          {field("Fora do Prazo (R$)", "bonus_prazo_fora")}
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase">Defeito</p>
        <div className="grid grid-cols-2 gap-3">
          {field("0% defeito (R$)", "bonus_defeito_0_pct")}
          {field("Até 1% defeito (R$)", "bonus_defeito_ate_1_pct")}
          {field("Até 3% defeito (R$)", "bonus_defeito_ate_3_pct")}
          {field("Acima 3% defeito (R$)", "bonus_defeito_acima_3_pct")}
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════
   Config Máquinas
   ═══════════════════════════════════════════ */
function ConfigMaquinas() {
  const qc = useQueryClient();
  const { data: maquinas = [], isLoading } = useQuery({
    queryKey: ["config_maquinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("config_maquinas").select("*");
      if (error) throw error;
      return (data ?? []).sort((a: any, b: any) => {
        const nomeA = (a.tipo_maquina ?? a.maquina ?? "").toString();
        const nomeB = (b.tipo_maquina ?? b.maquina ?? "").toString();
        return nomeA.localeCompare(nomeB, "pt-BR");
      });
    },
  });

  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    setRows(
      (maquinas ?? []).map((m: any) => ({
        ...m,
        tipo_maquina: m.tipo_maquina ?? m.maquina ?? "",
      })),
    );
  }, [maquinas]);

  const [novo, setNovo] = useState({ tipo_maquina: "", horas_por_dia: 8, dias_uteis_mes: 22, quantidade_maquinas: 1 });

  const updateRow = (idx: number, field: string, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const salvarLinha = useMutation({
    mutationFn: async (row: any) => {
      const nomeMaquina = (row.tipo_maquina ?? row.maquina ?? "").toString().trim();
      if (!nomeMaquina) throw new Error("Informe o tipo da máquina");

      const payload: any = {
        tipo_maquina: nomeMaquina,
        maquina: nomeMaquina,
        quantidade_maquinas: Number(row.quantidade_maquinas ?? 0),
        horas_por_dia: Number(row.horas_por_dia ?? 0),
        dias_uteis_mes: Number(row.dias_uteis_mes ?? 0),
      };

      const { error } = await supabase.from("config_maquinas").update(payload).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["config_maquinas"] }); toast.success("Salvo"); },
    onError: (e: any) => toast.error("Erro ao salvar: " + (e?.message || "desconhecido")),
  });

  const adicionar = useMutation({
    mutationFn: async () => {
      const nomeMaquina = novo.tipo_maquina.trim();
      if (!nomeMaquina) throw new Error("Informe o tipo");

      const payload: any = {
        tipo_maquina: nomeMaquina,
        maquina: nomeMaquina,
        horas_por_dia: Number(novo.horas_por_dia),
        dias_uteis_mes: Number(novo.dias_uteis_mes),
        quantidade_maquinas: Number(novo.quantidade_maquinas),
      };

      const { error } = await supabase.from("config_maquinas").insert(payload).select();
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["config_maquinas"] }); setNovo({ tipo_maquina: "", horas_por_dia: 8, dias_uteis_mes: 22, quantidade_maquinas: 1 }); toast.success("Máquina adicionada"); },
    onError: (e: any) => toast.error("Erro ao adicionar: " + (e?.message || "desconhecido")),
  });

  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("config_maquinas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["config_maquinas"] }); toast.success("Removida"); },
    onError: () => toast.error("Erro ao remover"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-primary flex items-center gap-2">
          <Settings className="h-4 w-4" /> Máquinas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-24">Qtd</TableHead>
              <TableHead className="w-28">Horas/dia</TableHead>
              <TableHead className="w-28">Dias úteis/mês</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma máquina</TableCell></TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={r.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                  <TableCell className="font-medium">{r.tipo_maquina}</TableCell>
                  <TableCell>
                    <Input type="number" min={0} value={r.quantidade_maquinas} onChange={(e) => updateRow(i, "quantidade_maquinas", Number(e.target.value))} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} step="0.5" value={r.horas_por_dia} onChange={(e) => updateRow(i, "horas_por_dia", Number(e.target.value))} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} value={r.dias_uteis_mes} onChange={(e) => updateRow(i, "dias_uteis_mes", Number(e.target.value))} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => salvarLinha.mutate(r)}>✓</Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deletar.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
            {/* New machine row */}
            <TableRow className="bg-primary/5">
              <TableCell>
                <Input placeholder="Tipo de máquina" value={novo.tipo_maquina} onChange={(e) => setNovo({ ...novo, tipo_maquina: e.target.value })} className="h-8" />
              </TableCell>
              <TableCell>
                <Input type="number" min={0} value={novo.quantidade_maquinas} onChange={(e) => setNovo({ ...novo, quantidade_maquinas: Number(e.target.value) })} className="h-8" />
              </TableCell>
              <TableCell>
                <Input type="number" min={0} step="0.5" value={novo.horas_por_dia} onChange={(e) => setNovo({ ...novo, horas_por_dia: Number(e.target.value) })} className="h-8" />
              </TableCell>
              <TableCell>
                <Input type="number" min={0} value={novo.dias_uteis_mes} onChange={(e) => setNovo({ ...novo, dias_uteis_mes: Number(e.target.value) })} className="h-8" />
              </TableCell>
              <TableCell>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => adicionar.mutate()} disabled={adicionar.isPending || !novo.tipo_maquina.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════
   Config Custo Fixo Oficina
   ═══════════════════════════════════════════ */
function ConfigCustoFixo() {
  const qc = useQueryClient();
  const mesAtual = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const { data: registro, isLoading } = useQuery({
    queryKey: ["custo_fixo_oficina_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custo_fixo_oficina")
        .select("*")
        .order("mes", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [mes, setMes] = useState(mesAtual);
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (registro) {
      setMes(registro.mes || mesAtual);
      setValor(registro.valor || 0);
    }
  }, [registro]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (registro?.id) {
        const { error } = await supabase
          .from("custo_fixo_oficina")
          .update({ mes, valor })
          .eq("id", registro.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("custo_fixo_oficina")
          .insert({ mes, valor });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custo_fixo_oficina_config"] });
      qc.invalidateQueries({ queryKey: ["custo_fixo_oficina"] });
      toast.success("Custo fixo salvo");
    },
    onError: (e: any) => toast.error("Erro: " + (e?.message || "desconhecido")),
  });

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-primary flex items-center gap-2">
          <Settings className="h-4 w-4" /> Custo Fixo Mensal da Oficina
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Esse valor é usado para calcular o custo por segundo nas Fichas Técnicas.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Mês de referência</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-8" />
          </div>
          <div>
            <Label className="text-xs">Valor (R$)</Label>
            <Input type="number" step="0.01" min={0} value={valor} onChange={(e) => setValor(Number(e.target.value))} className="h-8" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════
   Tab Configurações (main export)
   ═══════════════════════════════════════════ */
export default function TabConfiguracoes() {
  return (
    <div className="space-y-6">
      <Alert className="border-amber-300 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Alterações afetam o cálculo dos próximos fechamentos.
        </AlertDescription>
      </Alert>

      <ConfigCustoFixo />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ConfigCostureiras />
        <ConfigRevisoras />
      </div>

      <ConfigMaquinas />
    </div>
  );
}
