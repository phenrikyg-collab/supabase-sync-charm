import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SeletorDias } from "@/components/financeiro/SeletorDias";
import { brl, num, dataBr } from "@/lib/financeiroFormat";
import { AlertCircle, CheckCircle2 } from "lucide-react";

type Row = Record<string, any>;

interface ConciliacaoPayload {
  resumo?: Row;
  conciliadas?: Row[];
  sem_correspondencia?: Row[];
  creditos_pix_sem_cobranca?: Row[];
}

function Tile({
  label,
  value,
  loading,
  valueClass,
  hint,
}: {
  label: string;
  value: string;
  loading: boolean;
  valueClass?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className={cn("mt-1 text-2xl font-semibold tabular-nums text-card-foreground", valueClass)}>{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function Secao({
  titulo,
  children,
  descricao,
  acaoHeader,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  children: React.ReactNode;
  acaoHeader?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-card-foreground">{titulo}</h2>
          {descricao && <div className="text-xs text-muted-foreground">{descricao}</div>}
        </div>
        {acaoHeader}
      </div>
      {children}
    </section>
  );
}

function ChipConfianca({ nivel }: { nivel?: string | null }) {
  if (!nivel) return <span className="text-xs text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    alta: "bg-success/10 text-success",
    media: "bg-warning/10 text-warning",
    baixa: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", map[nivel] ?? "bg-muted text-muted-foreground")}>
      {nivel}
    </span>
  );
}

export default function ConciliacaoPixWhatsApp() {
  const [dias, setDias] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["conciliacao_pix_whatsapp", dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("conciliacao_pix_whatsapp" as any, { p_dias: dias });
      if (error) throw error;
      return (data ?? {}) as ConciliacaoPayload;
    },
  });

  const resumo = data?.resumo ?? {};
  const conciliadas = useMemo(
    () =>
      [...(data?.conciliadas ?? [])].sort(
        (a, b) => new Date(String(b.data_emissao ?? 0)).getTime() - new Date(String(a.data_emissao ?? 0)).getTime()
      ),
    [data?.conciliadas]
  );
  const semCorrespondencia = data?.sem_correspondencia ?? [];
  const creditosPix = data?.creditos_pix_sem_cobranca ?? [];
  const totalCreditosPix = creditosPix.reduce((s, r) => s + Number(r.valor ?? 0), 0);

  const semCorrespondenciaCount = Number(resumo.sem_correspondencia ?? semCorrespondencia.length);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Conciliação Pix WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Cruza cobranças do bot com créditos recebidos na conta</p>
        </div>
        <SeletorDias valor={dias} onChange={setDias} />
      </div>

      {/* Bloco A */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Cobranças concluídas" value={num(resumo.cobrancas_concluidas)} loading={isLoading} />
        <Tile
          label="Conciliadas"
          value={num(resumo.conciliadas)}
          loading={isLoading}
          valueClass="text-success"
          hint={resumo.conciliadas ? `${num(resumo.conciliadas)} de ${num(resumo.cobrancas_concluidas)}` : undefined}
        />
        <Tile
          label="Sem correspondência"
          value={num(semCorrespondenciaCount)}
          loading={isLoading}
          valueClass={semCorrespondenciaCount > 0 ? "text-danger" : undefined}
        />
      </div>

      {/* Bloco B */}
      <Secao titulo="Conciliadas" descricao="Cobranças pagas no Inter com crédito equivalente encontrado no extrato.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Nome do pedido</th>
                <th className="py-2 pr-3">Nome no extrato</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 pr-3">Emitida em</th>
                <th className="py-2 pr-3">Recebida em</th>
                <th className="py-2">Confiança</th>
              </tr>
            </thead>
            <tbody>
              {conciliadas.map((r, i) => {
                const confianca = String(r.confianca ?? "").toLowerCase();
                return (
                  <tr
                    key={`${r.nome_pedido}-${i}`}
                    className={cn(
                      "border-b align-top transition-colors last:border-0",
                      confianca === "baixa" && "opacity-60"
                    )}
                  >
                    <td className="py-2 pr-3 font-medium text-foreground">{r.nome_pedido || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.nome_extrato || "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{brl(r.valor)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{dataBr(r.data_emissao)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{dataBr(r.data_recebimento)}</td>
                    <td className="py-2">
                      <ChipConfianca nivel={confianca} />
                    </td>
                  </tr>
                );
              })}
              {!isLoading && conciliadas.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhuma cobrança conciliada no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Secao>

      {/* Bloco C */}
      <Secao
        titulo="Sem correspondência"
        descricao="Cobranças marcadas como pagas no Inter sem crédito equivalente no extrato no período."
        acaoHeader={
          semCorrespondenciaCount > 0 ? (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              {num(semCorrespondenciaCount)} para investigar
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-success border-success/30">
              <CheckCircle2 className="h-3 w-3" />
              Tudo certo
            </Badge>
          )
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Nome do pedido</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2">Emitida em</th>
              </tr>
            </thead>
            <tbody>
              {semCorrespondencia.map((r, i) => (
                <tr key={`${r.nome_pedido}-${i}`} className="border-b align-top last:border-0">
                  <td className="py-2 pr-3 font-medium text-foreground">{r.nome_pedido || "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{brl(r.valor)}</td>
                  <td className="py-2 whitespace-nowrap">{dataBr(r.data_emissao)}</td>
                </tr>
              ))}
              {!isLoading && semCorrespondencia.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted-foreground">
                    Nenhuma cobrança sem correspondência.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Secao>

      {/* Bloco D */}
      <Secao
        titulo="Créditos Pix sem cobrança"
        descricao={
          <span>
            Pix recebidos na conta sem cobrança formal gerada pelo bot.{" "}
            <span className="text-foreground">
              Confira se esses valores já estão lançados em algum pedido na Tray (pagamento manual) antes de considerar
              receita não contabilizada.
            </span>
          </span>
        }
        acaoHeader={
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total no período</p>
            <p className="text-xl font-semibold tabular-nums text-foreground">{brl(totalCreditosPix)}</p>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Nome no extrato</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {creditosPix.map((r, i) => (
                <tr key={`${r.nome_extrato}-${i}`} className="border-b align-top last:border-0">
                  <td className="py-2 pr-3 font-medium text-foreground">{r.nome_extrato || "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{brl(r.valor)}</td>
                  <td className="py-2 whitespace-nowrap">{dataBr(r.data)}</td>
                </tr>
              ))}
              {!isLoading && creditosPix.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted-foreground">
                    Nenhum crédito Pix sem cobrança no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Secao>
    </div>
  );
}
