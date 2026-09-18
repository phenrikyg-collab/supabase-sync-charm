import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Smartphone, AppWindow, Users, Repeat, BellRing, Send, MousePointerClick,
  UserCheck, ShoppingBag, Package, Banknote, TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { chamarRpc } from "@/lib/supabaseRpc";
import { nBR } from "@/lib/popups";
import { brl } from "@/lib/financeiroFormat";

type SeriePonto = { dia: string; visitantes: number; aberturas: number };

type AppKpis = {
  dias: number;
  visitantes: number;
  instalados: number;
  android: number;
  ios: number;
  recorrentes: number;
  aberturas: number;
  aberturas_por_via: { icone?: number; link?: number; direto?: number } | null;
  aberturas_pelo_icone: number;
  telas: Record<string, number> | null;
  cliques_saida: Record<string, number> | null;
  identificadas: number;
  avisos_inscritas: number;
  avisos_com_cpf: number;
  avisos_enviados: number;
  avisos_cliques: number;
  popups_impressoes: number;
  popups_cliques: number;
  compradoras_pos_app: number;
  pedidos_pos_app: number;
  receita_pos_app: number;
  serie: SeriePonto[] | null;
};

const OPCOES_DIAS = [7, 30, 90];

const ROTULOS_SAIDA: Record<string, string> = {
  loja: "Loja",
  cashback: "Cashback",
  trocas: "Trocas",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

const ROTULOS_TELAS: Record<string, string> = {
  "/": "Início",
  "/inicio": "Início",
  "/rastreio": "Meus pedidos",
};

function rotuloTela(chave: string) {
  return ROTULOS_TELAS[chave] ?? chave;
}

function pct(parte: number | null | undefined, total: number | null | undefined) {
  if (!total) return null;
  return `${(((Number(parte ?? 0) / total) * 100)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/** Barra horizontal simples com rótulo e valor à direita. */
function BarraHoriz({ rotulo, valor, max, cor }: { rotulo: string; valor: number; max: number; cor: string }) {
  const largura = max > 0 ? Math.max(4, (valor / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground/90">{rotulo}</span>
        <span className="text-muted-foreground tabular-nums">{nBR(valor)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${largura}%`, backgroundColor: cor }} />
      </div>
    </div>
  );
}

function Vazio({ texto = "Ainda sem dados neste período" }: { texto?: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{texto}</p>;
}

export default function AppKpis() {
  const [dias, setDias] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["app-kpis", dias],
    queryFn: async () => {
      const { data, error } = await chamarRpc<AppKpis>("app_kpis", { p_dias: dias });
      if (error) throw new Error(error.message ?? "Erro ao carregar indicadores");
      return data;
    },
    staleTime: 60_000,
  });

  const seriesTela = useMemo(() => {
    const lista: Record<string, number> = {};
    for (const [chave, valor] of Object.entries(data?.telas ?? {})) {
      const rotulo = rotuloTela(chave);
      lista[rotulo] = (lista[rotulo] ?? 0) + Number(valor ?? 0);
    }
    return Object.entries(lista)
      .map(([rotulo, valor]) => ({ rotulo, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);
  }, [data?.telas]);

  const saidas = useMemo(
    () =>
      Object.entries(data?.cliques_saida ?? {})
        .map(([chave, valor]) => ({ chave, valor: Number(valor ?? 0) }))
        .sort((a, b) => b.valor - a.valor),
    [data?.cliques_saida]
  );

  const serie = data?.serie ?? [];
  const temSerie = serie.some((p) => (p.visitantes ?? 0) > 0 || (p.aberturas ?? 0) > 0);
  const aberturasVia = data?.aberturas_por_via ?? {};
  const taxaAvisos =
    data && data.avisos_enviados > 0
      ? `${(((data.avisos_cliques ?? 0) / data.avisos_enviados) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
      : "sem cliques ainda";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">Dashboard do App</h1>
          <p className="text-sm text-muted-foreground">
            Como as clientes usam o app Minha MC e o que ele traz de resultado.
          </p>
        </div>
        <div className="flex gap-1.5">
          {OPCOES_DIAS.map((d) => (
            <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} className="h-9" onClick={() => setDias(d)}>
              {d} dias
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
      ) : !data ? (
        <Vazio />
      ) : (
        <>
          {/* Linha 1 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Pessoas no app" value={nBR(data.visitantes)} icon={Users} variant="primary" />
            <StatCard
              title="Com app instalado"
              value={nBR(data.instalados)}
              subtitle={pct(data.instalados, data.visitantes) ? `${pct(data.instalados, data.visitantes)} do total` : undefined}
              icon={Smartphone}
            />
            <StatCard
              title="Voltaram 2+ dias"
              value={nBR(data.recorrentes)}
              subtitle={pct(data.recorrentes, data.visitantes) ? `${pct(data.recorrentes, data.visitantes)} das pessoas` : undefined}
              icon={Repeat}
            />
            <StatCard title="Aberturas pelo ícone" value={nBR(data.aberturas_pelo_icone)} icon={Smartphone} />
          </div>

          {/* Linha 2 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Avisos ligados"
              value={nBR(data.avisos_inscritas)}
              subtitle={`${nBR(data.avisos_com_cpf)} com CPF`}
              icon={BellRing}
              variant="success"
            />
            <StatCard title="Avisos enviados" value={nBR(data.avisos_enviados)} icon={Send} />
            <StatCard title="Cliques nos avisos" value={nBR(data.avisos_cliques)} subtitle={taxaAvisos} icon={MousePointerClick} />
            <StatCard title="Identificadas pelo CPF" value={nBR(data.identificadas)} icon={UserCheck} />
          </div>

          {/* Linha 3 */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Vendas depois do app
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Clientes que compraram</p>
                  <p className="mt-1 font-serif text-2xl font-bold">{nBR(data.compradoras_pos_app)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pedidos</p>
                  <p className="mt-1 font-serif text-2xl font-bold">{nBR(data.pedidos_pos_app)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Receita</p>
                  <p className="mt-1 font-serif text-2xl font-bold">{brl(data.receita_pos_app)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Pedidos de clientes identificadas no app, feitos depois do primeiro uso. É atribuição por contato, não prova de causa.
              </p>
            </CardContent>
          </Card>

          {/* Gráfico de linhas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg">Pessoas e aberturas por dia</CardTitle>
            </CardHeader>
            <CardContent>
              {temSerie ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="dia"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v: string) => {
                        const partes = String(v).slice(0, 10).split("-");
                        return partes.length === 3 ? `${partes[2]}/${partes[1]}` : String(v);
                      }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={36} />
                    <Tooltip
                      formatter={(valor: number | string, nome) => [nBR(Number(valor)), String(nome)]}
                      labelFormatter={(v: string) => {
                        const partes = String(v).slice(0, 10).split("-");
                        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(v);
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="visitantes" name="Pessoas" stroke="#E8CD7E" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="aberturas" name="Aberturas" stroke="#8B6914" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Vazio />
              )}
            </CardContent>
          </Card>

          {/* Barras horizontais */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-lg">Para onde elas vão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {saidas.length && saidas.some((s) => s.valor > 0) ? (
                  (() => {
                    const max = Math.max(...saidas.map((s) => s.valor));
                    return saidas.map((s) => (
                      <BarraHoriz
                        key={s.chave}
                        rotulo={ROTULOS_SAIDA[s.chave] ?? s.chave}
                        valor={s.valor}
                        max={max}
                        cor="#E8CD7E"
                      />
                    ));
                  })()
                ) : (
                  <Vazio />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-lg">Telas mais vistas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {seriesTela.length && seriesTela.some((s) => s.valor > 0) ? (
                  (() => {
                    const max = Math.max(...seriesTela.map((s) => s.valor));
                    return seriesTela.map((s) => (
                      <BarraHoriz key={s.rotulo} rotulo={s.rotulo} valor={s.valor} max={max} cor="#8B6914" />
                    ));
                  })()
                ) : (
                  <Vazio />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Rodapé */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Android" value={nBR(data.android)} icon={Smartphone} />
            <StatCard title="iPhone" value={nBR(data.ios)} icon={Smartphone} />
            <StatCard
              title="Popups do app"
              value={`${nBR(data.popups_impressoes)} / ${nBR(data.popups_cliques)}`}
              subtitle="impressões / cliques"
              icon={MousePointerClick}
            />
          </div>

          {data.visitantes === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Ainda sem dados neste período. As números aparecem conforme as clientes usarem o app.
            </p>
          )}
        </>
      )}
    </div>
  );
}
