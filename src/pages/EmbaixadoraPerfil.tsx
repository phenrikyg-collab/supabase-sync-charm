import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Loader2, Save, Sparkles, CheckCircle2, Truck, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  useEmbaixadora,
  useUpdateEmbaixadora,
  useEntregas,
  useCreateEntrega,
  useUpdateEntrega,
  useEnvios,
  useCreateEnvio,
  useUpdateEnvio,
  useMetricasMensais,
  useUpsertMetrica,
  TIER_LABELS,
  TIER_BADGE_CLASS,
  STATUS_INFLU_LABELS,
  STATUS_ENTREGA_BADGE,
  STATUS_ENVIO_BADGE,
  isVencido,
  type StatusInfluenciadora,
  type StatusEntrega,
  type StatusEnvio,
  type Tier,
} from "@/hooks/useEmbaixadoras";
import { formatarData } from "@/utils/formatters";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function currency(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
}

export default function EmbaixadoraPerfil() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: emb, isLoading } = useEmbaixadora(id);

  if (isLoading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!emb) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/embaixadoras")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <p className="mt-4 text-muted-foreground">Embaixadora não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/embaixadoras")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold">{emb.nome}</h1>
            <p className="text-sm text-muted-foreground">{emb.instagram || "—"}</p>
          </div>
          <Badge className={TIER_BADGE_CLASS[emb.tier as Tier]} variant="outline">
            {TIER_LABELS[emb.tier as Tier] || emb.tier}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="entregas">Entregas</TabsTrigger>
          <TabsTrigger value="envios">Envios</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil"><AbaPerfil emb={emb} /></TabsContent>
        <TabsContent value="entregas"><AbaEntregas influenciadoraId={emb.id} /></TabsContent>
        <TabsContent value="envios"><AbaEnvios influenciadoraId={emb.id} /></TabsContent>
        <TabsContent value="metricas"><AbaMetricas influenciadoraId={emb.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ===================== Aba Perfil =====================
function AbaPerfil({ emb }: { emb: any }) {
  const update = useUpdateEmbaixadora();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ ...emb });
  const [confirmEncerrar, setConfirmEncerrar] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  async function salvar() {
    try {
      await update.mutateAsync({ id: emb.id, ...form });
      toast.success("Perfil atualizado");
      setEditando(false);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  }

  async function toggleFlag(k: "contrato_assinado" | "kit_enviado" | "grupo_whatsapp", v: boolean) {
    try {
      await update.mutateAsync({ id: emb.id, [k]: v } as any);
      toast.success("Atualizado");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  }

  async function mudarStatus(novo: StatusInfluenciadora) {
    if (novo === "encerrada") {
      setConfirmEncerrar(true);
      return;
    }
    try {
      await update.mutateAsync({ id: emb.id, status: novo });
      toast.success("Status atualizado");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  }

  const statusTimeline: StatusInfluenciadora[] = ["prospecto", "pendente de aprovação", "ativa", "encerrada"];
  const statusIdx = statusTimeline.indexOf(emb.status);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Dados da influenciadora</h3>
            {!editando ? (
              <Button variant="ghost" size="sm" onClick={() => { setForm({ ...emb }); setEditando(true); }}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditando(false)}>Cancelar</Button>
                <Button size="sm" onClick={salvar} disabled={update.isPending}>
                  {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  <Save className="h-3.5 w-3.5 mr-1" /> Salvar
                </Button>
              </div>
            )}
          </div>

          {!editando ? (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Instagram</dt><dd>{emb.instagram || "—"}</dd>
              <dt className="text-muted-foreground">TikTok</dt><dd>{emb.tiktok || "—"}</dd>
              <dt className="text-muted-foreground">WhatsApp</dt><dd>{emb.whatsapp || "—"}</dd>
              <dt className="text-muted-foreground">E-mail</dt><dd>{emb.email || "—"}</dd>
              <dt className="text-muted-foreground">Seguidores</dt>
              <dd>{emb.seguidores_instagram?.toLocaleString("pt-BR") || "—"}</dd>
              <dt className="text-muted-foreground">Taxa de engajamento</dt>
              <dd>{emb.taxa_engajamento != null ? `${Number(emb.taxa_engajamento).toFixed(2)}%` : "—"}</dd>
              <dt className="text-muted-foreground">Cupom exclusivo</dt>
              <dd>{emb.cupom_exclusivo ? <code className="px-1.5 py-0.5 rounded bg-muted text-xs">{emb.cupom_exclusivo}</code> : "—"}</dd>
              <dt className="text-muted-foreground">Comissão</dt><dd>{emb.comissao_pct}%</dd>
              <dt className="text-muted-foreground">Início parceria</dt><dd>{formatarData(emb.data_inicio_parceria)}</dd>
              <dt className="text-muted-foreground">Fim parceria</dt><dd>{formatarData(emb.data_fim_parceria)}</dd>
              <dt className="text-muted-foreground">Responsável</dt><dd>{emb.responsavel_interno || "—"}</dd>
              <dt className="text-muted-foreground">Notas</dt>
              <dd className="whitespace-pre-wrap">{emb.notas || "—"}</dd>
            </dl>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><Label>Nome</Label><Input value={form.nome || ""} onChange={(e) => set("nome", e.target.value)} /></div>
              <div><Label>Instagram</Label><Input value={form.instagram || ""} onChange={(e) => set("instagram", e.target.value)} /></div>
              <div><Label>TikTok</Label><Input value={form.tiktok || ""} onChange={(e) => set("tiktok", e.target.value)} /></div>
              <div><Label>WhatsApp</Label><Input value={form.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value)} /></div>
              <div><Label>E-mail</Label><Input value={form.email || ""} onChange={(e) => set("email", e.target.value)} /></div>
              <div><Label>Seguidores</Label><Input type="number" value={form.seguidores_instagram || ""} onChange={(e) => set("seguidores_instagram", e.target.value ? Number(e.target.value) : null)} /></div>
              <div><Label>Engajamento (%)</Label><Input type="number" step="0.01" value={form.taxa_engajamento || ""} onChange={(e) => set("taxa_engajamento", e.target.value ? Number(e.target.value) : null)} /></div>
              <div><Label>Cupom exclusivo</Label><Input value={form.cupom_exclusivo || ""} onChange={(e) => set("cupom_exclusivo", e.target.value.toUpperCase())} /></div>
              <div><Label>Comissão (%)</Label><Input type="number" step="0.01" value={form.comissao_pct || 0} onChange={(e) => set("comissao_pct", Number(e.target.value))} /></div>
              <div><Label>Tier</Label>
                <Select value={form.tier} onValueChange={(v) => set("tier", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIER_LABELS) as Tier[]).map((t) => (
                      <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Início parceria</Label><Input type="date" value={form.data_inicio_parceria || ""} onChange={(e) => set("data_inicio_parceria", e.target.value || null)} /></div>
              <div><Label>Fim parceria</Label><Input type="date" value={form.data_fim_parceria || ""} onChange={(e) => set("data_fim_parceria", e.target.value || null)} /></div>
              <div className="md:col-span-2"><Label>Responsável</Label><Input value={form.responsavel_interno || ""} onChange={(e) => set("responsavel_interno", e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Notas</Label><Textarea value={form.notas || ""} onChange={(e) => set("notas", e.target.value)} rows={3} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-semibold">Status da Parceria</h3>
            <Select value={emb.status} onValueChange={(v) => mudarStatus(v as StatusInfluenciadora)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_INFLU_LABELS) as StatusInfluenciadora[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_INFLU_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 pt-3">
              {statusTimeline.map((s, i) => (
                <div key={s} className="flex items-center flex-1">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      i <= statusIdx ? "bg-primary" : "bg-muted"
                    }`}
                  />
                  {i < statusTimeline.length - 1 && (
                    <div className={`h-px flex-1 ${i < statusIdx ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
              <span>Prospecto</span><span>Pendente</span><span>Ativa</span><span>Encerrada</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-semibold">Checklist</h3>
            <div className="flex items-center gap-2">
              <Checkbox
                id="contrato"
                checked={!!emb.contrato_assinado}
                onCheckedChange={(v) => toggleFlag("contrato_assinado", !!v)}
              />
              <Label htmlFor="contrato" className="cursor-pointer">Contrato Assinado</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="kit"
                checked={!!emb.kit_enviado}
                onCheckedChange={(v) => toggleFlag("kit_enviado", !!v)}
              />
              <Label htmlFor="kit" className="cursor-pointer">Kit Enviado</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="grupo"
                checked={!!emb.grupo_whatsapp}
                onCheckedChange={(v) => toggleFlag("grupo_whatsapp", !!v)}
              />
              <Label htmlFor="grupo" className="cursor-pointer">No Grupo WhatsApp</Label>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmEncerrar} onOpenChange={setConfirmEncerrar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar parceria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação altera o status para "Encerrada". Você poderá reativar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await update.mutateAsync({ id: emb.id, status: "encerrada" });
                toast.success("Parceria encerrada");
                setConfirmEncerrar(false);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===================== Aba Entregas =====================
function AbaEntregas({ influenciadoraId }: { influenciadoraId: string }) {
  const { data: entregas = [], isLoading } = useEntregas(influenciadoraId);
  const create = useCreateEntrega();
  const update = useUpdateEntrega();
  const [novaOpen, setNovaOpen] = useState(false);
  const [publicarEntrega, setPublicarEntrega] = useState<any>(null);
  const [novaForm, setNovaForm] = useState({
    formato: "reel",
    prazo_envio_preview: "",
    prazo_publicacao: "",
    produto_divulgado: "",
    campanha: "",
  });
  const [pubForm, setPubForm] = useState({
    url_publicacao: "",
    alcance: "",
    likes: "",
    cliques_link: "",
  });

  const totals = useMemo(() => {
    const publicadas = entregas.filter((e) => e.status_entrega === "publicado").length;
    const atrasadas = entregas.filter((e) => e.status_entrega === "pendente" && isVencido(e.prazo_publicacao)).length;
    const ugc = entregas.filter((e) => e.ugc_aprovado).length;
    return { publicadas, atrasadas, ugc };
  }, [entregas]);

  async function salvarNova() {
    try {
      await create.mutateAsync({
        influenciadora_id: influenciadoraId,
        formato: novaForm.formato,
        prazo_envio_preview: novaForm.prazo_envio_preview || null,
        prazo_publicacao: novaForm.prazo_publicacao || null,
        produto_divulgado: novaForm.produto_divulgado || null,
        campanha: novaForm.campanha || null,
        status_entrega: "pendente",
      });
      toast.success("Entrega criada");
      setNovaOpen(false);
      setNovaForm({ formato: "reel", prazo_envio_preview: "", prazo_publicacao: "", produto_divulgado: "", campanha: "" });
    } catch (e: any) { toast.error("Erro: " + e.message); }
  }

  async function aprovar(entrega: any) {
    try {
      await update.mutateAsync({
        id: entrega.id,
        status_entrega: "aprovado",
        data_aprovacao: new Date().toISOString(),
        aprovado_por: "Marketing",
      } as any);
      toast.success("Entrega aprovada");
    } catch (e: any) { toast.error("Erro: " + e.message); }
  }

  async function salvarPublicacao() {
    if (!publicarEntrega) return;
    try {
      await update.mutateAsync({
        id: publicarEntrega.id,
        status_entrega: "publicado",
        data_publicacao_real: new Date().toISOString().slice(0, 10),
        url_publicacao: pubForm.url_publicacao || null,
        alcance: pubForm.alcance ? Number(pubForm.alcance) : null,
        likes: pubForm.likes ? Number(pubForm.likes) : null,
        cliques_link: pubForm.cliques_link ? Number(pubForm.cliques_link) : null,
      } as any);
      toast.success("Publicação registrada");
      setPublicarEntrega(null);
      setPubForm({ url_publicacao: "", alcance: "", likes: "", cliques_link: "" });
    } catch (e: any) { toast.error("Erro: " + e.message); }
  }

  async function toggleUgc(entrega: any) {
    try {
      await update.mutateAsync({ id: entrega.id, ugc_aprovado: !entrega.ugc_aprovado, usar_como_ugc: !entrega.ugc_aprovado || entrega.usar_como_ugc } as any);
      toast.success("UGC atualizado");
    } catch (e: any) { toast.error("Erro: " + e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Publicadas: <strong>{totals.publicadas}</strong> · Atrasadas:{" "}
          <strong className={totals.atrasadas > 0 ? "text-red-600" : ""}>{totals.atrasadas}</strong> · UGC aprovados:{" "}
          <strong>{totals.ugc}</strong>
        </div>
        <Button onClick={() => setNovaOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova Entrega</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : entregas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma entrega cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {entregas.map((e) => {
                const atrasada = e.status_entrega === "pendente" && isVencido(e.prazo_publicacao);
                return (
                  <div key={e.id} className="border rounded-md p-3 flex flex-wrap items-center gap-3">
                    <Badge className={STATUS_ENTREGA_BADGE[e.status_entrega as StatusEntrega] || "bg-muted"} variant="outline">
                      {e.status_entrega}
                    </Badge>
                    <span className="text-sm font-medium uppercase">{e.formato}</span>
                    {e.produto_divulgado && <span className="text-sm">{e.produto_divulgado}</span>}
                    {e.campanha && <span className="text-xs text-muted-foreground">· {e.campanha}</span>}
                    <span className={`text-xs ${atrasada ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                      Prazo: {formatarData(e.prazo_publicacao)}
                    </span>
                    {e.ugc_aprovado && (
                      <Badge className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                        <Sparkles className="h-3 w-3 mr-1" /> UGC
                      </Badge>
                    )}
                    <div className="ml-auto flex gap-1">
                      {e.status_entrega !== "aprovado" && e.status_entrega !== "publicado" && (
                        <Button size="sm" variant="outline" onClick={() => aprovar(e)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                        </Button>
                      )}
                      {e.status_entrega !== "publicado" && (
                        <Button size="sm" variant="outline" onClick={() => setPublicarEntrega(e)}>
                          Publicado
                        </Button>
                      )}
                      <Button size="sm" variant={e.ugc_aprovado ? "default" : "ghost"} onClick={() => toggleUgc(e)}>
                        UGC
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nova entrega */}
      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Entrega</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Formato</Label>
              <Select value={novaForm.formato} onValueChange={(v) => setNovaForm((f) => ({ ...f, formato: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reel">Reel</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="carousel">Carrossel</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prazo preview</Label>
                <Input type="date" value={novaForm.prazo_envio_preview} onChange={(e) => setNovaForm((f) => ({ ...f, prazo_envio_preview: e.target.value }))} />
              </div>
              <div>
                <Label>Prazo publicação</Label>
                <Input type="date" value={novaForm.prazo_publicacao} onChange={(e) => setNovaForm((f) => ({ ...f, prazo_publicacao: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Produto divulgado</Label>
              <Input value={novaForm.produto_divulgado} onChange={(e) => setNovaForm((f) => ({ ...f, produto_divulgado: e.target.value }))} />
            </div>
            <div>
              <Label>Campanha</Label>
              <Input value={novaForm.campanha} onChange={(e) => setNovaForm((f) => ({ ...f, campanha: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovaOpen(false)}>Cancelar</Button>
            <Button onClick={salvarNova} disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publicar */}
      <Dialog open={!!publicarEntrega} onOpenChange={(o) => !o && setPublicarEntrega(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Publicação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>URL</Label><Input value={pubForm.url_publicacao} onChange={(e) => setPubForm((f) => ({ ...f, url_publicacao: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Alcance</Label><Input type="number" value={pubForm.alcance} onChange={(e) => setPubForm((f) => ({ ...f, alcance: e.target.value }))} /></div>
              <div><Label>Likes</Label><Input type="number" value={pubForm.likes} onChange={(e) => setPubForm((f) => ({ ...f, likes: e.target.value }))} /></div>
              <div><Label>Cliques</Label><Input type="number" value={pubForm.cliques_link} onChange={(e) => setPubForm((f) => ({ ...f, cliques_link: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublicarEntrega(null)}>Cancelar</Button>
            <Button onClick={salvarPublicacao} disabled={update.isPending}>
              {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===================== Aba Envios =====================
function AbaEnvios({ influenciadoraId }: { influenciadoraId: string }) {
  const { data: envios = [], isLoading } = useEnvios(influenciadoraId);
  const create = useCreateEnvio();
  const update = useUpdateEnvio();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    produto: "",
    tamanho: "",
    cor: "",
    codigo_rastreio: "",
    transportadora: "",
    data_envio: "",
    data_entrega_prevista: "",
  });

  const timeline: StatusEnvio[] = ["aguardando", "preparando", "enviado", "entregue"];

  async function salvar() {
    if (!form.produto.trim()) { toast.error("Produto obrigatório"); return; }
    try {
      await create.mutateAsync({
        influenciadora_id: influenciadoraId,
        produto: form.produto,
        tamanho: form.tamanho || null,
        cor: form.cor || null,
        codigo_rastreio: form.codigo_rastreio || null,
        transportadora: form.transportadora || null,
        data_envio: form.data_envio || null,
        data_entrega_prevista: form.data_entrega_prevista || null,
        status_envio: "aguardando",
      });
      toast.success("Envio registrado");
      setOpen(false);
      setForm({ produto: "", tamanho: "", cor: "", codigo_rastreio: "", transportadora: "", data_envio: "", data_entrega_prevista: "" });
    } catch (e: any) { toast.error("Erro: " + e.message); }
  }

  async function avancar(envio: any) {
    const idx = timeline.indexOf(envio.status_envio);
    const proximo = timeline[Math.min(idx + 1, timeline.length - 1)];
    try {
      const patch: any = { id: envio.id, status_envio: proximo };
      if (proximo === "entregue" && !envio.data_entrega_real) {
        patch.data_entrega_real = new Date().toISOString().slice(0, 10);
      }
      await update.mutateAsync(patch);
      toast.success("Status atualizado");
    } catch (e: any) { toast.error("Erro: " + e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Truck className="h-4 w-4 mr-1" /> Registrar Envio</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : envios.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum envio.</p>
          ) : (
            <div className="space-y-3">
              {envios.map((e) => {
                const idx = timeline.indexOf(e.status_envio as StatusEnvio);
                const previstoVencido = e.status_envio !== "entregue" && isVencido(e.data_entrega_prevista);
                return (
                  <div key={e.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={STATUS_ENVIO_BADGE[e.status_envio as StatusEnvio] || "bg-muted"} variant="outline">
                        {e.status_envio}
                      </Badge>
                      <span className="font-medium">{e.produto}</span>
                      {e.tamanho && <span className="text-xs text-muted-foreground">Tam {e.tamanho}</span>}
                      {e.cor && <span className="text-xs text-muted-foreground">{e.cor}</span>}
                      {e.codigo_rastreio && (
                        <code className="text-xs px-1.5 py-0.5 rounded bg-muted">{e.codigo_rastreio}</code>
                      )}
                      <span className={`text-xs ml-auto ${previstoVencido ? "text-red-600" : "text-muted-foreground"}`}>
                        Previsto: {formatarData(e.data_entrega_prevista)}
                      </span>
                      {e.status_envio !== "entregue" && (
                        <Button size="sm" variant="outline" onClick={() => avancar(e)}>Avançar</Button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {timeline.map((s, i) => (
                        <div key={s} className="flex items-center flex-1">
                          <div className={`h-1.5 w-1.5 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
                          {i < timeline.length - 1 && (
                            <div className={`h-px flex-1 ${i < idx ? "bg-primary" : "bg-muted"}`} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Envio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Produto *</Label><Input value={form.produto} onChange={(e) => setForm((f) => ({ ...f, produto: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tamanho</Label><Input value={form.tamanho} onChange={(e) => setForm((f) => ({ ...f, tamanho: e.target.value }))} /></div>
              <div><Label>Cor</Label><Input value={form.cor} onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código rastreio</Label><Input value={form.codigo_rastreio} onChange={(e) => setForm((f) => ({ ...f, codigo_rastreio: e.target.value }))} /></div>
              <div><Label>Transportadora</Label><Input value={form.transportadora} onChange={(e) => setForm((f) => ({ ...f, transportadora: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data envio</Label><Input type="date" value={form.data_envio} onChange={(e) => setForm((f) => ({ ...f, data_envio: e.target.value }))} /></div>
              <div><Label>Previsão entrega</Label><Input type="date" value={form.data_entrega_prevista} onChange={(e) => setForm((f) => ({ ...f, data_entrega_prevista: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===================== Aba Métricas =====================
function AbaMetricas({ influenciadoraId }: { influenciadoraId: string }) {
  const { data: metricas = [], isLoading } = useMetricasMensais(influenciadoraId);
  const upsert = useUpsertMetrica();
  const [open, setOpen] = useState(false);
  const mesPadrao = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const [form, setForm] = useState({
    mes_ano: mesPadrao,
    total_publicacoes: "",
    alcance_total: "",
    usos_cupom: "",
    receita_gerada: "",
  });

  const chartData = useMemo(() => {
    return [...metricas]
      .slice(0, 6)
      .reverse()
      .map((m) => ({
        mes: m.mes_ano?.slice(0, 7),
        receita: Number(m.receita_gerada || 0),
      }));
  }, [metricas]);

  async function salvar() {
    try {
      await upsert.mutateAsync({
        influenciadora_id: influenciadoraId,
        mes_ano: form.mes_ano,
        total_publicacoes: Number(form.total_publicacoes) || 0,
        alcance_total: Number(form.alcance_total) || 0,
        usos_cupom: Number(form.usos_cupom) || 0,
        receita_gerada: Number(form.receita_gerada) || 0,
      } as any);
      toast.success("Métricas registradas");
      setOpen(false);
    } catch (e: any) { toast.error("Erro: " + e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Registrar Métricas do Mês</Button>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 text-sm">Receita gerada (últimos 6 meses)</h3>
              {chartData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Sem dados.</p>
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                      <RTooltip formatter={(v: any) => currency(Number(v))} />
                      <Line type="monotone" dataKey="receita" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metricas.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.mes_ano?.slice(0, 7)}</div>
                  <dl className="mt-2 text-sm space-y-1">
                    <div className="flex justify-between"><dt>Publicações</dt><dd>{m.total_publicacoes}</dd></div>
                    <div className="flex justify-between"><dt>Alcance</dt><dd>{m.alcance_total?.toLocaleString("pt-BR")}</dd></div>
                    <div className="flex justify-between"><dt>Usos cupom</dt><dd>{m.usos_cupom}</dd></div>
                    <div className="flex justify-between font-semibold"><dt>Receita</dt><dd>{currency(m.receita_gerada)}</dd></div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Métricas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Mês (YYYY-MM-01)</Label><Input type="date" value={form.mes_ano} onChange={(e) => setForm((f) => ({ ...f, mes_ano: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Publicações</Label><Input type="number" value={form.total_publicacoes} onChange={(e) => setForm((f) => ({ ...f, total_publicacoes: e.target.value }))} /></div>
              <div><Label>Alcance total</Label><Input type="number" value={form.alcance_total} onChange={(e) => setForm((f) => ({ ...f, alcance_total: e.target.value }))} /></div>
              <div><Label>Usos do cupom</Label><Input type="number" value={form.usos_cupom} onChange={(e) => setForm((f) => ({ ...f, usos_cupom: e.target.value }))} /></div>
              <div><Label>Receita (R$)</Label><Input type="number" step="0.01" value={form.receita_gerada} onChange={(e) => setForm((f) => ({ ...f, receita_gerada: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
