import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ChevronDown, StickyNote, UserX } from "lucide-react";
import { formatarPreco } from "./CatalogoDialog";

type Perfil = {
  vinculado?: boolean;
  cliente?: { nome?: string; email?: string; telefone?: string; cpf?: string } | null;
  endereco?: {
    rua?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; cep?: string;
  } | null;
  rfm?: {
    segmento?: string; frequencia?: number; valor_total?: number; ticket_medio?: number;
    dias_desde_ultima_compra?: number;
  } | null;
  pedidos?: { id: number | string; status?: string; total?: number; data?: string }[] | null;
  produtos_comprados?: { imagem?: string; nome?: string; data_compra?: string }[] | null;
};

type Nota = { id: number | string; autor?: string; conteudo: string; criado_em?: string };

const SEGMENTO_COR: Record<string, string> = {
  "campeões": "bg-success/10 text-success border-success/20",
  "campeoes": "bg-success/10 text-success border-success/20",
  "leais": "bg-success/10 text-success border-success/20",
  "em risco": "bg-warning/10 text-warning border-warning/20",
  "hibernando": "bg-warning/10 text-warning border-warning/20",
  "perdidos": "bg-danger/10 text-danger border-danger/20",
};

function dataCurta(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR");
}

function Linha({ label, valor }: { label: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-all">{valor}</span>
    </div>
  );
}

function MiniCard({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{valor}</p>
    </div>
  );
}

function NotasInternas({ conversaId, autor }: { conversaId: number | string; autor: string }) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(true);
  const pId = Number.isNaN(Number(conversaId)) ? conversaId : Number(conversaId);

  const { data: notas = [] } = useQuery({
    queryKey: ["whatsapp-notas", String(conversaId)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_listar_notas" as any, { p_conversa_id: pId });
      if (error) throw error;
      return (data ?? []) as Nota[];
    },
  });

  const adicionar = async () => {
    if (!texto.trim()) return;
    setSalvando(true);
    const { error } = await supabase.rpc("whatsapp_criar_nota" as any, {
      p_conversa_id: pId,
      p_autor: autor,
      p_conteudo: texto.trim(),
    });
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao salvar nota", description: error.message, variant: "destructive" });
      return;
    }
    setTexto("");
    queryClient.invalidateQueries({ queryKey: ["whatsapp-notas", String(conversaId)] });
  };

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5" />
          Notas internas
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        <div className="space-y-2">
          {notas.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma nota ainda.</p>}
          {notas.map((n) => (
            <div key={String(n.id)} className="rounded-md border border-warning/30 bg-warning/10 p-2">
              <p className="text-xs whitespace-pre-wrap break-words">{n.conteudo}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {n.autor ?? "Atendente"} · {dataCurta(n.criado_em)}
              </p>
            </div>
          ))}
        </div>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          placeholder="Nota visível só para a equipe…"
          className="resize-none text-xs"
        />
        <Button size="sm" className="w-full" onClick={adicionar} disabled={salvando || !texto.trim()}>
          Adicionar nota
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PerfilCliente({ conversaId, autor }: { conversaId: number | string; autor: string }) {
  const pId = Number.isNaN(Number(conversaId)) ? conversaId : Number(conversaId);

  const { data: perfil, isLoading } = useQuery({
    queryKey: ["whatsapp-perfil", String(conversaId)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_get_perfil_cliente" as any, { p_conversa_id: pId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as Perfil | null;
    },
  });

  const rfm = perfil?.rfm;
  const seg = (rfm?.segmento ?? "").toLowerCase();
  const end = perfil?.endereco;

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-semibold">Perfil da cliente</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {isLoading && <p className="text-xs text-muted-foreground">Carregando perfil…</p>}

          {!isLoading && !perfil?.vinculado && (
            <div className="flex flex-col items-center text-center gap-2 py-6 text-muted-foreground">
              <UserX className="h-8 w-8 opacity-40" />
              <p className="text-xs">Cliente não identificado no cadastro</p>
            </div>
          )}

          {!isLoading && perfil?.vinculado && (
            <>
              <section className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dados</p>
                <Linha label="Nome" valor={perfil.cliente?.nome} />
                <Linha label="E-mail" valor={perfil.cliente?.email} />
                <Linha label="Telefone" valor={perfil.cliente?.telefone} />
                <Linha label="CPF" valor={perfil.cliente?.cpf} />
              </section>

              {end && (
                <section className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Endereço</p>
                  <p className="text-xs">
                    {[end.rua, end.numero].filter(Boolean).join(", ")}
                    {end.bairro ? ` — ${end.bairro}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[end.cidade, end.estado].filter(Boolean).join(" / ")} {end.cep ? `· ${end.cep}` : ""}
                  </p>
                </section>
              )}

              {rfm && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Matriz RFM</p>
                    {rfm.segmento && (
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          SEGMENTO_COR[seg] ?? "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        {rfm.segmento}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniCard label="Frequência" valor={String(rfm.frequencia ?? 0)} />
                    <MiniCard label="Valor total" valor={formatarPreco(rfm.valor_total)} />
                    <MiniCard label="Ticket médio" valor={formatarPreco(rfm.ticket_medio)} />
                    <MiniCard label="Últ. compra" valor={`${rfm.dias_desde_ultima_compra ?? "—"} d`} />
                  </div>
                </section>
              )}

              {!!perfil.pedidos?.length && (
                <section className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pedidos</p>
                  {[...perfil.pedidos]
                    .sort((a, b) => new Date(b.data ?? 0).getTime() - new Date(a.data ?? 0).getTime())
                    .map((p) => (
                      <div key={String(p.id)} className="flex items-center justify-between gap-2 text-xs border border-border rounded-md p-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">#{p.id}</p>
                          <p className="text-[10px] text-muted-foreground">{dataCurta(p.data)} · {p.status ?? "—"}</p>
                        </div>
                        <span className="font-semibold whitespace-nowrap">{formatarPreco(p.total)}</span>
                      </div>
                    ))}
                </section>
              )}

              {!!perfil.produtos_comprados?.length && (
                <section className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produtos comprados</p>
                  <div className="grid grid-cols-3 gap-2">
                    {perfil.produtos_comprados.map((pr, i) => (
                      <div key={i} className="border border-border rounded-md overflow-hidden">
                        <div className="aspect-square bg-muted">
                          {pr.imagem && <img src={pr.imagem} alt={pr.nome ?? "Produto"} className="w-full h-full object-cover" loading="lazy" />}
                        </div>
                        <div className="p-1">
                          <p className="text-[10px] line-clamp-2">{pr.nome}</p>
                          <p className="text-[9px] text-muted-foreground">{dataCurta(pr.data_compra)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <div className="border-t border-border pt-3">
            <NotasInternas conversaId={conversaId} autor={autor} />
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
}
