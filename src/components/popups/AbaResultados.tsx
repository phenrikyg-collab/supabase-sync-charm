import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";
import {
  popupsApi, ROTULO_FECHOU, ROTULO_GATILHO, dataBR, moedaBR, nBR, pctBR, type Diagnostico,
} from "@/lib/popups";
import { TabelaLeads } from "./TabelaLeads";

const CORES = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--danger))", "hsl(var(--muted-foreground))"];

function isoDiasAtras(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export function AbaResultados({ popupId, diagnostico }: { popupId: number; diagnostico?: Diagnostico | null }) {
  const [periodo, setPeriodo] = useState<number | "custom">(30);
  const [de, setDe] = useState(isoDiasAtras(30));
  const [ate, setAte] = useState(new Date().toISOString().slice(0, 10));
  const [mostrarTestes, setMostrarTestes] = useState(false);

  const faixa = useMemo(() => {
    if (periodo === "custom") return { de, ate };
    return { de: isoDiasAtras(periodo), ate: new Date().toISOString().slice(0, 10) };
  }, [periodo, de, ate]);

  const { data: metricas, isLoading } = useQuery({
    queryKey: ["popups-metricas", popupId, faixa.de, faixa.ate],
    queryFn: () => popupsApi.metricas(popupId, faixa.de, faixa.ate),
  });
  const { data: eng } = useQuery({
    queryKey: ["popups-engajamento", popupId, faixa.de, faixa.ate],
    queryFn: () => popupsApi.engajamento(popupId, faixa.de, faixa.ate),
  });

  const resumo = metricas?.resumo ?? {};
  const bench = diagnostico?.benchmark ?? null;
  const taxa = Number(resumo.taxa_conversao ?? 0);
  const impressoes = Number(resumo.impressoes ?? 0);
  const amostraPequena = impressoes < 300;

  const posicao = bench ? Math.max(0, Math.min(100, ((taxa - 0) / Math.max(bench.ate * 1.4, 1)) * 100)) : 0;
  const inicioFaixa = bench ? (bench.de / Math.max(bench.ate * 1.4, 1)) * 100 : 0;
  const fimFaixa = bench ? (bench.ate / Math.max(bench.ate * 1.4, 1)) * 100 : 0;
  const corTaxa = amostraPequena ? "text-muted-foreground" : !bench ? "" : taxa < bench.de ? "text-danger" : taxa > bench.ate ? "text-success" : "text-success";

  const porDispositivo = Object.entries(metricas?.por_dispositivo ?? {}).map(([k, v]) => ({ nome: k, valor: Number(v) }));
  const porGatilho = Object.entries(metricas?.por_gatilho ?? {}).map(([k, v]) => ({ nome: ROTULO_GATILHO[k] ?? k, valor: Number(v) }));
  const fechouComo = Object.entries(metricas?.fechou_como ?? {}).map(([k, v]) => ({ nome: ROTULO_FECHOU[k] ?? k, valor: Number(v) }));
  const funil = metricas?.funil_etapas ?? [];
  const baseFunil = Number(funil?.[0]?.pessoas ?? funil?.[0]?.valor ?? 0);

  const fechou3s = Number(eng?.taxa_fechou_em_3s ?? 0);
  const focos = Number(eng?.focos ?? 0);
  const focouFechou = Number(eng?.fechou_depois_de_focar ?? 0);
  const pctFocouFechou = focos > 0 ? (focouFechou / focos) * 100 : 0;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-end gap-2">
        {[7, 30, 90].map((d) => (
          <Button key={d} size="sm" variant={periodo === d ? "default" : "outline"} onClick={() => setPeriodo(d)}>
            {d} dias
          </Button>
        ))}
        <Button size="sm" variant={periodo === "custom" ? "default" : "outline"} onClick={() => setPeriodo("custom")}>
          Personalizado
        </Button>
        {periodo === "custom" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-40" />
            </div>
          </>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {dataBR(faixa.de)} a {dataBR(faixa.ate)}
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Impressões" value={nBR(resumo.impressoes)} />
            <StatCard title="Visitantes únicas" value={nBR(resumo.visitantes)} />
            <StatCard title="Conversões" value={nBR(resumo.conversoes)} variant="primary" />
            <StatCard title="Taxa de conversão" value={pctBR(resumo.taxa_conversao)} variant="success" />
            <StatCard title="Cupons gerados" value={nBR(resumo.cupons_gerados)} />
            <StatCard
              title="Cupons usados"
              value={nBR(resumo.cupons_usados)}
              subtitle={`Uso: ${pctBR(resumo.taxa_uso_cupom)}`}
            />
            <StatCard title="Receita com cupom" value={moedaBR(resumo.receita)} />
            <StatCard title="Desconto concedido" value={moedaBR(resumo.desconto)} />
          </div>

          {bench && (
            <Card>
              <CardHeader><CardTitle className="text-base">Faixa esperada: {bench.tipo}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="relative h-4 w-full rounded-full bg-muted">
                  <div
                    className="absolute h-4 rounded-full bg-success/30"
                    style={{ left: `${inicioFaixa}%`, width: `${Math.max(2, fimFaixa - inicioFaixa)}%` }}
                  />
                  <div
                    className={cn("absolute -top-1 h-6 w-1 rounded-full", amostraPequena ? "bg-muted-foreground" : taxa < bench.de ? "bg-danger" : "bg-success")}
                    style={{ left: `${posicao}%` }}
                  />
                </div>
                <p className={cn("text-sm font-medium", corTaxa)}>
                  {amostraPequena
                    ? "Amostra pequena, menos de 300 impressões no período."
                    : `Este popup está em ${pctBR(taxa)}. Esperado de ${pctBR(bench.de)} a ${pctBR(bench.ate)}.`}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Engajamento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div>
                  <p className="text-xs text-muted-foreground">Foco no formulário</p>
                  <p className="text-lg font-semibold">{pctBR(eng?.taxa_foco)}</p>
                  <p className="text-[11px] text-muted-foreground">Mediana até focar: {nBR(eng?.tempo_ate_focar_s)} s</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fechou em até 3 s</p>
                  <p className={cn("text-lg font-semibold", fechou3s > 60 && "text-danger")}>{pctBR(eng?.taxa_fechou_em_3s)}</p>
                  {fechou3s > 60 && <p className="text-[11px] text-danger">Abre cedo demais ou a oferta não aparece de cara.</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mediana até fechar</p>
                  <p className="text-lg font-semibold">{nBR(eng?.tempo_ate_fechar_s)} s</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Focou e fechou sem enviar</p>
                  <p className={cn("text-lg font-semibold", pctFocouFechou > 30 && "text-warning")}>{nBR(eng?.fechou_depois_de_focar)}</p>
                  {pctFocouFechou > 30 && <p className="text-[11px] text-warning">Formulário travando: menos campos por etapa.</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Erros de preenchimento</p>
                  <p className="text-lg font-semibold">{nBR(eng?.erros_formulario)}</p>
                </div>
              </div>
              {eng?.leitura && <p className="text-xs text-muted-foreground">{eng.leitura}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Qualidade</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Já clientes barradas</p><p className="text-lg font-semibold">{nBR(resumo.ja_clientes)}</p></div>
              <div><p className="text-xs text-muted-foreground">Cupons reenviados</p><p className="text-lg font-semibold">{nBR(resumo.cupons_reenviados)}</p></div>
              <div><p className="text-xs text-muted-foreground">Bloqueados por limite</p><p className="text-lg font-semibold">{nBR(resumo.bloqueados)}</p></div>
              <div>
                <p className="text-xs text-muted-foreground">Erros</p>
                <p className={cn("text-lg font-semibold", Number(resumo.erros ?? 0) > 0 && "text-danger")}>{nBR(resumo.erros)}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Impressões e conversões por dia</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricas?.por_dia ?? []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dia" tickFormatter={(v) => dataBR(v).slice(0, 5)} fontSize={11} />
                    <YAxis fontSize={11} />
                    <RTooltip labelFormatter={(v) => dataBR(String(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="impressoes" name="Impressões" stroke={CORES[0]} dot={false} />
                    <Line type="monotone" dataKey="conversoes" name="Conversões" stroke={CORES[1]} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Funil de etapas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {funil.map((f: any, i: number) => {
                  const v = Number(f.pessoas ?? f.valor ?? 0);
                  const pct = baseFunil > 0 ? (v / baseFunil) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{f.nome ?? f.etapa}</span>
                        <span className="text-muted-foreground">{nBR(v)} · {pctBR(pct)}</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-muted">
                        <div className="h-3 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!funil.length && <p className="text-xs text-muted-foreground">Sem dados no período.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Dispositivo</CardTitle></CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={porDispositivo} dataKey="valor" nameKey="nome" outerRadius={80} label>
                      {porDispositivo.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Pie>
                    <RTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Como abriu</CardTitle></CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porGatilho} layout="vertical">
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="nome" width={150} fontSize={11} />
                    <RTooltip />
                    <Bar dataKey="valor" fill={CORES[0]} radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Como fechou</CardTitle></CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fechouComo} layout="vertical">
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="nome" width={150} fontSize={11} />
                    <RTooltip />
                    <Bar dataKey="valor" fill={CORES[2]} radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Leads deste popup</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Mostrar testes da prévia</Label>
                <Switch checked={mostrarTestes} onCheckedChange={setMostrarTestes} />
              </div>
            </CardHeader>
            <CardContent>
              <TabelaLeads popupId={popupId} limite={200} incluirTeste={mostrarTestes} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
