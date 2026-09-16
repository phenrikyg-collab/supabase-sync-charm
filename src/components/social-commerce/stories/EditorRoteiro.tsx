import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Loader2, Plus, Send, Save, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  AVISO_API, CLASSE_STATUS_ROTEIRO, CLASSE_STATUS_SLIDE, INTERVALOS, ROTULO_STATUS_ROTEIRO,
  ROTULO_STATUS_SLIDE, deInputLocal, listarSlides, marcarSlidePublicadoManual, paraInputLocal,
  publicarAgora, salvarRoteiro, slideInvalido, textoAvisos, type Roteiro, type Slide,
} from "@/lib/stories";
import { cn } from "@/lib/utils";
import SlideCard from "./SlideCard";
import PainelSlide from "./PainelSlide";

const novaChave = () => Math.random().toString(36).slice(2);

const slideVazio = (): Slide => ({
  _key: novaChave(),
  midia_url: null,
  manual: false,
  palavras_gatilho: [],
  gatilho_qualquer: false,
  enquete_opcoes: [],
  status: "pendente",
});

export default function EditorRoteiro({
  roteiroInicial, onVoltar, onSalvou,
}: { roteiroInicial: Roteiro; onVoltar: () => void; onSalvou: () => void }) {
  const { user } = useAuth();
  const [roteiro, setRoteiro] = useState<Roteiro>(roteiroInicial);
  const [slides, setSlides] = useState<Slide[]>([slideVazio()]);
  const [carregando, setCarregando] = useState(!!roteiroInicial.id);
  const [selecionado, setSelecionado] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const arrastando = useRef<number | null>(null);

  const publicandoOuDepois = ["publicando", "publicado", "parcial"].includes(String(roteiro.status ?? ""));

  const carregarSlides = async (id: number) => {
    try {
      const lista = await listarSlides(id);
      setSlides(lista.length ? lista.map((s) => ({ ...s, _key: novaChave() })) : [slideVazio()]);
    } catch (e: any) {
      toast.error("Não deu para carregar os slides", { description: e?.message });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (roteiroInicial.id) carregarSlides(Number(roteiroInicial.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roteiroInicial.id]);

  /* acompanhamento ao vivo enquanto publica */
  useEffect(() => {
    if (roteiro.status !== "publicando" || !roteiro.id) return;
    const t = setInterval(() => carregarSlides(Number(roteiro.id)), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roteiro.status, roteiro.id]);

  const invalidos = useMemo(
    () => slides.map((s, i) => ({ s, i })).filter(({ s }) => slideInvalido(s)),
    [slides],
  );

  const mudarSlide = (indice: number, patch: Partial<Slide>) =>
    setSlides((prev) => prev.map((s, i) => (i === indice ? { ...s, ...patch } : s)));

  const excluirSlide = (indice: number) => {
    setSlides((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== indice)));
    setSelecionado((s) => Math.max(0, Math.min(s, slides.length - 2)));
  };

  const soltar = (destino: number) => {
    const origem = arrastando.current;
    arrastando.current = null;
    if (origem === null || origem === destino) return;
    setSlides((prev) => {
      const copia = [...prev];
      const [item] = copia.splice(origem, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
    setSelecionado(destino);
  };

  const salvar = async (status: "rascunho" | "agendado") => {
    setSalvando(true);
    setMotivo(null);
    setAvisos([]);
    try {
      const retorno = await salvarRoteiro({
        id: roteiro.id ?? null,
        titulo: roteiro.titulo ?? "",
        objetivo: roteiro.objetivo ?? null,
        agendado_para: roteiro.agendado_para ?? null,
        intervalo_segundos: roteiro.intervalo_segundos ?? 0,
        status,
        criado_por: user?.email ?? null,
        slides: slides.map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          midia_url: s.midia_url ?? null,
          manual: !!s.manual,
          observacao: s.observacao ?? null,
          palavras_gatilho: s.palavras_gatilho ?? [],
          gatilho_qualquer: !!s.gatilho_qualquer,
          resposta_dm: s.resposta_dm ?? null,
          produto_id: s.produto_id ?? null,
          link: s.link ?? null,
          enquete_opcoes: s.enquete_opcoes ?? [],
        })),
      });

      const listaAvisos = textoAvisos(retorno.avisos);
      setAvisos(listaAvisos);

      if (!retorno.ok) {
        setMotivo(retorno.motivo ?? "O banco não aceitou salvar este roteiro.");
        toast.error(retorno.motivo ?? "Não deu para salvar", {
          description: listaAvisos.join(" | ") || undefined,
        });
        return;
      }

      const id = Number(retorno.id ?? roteiro.id);
      setRoteiro((r) => ({ ...r, id, status }));
      await carregarSlides(id);
      onSalvou();
      toast.success(status === "agendado" ? "Roteiro agendado." : "Rascunho salvo.", {
        description: listaAvisos.join(" | ") || undefined,
      });
    } catch (e: any) {
      toast.error("Não deu para salvar", { description: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  const publicar = async () => {
    if (!roteiro.id) {
      toast.error("Salve o roteiro antes de publicar.");
      return;
    }
    setSalvando(true);
    try {
      await publicarAgora(Number(roteiro.id));
      setRoteiro((r) => ({ ...r, status: "publicando" }));
      toast.success("Publicação começou. O acompanhamento atualiza sozinho.");
    } catch (e: any) {
      toast.error("Não deu para publicar agora", { description: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  const jaPubliquei = async (slideId: number) => {
    try {
      await marcarSlidePublicadoManual(slideId);
      if (roteiro.id) carregarSlides(Number(roteiro.id));
      toast.success("Slide marcado como publicado pelo app.");
    } catch (e: any) {
      toast.error("Não deu para marcar", { description: e?.message });
    }
  };

  const rolarAte = (indice: number) => {
    setSelecionado(indice);
    document.getElementById(`slide-${indice}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const atual = slides[selecionado] ?? slides[0];
  const manuaisPendentes = slides.filter((s) => s.status === "manual_pendente");

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* cabeçalho */}
      <div className="shrink-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1" onClick={onVoltar}>
            <ArrowLeft className="h-4 w-4" /> Roteiros
          </Button>
          <Badge variant="outline" className={cn("border", CLASSE_STATUS_ROTEIRO[String(roteiro.status ?? "rascunho")])}>
            {ROTULO_STATUS_ROTEIRO[String(roteiro.status ?? "rascunho")]}
          </Badge>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" disabled={salvando} onClick={() => salvar("rascunho")}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar rascunho
            </Button>
            <Button
              size="sm" className="gap-1"
              disabled={salvando || invalidos.length > 0 || !roteiro.agendado_para}
              onClick={() => salvar("agendado")}
            >
              <CalendarClock className="h-4 w-4" /> Agendar
            </Button>
            <Button variant="secondary" size="sm" className="gap-1" disabled={salvando || !roteiro.id} onClick={publicar}>
              <Send className="h-4 w-4" /> Publicar agora
            </Button>
          </div>
        </div>

        {invalidos.length > 0 && (
          <p className="text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            {invalidos.length === 1
              ? "1 slide com mídia que o Instagram recusa"
              : `${invalidos.length} slides com mídia que o Instagram recusa`}
            <button type="button" className="underline" onClick={() => rolarAte(invalidos[0].i)}>
              ver o primeiro
            </button>
          </p>
        )}
        {!roteiro.agendado_para && (
          <p className="text-xs text-muted-foreground">Escolha data e hora para poder agendar.</p>
        )}
        {motivo && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-2 space-y-1">
            <p className="text-xs text-destructive font-medium">{motivo}</p>
            {avisos.map((a, i) => <p key={i} className="text-xs text-destructive">{a}</p>)}
          </div>
        )}
        {!motivo && avisos.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 space-y-1">
            {avisos.map((a, i) => <p key={i} className="text-xs text-amber-800">{a}</p>)}
          </div>
        )}

        <Card className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Título</Label>
            <Input
              value={roteiro.titulo ?? ""}
              placeholder="Stories da manhã"
              onChange={(e) => setRoteiro((r) => ({ ...r, titulo: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Objetivo</Label>
            <Input
              value={roteiro.objetivo ?? ""}
              placeholder="sorteio do corset"
              onChange={(e) => setRoteiro((r) => ({ ...r, objetivo: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Data e hora</Label>
            <Input
              type="datetime-local"
              value={paraInputLocal(roteiro.agendado_para)}
              onChange={(e) => setRoteiro((r) => ({ ...r, agendado_para: deInputLocal(e.target.value) }))}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Intervalo entre slides</Label>
            <Select
              value={String(roteiro.intervalo_segundos ?? 0)}
              onValueChange={(v) => setRoteiro((r) => ({ ...r, intervalo_segundos: Number(v) }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVALOS.map((i) => (
                  <SelectItem key={i.valor} value={String(i.valor)}>{i.rotulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground border rounded-md p-2">{AVISO_API}</p>

        {manuaisPendentes.length > 0 && (
          <Card className="p-3 border-purple-200 bg-purple-50 space-y-2">
            <p className="text-xs text-purple-900 font-medium">
              Tem slide esperando você publicar pelo app do Instagram.
            </p>
            {manuaisPendentes.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-purple-900">
                  Slide {slides.findIndex((x) => x.id === s.id) + 1}: {s.observacao || "sem observação"}
                </span>
                <Button size="sm" variant="outline" onClick={() => s.id && jaPubliquei(Number(s.id))}>
                  Já publiquei pelo app
                </Button>
              </div>
            ))}
            <p className="text-[11px] text-purple-900">
              Sem essa marcação em 20 minutos, a sequência segue sem ele e o slide fica fora, com o motivo escrito.
            </p>
          </Card>
        )}
      </div>

      {/* colunas */}
      <div className="flex-1 min-h-0 mt-3 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4">
        <div className="min-h-0 overflow-y-auto pr-1 space-y-2">
          {carregando ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              {slides.map((s, i) => (
                <div key={s._key ?? s.id ?? i} className="space-y-1">
                  <SlideCard
                    slide={s}
                    indice={i}
                    ancora={`slide-${i}`}
                    selecionado={i === selecionado}
                    onSelecionar={() => setSelecionado(i)}
                    onExcluir={() => excluirSlide(i)}
                    onArrastarInicio={() => { arrastando.current = i; }}
                    onSoltarSobre={() => soltar(i)}
                  />
                  {s.status === "manual_pendente" && s.id && (
                    <Button size="sm" variant="outline" className="ml-14" onClick={() => jaPubliquei(Number(s.id))}>
                      Já publiquei pelo app
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline" size="sm" className="w-full gap-1"
                onClick={() => { setSlides((p) => [...p, slideVazio()]); setSelecionado(slides.length); }}
              >
                <Plus className="h-4 w-4" /> Novo slide
              </Button>
              {roteiro.status === "publicando" && (
                <p className="text-xs text-muted-foreground">
                  Publicando agora. O estado de cada slide atualiza a cada 10 segundos.
                </p>
              )}
              {publicandoOuDepois && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {slides.map((s, i) => (
                    <Badge key={i} variant="outline" className={cn("text-[10px] border", CLASSE_STATUS_SLIDE[String(s.status ?? "pendente")])}>
                      {i + 1}. {ROTULO_STATUS_SLIDE[String(s.status ?? "pendente")]}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <Card className="min-h-0 overflow-y-auto p-3">
          {atual ? (
            <PainelSlide
              slide={atual}
              indice={selecionado}
              somenteLeitura={publicandoOuDepois}
              onMudar={(patch) => mudarSlide(selecionado, patch)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Escolha um slide na coluna ao lado.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
