import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/socialCommerce";
import { tempoRelativo } from "./comum";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle, Clock, ExternalLink, Inbox, Loader2, MessageCircle, RefreshCw, User,
} from "lucide-react";

type Etapa = { etapa: string; leads: number; pct: number };

type Funil = {
  etapas?: Etapa[];
  gargalo?: string | null;
  por_origem?: { origem: string; leads: number }[];
  por_status?: { status: string; leads: number }[];
  periodo_dias?: number;
  parados_sem_acao?: number;
  sem_direct_janela_aberta?: number;
  tempo_medio_1o_toque_ate_direct_horas?: number | null;
};

type Lead = {
  ig_user_id: string;
  username?: string | null;
  nome_exibicao?: string | null;
  foto_url?: string | null;
  perfil_url?: string | null;
  status?: string | null;
  responsavel?: string | null;
  observacao?: string | null;
  toques?: number | null;
  origens?: string[] | null;
  primeiro_toque_em?: string | null;
  ultimo_toque_em?: string | null;
  horas_desde_ultimo_toque?: number | null;
  ultimo_texto?: string | null;
  produtos_nomes?: string[] | null;
  ultimo_post_url?: string | null;
  recebeu_resposta_publica?: boolean | null;
  recebeu_direct?: boolean | null;
  cadastro_email?: string | null;
  cadastro_telefone?: string | null;
  conversa_id?: number | null;
  janela_aberta?: boolean | null;
  prioridade?: number | null;
};

/** Recorte da lista: cada barra do funil e cada alerta abre um destes. */
type Recorte =
  | "todas"
  | "resposta_publica"
  | "direct"
  | "conversa_aberta"
  | "contato"
  | "cupom"
  | "comprou"
  | "sem_direct_janela_aberta"
  | "parados";

const ROTULO_RECORTE: Record<Recorte, string> = {
  todas: "Todas as leads",
  resposta_publica: "Receberam resposta pública",
  direct: "Receberam Direct",
  conversa_aberta: "Conversa aberta",
  contato: "Deram e-mail ou telefone",
  cupom: "Receberam cupom",
  comprou: "Compraram",
  sem_direct_janela_aberta: "Janela aberta e sem Direct",
  parados: "Paradas há mais de 48h",
};

const RECORTE_POR_ETAPA: Recorte[] = [
  "todas", "resposta_publica", "direct", "conversa_aberta", "contato", "cupom", "comprou",
];

const STATUS_LEAD = ["novo", "em_contato", "cupom_enviado", "comprou", "perdido", "descartada"];

const PERIODOS = [7, 30, 90];

export function FunilLeadsTab() {
  const [dias, setDias] = useState(30);
  const [funil, setFunil] = useState<Funil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [recorte, setRecorte] = useState<Recorte>("todas");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregandoLeads, setCarregandoLeads] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [obs, setObs] = useState<Record<string, string>>({});

  const carregarFunil = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await db.rpc("fn_ig_funil_leads", { p_dias: dias } as never);
    if (error) toast.error("Falha ao carregar o funil", { description: error.message });
    else setFunil((data ?? null) as Funil);
    setCarregando(false);
  }, [dias]);

  const carregarLeads = useCallback(async () => {
    setCarregandoLeads(true);
    const desde = new Date(Date.now() - dias * 86400000).toISOString();
    let q = db
      .from("vw_ig_leads_painel")
      .select("*")
      .gte("primeiro_toque_em", desde)
      .order("prioridade", { ascending: false })
      .limit(200);

    if (recorte === "resposta_publica") q = q.eq("recebeu_resposta_publica", true);
    if (recorte === "direct") q = q.eq("recebeu_direct", true);
    if (recorte === "conversa_aberta") q = q.eq("janela_aberta", true);
    if (recorte === "contato") q = q.or("cadastro_email.not.is.null,cadastro_telefone.not.is.null");
    if (recorte === "cupom") q = q.in("status", ["cupom_enviado", "comprou"]);
    if (recorte === "comprou") q = q.eq("status", "comprou");
    if (recorte === "sem_direct_janela_aberta") q = q.eq("janela_aberta", true).eq("recebeu_direct", false);
    if (recorte === "parados") q = q.eq("status", "novo").gt("horas_desde_ultimo_toque", 48);

    const { data, error } = await q;
    if (error) toast.error("Falha ao carregar leads", { description: error.message });
    else setLeads((data ?? []) as Lead[]);
    setCarregandoLeads(false);
  }, [dias, recorte]);

  useEffect(() => { carregarFunil(); }, [carregarFunil]);
  useEffect(() => { carregarLeads(); }, [carregarLeads]);

  const etapas = funil?.etapas ?? [];
  const maxLeads = Math.max(1, ...etapas.map((e) => e.leads));

  const atualizarLead = async (lead: Lead, campos: Record<string, unknown>) => {
    setSalvando(lead.ig_user_id);
    try {
      const { data, error } = await db.rpc("fn_ig_lead_atualizar", {
        p_ig_user_id: lead.ig_user_id,
        ...campos,
      } as never);
      if (error) throw error;
      if (data && (data as any).ok === false) throw new Error((data as any).erro);
      toast.success("Lead atualizada");
      await Promise.all([carregarLeads(), carregarFunil()]);
    } catch (e: any) {
      toast.error("Falha ao atualizar", { description: e?.message });
    } finally {
      setSalvando(null);
    }
  };

  const alertas = useMemo(() => {
    const l: { icone: React.ReactNode; texto: string; recorte?: Recorte }[] = [];
    if ((funil?.sem_direct_janela_aberta ?? 0) > 0) {
      l.push({
        icone: <AlertTriangle className="h-4 w-4 text-warning shrink-0" />,
        texto: `${funil?.sem_direct_janela_aberta} leads com janela aberta e sem Direct — dá para falar agora`,
        recorte: "sem_direct_janela_aberta",
      });
    }
    if ((funil?.parados_sem_acao ?? 0) > 0) {
      l.push({
        icone: <AlertTriangle className="h-4 w-4 text-danger shrink-0" />,
        texto: `${funil?.parados_sem_acao} leads paradas há mais de 48h sem ação`,
        recorte: "parados",
      });
    }
    return l;
  }, [funil]);

  return (
    <div className="space-y-4">
      {/* ============ Funil ============ */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Funil de interesse</CardTitle>
          <div className="flex items-center gap-1.5">
            {PERIODOS.map((d) => (
              <Button
                key={d}
                size="sm"
                variant={dias === d ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setDias(d)}
              >
                {d} dias
              </Button>
            ))}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={carregarFunil}>
              <RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {carregando ? (
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                {etapas.map((e, i) => {
                  const gargalo = funil?.gargalo === e.etapa;
                  const alvo = RECORTE_POR_ETAPA[i] ?? "todas";
                  const ativo = recorte === alvo;
                  return (
                    <button
                      key={e.etapa}
                      type="button"
                      onClick={() => setRecorte(alvo)}
                      className={`w-full text-left rounded-md px-2 py-1.5 transition-colors hover:bg-accent/60 ${
                        ativo ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-52 text-xs truncate">{e.etapa}</span>
                        <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded ${gargalo ? "bg-danger/70" : "bg-primary/70"}`}
                            style={{ width: `${Math.max(2, (e.leads / maxLeads) * 100)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-semibold tabular-nums">{e.leads}</span>
                        <span className="w-12 text-right text-[11px] text-muted-foreground tabular-nums">
                          {e.pct}%
                        </span>
                        <span className="w-20 text-[10px] font-semibold text-danger">
                          {gargalo ? "⚠ gargalo" : ""}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {funil?.gargalo && (
                <p className="text-xs rounded border border-danger/30 bg-danger/5 p-2">
                  O funil trava em <strong>{funil.gargalo}</strong>.
                </p>
              )}

              <div className="space-y-1.5">
                {alertas.map((a, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => a.recorte && setRecorte(a.recorte)}
                    className="w-full flex items-center gap-2 rounded border border-warning/30 bg-warning/10 px-2.5 py-2 text-xs text-left hover:bg-warning/20 transition-colors"
                  >
                    {a.icone}
                    <span>{a.texto}</span>
                  </button>
                ))}
                {funil?.tempo_medio_1o_toque_ate_direct_horas != null && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground px-0.5">
                    <Clock className="h-3.5 w-3.5" />
                    {Math.round(funil.tempo_medio_1o_toque_ate_direct_horas)}h em média até o primeiro Direct
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Origem:</span>
                {(funil?.por_origem ?? []).map((o) => (
                  <span key={o.origem}>{o.origem} {o.leads}</span>
                ))}
                {(funil?.por_origem ?? []).length === 0 && <span>sem dados no período</span>}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Status:</span>
                {(funil?.por_status ?? []).map((s) => (
                  <span key={s.status}>{s.status} {s.leads}</span>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ============ Lista de leads ============ */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">
            {ROTULO_RECORTE[recorte]}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {carregandoLeads ? "" : `${leads.length} lead(s) · últimos ${dias} dias`}
            </span>
          </CardTitle>
          {recorte !== "todas" && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRecorte("todas")}>
              Limpar recorte
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {carregandoLeads ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : leads.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhuma lead neste recorte.
            </div>
          ) : (
            leads.map((l) => (
              <div key={l.ig_user_id} className="rounded-lg border p-3">
                <div className="flex items-start gap-3">
                  {l.foto_url ? (
                    <img
                      src={l.foto_url}
                      alt={l.nome_exibicao ?? "Lead"}
                      className="h-10 w-10 rounded-full object-cover bg-muted shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {l.nome_exibicao || (l.username ? `@${l.username}` : "Lead")}
                      </span>
                      {l.username && (
                        <a
                          href={l.perfil_url ?? `https://instagram.com/${l.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary inline-flex items-center gap-0.5 hover:underline"
                        >
                          @{l.username} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {l.janela_aberta && (
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px] border-success/30 text-success">
                          Janela aberta
                        </Badge>
                      )}
                      {!l.recebeu_direct && (
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px] border-warning/30 text-warning">
                          Sem Direct
                        </Badge>
                      )}
                      {(l.origens ?? []).map((o) => (
                        <Badge key={o} variant="secondary" className="h-4 px-1.5 text-[10px]">{o}</Badge>
                      ))}
                    </div>
                    {l.ultimo_texto && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">"{l.ultimo_texto}"</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {l.toques ?? 0} toque(s) · último {tempoRelativo(l.ultimo_toque_em)}
                      {l.cadastro_email ? ` · ${l.cadastro_email}` : ""}
                      {l.cadastro_telefone ? ` · ${l.cadastro_telefone}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Select
                      value={l.status ?? "novo"}
                      onValueChange={(v) => atualizarLead(l, { p_status: v })}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_LEAD.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {l.conversa_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => window.open(`/social-commerce?tab=atendimento`, "_self")}
                      >
                        <MessageCircle className="h-3.5 w-3.5 mr-1" /> Conversa
                      </Button>
                    )}
                    {salvando === l.ig_user_id && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <Textarea
                    rows={1}
                    placeholder="Observação da equipe..."
                    className="text-xs min-h-8"
                    value={obs[l.ig_user_id] ?? l.observacao ?? ""}
                    onChange={(e) => setObs((p) => ({ ...p, [l.ig_user_id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={(obs[l.ig_user_id] ?? l.observacao ?? "") === (l.observacao ?? "")}
                    onClick={() => atualizarLead(l, { p_observacao: obs[l.ig_user_id] ?? "" })}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
