import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, MessageCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type CardOportunidade = {
  card_id: string | number;
  conversa_id: string | number | null;
  etapa: string | null;
  prioridade: number | null;
  nome: string | null;
  telefone?: string | null;
  titulo: string | null;
  detalhe?: string | null;
  acao_sugerida?: string | null;
  valor_real: number | null;
  valor_potencial: number | null;
  origem: string | null;
  contato_permitido: string | null;
  wa_link: string | null;
  nivel: string | null;
  motivos: string[] | null;
  data?: string | null;
};

const brl = (v?: number | null) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const hoje = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const rotuloContato = (c?: string | null) => {
  const v = (c ?? "").toLowerCase();
  if (v === "livre") return "conversa aberta";
  if (v === "template") return "fora da janela de 24h";
  if (v === "sem_telefone") return "só e-mail";
  return v || null;
};

export function OportunidadesTab({
  onAbrirConversa,
}: {
  onAbrirConversa?: (conversaId: string) => void;
}) {
  const [linhas, setLinhas] = useState<CardOportunidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    const { data, error } = await supabase
      .from("vw_funil_kanban" as any)
      .select("*")
      .eq("data", hoje())
      .eq("etapa", "oportunidade");
    if (error) {
      setErro(error.message);
    } else {
      setErro(null);
      const lista = ((data ?? []) as unknown as CardOportunidade[]).slice();
      lista.sort((a, b) => (Number(b.prioridade) || 0) - (Number(a.prioridade) || 0));
      setLinhas(lista);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const t = setInterval(() => carregar(true), 60000);
    return () => clearInterval(t);
  }, [carregar]);

  if (carregando) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (erro) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar as oportunidades.</p>
        <Button variant="outline" size="sm" onClick={() => carregar()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {linhas.length === 1 ? "1 oportunidade de hoje" : `${linhas.length} oportunidades de hoje`}
        </p>
        <Button variant="outline" size="sm" onClick={() => carregar()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {linhas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma oportunidade aberta hoje.
        </p>
      ) : (
        <div className="space-y-2">
          {linhas.map((c) => {
            const contato = (c.contato_permitido ?? "").toLowerCase();
            return (
              <Card key={String(c.card_id)}>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-sm font-medium",
                          (c.nivel ?? "").toLowerCase() === "quente" && "font-bold",
                        )}
                      >
                        {c.nome || "Sem nome"}
                      </span>
                      {c.telefone && (
                        <span className="text-xs text-muted-foreground">{c.telefone}</span>
                      )}
                      {(c.origem ?? "").toLowerCase() === "site" && (
                        <Badge variant="outline" className="text-[10px]">site</Badge>
                      )}
                    </div>

                    {c.titulo && <p className="text-xs text-foreground/80">{c.titulo}</p>}
                    {c.acao_sugerida && (
                      <p className="text-xs text-muted-foreground">{c.acao_sugerida}</p>
                    )}

                    {c.valor_real ? (
                      <p className="text-sm font-semibold">{brl(c.valor_real)}</p>
                    ) : c.valor_potencial ? (
                      <p className="text-xs text-muted-foreground">
                        {brl(c.valor_potencial)} <span className="text-[10px]">potencial</span>
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-1">
                      {(c.motivos ?? []).map((m, i) => (
                        <span
                          key={`${m}-${i}`}
                          className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {m}
                        </span>
                      ))}
                      {rotuloContato(c.contato_permitido) && (
                        <span className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {rotuloContato(c.contato_permitido)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {c.conversa_id ? (
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => onAbrirConversa?.(String(c.conversa_id))}
                      >
                        <MessageCircle className="mr-1 h-3.5 w-3.5" />
                        Abrir conversa
                      </Button>
                    ) : contato === "template" && c.wa_link ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => window.open(c.wa_link!, "_blank", "noopener")}
                      >
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Abrir no WhatsApp
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">sem conversa</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
