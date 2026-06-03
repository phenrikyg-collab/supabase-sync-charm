import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Drivers, calcularCascata, checkDriverFlags, identificarGargalo,
  DRIVER_LABELS, MESES, DEFAULT_DRIVERS,
} from "@/hooks/usePlanejamentoCascata";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const ANO = 2026;
const DRIVER_KEYS: (keyof Drivers)[] = [
  "ticket_medio", "taxa_conversao", "retencao", "aprovacao",
  "cps_midia", "invest_midia", "invest_vip", "invest_imp", "sessoes_org",
];

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (v: number) => Math.round(v).toLocaleString("pt-BR");

function statusBadge(s: string) {
  const map: Record<string, string> = {
    planejado: "bg-muted text-muted-foreground",
    em_execucao: "bg-warning text-warning-foreground",
    realizado: "bg-success text-success-foreground",
  };
  return <Badge className={map[s] ?? "bg-muted"}>{s}</Badge>;
}

function driverIndicator(k: keyof Drivers, v: number) {
  if (k === "retencao") return v < 10 || v > 60 ? "bg-destructive" : v < 25 ? "bg-warning" : "bg-success";
  if (k === "aprovacao") return v < 70 ? "bg-destructive" : v < 88 ? "bg-warning" : "bg-success";
  if (k === "cps_midia") return v > 1.2 ? "bg-warning" : "bg-success";
  if (k === "taxa_conversao") return v < 1.2 ? "bg-warning" : "bg-success";
  if (k === "ticket_medio") return v < 280 ? "bg-warning" : "bg-success";
  return "bg-success";
}

export default function PlanejamentoMensal() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [drivers, setDrivers] = useState<Drivers>(DEFAULT_DRIVERS);
  const [status, setStatus] = useState("planejado");
  const [loading, setLoading] = useState(true);
  const [realizado, setRealizado] = useState<Drivers | null>(null);
  const [showRealForm, setShowRealForm] = useState(false);
  const [realForm, setRealForm] = useState<Drivers>(DEFAULT_DRIVERS);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [d, r] = await Promise.all([
        supabase.from("planejamento_drivers" as any).select("*").eq("ano", ANO).eq("mes", mes).maybeSingle(),
        supabase.from("planejamento_realizado" as any).select("*").eq("ano", ANO).eq("mes", mes).maybeSingle(),
      ]);
      if (d.data) {
        const dd: any = d.data;
        setDrivers({
          retencao: dd.retencao, aprovacao: dd.aprovacao, ticket_medio: dd.ticket_medio,
          taxa_conversao: dd.taxa_conversao, invest_midia: dd.invest_midia, invest_vip: dd.invest_vip,
          invest_imp: dd.invest_imp, sessoes_org: dd.sessoes_org, cps_midia: dd.cps_midia,
        });
        setStatus(dd.status ?? "planejado");
      } else {
        setDrivers(DEFAULT_DRIVERS);
        setStatus("planejado");
      }
      if (r.data) {
        const rd: any = r.data;
        setRealizado({
          retencao: rd.retencao, aprovacao: rd.aprovacao, ticket_medio: rd.ticket_medio,
          taxa_conversao: rd.taxa_conversao, invest_midia: rd.invest_midia, invest_vip: rd.invest_vip,
          invest_imp: rd.invest_imp, sessoes_org: rd.sessoes_org, cps_midia: rd.cps_midia,
        });
        setRealForm({
          retencao: rd.retencao, aprovacao: rd.aprovacao, ticket_medio: rd.ticket_medio,
          taxa_conversao: rd.taxa_conversao, invest_midia: rd.invest_midia, invest_vip: rd.invest_vip,
          invest_imp: rd.invest_imp, sessoes_org: rd.sessoes_org, cps_midia: rd.cps_midia,
        });
      } else {
        setRealizado(null);
        setRealForm(drivers);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  const cascata = useMemo(() => calcularCascata(drivers), [drivers]);
  const cascataReal = useMemo(() => (realizado ? calcularCascata(realizado) : null), [realizado]);
  const flags = useMemo(() => checkDriverFlags(drivers, cascata, mes), [drivers, cascata, mes]);

  const handleSave = async () => {
    const payload: any = { ano: ANO, mes, status, ...drivers };
    const { error } = await supabase.from("planejamento_drivers" as any).upsert(payload, { onConflict: "ano,mes" });
    if (error) toast.error("Erro ao salvar");
    else toast.success("Drivers salvos 💛", { duration: 2000 });
  };

  const handleSaveRealizado = async () => {
    const c = calcularCascata(realForm);
    const cBase = cascata;
    const desvio_receita_pct = cBase.receita_faturada > 0 ? ((c.receita_faturada - cBase.receita_faturada) / cBase.receita_faturada) * 100 : 0;
    const desvio_roas_pct = cBase.roas_faturado > 0 ? ((c.roas_faturado - cBase.roas_faturado) / cBase.roas_faturado) * 100 : 0;
    const desvio_cac_pct = cBase.cac > 0 ? ((c.cac - cBase.cac) / cBase.cac) * 100 : 0;
    const gargalo = identificarGargalo(realForm);
    const payload: any = {
      ano: ANO, mes, ...realForm,
      invest_total: c.invest_total, sessoes_totais: c.sessoes_totais,
      pedidos_faturados: c.pedidos_faturados, receita_captada: c.receita_captada,
      receita_faturada: c.receita_faturada, roas_faturado: c.roas_faturado,
      cac: c.cac, adcost_pct: c.adcost_pct,
      desvio_receita_pct, desvio_roas_pct, desvio_cac_pct,
      driver_gargalo: gargalo?.driver, impacto_gargalo: gargalo?.impacto,
    };
    const { error } = await supabase.from("planejamento_realizado" as any).upsert(payload, { onConflict: "ano,mes" });
    if (error) { toast.error("Erro ao salvar"); return; }
    setRealizado(realForm);
    setShowRealForm(false);
    toast.success("Realizado salvo 💛");
  };

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-serif">Planejamento Mensal</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMes((m) => Math.max(1, m - 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="px-4 py-2 border rounded font-medium min-w-[140px] text-center">{MESES[mes - 1]} / {ANO}</div>
          <Button variant="outline" size="icon" onClick={() => setMes((m) => Math.min(12, m + 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drivers Panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-xl">Drivers do Mês</CardTitle>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planejado">Planejado</SelectItem>
                <SelectItem value="em_execucao">Em execução</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-3">
            {DRIVER_KEYS.map((k) => (
              <div key={k} className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${driverIndicator(k, drivers[k] as number)}`} />
                  {DRIVER_LABELS[k].label} <span className="text-muted-foreground">({DRIVER_LABELS[k].unit})</span>
                </label>
                <Input
                  type="number" step="0.01"
                  value={drivers[k] as number}
                  onChange={(e) => setDrivers({ ...drivers, [k]: Number(e.target.value.replace(",", ".")) || 0 })}
                />
                <p className="text-xs text-muted-foreground">Faixa saudável: {DRIVER_LABELS[k].faixa}</p>
              </div>
            ))}
            <Button onClick={handleSave} className="w-full mt-4">Salvar Drivers</Button>
          </CardContent>
        </Card>

        {/* Cascata Panel */}
        <Card>
          <CardHeader><CardTitle className="font-serif text-xl">Cascata Calculada</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground tracking-wider mb-2">Tráfego</p>
              <div className="grid grid-cols-2 gap-2">
                <div>Sessões Totais: <strong>{fmtNum(cascata.sessoes_totais)}</strong></div>
                <div>% Pago: <strong>{cascata.pct_midia.toFixed(1)}%</strong></div>
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs uppercase text-muted-foreground tracking-wider mb-2">Pedidos</p>
              <div className="grid grid-cols-2 gap-2">
                <div>Captados: <strong>{fmtNum(cascata.pedidos_captados)}</strong></div>
                <div>Aquisição: <strong>{fmtNum(cascata.pedidos_aquisicao)}</strong></div>
                <div>Retenção: <strong>{fmtNum(cascata.pedidos_retencao)}</strong></div>
                <div>Faturados: <strong>{fmtNum(cascata.pedidos_faturados)}</strong></div>
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs uppercase text-muted-foreground tracking-wider mb-2">Receita</p>
              <div className="grid grid-cols-2 gap-2">
                <div>Captada: <strong>{fmtBRL(cascata.receita_captada)}</strong></div>
                <div className="text-primary">Faturada: <strong>{fmtBRL(cascata.receita_faturada)}</strong></div>
                <div className="text-destructive">Cancelada: <strong>{fmtBRL(cascata.receita_cancelada)}</strong></div>
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs uppercase text-muted-foreground tracking-wider mb-2">Eficiência</p>
              <div className="grid grid-cols-2 gap-2">
                <div>CAC: <strong>{fmtBRL(cascata.cac)}</strong></div>
                <div>CPA Real: <strong>{fmtBRL(cascata.cpa_real)}</strong></div>
                <div className="flex items-center gap-2">ROAS: <Badge className={cascata.roas_faturado >= 4 ? "bg-success text-success-foreground" : cascata.roas_faturado >= 2.5 ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground"}>{cascata.roas_faturado.toFixed(2)}x</Badge></div>
                <div>AdCost %: <strong>{cascata.adcost_pct.toFixed(1)}%</strong></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Status:</span> {statusBadge(status)}</div>

      {/* Planejado vs Realizado */}
      {(status === "em_execucao" || status === "realizado") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-xl">Planejado vs. Realizado</CardTitle>
            <Dialog open={showRealForm} onOpenChange={setShowRealForm}>
              <DialogTrigger asChild><Button>Preencher Realizado</Button></DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Realizado — {MESES[mes - 1]}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  {DRIVER_KEYS.map((k) => (
                    <div key={k}>
                      <label className="text-sm">{DRIVER_LABELS[k].label} ({DRIVER_LABELS[k].unit})</label>
                      <Input type="number" step="0.01" value={realForm[k] as number}
                        onChange={(e) => setRealForm({ ...realForm, [k]: Number(e.target.value.replace(",", ".")) || 0 })} />
                    </div>
                  ))}
                </div>
                <DialogFooter><Button onClick={handleSaveRealizado}>Salvar Realizado</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {!realizado ? (
              <p className="text-muted-foreground">Nenhum realizado registrado ainda.</p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-sidebar-background text-sidebar-foreground">
                    <tr><th className="px-3 py-2 text-left">Driver</th><th className="px-3 py-2 text-right">Planejado</th><th className="px-3 py-2 text-right">Realizado</th><th className="px-3 py-2 text-right">Desvio</th></tr>
                  </thead>
                  <tbody>
                    {DRIVER_KEYS.map((k) => {
                      const p = drivers[k] as number;
                      const r = realizado[k] as number;
                      const desvio = p > 0 ? ((r - p) / p) * 100 : 0;
                      const positive = desvio >= 0;
                      // For CPS, lower is better — invert color
                      const goodPositive = k === "cps_midia" ? !positive : positive;
                      return (
                        <tr key={k} className="border-t">
                          <td className="px-3 py-2">{DRIVER_LABELS[k].label}</td>
                          <td className="px-3 py-2 text-right">{p}</td>
                          <td className="px-3 py-2 text-right">{r}</td>
                          <td className={`px-3 py-2 text-right ${goodPositive ? "text-success" : "text-destructive"}`}>{desvio.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {cascataReal && (() => {
                  const gargalo = identificarGargalo(realizado);
                  const impactoReceita = cascataReal.receita_faturada - cascata.receita_faturada;
                  return (
                    <Card className="mt-4 border-primary/40 bg-primary/5">
                      <CardContent className="p-4 space-y-2">
                        <p className="font-medium">Driver do Desvio</p>
                        {gargalo ? (
                          <>
                            <p className="text-sm">Maior gap: <strong>{DRIVER_LABELS[gargalo.driver as keyof Drivers]?.label ?? gargalo.driver}</strong> (atual: {gargalo.valor.toFixed(2)}, ideal: {gargalo.ideal})</p>
                            <p className="text-sm">Impacto na receita do mês: <strong className={impactoReceita >= 0 ? "text-success" : "text-destructive"}>{fmtBRL(impactoReceita)}</strong></p>
                          </>
                        ) : <p className="text-sm text-muted-foreground">Sem gargalo identificado.</p>}
                      </CardContent>
                    </Card>
                  );
                })()}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Red Flags */}
      <Card>
        <CardHeader><CardTitle className="font-serif text-xl">Red Flags do Mês</CardTitle></CardHeader>
        <CardContent>
          {flags.length === 0 ? (
            <p className="text-muted-foreground">Todos os drivers dentro das faixas saudáveis 💛</p>
          ) : (
            <div className="space-y-2">
              {flags.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-2 border rounded">
                  <Badge className={f.severity === "danger" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}>{f.severity === "danger" ? "🔴" : "⚠️"}</Badge>
                  <span className="font-medium">{f.driver}</span>
                  <span className="text-sm text-muted-foreground">valor: {f.valor.toFixed(2)} · faixa: {f.faixa}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
