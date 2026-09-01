import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Send, Loader2, AlertTriangle, Link2, Lock } from "lucide-react";
import {
  crmDestinosListar, crmPortaEmUso, crmCampanhaMetricas, campanhaLinkSalvar,
  nomeCampanhaEmUso, avisoDestino, botoesUrl, slugDaUrl, CrmPorta,
} from "@/lib/crmLinks";

type Campanha = {
  id: number | string;
  nome: string;
  status?: string | null;
  total_destinatarios?: number | null;
  total_enviados?: number | null;
  total_falhas?: number | null;
  created_at?: string | null;
  data_envio?: string | null;
  concluida_em?: string | null;
  link_slug?: string | null;
  link_destino?: string | null;
  cliques?: number | null;
  template_id?: number | string | null;
};

const PLACEHOLDER_DESTINO = "https://www.usemarianacardoso.com.br/sale-elegant";

function fmtData(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("pt-BR");
}

function statusBadge(status?: string | null) {
  const s = (status ?? "rascunho").toLowerCase();
  if (s === "enviando") return <Badge variant="secondary">Enviando</Badge>;
  if (s.startsWith("conclu")) return <Badge>Concluída</Badge>;
  if (s === "erro" || s === "falha") return <Badge variant="destructive">Erro</Badge>;
  return <Badge variant="outline">Rascunho</Badge>;
}

function ExplicacaoPorta({ url }: { url?: string | null }) {
  return (
    <div className="rounded-md bg-muted p-3 text-xs leading-relaxed">
      O botão da mensagem é sempre <span className="font-mono">{url || "oferta.usemarianacardoso.com.br/ir"}</span>.
      Quando esta campanha entrar em envio, essa porta passa a apontar para o link de destino acima.
      Não é preciso aprovar template novo.
    </div>
  );
}

/** Bloco de porta + destino reutilizado em criação e edição. */
function BlocoLink({
  portas, slug, setSlug, destino, setDestino, travado, campanhaId,
  onConflito,
}: {
  portas: CrmPorta[];
  slug: string;
  setSlug: (v: string) => void;
  destino: string;
  setDestino: (v: string) => void;
  travado: boolean;
  campanhaId: string | number | null;
  onConflito: (nome: string | null) => void;
}) {
  const porta = portas.find((p) => p.slug === slug);
  const aviso = avisoDestino(destino);

  const { data: emUso } = useQuery({
    queryKey: ["crm-porta-em-uso", slug, campanhaId],
    queryFn: async () => nomeCampanhaEmUso(await crmPortaEmUso(slug, campanhaId)),
    enabled: !!slug,
    refetchInterval: 30_000,
  });

  useEffect(() => { onConflito(emUso ?? null); }, [emUso, onConflito]);

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <Label>Link da mensagem</Label>
      </div>

      <div>
        <Label className="text-xs">Porta</Label>
        <Select value={slug} onValueChange={setSlug} disabled={travado}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a porta" />
          </SelectTrigger>
          <SelectContent>
            {portas.map((p) => (
              <SelectItem key={p.slug} value={p.slug}>
                <span className="flex flex-col items-start">
                  <span>{p.nome || p.slug}</span>
                  <span className="text-[11px] text-muted-foreground">{p.url}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {travado && (
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <Lock className="h-3 w-3" /> A porta já está escrita no template aprovado.
          </p>
        )}
      </div>

      <div>
        <Label className="text-xs">Link de destino</Label>
        <Input
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          placeholder={PLACEHOLDER_DESTINO}
        />
        {aviso && <p className="text-xs text-amber-600 mt-1">{aviso}</p>}
      </div>

      <ExplicacaoPorta url={porta?.url} />

      {emUso && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            A porta /{slug} está sendo usada agora pela campanha "{emUso}". Se você disparar, as
            clientes daquela campanha passam a cair no link desta. Espere aquela terminar ou use
            outra porta.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function NovaCampanhaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [listaId, setListaId] = useState("");
  const [variaveis, setVariaveis] = useState<string[]>([]);
  const [slug, setSlug] = useState("");
  const [destino, setDestino] = useState("");
  const [conflito, setConflito] = useState<string | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["wpp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_templates_listar" as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const { data: portas = [] } = useQuery({
    queryKey: ["crm-portas"],
    queryFn: crmDestinosListar,
    enabled: open,
  });

  const aprovados = templates.filter(
    (t: any) => (t.status_aprovacao ?? "").toLowerCase() === "aprovado"
  );

  const template = aprovados.find((t: any) => String(t.id) === templateId);
  const botoes = useMemo(() => botoesUrl(template?.botoes), [template]);
  const temBotao = botoes.length > 0;
  const portaTravada = botoes.length === 1;

  // Pré-seleciona a porta escrita no template aprovado.
  useEffect(() => {
    if (!temBotao) { setSlug(""); return; }
    const s = slugDaUrl(botoes[0].url ?? "", portas);
    if (s) setSlug(s);
  }, [templateId, temBotao, portas]);

  const { data: listas = [] } = useQuery({
    queryKey: ["wpp-listas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listas_listar" as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const criar = useMutation({
    mutationFn: async () => {
      const variaveis_fixas: Record<string, string> = {};
      variaveis.forEach((v, i) => {
        if (v.trim() !== "") variaveis_fixas[String(i + 2)] = v;
      });
      const { error } = await supabase.rpc("campanhas_whatsapp_criar" as any, {
        p_nome: nome,
        p_template_id: templateId,
        p_lista_id: listaId,
        p_variaveis_fixas: variaveis_fixas,
        p_link_slug: temBotao ? slug || null : null,
        p_link_destino: temBotao ? destino || null : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Campanha criada" });
      queryClient.invalidateQueries({ queryKey: ["wpp-campanhas"] });
      onOpenChange(false);
      setNome(""); setTemplateId(""); setListaId(""); setVariaveis([]);
      setSlug(""); setDestino("");
    },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova campanha</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Template aprovado</Label>
            {aprovados.length === 0 ? (
              <p className="text-sm text-destructive flex items-center gap-2 mt-1">
                <AlertTriangle className="h-4 w-4" /> Nenhum template aprovado ainda
              </p>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {aprovados.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Lista / segmento</Label>
            <Select value={listaId} onValueChange={setListaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {listas.map((l: any) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.nome} ({l.total_membros ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {temBotao && (
            <BlocoLink
              portas={portas}
              slug={slug}
              setSlug={setSlug}
              destino={destino}
              setDestino={setDestino}
              travado={portaTravada}
              campanhaId={null}
              onConflito={setConflito}
            />
          )}

          <div>
            <Label>Variáveis fixas extras (opcional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              {"{{1}}"} é sempre o primeiro nome do cliente, preenchido automaticamente. Preencha
              aqui apenas {"{{2}}"}, {"{{3}}"}... com o mesmo valor para todos.
            </p>
            <div className="space-y-2">
              {variaveis.map((v, i) => (
                <Input
                  key={i}
                  value={v}
                  placeholder={`Valor para {{${i + 2}}}`}
                  onChange={(e) =>
                    setVariaveis((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                  }
                />
              ))}
              <Button variant="outline" size="sm" onClick={() => setVariaveis((p) => [...p, ""])}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar variável
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => criar.mutate()}
            disabled={!nome || !templateId || !listaId || criar.isPending || (temBotao && !destino)}
          >
            {criar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarLinkDialog({ campanha, onOpenChange }: { campanha: Campanha | null; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState("");
  const [destino, setDestino] = useState("");
  const [conflito, setConflito] = useState<string | null>(null);

  useEffect(() => {
    setSlug(campanha?.link_slug ?? "");
    setDestino(campanha?.link_destino ?? "");
  }, [campanha?.id]);

  const { data: portas = [] } = useQuery({
    queryKey: ["crm-portas"],
    queryFn: crmDestinosListar,
    enabled: !!campanha,
  });

  const salvar = useMutation({
    mutationFn: () => campanhaLinkSalvar(campanha!.id, slug || null, destino || null),
    onSuccess: () => {
      toast({ title: "Link salvo" });
      queryClient.invalidateQueries({ queryKey: ["wpp-campanhas"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={!!campanha} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Link da campanha — {campanha?.nome}</DialogTitle></DialogHeader>
        <BlocoLink
          portas={portas}
          slug={slug}
          setSlug={setSlug}
          destino={destino}
          setDestino={setDestino}
          travado={false}
          campanhaId={campanha?.id ?? null}
          onConflito={setConflito}
        />
        <DialogFooter>
          <Button onClick={() => salvar.mutate()} disabled={!destino || salvar.isPending}>
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricasDialog({ campanha, onOpenChange }: { campanha: Campanha | null; onOpenChange: (v: boolean) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["wpp-campanha-metricas", campanha?.id],
    queryFn: () => crmCampanhaMetricas(campanha!.id),
    enabled: !!campanha,
  });

  return (
    <Dialog open={!!campanha} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{campanha?.nome}</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <Card className="p-3">
                <p className="text-[11px] uppercase text-muted-foreground">Enviados</p>
                <p className="text-2xl font-serif">{data?.enviados ?? 0}</p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] uppercase text-muted-foreground">Falhas</p>
                <p className="text-2xl font-serif">{data?.falhas ?? 0}</p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] uppercase text-muted-foreground">Cliques</p>
                <p className="text-2xl font-serif">{data?.cliques ?? 0}</p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] uppercase text-muted-foreground">CTR (visitantes únicos / enviados)</p>
                <p className="text-2xl font-serif">
                  {data?.ctr_pct != null ? `${Number(data.ctr_pct).toFixed(1)}%` : "—"}
                </p>
              </Card>
            </div>
            <div className="rounded-md border p-3 text-xs space-y-1">
              <p>
                <span className="text-muted-foreground">Porta: </span>
                <span className="font-mono">{campanha?.link_slug ? `/${campanha.link_slug}` : "—"}</span>
              </p>
              <p className="break-all">
                <span className="text-muted-foreground">Destino: </span>
                {campanha?.link_destino ?? "—"}
              </p>
              <p className="text-muted-foreground">
                Campanha já enviada: porta e destino ficam só para leitura, porque parte das
                clientes já recebeu a mensagem com essa porta.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FalhasDialog({ campanha, onOpenChange }: { campanha: Campanha | null; onOpenChange: (v: boolean) => void }) {
  const { data: falhas = [], isLoading } = useQuery({
    queryKey: ["wpp-campanha-falhas", campanha?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("campanhas_whatsapp_listar_falhas" as any, {
        p_campanha_id: campanha!.id,
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!campanha,
  });

  return (
    <Dialog open={!!campanha} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Falhas — {campanha?.nome}</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : falhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum detalhe de falha disponível.</p>
        ) : (
          <div className="space-y-2">
            {falhas.map((f: any, i: number) => (
              <div key={i} className="border rounded-md p-2 text-sm">
                <p className="font-medium">{f.nome ?? f.telefone ?? "Destinatário"}</p>
                <p className="text-xs text-destructive">{f.erro ?? f.mensagem_erro ?? "Erro desconhecido"}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BotaoDisparar({ campanha, onDisparar, disparando }: {
  campanha: Campanha;
  onDisparar: (c: Campanha) => void;
  disparando: boolean;
}) {
  const { data: emUso } = useQuery({
    queryKey: ["crm-porta-em-uso", campanha.link_slug, campanha.id],
    queryFn: async () => nomeCampanhaEmUso(await crmPortaEmUso(campanha.link_slug!, campanha.id)),
    enabled: !!campanha.link_slug,
    refetchInterval: 30_000,
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={() => onDisparar(campanha)}
        disabled={disparando || !!emUso}
      >
        <Send className="h-4 w-4 mr-2" /> Disparar
      </Button>
      {emUso && (
        <p className="text-[11px] text-destructive max-w-[240px] text-right">
          A porta /{campanha.link_slug} está sendo usada agora pela campanha "{emUso}". Espere
          aquela terminar ou use outra porta.
        </p>
      )}
    </div>
  );
}

export function CampanhasWppTab() {
  const queryClient = useQueryClient();
  const [nova, setNova] = useState(false);
  const [falhasDe, setFalhasDe] = useState<Campanha | null>(null);
  const [linkDe, setLinkDe] = useState<Campanha | null>(null);
  const [metricasDe, setMetricasDe] = useState<Campanha | null>(null);

  const { data: campanhas = [], isLoading } = useQuery({
    queryKey: ["wpp-campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("campanhas_whatsapp_listar" as any);
      if (error) throw error;
      return (data ?? []) as Campanha[];
    },
    refetchInterval: (query) => {
      const linhas = (query.state.data ?? []) as Campanha[];
      return linhas.some((c) => (c.status ?? "").toLowerCase() === "enviando") ? 7000 : false;
    },
  });

  const disparar = useMutation({
    mutationFn: async (c: Campanha) => {
      if (c.link_slug) {
        const emUso = nomeCampanhaEmUso(await crmPortaEmUso(c.link_slug, c.id));
        if (emUso) {
          throw new Error(
            `A porta /${c.link_slug} está sendo usada agora pela campanha "${emUso}". Espere aquela terminar ou use outra porta.`
          );
        }
      }
      const { error } = await supabase.rpc("campanhas_whatsapp_preparar_envio" as any, {
        p_campanha_id: c.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Campanha em envio", description: "O motor processa cerca de 50 mensagens por minuto." });
      queryClient.invalidateQueries({ queryKey: ["wpp-campanhas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-portas"] });
    },
    onError: (e: any) => toast({ title: "Erro ao disparar", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNova(true)}><Plus className="h-4 w-4 mr-2" /> Nova campanha</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : campanhas.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhuma campanha criada ainda.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Destinatários</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead className="text-right">Falhas</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead>Criada</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas.map((c) => {
                const status = (c.status ?? "rascunho").toLowerCase();
                const total = c.total_destinatarios ?? 0;
                const enviados = c.total_enviados ?? 0;
                const pct = total > 0 ? Math.round((enviados / total) * 100) : 0;
                const editavel = status === "rascunho";
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">{c.nome}</p>
                      {c.link_slug && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Link2 className="h-3 w-3" /> /{c.link_slug}
                          <span className="truncate max-w-[180px]">→ {c.link_destino ?? "—"}</span>
                        </p>
                      )}
                      {status === "enviando" && (
                        <div className="mt-1 w-40">
                          <Progress value={pct} className="h-1.5" />
                          <p className="text-[11px] text-muted-foreground mt-0.5">{enviados}/{total}</p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(status)}</TableCell>
                    <TableCell className="text-right">{total}</TableCell>
                    <TableCell className="text-right">{enviados}</TableCell>
                    <TableCell className="text-right">
                      {(c.total_falhas ?? 0) > 0 ? (
                        <button className="text-destructive underline" onClick={() => setFalhasDe(c)}>
                          {c.total_falhas}
                        </button>
                      ) : 0}
                    </TableCell>
                    <TableCell className="text-right">{c.cliques ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtData(c.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        {editavel && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setLinkDe(c)}>
                              <Link2 className="h-4 w-4 mr-2" /> Link
                            </Button>
                            <BotaoDisparar
                              campanha={c}
                              onDisparar={(x) => disparar.mutate(x)}
                              disparando={disparar.isPending}
                            />
                          </>
                        )}
                        {!editavel && (
                          <Button size="sm" variant="ghost" onClick={() => setMetricasDe(c)}>
                            Ver resultados
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <NovaCampanhaDialog open={nova} onOpenChange={setNova} />
      <EditarLinkDialog campanha={linkDe} onOpenChange={(v) => !v && setLinkDe(null)} />
      <MetricasDialog campanha={metricasDe} onOpenChange={(v) => !v && setMetricasDe(null)} />
      <FalhasDialog campanha={falhasDe} onOpenChange={(v) => !v && setFalhasDe(null)} />
    </div>
  );
}
