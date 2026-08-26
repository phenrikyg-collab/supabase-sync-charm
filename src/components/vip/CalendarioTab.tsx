import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  ImageIcon,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { brl, dataCurta, num, pctBr } from "@/lib/financeiroFormat";
import {
  CORES_INTENCAO,
  CORES_STATUS,
  DISTRIBUICAO_REFERENCIA,
  copiar,
  textoRedFlag,
  vipCalendarioExcluir,
  vipCalendarioGet,
  vipCalendariosListar,
  vipDispararAgendados,
  vipGerarCalendario,
  vipGruposListar,
  vipMensagensStatus,
  vipMensagemTextoFinal,
  type VipCalendario,
  type VipCalendarioResumo,
  type VipGrupo,
  type VipMensagem,
} from "@/lib/vip";
import { MensagemPainel } from "./MensagemPainel";

const CORES_DONUT = ["#E8CD7E", "#8B6914", "#7C9EB2", "#B27C9E", "#9EB27C", "#B2907C"];

function ModalGerar({
  aberto,
  onFechar,
  onCriado,
  horarioPadrao,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriado: (id: string) => void;
  horarioPadrao: string;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    titulo: "",
    periodo_inicio: hoje,
    periodo_fim: hoje,
    cadencia: "dia_sim_dia_nao",
    mensagens_por_dia: 1,
    objetivo: "",
    temperatura: "equilibrada",
    horario: horarioPadrao || "20:30",
    observacoes: "",
  });
  const [enviando, setEnviando] = useState(false);

  const gerar = async () => {
    setEnviando(true);
    try {
      const r: any = await vipGerarCalendario({ ...form, criado_por: "painel" });
      const id = r?.calendario_id ?? r?.id;
      if (!id) throw new Error("O backend não devolveu o calendario_id.");
      toast.success("Calendário em geração — leva de 2 a 6 minutos.");
      onCriado(id);
      onFechar();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar calendário");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">Gerar calendário com IA</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Título</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Semana de Sale" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="date" value={form.periodo_inicio} onChange={(e) => setForm({ ...form, periodo_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="date" value={form.periodo_fim} onChange={(e) => setForm({ ...form, periodo_fim: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cadência</Label>
              <Select value={form.cadencia} onValueChange={(v) => setForm({ ...form, cadencia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia_sim_dia_nao">Dia sim, dia não</SelectItem>
                  <SelectItem value="diario">Diário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mensagens por dia</Label>
              <Select
                value={String(form.mensagens_por_dia)}
                onValueChange={(v) => setForm({ ...form, mensagens_por_dia: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2 (09h30 e 20h30)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.mensagens_por_dia === 2 && (
            <p className="text-[11px] text-muted-foreground">
              Em 2 por dia o sistema cria os turnos de 09h30 e 20h30 e obriga peça e tema diferentes entre manhã e noite.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Objetivo</Label>
              <Input value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="Girar estoque parado" />
            </div>
            <div>
              <Label>Temperatura</Label>
              <Select value={form.temperatura} onValueChange={(v) => setForm({ ...form, temperatura: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="relacionamento">Relacionamento</SelectItem>
                  <SelectItem value="equilibrada">Equilibrada</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Horário padrão</Label>
            <Input type="time" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} className="w-40" />
          </div>
          <div>
            <Label>Observações da equipe</Label>
            <Textarea
              rows={3}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Semana de Sale, uma peça parada por mensagem"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={gerar} disabled={enviando}>
            <Sparkles className="mr-1 h-4 w-4" /> {enviando ? "Enviando..." : "Gerar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EstoqueReal({ m }: { m: VipMensagem }) {
  const lista: any[] = Array.isArray(m.produto_estoque)
    ? m.produto_estoque
    : Array.isArray((m as any).estoque_real)
      ? (m as any).estoque_real
      : [];
  if (!m.produto_nome && lista.length === 0) return null;
  return (
    <span className="text-xs text-muted-foreground">
      {m.produto_nome}
      {lista.length > 0 && (
        <>
          {" · estoque real: "}
          {lista
            .map((e) => `${[e.cor, e.tamanho].filter(Boolean).join(" ")} ${e.quantidade ?? e.qtd ?? 0}`)
            .join(" · ")}
        </>
      )}
    </span>
  );
}

export function CalendarioTab() {
  const [lista, setLista] = useState<VipCalendarioResumo[]>([]);
  const [id, setId] = useState<string>("");
  const [cal, setCal] = useState<VipCalendario | null>(null);
  const [grupos, setGrupos] = useState<VipGrupo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [filtroIntencao, setFiltroIntencao] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroExtra, setFiltroExtra] = useState("todas");
  const [aberta, setAberta] = useState<VipMensagem | null>(null);
  const polls = useRef(0);

  const carregarLista = useCallback(async () => {
    try {
      const l = await vipCalendariosListar();
      setLista(l ?? []);
      if (!id && l?.length) setId(l[0].id);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao listar calendários");
    }
  }, [id]);

  const carregarCal = useCallback(async (calId: string) => {
    const c = await vipCalendarioGet(calId);
    setCal(c);
    return c;
  }, []);

  useEffect(() => {
    vipGruposListar().then((g) => setGrupos(g ?? [])).catch(() => {});
    carregarLista().finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!id) return;
    setCarregando(true);
    carregarCal(id).catch((e) => toast.error(e.message)).finally(() => setCarregando(false));
  }, [id, carregarCal]);

  // polling enquanto gerando
  useEffect(() => {
    if (!cal || cal.status !== "gerando") {
      polls.current = 0;
      return;
    }
    if (polls.current >= 40) return;
    const t = setTimeout(async () => {
      polls.current += 1;
      try {
        await carregarCal(cal.id);
      } catch {
        /* segue tentando */
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [cal, carregarCal]);

  const mensagens = cal?.mensagens ?? [];

  const filtradas = useMemo(
    () =>
      mensagens.filter((m) => {
        if (filtroIntencao !== "todas" && m.intencao !== filtroIntencao) return false;
        if (filtroStatus !== "todos" && m.status !== filtroStatus) return false;
        if (filtroExtra === "prioritarias" && !m.prioritaria) return false;
        if (filtroExtra === "autorizacao" && !(m.midia_requer_autorizacao && m.midia_autorizacao_status !== "autorizada"))
          return false;
        if (filtroExtra === "enquete" && !m.enquete) return false;
        return true;
      }),
    [mensagens, filtroIntencao, filtroStatus, filtroExtra],
  );

  const aplicarStatus = async (status: "aprovada" | "agendada" | "cancelada") => {
    if (sel.length === 0) return;
    try {
      const r = await vipMensagensStatus(sel, status);
      const bloqueadas = r?.bloqueadas ?? [];
      toast.success(`${r?.alteradas ?? 0} mensagem(ns) atualizada(s).`);
      if (bloqueadas.length) {
        toast.warning(
          `Não agendadas: ${bloqueadas
            .map((b: any) => (typeof b === "string" ? b : `#${b.ordem ?? b.id} — ${b.motivo ?? b.razao ?? "bloqueada"}`))
            .join(" | ")}`,
          { duration: 10000 },
        );
      }
      setSel([]);
      if (id) await carregarCal(id);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao alterar status");
    }
  };

  const donut = useMemo(() => {
    const d = cal?.diagnostico?.distribuicao ?? {};
    return Object.entries(d).map(([k, v]) => ({ nome: k, valor: Number(v) }));
  }, [cal]);

  const gerando = cal?.status === "gerando";
  const totalEsperado = cal?.total_mensagens ?? cal?.diagnostico?.total_mensagens ?? mensagens.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={id} onValueChange={setId}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Escolha um calendário" />
          </SelectTrigger>
          <SelectContent>
            {lista.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.titulo ?? "Sem título"} · {dataCurta(c.periodo_inicio)}–{dataCurta(c.periodo_fim)} · {c.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setModal(true)}>
          <Sparkles className="mr-1 h-4 w-4" /> Gerar calendário
        </Button>
        <Button
          variant="outline"
          disabled={disparando}
          onClick={async () => {
            setDisparando(true);
            try {
              const r: any = await vipDispararAgendados(id ? { calendario_id: id } : undefined);
              const enviadas = r?.enviadas ?? r?.total_enviadas ?? r?.processadas ?? null;
              toast.success(
                r?.mensagem ??
                  (enviadas != null
                    ? `${enviadas} mensagem(ns) processada(s).`
                    : "Rotina de disparo executada."),
              );
              if (r?.aviso) toast.warning(r.aviso, { duration: 8000 });
              if (id) await carregarCal(id);
            } catch (e: any) {
              toast.error(e?.message ?? "Falha ao disparar as mensagens agendadas");
            } finally {
              setDisparando(false);
            }
          }}
        >
          <Send className={`mr-1 h-4 w-4 ${disparando ? "animate-pulse" : ""}`} />
          {disparando ? "Disparando…" : "Disparar agendados agora"}
        </Button>
        <Button variant="outline" size="icon" onClick={() => id && carregarCal(id)}>
          <RefreshCw className="h-4 w-4" />
        </Button>

        {id && (
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (!confirm("Apagar este calendário e suas mensagens?")) return;
              await vipCalendarioExcluir(id);
              setId("");
              setCal(null);
              carregarLista();
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {carregando && !cal && <Skeleton className="h-48" />}

      {gerando && (
        <Card>
          <CardContent className="space-y-3 py-6">
            <div className="flex items-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {!cal?.diagnostico
                ? "Diagnosticando o grupo…"
                : `Escrevendo mensagem ${mensagens.length + 1} de ${totalEsperado || "?"}…`}
            </div>
            <Progress value={totalEsperado ? (mensagens.length / totalEsperado) * 100 : 8} />
            <p className="text-xs text-muted-foreground">A geração leva de 2 a 6 minutos. Pode navegar e voltar depois.</p>
          </CardContent>
        </Card>
      )}

      {cal?.status === "erro" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha na geração</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{cal.erro ?? "Erro desconhecido."}</p>
            <Button size="sm" variant="outline" onClick={() => setModal(true)}>Tentar de novo</Button>
          </AlertDescription>
        </Alert>
      )}

      {cal?.diagnostico && (
        <Collapsible defaultOpen>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex-row items-center justify-between py-3">
                <CardTitle className="text-sm">Diagnóstico do período</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="grid gap-5 lg:grid-cols-3">
                <div className="space-y-2 text-sm lg:col-span-2">
                  <p className="text-muted-foreground">{cal.diagnostico.estado_atual}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><strong>Persona dominante:</strong> {cal.diagnostico.persona_dominante ?? "—"}</div>
                    <div><strong>Risco:</strong> {cal.diagnostico.risco ?? "—"}</div>
                    <div className="sm:col-span-2"><strong>Pilares:</strong> {(cal.diagnostico.pilares ?? []).join(" · ") || "—"}</div>
                    <div className="sm:col-span-2"><strong>Produtos foco:</strong> {(cal.diagnostico.produtos_foco ?? []).map((p: any) => p?.nome ?? p).join(" · ") || "—"}</div>
                    <div className="sm:col-span-2"><strong>Ações no período:</strong> {(cal.diagnostico.acoes ?? cal.diagnostico.acoes_periodo ?? []).map((a: any) => a?.nome ?? a).join(" · ") || "—"}</div>
                  </div>
                  {donut.length > 0 && (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={donut} dataKey="valor" nameKey="nome" innerRadius={45} outerRadius={75} label>
                            {donut.map((_, i) => (
                              <Cell key={i} fill={CORES_DONUT[i % CORES_DONUT.length]} />
                            ))}
                          </Pie>
                          <RTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Referência: {Object.entries(DISTRIBUICAO_REFERENCIA).map(([k, v]) => `${k} ${v}`).join(" · ")}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Health score do calendário</div>
                    <div className="text-3xl font-semibold">{num(cal.health_score?.nota ?? cal.health_score ?? 0, 1)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Receita potencial</div>
                    <div className="text-2xl font-semibold">{brl(cal.receita_potencial?.valor ?? cal.receita_potencial ?? 0)}</div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{cal.receita_potencial?.premissa ?? ""}</p>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {(cal?.red_flags?.length ?? 0) > 0 && (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Red flags do calendário</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {cal!.red_flags!.map((f: any, i: number) => {
                const txt = textoRedFlag(f);
                const ref = txt.match(/#(\d+)/)?.[1];
                return (
                  <li key={i}>
                    • {txt}
                    {ref && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 pl-2"
                        onClick={() => {
                          const alvo = mensagens.find((m) => String(m.ordem) === ref);
                          if (alvo) setAberta(alvo);
                        }}
                      >
                        ver #{ref}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {mensagens.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filtroIntencao} onValueChange={setFiltroIntencao}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as intenções</SelectItem>
                {Object.keys(CORES_INTENCAO).map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {Object.keys(CORES_STATUS).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroExtra} onValueChange={setFiltroExtra}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Sem filtro extra</SelectItem>
                <SelectItem value="prioritarias">Prioritárias</SelectItem>
                <SelectItem value="autorizacao">Esperando autorização</SelectItem>
                <SelectItem value="enquete">Com enquete</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            {sel.length > 0 && (
              <>
                <span className="text-sm text-muted-foreground">{sel.length} selecionada(s)</span>
                <Button size="sm" onClick={() => aplicarStatus("aprovada")}>Aprovar</Button>
                <Button size="sm" variant="outline" onClick={() => aplicarStatus("agendada")}>Agendar</Button>
                <Button size="sm" variant="ghost" onClick={() => aplicarStatus("cancelada")}>Cancelar</Button>
              </>
            )}
          </div>

          <div className="space-y-2">
            {filtradas.map((m) => {
              const camadas = Object.values(m.camadas ?? {}).filter(Boolean).slice(0, 5).join(" · ");
              const pendente = m.midia_requer_autorizacao && m.midia_autorizacao_status !== "autorizada";
              return (
                <Card key={m.id} className={`border-l-4 ${pendente ? "border-l-amber-500" : "border-l-primary/40"}`}>
                  <CardContent className="flex gap-3 py-3">
                    <Checkbox
                      checked={sel.includes(m.id)}
                      onCheckedChange={(v) => setSel(v ? [...sel, m.id] : sel.filter((x) => x !== m.id))}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium">#{m.ordem}</span>
                        <span className="text-muted-foreground">
                          {dataCurta(m.data_envio)} · {(m.horario ?? "").slice(0, 5)}
                        </span>
                        <Badge variant="outline" className={CORES_INTENCAO[m.intencao ?? ""] ?? ""}>{m.intencao}</Badge>
                        {m.prioritaria && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                        {m.midia_url && <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                        {m.enquete && <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />}
                        <Badge variant="outline" className={CORES_STATUS[m.status ?? "rascunho"]}>{m.status}</Badge>
                        {pendente && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600">Precisa de autorização</Badge>
                        )}
                      </div>
                      <div className="truncate text-sm font-medium">{m.headline}</div>
                      {camadas && <div className="truncate text-xs text-muted-foreground">{camadas}</div>}
                      <div className="flex flex-wrap items-center gap-3">
                        <EstoqueReal m={m} />
                        {m.variantes?.comunidade && (
                          <span className="text-xs text-muted-foreground">🗨 Cria Comigo ✓</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          cliques {num(m.cliques ?? 0)} · pedidos {num(m.pedidos ?? 0)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="outline" onClick={() => setAberta(m)}>Ver / editar</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            const r = await vipMensagemTextoFinal(m.id, null);
                            await copiar(typeof r === "string" ? r : (r?.texto ?? r?.texto_final ?? ""));
                            toast.success("Texto copiado");
                          } catch (e: any) {
                            toast.error(e.message);
                          }
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await vipMensagensStatus([m.id], "aprovada");
                          id && carregarCal(id);
                        }}
                      >
                        Aprovar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {cal && !gerando && mensagens.length === 0 && (
        <p className="text-sm text-muted-foreground">Este calendário ainda não tem mensagens.</p>
      )}

      <Separator />
      <p className="text-[11px] text-muted-foreground">
        Nenhuma mensagem pode prometer separar, reservar ou guardar peça — a loja não faz reserva. Escassez só com
        estoque real por cor e tamanho. Ambas as regras estão travadas no backend.
      </p>

      <ModalGerar aberto={modal} onFechar={() => setModal(false)} onCriado={(novo) => { carregarLista(); setId(novo); }} horarioPadrao="20:30" />
      <MensagemPainel
        mensagem={aberta}
        grupos={grupos}
        aberto={!!aberta}
        onFechar={() => setAberta(null)}
        onAtualizado={() => id && carregarCal(id).then((c) => {
          const atual = c?.mensagens?.find((x) => x.id === aberta?.id) ?? null;
          setAberta(atual);
        })}
      />
    </div>
  );
}
