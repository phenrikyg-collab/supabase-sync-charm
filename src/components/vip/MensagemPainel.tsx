import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowDown, ArrowUp, Copy, ImageIcon, Plus, Save, Send, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  copiar,
  temSaudacao,
  whatsappParaHtml,
  vipMensagemSalvar,
  vipVarianteSalvar,
  vipMidiaAutorizacao,
  vipMensagemTextoFinal,
  vipMensagemMarcarManual,
  vipDisparar,
  type VipGrupo,
  type VipMensagem,
} from "@/lib/vip";

const CAMADAS_PADRAO = [
  "tipo",
  "formato",
  "tom",
  "gatilho",
  "persona",
  "tema",
  "angulo",
  "prova",
  "cta",
];

function PreviewBalao({
  headline,
  corpo,
  cta,
  imagem,
  link,
}: {
  headline?: string | null;
  corpo?: string | null;
  cta?: string | null;
  imagem?: string | null;
  link?: string | null;
}) {
  const texto = [headline, corpo, cta].filter(Boolean).join("\n\n");
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="max-w-md rounded-2xl rounded-tl-sm border bg-background p-3 shadow-sm">
        {imagem && (
          <img
            src={imagem}
            alt="Prévia da imagem da mensagem VIP"
            className="mb-2 max-h-56 w-full rounded-lg object-cover"
            loading="lazy"
          />
        )}
        <div
          className="whitespace-pre-wrap break-words text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: whatsappParaHtml(texto) }}
        />
        {link && <div className="mt-2 truncate text-xs text-sky-600 underline">{link}</div>}
      </div>
    </div>
  );
}

function EditorEnquete({
  enquete,
  onChange,
}: {
  enquete: any;
  onChange: (e: any) => void;
}) {
  const opcoes: string[] = enquete?.opcoes ?? ["", ""];
  const setOpcoes = (o: string[]) => onChange({ ...enquete, opcoes: o });
  return (
    <div className="space-y-3">
      <div>
        <Label>Pergunta (máx. 250 caracteres)</Label>
        <Textarea
          maxLength={250}
          rows={2}
          value={enquete?.pergunta ?? ""}
          onChange={(e) => onChange({ ...enquete, pergunta: e.target.value })}
        />
        <div className="mt-1 text-right text-[11px] text-muted-foreground">
          {(enquete?.pergunta ?? "").length}/250
        </div>
      </div>
      <div className="space-y-2">
        <Label>Opções (2 a 12)</Label>
        {opcoes.map((op, i) => (
          <div key={i} className="flex items-center gap-1">
            <Input value={op} onChange={(e) => setOpcoes(opcoes.map((o, j) => (j === i ? e.target.value : o)))} />
            <Button
              size="icon"
              variant="ghost"
              disabled={i === 0}
              onClick={() => {
                const n = [...opcoes];
                [n[i - 1], n[i]] = [n[i], n[i - 1]];
                setOpcoes(n);
              }}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={i === opcoes.length - 1}
              onClick={() => {
                const n = [...opcoes];
                [n[i + 1], n[i]] = [n[i], n[i + 1]];
                setOpcoes(n);
              }}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={opcoes.length <= 2}
              onClick={() => setOpcoes(opcoes.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" disabled={opcoes.length >= 12} onClick={() => setOpcoes([...opcoes, ""])}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar opção
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={!!enquete?.multipla} onCheckedChange={(v) => onChange({ ...enquete, multipla: v })} />
        <Label className="text-sm">Permitir múltipla escolha</Label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Enquete não carrega link — a métrica dela é voto.
      </p>
    </div>
  );
}

export function MensagemPainel({
  mensagem,
  grupos,
  aberto,
  onFechar,
  onAtualizado,
}: {
  mensagem: VipMensagem | null;
  grupos: VipGrupo[];
  aberto: boolean;
  onFechar: () => void;
  onAtualizado: () => void;
}) {
  const [rascunho, setRascunho] = useState<VipMensagem | null>(mensagem);
  const [variante, setVariante] = useState<any>(mensagem?.variantes?.comunidade ?? null);
  const [modoListas, setModoListas] = useState<"texto" | "enquete">("texto");
  const [modoCom, setModoCom] = useState<"texto" | "enquete">("texto");
  const [cliente, setCliente] = useState(mensagem?.midia_autorizacao_cliente ?? "");
  const [grupoCopia, setGrupoCopia] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setRascunho(mensagem);
    setVariante(mensagem?.variantes?.comunidade ?? null);
    setCliente(mensagem?.midia_autorizacao_cliente ?? "");
    setModoListas(mensagem?.enquete ? "enquete" : "texto");
    setModoCom(mensagem?.variantes?.comunidade?.enquete ? "enquete" : "texto");
  }, [mensagem?.id]);

  const camadas = useMemo(() => {
    const base = { ...(rascunho?.camadas ?? {}) };
    CAMADAS_PADRAO.forEach((c) => {
      if (!(c in base)) base[c] = (base as any)[c] ?? "";
    });
    return base as Record<string, any>;
  }, [rascunho?.camadas]);

  if (!rascunho) return null;

  const set = (patch: Partial<VipMensagem>) => setRascunho({ ...rascunho, ...patch } as VipMensagem);
  const setCamada = (k: string, v: string) => set({ camadas: { ...camadas, [k]: v } });

  const bloqueadaPorAutorizacao =
    !!rascunho.midia_requer_autorizacao && rascunho.midia_autorizacao_status !== "autorizada";

  const salvar = async () => {
    setSalvando(true);
    try {
      await vipMensagemSalvar(
        rascunho.id,
        {
          headline: rascunho.headline,
          corpo: rascunho.corpo,
          camadas,
          data_envio: rascunho.data_envio,
          horario: rascunho.horario,
          link_destino: rascunho.link_destino,
          midia_url: rascunho.midia_url,
          midia_sugerida: rascunho.midia_sugerida,
          raciocinio: rascunho.raciocinio,
          enquete: modoListas === "enquete" ? rascunho.enquete : null,
        },
        "painel",
      );
      if (variante) {
        await vipVarianteSalvar(
          rascunho.id,
          "comunidade",
          { ...variante, enquete: modoCom === "enquete" ? variante?.enquete ?? null : null },
          "painel",
        );
      }
      toast.success("Mensagem salva.");
      onAtualizado();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const copiarTexto = async () => {
    try {
      const r = await vipMensagemTextoFinal(rascunho.id, grupoCopia || null);
      const texto = typeof r === "string" ? r : (r?.texto ?? r?.texto_final ?? JSON.stringify(r));
      await copiar(texto);
      toast.success("Texto copiado com o link do grupo.");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar texto");
    }
  };

  const autorizar = async (status: "autorizada" | "recusada" | "nao_aplica") => {
    try {
      await vipMidiaAutorizacao(rascunho.id, status, cliente || null, "painel");
      toast.success("Autorização registrada.");
      onAtualizado();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao registrar autorização");
    }
  };

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif">
            #{rascunho.ordem ?? ""} · {rascunho.intencao ?? "mensagem"}
          </SheetTitle>
        </SheetHeader>

        {bloqueadaPorAutorizacao && (
          <Alert className="mt-3 border-amber-500/40 bg-amber-500/10">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Precisa de autorização da cliente</AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-xs">
                Foto, print ou depoimento de cliente só vai para os outros grupos depois que ela autorizar.
              </p>
              {rascunho.midia_autorizacao_texto && (
                <div className="rounded-md border bg-background p-2 text-xs whitespace-pre-wrap">
                  {rascunho.midia_autorizacao_texto}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => copiar(rascunho.midia_autorizacao_texto!).then(() => toast.success("Pedido copiado"))}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copiar pedido
                  </Button>
                </div>
              )}
              <Input
                placeholder="Nome da cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                className="max-w-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => autorizar("autorizada")}>Autorizada</Button>
                <Button size="sm" variant="destructive" onClick={() => autorizar("recusada")}>Recusada</Button>
                <Button size="sm" variant="outline" onClick={() => autorizar("nao_aplica")}>Não se aplica</Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="listas" className="mt-4">
          <TabsList>
            <TabsTrigger value="listas">Listas VIP</TabsTrigger>
            <TabsTrigger value="comunidade">Cria Comigo</TabsTrigger>
          </TabsList>

          {/* -------- Listas VIP -------- */}
          <TabsContent value="listas" className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant={modoListas === "texto" ? "default" : "outline"} onClick={() => setModoListas("texto")}>
                Texto
              </Button>
              <Button size="sm" variant={modoListas === "enquete" ? "default" : "outline"} onClick={() => setModoListas("enquete")}>
                Enquete
              </Button>
            </div>

            {modoListas === "texto" ? (
              <>
                <PreviewBalao
                  headline={rascunho.headline}
                  corpo={rascunho.corpo}
                  cta={camadas.cta}
                  imagem={rascunho.midia_url}
                  link={rascunho.link_geral ?? rascunho.link_destino}
                />
                {temSaudacao(rascunho.headline) && (
                  <p className="flex items-center gap-1 text-xs text-amber-600">
                    <TriangleAlert className="h-3.5 w-3.5" /> A headline das listas começa com saudação — nas listas isso
                    queima o primeiro segundo de atenção (no Cria Comigo cumprimentar é natural).
                  </p>
                )}
                <div className="space-y-2">
                  <Label>Headline</Label>
                  <Input value={rascunho.headline ?? ""} onChange={(e) => set({ headline: e.target.value })} />
                  <Label>Corpo</Label>
                  <Textarea rows={6} value={rascunho.corpo ?? ""} onChange={(e) => set({ corpo: e.target.value })} />
                </div>
              </>
            ) : (
              <EditorEnquete enquete={rascunho.enquete ?? { opcoes: ["", ""] }} onChange={(e) => set({ enquete: e })} />
            )}

            <Separator />
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">As 9 camadas</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {Object.keys(camadas).map((k) => (
                  <div key={k}>
                    <Label className="text-[11px] capitalize">{k.replace(/_/g, " ")}</Label>
                    <Input value={String(camadas[k] ?? "")} onChange={(e) => setCamada(k, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-[11px]">Data</Label>
                <Input type="date" value={rascunho.data_envio ?? ""} onChange={(e) => set({ data_envio: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">Horário</Label>
                <Input type="time" value={(rascunho.horario ?? "").slice(0, 5)} onChange={(e) => set({ horario: e.target.value })} />
              </div>
              {modoListas === "texto" && (
                <div className="sm:col-span-2">
                  <Label className="text-[11px]">Link de destino</Label>
                  <Input value={rascunho.link_destino ?? ""} onChange={(e) => set({ link_destino: e.target.value })} />
                </div>
              )}
              <div className="sm:col-span-2">
                <Label className="text-[11px] flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" /> URL da imagem (mídia oficial da Tray)
                </Label>
                <Input value={rascunho.midia_url ?? ""} onChange={(e) => set({ midia_url: e.target.value })} />
              </div>
            </div>

            {rascunho.midia_sugerida && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide">Briefing de arte (design)</div>
                <p className="whitespace-pre-wrap text-sm">{rascunho.midia_sugerida}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => copiar(rascunho.midia_sugerida!).then(() => toast.success("Briefing copiado"))}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copiar briefing
                </Button>
              </div>
            )}

            {rascunho.raciocinio && (
              <div>
                <Label className="text-[11px]">Raciocínio da IA</Label>
                <Textarea rows={3} value={rascunho.raciocinio ?? ""} onChange={(e) => set({ raciocinio: e.target.value })} />
              </div>
            )}
          </TabsContent>

          {/* -------- Comunidade -------- */}
          <TabsContent value="comunidade" className="space-y-4">
            {!variante ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Sem variante para o Cria Comigo — o grupo receberá o texto das listas.
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => setVariante({ headline: rascunho.headline, corpo: rascunho.corpo })}>
                    Criar variante da comunidade
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button size="sm" variant={modoCom === "texto" ? "default" : "outline"} onClick={() => setModoCom("texto")}>
                    Texto
                  </Button>
                  <Button size="sm" variant={modoCom === "enquete" ? "default" : "outline"} onClick={() => setModoCom("enquete")}>
                    Enquete
                  </Button>
                </div>
                {modoCom === "texto" ? (
                  <>
                    <PreviewBalao
                      headline={variante.headline}
                      corpo={variante.corpo}
                      cta={variante.cta}
                      imagem={rascunho.midia_url}
                      link={rascunho.link_destino}
                    />
                    <div className="space-y-2">
                      <Label>Headline</Label>
                      <Input value={variante.headline ?? ""} onChange={(e) => setVariante({ ...variante, headline: e.target.value })} />
                      <Label>Corpo</Label>
                      <Textarea rows={6} value={variante.corpo ?? ""} onChange={(e) => setVariante({ ...variante, corpo: e.target.value })} />
                      <Label>CTA (sempre puxando resposta)</Label>
                      <Input value={variante.cta ?? ""} onChange={(e) => setVariante({ ...variante, cta: e.target.value })} />
                    </div>
                  </>
                ) : (
                  <EditorEnquete
                    enquete={variante.enquete ?? { opcoes: ["", ""] }}
                    onChange={(e) => setVariante({ ...variante, enquete: e })}
                  />
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />

        <div className="flex flex-wrap items-center gap-2 pb-8">
          <Button onClick={salvar} disabled={salvando}>
            <Save className="mr-1 h-4 w-4" /> Salvar
          </Button>
          <Select value={grupoCopia} onValueChange={setGrupoCopia}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Link de qual grupo?" />
            </SelectTrigger>
            <SelectContent>
              {grupos.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.nome} {g.perfil === "comunidade" ? "(comunidade)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={copiarTexto}>
            <Copy className="mr-1 h-4 w-4" /> Copiar texto
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await vipMensagemMarcarManual(rascunho.id, grupoCopia ? [grupoCopia] : grupos.map((g) => g.id));
                toast.success("Marcada como enviada manualmente.");
                onAtualizado();
              } catch (e: any) {
                toast.error(e.message ?? "Falha ao marcar");
              }
            }}
          >
            Marcar como enviada manualmente
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await vipDisparar("enviar_teste", { mensagem_id: rascunho.id });
                toast.success("Teste enviado para o seu número.");
              } catch (e: any) {
                toast.error(e.message ?? "Falha ao enviar teste");
              }
            }}
          >
            <Send className="mr-1 h-4 w-4" /> Enviar teste
          </Button>
          {bloqueadaPorAutorizacao && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-600">
              Agendamento bloqueado até a autorização
            </Badge>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
