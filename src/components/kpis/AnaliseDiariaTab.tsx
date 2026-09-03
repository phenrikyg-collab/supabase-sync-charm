import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatarData } from "@/utils/formatters";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, TrendingUp, TrendingDown, Loader2, AlertTriangle } from "lucide-react";

const fmtBRL = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));
const fmtNum = (n: number | null | undefined) => new Intl.NumberFormat("pt-BR").format(Number(n ?? 0));
const fmtPct = (n: number | null | undefined, d = 1) => `${Number(n ?? 0).toFixed(d)}%`.replace(".", ",");
const fmtPp = (n: number | null | undefined, d = 2) => `${Number(n ?? 0).toFixed(d)} p.p.`.replace(".", ",");

function ontemBrasilia(): Date {
  const agora = new Date();
  // Brasília é UTC-3
  const offsetMs = -3 * 60 * 60 * 1000;
  const dataBr = new Date(agora.getTime() + offsetMs);
  return subDays(dataBr, 1);
}

interface DiaDados {
  data: string;
  receita: number;
  total_pedidos: number;
  ticket_medio: number;
  sessoes: number;
  taxa_conversao_pct: number;
}

interface CanalSessoes {
  canal: string;
  sessoes_atual: number;
  sessoes_anterior: number;
  variacao_absoluta: number;
  variacao_pct: number;
}

interface AnaliseDiariaResponse {
  dia_analisado: DiaDados;
  dia_anterior: DiaDados;
  variacao_receita_pct: number;
  variacao_sessoes_pct: number;
  variacao_ticket_medio_pct: number;
  variacao_taxa_conversao_pct_pontos: number;
  canais_sessoes: CanalSessoes[];
  fonte_sessoes?: string | null;
  aviso?: string | null;
}

function num(v: any): number {
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

export default function AnaliseDiariaTab() {
  const [dataSelecionada, setDataSelecionada] = useState<Date>(ontemBrasilia());

  const dataParam = useMemo(() => format(dataSelecionada, "yyyy-MM-dd"), [dataSelecionada]);

  const analise = useQuery({
    queryKey: ["kpis_analise_diaria", dataParam],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kpis_analise_diaria", { p_data: dataParam });
      if (error) throw error;
      return (data ?? null) as AnaliseDiariaResponse | null;
    },
  });

  const d = analise.data;

  const drivers: { label: string; valor: number; variacao: number; formato: "moeda" | "numero" | "pct" | "pp"; chave: string; fonte?: string | null }[] = useMemo(() => {
    if (!d) return [];
    return [
      { label: "Receita", valor: num(d.dia_analisado.receita), variacao: num(d.variacao_receita_pct), formato: "moeda", chave: "receita" },
      { label: "Sessões", valor: num(d.dia_analisado.sessoes), variacao: num(d.variacao_sessoes_pct), formato: "numero", chave: "sessoes", fonte: d.fonte_sessoes ?? null },
      { label: "Ticket Médio", valor: num(d.dia_analisado.ticket_medio), variacao: num(d.variacao_ticket_medio_pct), formato: "moeda", chave: "ticket" },
      { label: "Taxa de Conversão", valor: num(d.dia_analisado.taxa_conversao_pct), variacao: num(d.variacao_taxa_conversao_pct_pontos), formato: "pp", chave: "conversao" },
    ];
  }, [d]);

  const interpretacao = useMemo(() => {
    if (!d || drivers.length === 0) return null;
    const receitaVar = num(d.variacao_receita_pct);
    const subiu = receitaVar > 0;
    const direcao = subiu ? "subiu" : "caiu";
    const direcaoSessoes = num(d.variacao_sessoes_pct) >= 0 ? "aumento" : "queda";
    const direcaoTicket = num(d.variacao_ticket_medio_pct) >= 0 ? "aumento" : "queda";
    const direcaoConversao = num(d.variacao_taxa_conversao_pct_pontos) >= 0 ? "aumento" : "queda";

    // driver com maior variação em módulo entre sessões/ticket/conversão
    const candidatos = [
      { nome: "sessões", variacao: Math.abs(num(d.variacao_sessoes_pct)), texto: `o ${direcaoSessoes} de ${fmtPct(Math.abs(num(d.variacao_sessoes_pct)))} nas sessões` },
      { nome: "ticket", variacao: Math.abs(num(d.variacao_ticket_medio_pct)), texto: `o ${direcaoTicket} de ${fmtPct(Math.abs(num(d.variacao_ticket_medio_pct)))} no ticket médio` },
      { nome: "conversao", variacao: Math.abs(num(d.variacao_taxa_conversao_pct_pontos)), texto: `a ${direcaoConversao} de ${fmtPp(Math.abs(num(d.variacao_taxa_conversao_pct_pontos)))} na taxa de conversão` },
    ];
    const principal = candidatos.sort((a, b) => b.variacao - a.variacao)[0];

    const outros = candidatos
      .filter((c) => c.nome !== principal.nome)
      .map((c) => c.texto.replace(/^o |^a /, ""));

    return {
      frase: `A receita ${direcao} ${fmtPct(Math.abs(receitaVar))} principalmente por causa de ${principal.texto} (${outros.join(" e ")}).`,
      principal,
    };
  }, [d, drivers]);

  const mostrarCanais = useMemo(() => {
    if (!d) return false;
    const v = Math.abs(num(d.variacao_sessoes_pct));
    return v > 10;
  }, [d]);

  function formatarValor(formato: "moeda" | "numero" | "pct" | "pp", valor: number) {
    if (formato === "moeda") return fmtBRL(valor);
    if (formato === "numero") return fmtNum(valor);
    if (formato === "pct") return fmtPct(valor);
    return fmtPp(valor);
  }

  function formatarVariacao(formato: "moeda" | "numero" | "pct" | "pp", variacao: number) {
    if (formato === "pp") return `${variacao >= 0 ? "+" : ""}${fmtPp(variacao)}`;
    return `${variacao >= 0 ? "+" : ""}${formatarValor(formato, variacao)}`;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Por que a receita mudou?</h2>
          <p className="text-sm text-muted-foreground">
            Compare o dia selecionado com o dia anterior imediato.
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal sm:w-auto">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatarData(format(dataSelecionada, "yyyy-MM-dd"))}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={dataSelecionada}
              onSelect={(date) => date && setDataSelecionada(date)}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {analise.isLoading && (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {analise.isError && (
        <Card className="rounded-xl border-danger/30 bg-danger/5 p-5">
          <p className="text-sm text-danger">Erro ao carregar análise diária. Tente novamente.</p>
        </Card>
      )}

      {!analise.isLoading && d && (
        <>
          {/* Aviso de qualidade dos dados */}
          {d.aviso && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{d.aviso}</span>
            </div>
          )}

          {/* Cards de driver */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {drivers.map((driver) => {
              const positivo = driver.variacao >= 0;
              const Icon = positivo ? TrendingUp : TrendingDown;
              return (
                <Card key={driver.chave} className="rounded-xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {driver.label}
                      </p>
                      <p className="mt-1 font-serif text-2xl font-bold truncate">
                        {formatarValor(driver.formato, driver.valor)}
                      </p>
                      {driver.fonte && (
                        <p className="mt-1 text-[11px] text-muted-foreground truncate">
                          fonte: {driver.fonte}
                        </p>
                      )}
                    </div>
                    <div className={cn("rounded-lg p-2.5", positivo ? "bg-success/10" : "bg-danger/10")}>
                      <Icon className={cn("h-5 w-5", positivo ? "text-success" : "text-danger")} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-medium",
                        positivo
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-danger/30 bg-danger/10 text-danger"
                      )}
                    >
                      {formatarVariacao(driver.formato, driver.variacao)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">vs dia anterior</span>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Interpretação automática */}
          {interpretacao && (
            <Card className="rounded-xl border-primary/30 bg-primary/5 p-5">
              <p className="text-sm leading-relaxed text-foreground">
                {interpretacao.frase}
              </p>
            </Card>
          )}

          {/* Tabela de canais */}
          {mostrarCanais && d.canais_sessoes && d.canais_sessoes.length > 0 && (
            <Card className="rounded-xl p-5">
              <h3 className="mb-1 font-semibold">Canais que mais moveram as sessões</h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Variação de sessões por canal entre o dia analisado e o anterior.
              </p>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Canal</TableHead>
                      <TableHead className="text-right">Ontem</TableHead>
                      <TableHead className="text-right">Anterior</TableHead>
                      <TableHead className="text-right">Variação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.canais_sessoes.map((canal, i) => {
                      const positivo = num(canal.variacao_pct) >= 0;
                      return (
                        <TableRow key={`${canal.canal}-${i}`}>
                          <TableCell className="font-medium">{canal.canal}</TableCell>
                          <TableCell className="text-right">{fmtNum(canal.sessoes_atual)}</TableCell>
                          <TableCell className="text-right">{fmtNum(canal.sessoes_anterior)}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-medium",
                                positivo
                                  ? "border-success/30 bg-success/10 text-success"
                                  : "border-danger/30 bg-danger/10 text-danger"
                              )}
                            >
                              {positivo ? "+" : ""}
                              {fmtPct(canal.variacao_pct)} ({canal.variacao_absoluta >= 0 ? "+" : ""}
                              {fmtNum(canal.variacao_absoluta)} sessões)
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {mostrarCanais && (!d.canais_sessoes || d.canais_sessoes.length === 0) && (
            <Card className="rounded-xl p-5">
              <p className="text-sm text-muted-foreground">
                A variação de sessões foi relevante, mas não há detalhamento por canal para este dia.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
