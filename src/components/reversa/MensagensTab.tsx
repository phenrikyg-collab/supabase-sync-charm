import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Eye, Loader2, Plus, Trash2 } from "lucide-react";
import {
  listarFigurinhasEmail,
  listarTemplatesEmail,
  nomeLegivelFigurinha,
  previaEmail,
  rotuloGatilho,
  salvarTemplateEmail,
  ROTULO_PREFERENCIA,
  VARIAVEIS_GATILHO,
  type FigurinhaEmail,
  type TemplateEmail,
} from "@/lib/reversaMensagens";

type Rascunho = {
  ativo: boolean;
  assunto: string;
  titulo: string;
  corpo: string[];
  botao_texto: string;
  aviso: string;
  figurinha: string;
  figurinha_alt: string;
  assinatura: string;
};

function paraRascunho(t: TemplateEmail): Rascunho {
  return {
    ativo: !!t.ativo,
    assunto: t.assunto ?? "",
    titulo: t.titulo ?? "",
    corpo: Array.isArray(t.corpo) ? [...t.corpo] : [],
    botao_texto: t.botao_texto ?? "",
    aviso: t.aviso ?? "",
    figurinha: t.figurinha ?? "",
    figurinha_alt: t.figurinha_alt ?? "",
    assinatura: t.assinatura ?? "",
  };
}

function diferencas(base: Rascunho, atual: Rascunho) {
  const patch: Record<string, any> = {};
  if (base.ativo !== atual.ativo) patch.ativo = atual.ativo;
  if (base.assunto !== atual.assunto) patch.assunto = atual.assunto;
  if (base.titulo !== atual.titulo) patch.titulo = atual.titulo;
  if (JSON.stringify(base.corpo) !== JSON.stringify(atual.corpo)) patch.corpo = atual.corpo;
  if (base.botao_texto !== atual.botao_texto) patch.botao_texto = atual.botao_texto;
  if (base.aviso !== atual.aviso) patch.aviso = atual.aviso;
  if (base.figurinha !== atual.figurinha) patch.figurinha = atual.figurinha || null;
  if (base.figurinha_alt !== atual.figurinha_alt) patch.figurinha_alt = atual.figurinha_alt;
  if (base.assinatura !== atual.assinatura) patch.assinatura = atual.assinatura;
  return patch;
}

export function MensagensTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TemplateEmail[]>([]);
  const [figurinhas, setFigurinhas] = useState<FigurinhaEmail[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gatilho, setGatilho] = useState<string | null>(null);
  const [base, setBase] = useState<Rascunho | null>(null);
  const [form, setForm] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [previaAberta, setPreviaAberta] = useState(false);
  const [previaHtml, setPreviaHtml] = useState<string | null>(null);
  const [previaCarregando, setPreviaCarregando] = useState(false);
  const [trocaPendente, setTrocaPendente] = useState<string | null>(null);

  async function carregar(manterGatilho = true) {
    setCarregando(true);
    try {
      const [lista, figs] = await Promise.all([listarTemplatesEmail(), listarFigurinhasEmail()]);
      setTemplates(lista);
      setFigurinhas(figs);
      const escolhido = (manterGatilho && gatilho) || lista[0]?.gatilho || null;
      const t = lista.find((x) => x.gatilho === escolhido) ?? lista[0];
      if (t) {
        setGatilho(t.gatilho);
        const r = paraRascunho(t);
        setBase(r);
        setForm(paraRascunho(t));
      }
    } catch (e: any) {
      toast({ title: "Não foi possível carregar", description: e.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = useMemo(() => (base && form ? diferencas(base, form) : {}), [base, form]);
  const mudou = Object.keys(patch).length > 0;

  useEffect(() => {
    if (!mudou) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [mudou]);

  function abrir(g: string) {
    if (g === gatilho) return;
    if (mudou) {
      setTrocaPendente(g);
      return;
    }
    trocar(g);
  }

  function trocar(g: string) {
    const t = templates.find((x) => x.gatilho === g);
    if (!t) return;
    setGatilho(g);
    setBase(paraRascunho(t));
    setForm(paraRascunho(t));
    setPreviaHtml(null);
  }

  const corpoVazio = !form || form.corpo.filter((p) => p.trim()).length === 0;

  async function salvar() {
    if (!gatilho || !form) return;
    if (corpoVazio) {
      toast({ title: "O corpo não pode ficar vazio", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      await salvarTemplateEmail(gatilho, patch);
      toast({ title: "Mensagem salva" });
      await carregar(true);
    } catch (e: any) {
      toast({ title: "Não foi possível salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  async function verEmail() {
    if (!gatilho) return;
    setPreviaAberta(true);
    setPreviaCarregando(true);
    setPreviaHtml(null);
    try {
      setPreviaHtml(await previaEmail(gatilho));
    } catch (e: any) {
      toast({ title: "Não foi possível abrir a prévia", description: e.message, variant: "destructive" });
    } finally {
      setPreviaCarregando(false);
    }
  }

  function mudarCorpo(i: number, valor: string) {
    if (!form) return;
    const corpo = [...form.corpo];
    corpo[i] = valor;
    setForm({ ...form, corpo });
  }

  function moverCorpo(i: number, delta: number) {
    if (!form) return;
    const j = i + delta;
    if (j < 0 || j >= form.corpo.length) return;
    const corpo = [...form.corpo];
    [corpo[i], corpo[j]] = [corpo[j], corpo[i]];
    setForm({ ...form, corpo });
  }

  const vars = gatilho ? VARIAVEIS_GATILHO[gatilho] : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="h-fit divide-y divide-border overflow-hidden">
        {carregando && (
          <div className="p-6 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {templates.map((t) => (
          <button
            key={t.gatilho}
            onClick={() => abrir(t.gatilho)}
            className={cn(
              "w-full px-3 py-2.5 text-left transition hover:bg-accent/40",
              gatilho === t.gatilho && "bg-accent/60",
              !t.ativo && "opacity-50",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{rotuloGatilho(t.gatilho)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Number(t.enviados ?? 0).toLocaleString("pt-BR")}
              </span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">{t.gatilho}</p>
            {t.preferencia && (
              <Badge variant="outline" className="mt-1 text-[10px]">
                {ROTULO_PREFERENCIA[t.preferencia] ?? t.preferencia}
              </Badge>
            )}
          </button>
        ))}
      </Card>

      {form && gatilho && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-xl">{rotuloGatilho(gatilho)}</h2>
              <p className="font-mono text-[11px] text-muted-foreground">{gatilho}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={verEmail}>
                <Eye className="mr-2 h-4 w-4" />
                Ver o e-mail
              </Button>
              <Button onClick={salvar} disabled={!mudou || salvando}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>

          <Card className="space-y-1 bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              <span className="font-mono">{"{{1}}"}</span> é o primeiro nome da cliente.{" "}
              <span className="font-mono">{"{{2}}"}</span> e <span className="font-mono">{"{{3}}"}</span> mudam
              conforme o gatilho.
            </p>
            <p>
              Neste gatilho: <span className="font-mono">{"{{2}}"}</span> {vars?.dois ?? "protocolo"}
              {vars?.tres ? (
                <>
                  {", "}
                  <span className="font-mono">{"{{3}}"}</span> {vars.tres}
                </>
              ) : null}
              .
            </p>
            <p>Só a marcação &lt;strong&gt; é aceita no corpo; qualquer outra tag vira texto.</p>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <Switch
                id="ativo"
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
              <Label htmlFor="ativo">Ativo</Label>
            </div>

            <div className="space-y-1.5">
              <Label>Assunto</Label>
              <Input value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Corpo</Label>
              {form.corpo.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Textarea
                    value={p}
                    rows={3}
                    className="flex-1"
                    onChange={(e) => mudarCorpo(i, e.target.value)}
                  />
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moverCorpo(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={i === form.corpo.length - 1}
                      onClick={() => moverCorpo(i, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setForm({ ...form, corpo: form.corpo.filter((_, k) => k !== i) })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {corpoVazio && <p className="text-xs text-destructive">O corpo não pode ficar vazio</p>}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setForm({ ...form, corpo: [...form.corpo, ""] })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar parágrafo
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label>Texto do botão</Label>
              <Input
                value={form.botao_texto}
                placeholder="Vazio: e-mail sem botão"
                onChange={(e) => setForm({ ...form, botao_texto: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Aviso</Label>
              <Textarea
                value={form.aviso}
                rows={2}
                placeholder="Vazio: sem a caixa de aviso"
                onChange={(e) => setForm({ ...form, aviso: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Figurinha</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                <button
                  onClick={() => setForm({ ...form, figurinha: "", figurinha_alt: "" })}
                  className={cn(
                    "flex h-20 items-center justify-center rounded-md border border-border p-1 text-[11px] text-muted-foreground",
                    !form.figurinha && "border-primary ring-2 ring-primary/30",
                  )}
                >
                  Sem figurinha
                </button>
                {figurinhas.map((f) => (
                  <button
                    key={f.nome}
                    onClick={() =>
                      setForm({
                        ...form,
                        figurinha: f.url,
                        figurinha_alt: `Mariana Cardoso: ${nomeLegivelFigurinha(f.nome)}`,
                      })
                    }
                    title={f.nome}
                    className={cn(
                      "h-20 rounded-md border border-border p-1",
                      form.figurinha === f.url && "border-primary ring-2 ring-primary/30",
                    )}
                  >
                    <img src={f.url} alt={f.nome} className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            </div>

            {form.figurinha && (
              <div className="space-y-1.5">
                <Label>Texto alternativo da figurinha</Label>
                <Input
                  value={form.figurinha_alt}
                  onChange={(e) => setForm({ ...form, figurinha_alt: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Assinatura</Label>
              <Input
                value={form.assinatura}
                onChange={(e) => setForm({ ...form, assinatura: e.target.value })}
              />
            </div>
          </Card>
        </div>
      )}

      <Sheet open={previaAberta} onOpenChange={setPreviaAberta}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Prévia do e-mail</SheetTitle>
          </SheetHeader>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Prévia com dados de exemplo (Maria, protocolo 10231) e com o texto já salvo.
          </p>
          <div className="mt-3 h-[calc(100vh-140px)] overflow-hidden rounded-md border border-border">
            {previaCarregando && (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
            {!previaCarregando && previaHtml && (
              <iframe title="Prévia do e-mail" srcDoc={previaHtml} className="h-full w-full bg-white" />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!trocaPendente} onOpenChange={(v) => !v && setTrocaPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              Você mudou esta mensagem e ainda não salvou. Se trocar de gatilho agora, as alterações se perdem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (trocaPendente) trocar(trocaPendente);
                setTrocaPendente(null);
              }}
            >
              Sair sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
