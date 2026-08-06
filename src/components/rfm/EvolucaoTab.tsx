import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Info } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

type Historico = {
  id: string;
  mes: string;
  segmento_rfm: string;
  total_clientes: number | null;
  receita_total: number | null;
};

const PALETA = [
  "hsl(142 60% 40%)", "hsl(160 50% 40%)", "hsl(200 60% 45%)", "hsl(210 70% 55%)",
  "hsl(190 55% 45%)", "hsl(38 92% 50%)", "hsl(25 90% 50%)", "hsl(20 90% 48%)",
  "hsl(220 9% 55%)", "hsl(0 72% 51%)",
];

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

const fmtMes = (m: string) => {
  if (!m) return "—";
  const [ano, mes] = m.split("-");
  return `${mes}/${ano}`;
};

export function EvolucaoTab() {
  const [metrica, setMetrica] = useState<"total_clientes" | "receita_total">("total_clientes");

  const { data: historico = [], isLoading, error } = useQuery({
    queryKey: ["rfm_historico"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfm_historico" as any)
        .select("*")
        .order("mes", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as Historico[];
    },
  });

  const segmentos = useMemo(
    () => Array.from(new Set(historico.map((h) => h.segmento_rfm))).sort(),
    [historico]
  );

  const meses = useMemo(
    () => Array.from(new Set(historico.map((h) => String(h.mes).slice(0, 7)))).sort(),
    [historico]
  );

  const dados = useMemo(() => {
    const mapa = new Map<string, any>();
    meses.forEach((m) => mapa.set(m, { mes: fmtMes(m) }));
    historico.forEach((h) => {
      const chave = String(h.mes).slice(0, 7);
      const linha = mapa.get(chave);
      if (!linha) return;
      linha[h.segmento_rfm] = Number(h[metrica] ?? 0);
    });
    return [...mapa.values()];
  }, [historico, meses, metrica]);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="text-base">Evolução dos segmentos</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Snapshot gerado automaticamente todo dia 1º do mês
          </p>
        </div>
        <Tabs value={metrica} onValueChange={(v) => setMetrica(v as any)}>
          <TabsList>
            <TabsTrigger value="total_clientes">Clientes</TabsTrigger>
            <TabsTrigger value="receita_total">Receita</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-6">
            Não foi possível carregar o histórico: {(error as any)?.message}. Verifique se você está autenticado.
          </p>
        ) : meses.length === 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5" />
            Ainda não há snapshots registrados.
          </div>
        ) : (
          <>
            {meses.length === 1 && (
              <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5" />
                Histórico começou a ser registrado agora — volte no próximo mês pra ver a evolução.
              </div>
            )}
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dados} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => (metrica === "receita_total" ? fmtMoney(Number(v)) : String(v))}
                    width={metrica === "receita_total" ? 80 : 40}
                  />
                  <Tooltip
                    formatter={(v: any) =>
                      metrica === "receita_total" ? fmtMoney(Number(v)) : new Intl.NumberFormat("pt-BR").format(Number(v))
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {segmentos.map((s, i) => (
                    <Line
                      key={s}
                      type="monotone"
                      dataKey={s}
                      stroke={PALETA[i % PALETA.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
