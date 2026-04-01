import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInBusinessDays, isBefore, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Calculator, Trophy } from "lucide-react";
import { toast } from "sonner";

interface BonusRow {
  costureira_id: string;
  nome: string;
  funcao: string;
  participacao_pct: number;
  bonus_prazo: number;
  bonus_qualidade: number;
  total: number;
}

export default function CalculadoraBonusCostureiras() {
  const qc = useQueryClient();
  const [ordemId, setOrdemId] = useState("");
  const [resultado, setResultado] = useState<BonusRow[]>([]);
  const [calculated, setCalculated] = useState(false);

  const { data: ordens = [] } = useQuery({
    queryKey: ["ordens_producao_todas_bonus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_producao")
        .select("id, nome_produto, quantidade_pecas_ordem, data_previsao_termino, data_fim, status_ordem")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const calcular = async () => {
    if (!ordemId) return;
    try {
      const ordem = ordens.find((o: any) => o.id === ordemId);
      if (!ordem) return;

      // Fetch production records
      const { data: registros, error: e1 } = await supabase
        .from("registros_producao_diaria")
        .select("costureira_id, pecas_produzidas, pecas_defeituosas")
        .eq("ordem_producao_id", ordemId);
      if (e1) throw e1;

      // Fetch costureiras
      const { data: costureiras, error: e2 } = await supabase
        .from("costureiras")
        .select("id, nome, funcao, participacao_pct")
        .eq("ativa", true)
        .order("nome");
      if (e2) throw e2;

      // Fetch config
      const { data: config, error: e3 } = await supabase
        .from("config_bonificacao_costureiras")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (e3) throw e3;
      if (!config) { toast.error("Configure os parâmetros de bonificação primeiro"); return; }

      // Calculate days of delay
      const prazo = ordem.data_previsao_termino;
      const conclusao = ordem.data_fim || new Date().toISOString().split("T")[0];
      let diasAtraso = 0;
      if (prazo) {
        const prazoDate = new Date(prazo + "T23:59:59");
        const concDate = new Date(conclusao + "T00:00:00");
        if (isBefore(prazoDate, startOfDay(concDate))) {
          diasAtraso = differenceInBusinessDays(concDate, prazoDate);
        }
      }

      // Determine prazo bonus tier
      let bonusPrazoBase: number;
      if (diasAtraso === 0) bonusPrazoBase = Number(config.bonus_prazo_no_prazo);
      else if (diasAtraso === 1) bonusPrazoBase = Number(config.bonus_prazo_1_dia_atraso);
      else if (diasAtraso === 2) bonusPrazoBase = Number(config.bonus_prazo_2_dias_atraso);
      else bonusPrazoBase = Number(config.bonus_prazo_acima_2_dias);

      // Build per-costureira results
      const rows: BonusRow[] = (costureiras || []).map((c: any) => {
        const regs = (registros || []).filter((r: any) => r.costureira_id === c.id);
        const totalProd = regs.reduce((s: number, r: any) => s + (r.pecas_produzidas || 0), 0);
        const totalDef = regs.reduce((s: number, r: any) => s + (r.pecas_defeituosas || 0), 0);
        const pctDef = totalProd > 0 ? (totalDef / totalProd) * 100 : 0;

        let bonusQualBase: number;
        if (pctDef === 0) bonusQualBase = Number(config.bonus_qualidade_0_pct);
        else if (pctDef <= 1) bonusQualBase = Number(config.bonus_qualidade_ate_1_pct);
        else if (pctDef <= 3) bonusQualBase = Number(config.bonus_qualidade_ate_3_pct);
        else bonusQualBase = Number(config.bonus_qualidade_acima_3_pct);

        const pct = Number(c.participacao_pct) / 100;
        const bp = bonusPrazoBase * pct;
        const bq = bonusQualBase * pct;

        return {
          costureira_id: c.id,
          nome: c.nome,
          funcao: c.funcao,
          participacao_pct: Number(c.participacao_pct),
          bonus_prazo: Math.round(bp * 100) / 100,
          bonus_qualidade: Math.round(bq * 100) / 100,
          total: Math.round((bp + bq) * 100) / 100,
        };
      }).filter((r) => r.total > 0 || true); // show all

      setResultado(rows);
      setCalculated(true);
    } catch {
      toast.error("Erro ao calcular bônus");
    }
  };

  const registrar = useMutation({
    mutationFn: async () => {
      for (const r of resultado) {
        const { error } = await supabase
          .from("bonus_costureiras")
          .upsert({
            ordem_producao_id: ordemId,
            costureira_id: r.costureira_id,
            bonus_prazo: r.bonus_prazo,
            bonus_qualidade: r.bonus_qualidade,
            total: r.total,
            status: "pendente",
          }, { onConflict: "ordem_producao_id,costureira_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bonus_costureiras"] });
      toast.success("Bônus registrados com status pendente");
    },
    onError: () => toast.error("Erro ao registrar bônus"),
  });

  const fmtCur = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-primary flex items-center gap-2">
          <Calculator className="h-5 w-5" /> Calculadora de Bônus — Costureiras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Label>Ordem de Produção</Label>
            <Select value={ordemId} onValueChange={(v) => { setOrdemId(v); setCalculated(false); }}>
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
          <Button onClick={calcular} disabled={!ordemId}>
            <Calculator className="h-4 w-4 mr-1" /> Calcular
          </Button>
        </div>

        {calculated && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Costureira</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">% Participação</TableHead>
                  <TableHead className="text-right">Bônus Prazo</TableHead>
                  <TableHead className="text-right">Bônus Qualidade</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.map((r, i) => (
                  <TableRow key={r.costureira_id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>{r.funcao}</TableCell>
                    <TableCell className="text-right">{r.participacao_pct}%</TableCell>
                    <TableCell className="text-right">{fmtCur(r.bonus_prazo)}</TableCell>
                    <TableCell className="text-right">{fmtCur(r.bonus_qualidade)}</TableCell>
                    <TableCell className="text-right font-bold text-amber-600">
                      <span className="flex items-center justify-end gap-1">
                        <Trophy className="h-4 w-4" /> {fmtCur(r.total)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end">
              <Button onClick={() => registrar.mutate()} disabled={registrar.isPending}>
                {registrar.isPending ? "Registrando..." : "Registrar Bônus"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
