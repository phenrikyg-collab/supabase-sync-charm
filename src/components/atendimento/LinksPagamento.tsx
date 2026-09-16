import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Copy, ExternalLink, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { chamarRpc } from "@/lib/supabaseRpc";

const EXTERNAL_SUPABASE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co";
const CONFERIR_LINK_URL = `${EXTERNAL_SUPABASE_URL}/functions/v1/pagamentos-conferir-link`;

export type LinkPagamentoRegistro = {
  id: string | number;
  conversa_id?: string | number | null;
  valor?: number | string | null;
  descricao?: string | null;
  status?: string | null;
  link_pagamento?: string | null;
  vindi_charge_id?: string | null;
  criado_em?: string | null;
  pago_em?: string | null;
};

function moedaBR(v?: number | string | null) {
  const n = typeof v === "string" ? Number(v) : v;
  if (n == null || Number.isNaN(n)) return "sem valor";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataHora(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function StatusLinkBadge({ status }: { status?: string | null }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "pago"
      ? "bg-success/10 text-success border-success/20"
      : s === "pendente"
        ? "bg-warning/10 text-warning border-warning/20"
        : ["cancelado", "recusado", "estornado"].includes(s)
          ? "bg-danger/10 text-danger border-danger/20"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold", cls)}>
      {status || "sem status"}
    </span>
  );
}

async function conferirLink(id: string | number) {
  const resposta = await fetch(`${CONFERIR_LINK_URL}?link_id=${encodeURIComponent(String(id))}&salvar=1`);
  const texto = await resposta.text();
  let dados: any = {};
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      throw new Error(`Resposta inválida (HTTP ${resposta.status}): ${texto}`);
    }
  }
  if (!resposta.ok) throw new Error(dados?.erro || dados?.error || `HTTP ${resposta.status}`);
  return dados as {
    ok?: boolean;
    status_no_banco?: string | null;
    yapay?: { status_name?: string | null; mapeado?: string | null } | null;
    salvo?: boolean;
  };
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast({ title: "Link copiado" });
  } catch {
    toast({ title: "Não foi possível copiar", variant: "destructive" });
  }
}

/** Botão que consulta o gateway e salva o status atualizado. */
function BotaoConferir({
  id,
  aoConferir,
  compacto,
}: {
  id: string | number;
  aoConferir: () => void | Promise<unknown>;
  compacto?: boolean;
}) {
  const [carregando, setCarregando] = useState(false);
  const clicar = async () => {
    setCarregando(true);
    try {
      const r = await conferirLink(id);
      const novo = r.yapay?.mapeado || r.status_no_banco || r.yapay?.status_name || "sem status";
      toast({ title: `Status: ${novo}`, description: r.salvo ? "Status salvo no banco." : undefined });
      await aoConferir();
    } catch (e) {
      toast({
        title: "Não foi possível conferir",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setCarregando(false);
    }
  };
  return (
    <Button
      size="sm"
      variant="ghost"
      className={cn("text-[11px]", compacto ? "h-6 px-2" : "h-7 px-2")}
      disabled={carregando}
      onClick={clicar}
    >
      {carregando ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
      Conferir agora
    </Button>
  );
}

/** Lista geral dos links de pagamento gerados no cartão. */
export function LinksPagamentoTab({ onAbrirConversa }: { onAbrirConversa?: (conversaId: string) => void }) {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<"todos" | "pendente" | "pago" | "outros">("todos");

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["pagamentos-links"],
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await chamarRpc("pagamentos_listar_links" as any, { p_limit: 100 });
      if (error) throw error;
      return (data ?? []) as LinkPagamentoRegistro[];
    },
  });

  const grupoDe = (l: LinkPagamentoRegistro) => {
    const s = (l.status ?? "").toLowerCase();
    if (s === "pago") return "pago";
    if (s === "pendente") return "pendente";
    return "outros";
  };

  const contagem = {
    todos: links.length,
    pendente: links.filter((l) => grupoDe(l) === "pendente").length,
    pago: links.filter((l) => grupoDe(l) === "pago").length,
    outros: links.filter((l) => grupoDe(l) === "outros").length,
  };

  const visiveis = filtro === "todos" ? links : links.filter((l) => grupoDe(l) === filtro);
  const recarregar = () => queryClient.invalidateQueries({ queryKey: ["pagamentos-links"] });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <h2 className="text-sm font-semibold">Links de pagamento (cartão)</h2>
        <div className="flex flex-wrap gap-1">
          {([
            ["todos", "Todos"],
            ["pendente", "Pendentes"],
            ["pago", "Pagos"],
            ["outros", "Outros"],
          ] as const).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={filtro === key ? "default" : "outline"}
              className="h-7 px-2.5 text-[11px]"
              onClick={() => setFiltro(key)}
            >
              {label}
              <span className="ml-1 opacity-70">({contagem[key]})</span>
            </Button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <p className="p-4 text-sm text-muted-foreground">Carregando links…</p>
      ) : visiveis.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          {links.length === 0 ? "Nenhum link de pagamento gerado ainda." : "Nenhum link neste filtro."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Valor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado / Pago</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((l) => (
                <TableRow key={String(l.id)}>
                  <TableCell className="font-medium">{moedaBR(l.valor)}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground" title={l.descricao ?? ""}>
                    {l.descricao || "sem descrição"}
                  </TableCell>
                  <TableCell>
                    <StatusLinkBadge status={l.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    <div>{dataHora(l.criado_em) || "sem data"}</div>
                    {l.pago_em && <div className="text-[11px] text-success">Pago em {dataHora(l.pago_em)}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {l.link_pagamento && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => copiar(l.link_pagamento!)}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          Copiar link
                        </Button>
                      )}
                      {l.link_pagamento && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => window.open(l.link_pagamento!, "_blank", "noopener")}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                      {l.conversa_id != null && onAbrirConversa && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => onAbrirConversa(String(l.conversa_id))}
                        >
                          <MessageCircle className="mr-1 h-3 w-3" />
                          Abrir conversa
                        </Button>
                      )}
                      <BotaoConferir id={l.id} aoConferir={recarregar} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

/** Links de pagamento vinculados a uma conversa aberta. */
export function LinksDaConversa({ conversaId }: { conversaId: string | number }) {
  const queryClient = useQueryClient();
  const chave = ["pagamentos-links-conversa", String(conversaId)];

  const { data: links = [] } = useQuery({
    queryKey: chave,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await chamarRpc("pagamentos_links_da_conversa" as any, {
        p_conversa_id: conversaId,
      });
      if (error) throw error;
      return (data ?? []) as LinkPagamentoRegistro[];
    },
  });

  if (links.length === 0) return null;

  return (
    <div className="border-b border-border bg-muted/30 p-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Links de pagamento desta conversa
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <div
            key={String(l.id)}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5"
          >
            <span className="text-sm font-semibold">{moedaBR(l.valor)}</span>
            <StatusLinkBadge status={l.status} />
            <span className="text-[11px] text-muted-foreground">{dataHora(l.criado_em)}</span>
            {l.pago_em && <span className="text-[11px] text-success">Pago em {dataHora(l.pago_em)}</span>}
            {l.link_pagamento && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                onClick={() => copiar(l.link_pagamento!)}
              >
                <Copy className="mr-1 h-3 w-3" />
                Copiar link
              </Button>
            )}
            <BotaoConferir
              id={l.id}
              compacto
              aoConferir={() => queryClient.invalidateQueries({ queryKey: chave })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
