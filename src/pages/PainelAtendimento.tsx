import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chamarRpc } from "@/lib/supabaseRpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Activity, ArrowDown, ArrowUp, Clock, Loader2, MessageCircle, RefreshCw, Users,
} from "lucide-react";

type FilaItem = { conversa_id: string | number | null; nome: string | null; telefone: string | null; minutos: number | null };

type Kpis = {
  hoje?: { atendimentos?: number | null; ontem?: number | null; conversas_novas?: number | null };
  fila?: {
    aguardando?: number | null; espera_mais_antiga_min?: number | null; acima_de_30min?: number | null;
    em_atendimento?: number | null; lista?: FilaItem[] | null;
  };
  tempos?: {
    humana_mediana_min?: number | null; humana_p90_min?: number | null; humana_amostra?: number | null;
    anna_mediana_seg?: number | null; resolucao_mediana_horas?: number | null; resolucao_amostra?: number | null;
  };
  conversao?: {
    atendimentos?: number | null; pagos?: number | null; taxa_pct?: number | null;
    receita?: number | null; ticket_medio?: number | null;
  };
  em_aberto?: {
    propostas?: number | null; propostas_valor?: number | null; propostas_mais_antiga_horas?: number | null;
    links?: number | null; links_valor?: number | null; links_mais_antigo_horas?: number | null;
  };
  carga?: { atendente?: string | null; conversas?: number | null; mensagens?: number | null }[] | null;
  anna?: {
    conversas?: number | null; sem_humano_pct?: number | null; escaladas?: number | null;
    chamadas_ia?: number | null; segundos_medio?: number | null;
  };
};

const TRACO = "—";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function fmtNum(v: unknown, casas = 0) {
  const n = num(v);
  if (n === null) return TRACO;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function fmtMoeda(v: unknown) {
  const n = num(v);
  if (n === null) return TRACO;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtMinutos(v: unknown) {
  const n = num(v);
  if (n === null) return TRACO;
  if (n < 60) return `${fmtNum(n, n % 1 === 0 ? 0 : 1)} min`;
  return `${fmtNum(n / 60, 1)} h`;
}

function fmtPct(v: unknown) {
  const n = num(v);
  if (n === null) return TRACO;
  return `${fmtNum(n, 1)}%`;
}

function fmtTelefone(t: string | null) {
  if (!t) return TRACO;
  const d = t.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return t;
}

const PERIODOS = [
  { label: "Hoje", dias: 1 },
  { label: "7 dias", dias: 7 },
  { label: "30 dias", dias: 30 },
];

function CardGrande({
  titulo, valor, children, tom = "neutro", icone: Icone,
}: {
  titulo: string; valor: string; children?: React.ReactNode;
  tom?: "neutro" | "ok" | "alerta" | "critico"; icone?: React.ElementType;
}) {
  const tons: Record<string, string> = {
    neutro: "",
    ok: "bg-emerald-500/10 border-emerald-500/30",
    alerta: "bg-amber-500/10 border-amber-500/30",
    critico: "bg-destructive/10 border-destructive/40",
  };
  return (
    <Card className={cn(tons[tom])}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {Icone ? <Icone className="h-4 w-4" /> : null}
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-4xl font-semibold leading-none">{valor}</div>
        {children}
      </CardContent>
    </Card>
  );
}

function CardMedio({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold leading-none">{valor}</div>
        {detalhe ? <div className="text-xs text-muted-foreground">{detalhe}</div> : null}
      </CardContent>
    </Card>
  );
}

export default function PainelAtendimento() {
  const navigate = useNavigate();
  const [dias, setDias] = useState(1);
  const [dados, setDados] = useState<Kpis | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    const { data, error } = await chamarRpc("whatsapp_kpis_operacao" as any, { p_dias: dias });
    if (error) {
      if (!silencioso) toast.error("Não foi possível carregar o painel.");
    } else {
      setDados((data ?? {}) as Kpis);
      setAtualizadoEm(new Date());
    }
    setCarregando(false);
  }, [dias]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const t = setInterval(() => carregar(true), 60000);
    return () => clearInterval(t);
  }, [carregar]);

  const fila = dados?.fila ?? {};
  const hoje = dados?.hoje ?? {};
  const tempos = dados?.tempos ?? {};
  const conversao = dados?.conversao ?? {};
  const aberto = dados?.em_aberto ?? {};
  const anna = dados?.anna ?? {};
  const carga = dados?.carga ?? [];

  const aguardando = num(fila.aguardando) ?? 0;
  const acima30 = num(fila.acima_de_30min) ?? 0;
  const tomFila = acima30 > 0 ? "critico" : aguardando > 0 ? "alerta" : "ok";

  const listaFila = useMemo(
    () => [...(fila.lista ?? [])].sort((a, b) => (num(b.minutos) ?? 0) - (num(a.minutos) ?? 0)),
    [fila.lista],
  );

  const totalAberto = (num(aberto.propostas) ?? 0) + (num(aberto.links) ?? 0);
  const valorAberto = (num(aberto.propostas_valor) ?? 0) + (num(aberto.links_valor) ?? 0);
  const linkParado = num(aberto.links_mais_antigo_horas);

  const atendHoje = num(hoje.atendimentos);
  const atendOntem = num(hoje.ontem);
  const subiu = atendHoje !== null && atendOntem !== null ? atendHoje >= atendOntem : null;

  const cargaNaoIdentificada =
    carga.length === 1 && (carga[0]?.atendente ?? "").toLowerCase().includes("nao identificado");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Activity className="h-6 w-6" /> Painel do atendimento
          </h1>
          <p className="text-sm text-muted-foreground">Operação do dia, atualizada a cada minuto.</p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
            <TabsList>
              {PERIODOS.map((p) => (
                <TabsTrigger key={p.dias} value={String(p.dias)}>{p.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => carregar()} disabled={carregando}>
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {atualizadoEm
          ? `Última atualização: ${atualizadoEm.toLocaleTimeString("pt-BR")}`
          : "Carregando dados..."}
      </p>

      {/* Faixa 1: o agora */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardGrande
          titulo="Esperando resposta"
          valor={fmtNum(fila.aguardando)}
          tom={tomFila}
          icone={Clock}
        >
          {acima30 > 0 ? (
            <p className="text-sm font-medium text-destructive">
              {fmtNum(acima30)} esperando há mais de 30 min
            </p>
          ) : aguardando > 0 ? (
            <p className="text-sm text-muted-foreground">
              mais antiga: {fmtNum(fila.espera_mais_antiga_min)} min
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">ninguém esperando</p>
          )}
        </CardGrande>

        <CardGrande titulo="Em atendimento" valor={fmtNum(fila.em_atendimento)} icone={MessageCircle} />

        <CardGrande titulo="Atendimentos hoje" valor={fmtNum(hoje.atendimentos)} icone={Users}>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {subiu === null ? null : subiu
              ? <ArrowUp className="h-3.5 w-3.5 text-emerald-600" />
              : <ArrowDown className="h-3.5 w-3.5 text-destructive" />}
            ontem: {fmtNum(hoje.ontem)}
          </p>
        </CardGrande>

        <CardGrande titulo="Em aberto" valor={fmtNum(totalAberto)}>
          <p className="text-sm text-muted-foreground">{fmtMoeda(valorAberto)}</p>
          {linkParado !== null && linkParado > 72 ? (
            <p className="text-xs text-amber-600">
              tem link parado há {fmtNum(linkParado / 24, 0)} dias
            </p>
          ) : null}
        </CardGrande>
      </div>

      {listaFila.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quem está esperando</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {listaFila.map((item, i) => (
              <div key={`${item.conversa_id ?? i}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.nome || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{fmtTelefone(item.telefone)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={(num(item.minutos) ?? 0) > 30 ? "destructive" : "secondary"}>
                    há {fmtNum(item.minutos)} min
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!item.conversa_id}
                    onClick={() => navigate(`/atendimento?conversa=${item.conversa_id}`)}
                  >
                    Abrir conversa
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Faixa 2: tempos */}
      <div className="space-y-2">
        <div className="grid gap-4 md:grid-cols-3">
          <CardMedio
            titulo="Primeira resposta humana"
            valor={fmtMinutos(tempos.humana_mediana_min)}
            detalhe={`p90: ${fmtMinutos(tempos.humana_p90_min)} (${fmtNum(tempos.humana_amostra)} conversas)`}
          />
          <CardMedio
            titulo="Resposta da Anna"
            valor={num(tempos.anna_mediana_seg) === null ? TRACO : `${fmtNum(tempos.anna_mediana_seg, 0)} s`}
          />
          <CardMedio
            titulo="Tempo até encerrar"
            valor={num(tempos.resolucao_mediana_horas) === null ? TRACO : `${fmtNum(tempos.resolucao_mediana_horas, 1)} h`}
            detalhe={`(${fmtNum(tempos.resolucao_amostra)} conversas)`}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Primeira resposta humana é o tempo entre a cliente escrever e uma pessoa responder, não a Anna.
          Tempo até encerrar conta só conversas que tiveram atendimento humano de verdade.
        </p>
      </div>

      {/* Faixa 3: conversão */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Conversão e receita no período</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs text-muted-foreground">Atendimentos</p>
            <p className="text-xl font-semibold">{fmtNum(conversao.atendimentos)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Viraram pagos</p>
            <p className="text-xl font-semibold">{fmtNum(conversao.pagos)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Taxa de conversão</p>
            <p className="text-3xl font-semibold text-primary">
              {num(conversao.taxa_pct) === null
                ? <span className="text-base text-muted-foreground">sem dados no período</span>
                : fmtPct(conversao.taxa_pct)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Receita</p>
            <p className="text-xl font-semibold">{fmtMoeda(conversao.receita)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ticket médio</p>
            <p className="text-xl font-semibold">{fmtMoeda(conversao.ticket_medio)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Faixa 4 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Carga por atendente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cargaNaoIdentificada ? (
              <p className="text-xs text-muted-foreground">
                O registro de quem respondeu começou agora. Conversas anteriores aparecem como não identificado.
              </p>
            ) : null}
            {carga.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 font-medium">Atendente</th>
                    <th className="py-1 text-right font-medium">Conversas</th>
                    <th className="py-1 text-right font-medium">Mensagens</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {carga.map((c, i) => (
                    <tr key={`${c.atendente ?? i}`}>
                      <td className="py-1.5">{c.atendente || "não identificado"}</td>
                      <td className="py-1.5 text-right">{fmtNum(c.conversas)}</td>
                      <td className="py-1.5 text-right">{fmtNum(c.mensagens)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Anna</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Conversas</p>
              <p className="text-xl font-semibold">{fmtNum(anna.conversas)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sem humano</p>
              <p className="text-2xl font-semibold text-primary">{fmtPct(anna.sem_humano_pct)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Escaladas</p>
              <p className="text-xl font-semibold">{fmtNum(anna.escaladas)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Chamadas de IA</p>
              <p className="text-xl font-semibold">{fmtNum(anna.chamadas_ia)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tempo médio</p>
              <p className="text-xl font-semibold">
                {num(anna.segundos_medio) === null ? TRACO : `${fmtNum(anna.segundos_medio, 1)} s`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
