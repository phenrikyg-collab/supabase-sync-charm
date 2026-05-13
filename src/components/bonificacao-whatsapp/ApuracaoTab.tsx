import { useApurarMes } from "@/hooks/useBonificacaoWhatsApp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, FileText, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { corPorAtingimento } from "@/lib/bonificacaoWhatsApp";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));
const fmtPct = (n: number, d = 1) => `${Number(n ?? 0).toFixed(d)}%`;

export default function ApuracaoTab({ mes }: { mes: string }) {
  const r = useApurarMes(mes);
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);

  if (r.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Calculando...
      </div>
    );
  }

  async function salvarApuracao(status: "aprovado" | "pago") {
    setSalvando(true);
    try {
      const rows = r.linhas.map((l) => ({
        mes_referencia: mes,
        consultora_id: l.consultora.id,
        faturamento_liquido: l.faturamento_liquido,
        meta: l.meta,
        pct_atingimento: l.pct_atingimento,
        ticket_medio: l.ticket_medio,
        desconto_medio_pct: l.desconto_medio_pct,
        qtd_pedidos: l.qtd_pedidos,
        bonus_base: l.bonus_base,
        multiplicador_desconto: l.multiplicador_desconto,
        acelerador_ticket: l.acelerador_ticket,
        bonus_final: l.bonus_final,
        status,
        data_pagamento: status === "pago" ? new Date().toISOString().slice(0, 10) : null,
      }));
      const { error } = await supabase
        .from("bonus_whatsapp_apurados" as any)
        .upsert(rows, { onConflict: "mes_referencia,consultora_id" });
      if (error) throw error;
      toast.success(`Apuração ${status === "pago" ? "marcada como paga" : "aprovada"}`);
      qc.invalidateQueries({ queryKey: ["bonus-historico"] });
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSalvando(false);
    }
  }

  function exportCSV() {
    const head = ["Consultora", "Faturamento", "Meta", "% Ating.", "Pedidos", "Ticket", "Desconto %", "Bônus base", "Mult. desconto", "Acelerador", "Bônus final"];
    const rows = r.linhas.map((l) => [
      l.consultora.nome, l.faturamento_liquido.toFixed(2), l.meta.toFixed(2),
      l.pct_atingimento.toFixed(1), l.qtd_pedidos, l.ticket_medio.toFixed(2),
      l.desconto_medio_pct.toFixed(2), l.bonus_base, l.multiplicador_desconto,
      l.acelerador_ticket, l.bonus_final.toFixed(2),
    ]);
    const csv = [head, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bonificacao-whatsapp-${mes}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-serif text-xl">Apuração detalhada — {mes}</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button size="sm" disabled={salvando || r.linhas.length === 0} onClick={() => salvarApuracao("aprovado")}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
          </Button>
          <Button size="sm" variant="default" disabled={salvando || r.linhas.length === 0} onClick={() => salvarApuracao("pago")}>
            Marcar como pago
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Consultora</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right">% Ating.</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Ticket</TableHead>
              <TableHead className="text-right">Desc. %</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">× Desc.</TableHead>
              <TableHead className="text-right">+ Ticket</TableHead>
              <TableHead className="text-right font-semibold">Bônus final</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.linhas.map((l) => {
              const c = corPorAtingimento(l.pct_atingimento);
              return (
                <TableRow key={l.consultora.id}>
                  <TableCell className="font-medium">{l.consultora.nome}</TableCell>
                  <TableCell className="text-right">{fmtBRL(l.faturamento_liquido)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtBRL(l.meta)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={`${c.bg} ${c.text} border-0`}>{fmtPct(l.pct_atingimento, 0)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{l.qtd_pedidos}</TableCell>
                  <TableCell className="text-right">{fmtBRL(l.ticket_medio)}</TableCell>
                  <TableCell className="text-right">{fmtPct(l.desconto_medio_pct, 1)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(l.bonus_base)}</TableCell>
                  <TableCell className="text-right">{(l.multiplicador_desconto * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-right">{fmtBRL(l.acelerador_ticket)}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">{fmtBRL(l.bonus_final)}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/30 font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{fmtBRL(r.totais.faturamento_liquido)}</TableCell>
              <TableCell className="text-right">{fmtBRL(r.totais.meta)}</TableCell>
              <TableCell className="text-right">{fmtPct(r.totais.pct, 0)}</TableCell>
              <TableCell className="text-right">{r.totais.qtd_pedidos}</TableCell>
              <TableCell className="text-right">{fmtBRL(r.totais.ticket_medio)}</TableCell>
              <TableCell className="text-right">{fmtPct(r.totais.desconto_medio_pct, 1)}</TableCell>
              <TableCell colSpan={3}></TableCell>
              <TableCell className="text-right text-primary">{fmtBRL(r.totais.bonus)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {r.semConsultora.qtd_pedidos > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            ⚠️ {r.semConsultora.qtd_pedidos} pedidos do canal WhatsApp ({fmtBRL(r.semConsultora.faturamento_liquido)})
            não foram associados a nenhuma consultora. Ajuste os padrões em Configurações.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
