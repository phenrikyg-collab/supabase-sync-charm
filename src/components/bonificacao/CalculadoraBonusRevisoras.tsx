import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, Trophy } from "lucide-react";
import { toast } from "sonner";

interface BonusRevisoraRow {
  revisora_id: string;
  revisora_nome: string;
  pct_prazo: number;
  pct_defeito: number;
  bonus_prazo: number;
  bonus_qualidade: number;
  total: number;
}

export default function CalculadoraBonusRevisoras() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(format(new Date(), "yyyy-MM"));
  const [resultado, setResultado] = useState<BonusRevisoraRow[]>([]);
  const [calculated, setCalculated] = useState(false);

  const calcular = async () => {
    try {
      // Fetch view data
      const { data: viewData, error: e1 } = await supabase
        .from("vw_revisao_mensal")
        .select("*")
        .eq("mes", mes);
      if (e1) throw e1;

      // Fetch defeitos mensais
      const { data: defeitosData, error: e2 } = await supabase
        .from("defeitos_mensais")
        .select("*")
        .eq("mes_referencia", mes)
        .maybeSingle();
      if (e2) throw e2;

      // Fetch config
      const { data: config, error: e3 } = await supabase
        .from("config_bonificacao_revisoras")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (e3) throw e3;
      if (!config) { toast.error("Configure os parâmetros de bonificação primeiro"); return; }

      const pctDefeitoGlobal = defeitosData && defeitosData.total_pecas_expedidas > 0
        ? (defeitosData.total_defeitos_reportados / defeitosData.total_pecas_expedidas) * 100
        : 0;

      // Determine quality bonus tier (global defect rate)
      let bonusDefBase: number;
      if (pctDefeitoGlobal === 0) bonusDefBase = Number(config.bonus_defeito_0_pct);
      else if (pctDefeitoGlobal <= 1) bonusDefBase = Number(config.bonus_defeito_ate_1_pct);
      else if (pctDefeitoGlobal <= 3) bonusDefBase = Number(config.bonus_defeito_ate_3_pct);
      else bonusDefBase = Number(config.bonus_defeito_acima_3_pct);

      const rows: BonusRevisoraRow[] = (viewData || []).map((v: any) => {
        const pctPrazo = Number(v.pct_prazo) || 0;

        // Determine prazo bonus per reviewer
        const bonusPrazo = pctPrazo >= 100
          ? Number(config.bonus_prazo_dentro)
          : Number(config.bonus_prazo_fora);

        return {
          revisora_id: v.revisora_id,
          revisora_nome: v.revisora_nome,
          pct_prazo: pctPrazo,
          pct_defeito: Math.round(pctDefeitoGlobal * 100) / 100,
          bonus_prazo: bonusPrazo,
          bonus_qualidade: bonusDefBase,
          total: Math.round((bonusPrazo + bonusDefBase) * 100) / 100,
        };
      });

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
          .from("bonus_revisoras")
          .upsert({
            revisora_id: r.revisora_id,
            mes_referencia: mes,
            bonus_prazo: r.bonus_prazo,
            bonus_qualidade: r.bonus_qualidade,
            total: r.total,
            status: "pendente",
          }, { onConflict: "revisora_id,mes_referencia" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bonus_revisoras"] });
      toast.success("Bônus registrados com status pendente");
    },
    onError: () => toast.error("Erro ao registrar bônus"),
  });

  const fmtCur = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-primary flex items-center gap-2">
          <Calculator className="h-5 w-5" /> Calculadora de Bônus — Revisoras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Label>Mês de Referência</Label>
            <Input type="month" value={mes} onChange={(e) => { setMes(e.target.value); setCalculated(false); }} />
          </div>
          <Button onClick={calcular}>
            <Calculator className="h-4 w-4 mr-1" /> Calcular
          </Button>
        </div>

        {calculated && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Revisora</TableHead>
                  <TableHead className="text-right">% Prazo</TableHead>
                  <TableHead className="text-right">% Defeito</TableHead>
                  <TableHead className="text-right">Bônus Prazo</TableHead>
                  <TableHead className="text-right">Bônus Qualidade</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhuma revisão encontrada para o mês
                    </TableCell>
                  </TableRow>
                ) : (
                  resultado.map((r, i) => (
                    <TableRow key={r.revisora_id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                      <TableCell className="font-medium">{r.revisora_nome}</TableCell>
                      <TableCell className="text-right">{r.pct_prazo}%</TableCell>
                      <TableCell className="text-right">{r.pct_defeito}%</TableCell>
                      <TableCell className="text-right">{fmtCur(r.bonus_prazo)}</TableCell>
                      <TableCell className="text-right">{fmtCur(r.bonus_qualidade)}</TableCell>
                      <TableCell className="text-right font-bold text-amber-600">
                        <span className="flex items-center justify-end gap-1">
                          <Trophy className="h-4 w-4" /> {fmtCur(r.total)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {resultado.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={() => registrar.mutate()} disabled={registrar.isPending}>
                  {registrar.isPending ? "Registrando..." : "Registrar Bônus"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
