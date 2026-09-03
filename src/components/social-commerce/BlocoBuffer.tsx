import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { ehUrlDeVideo } from "./midiaUpload";
import {
  canalDoServico,
  duracaoDoVideo,
  linkDoProduto,
  NOME_SERVICO,
  sugerirTitulosYoutube,
  type BufferCanal,
  type BufferPublicacao,
  type ServicoBuffer,
} from "@/lib/buffer";

export const LIMITE_LEGENDA_TT = 2200;
export const LIMITE_TITULO_FOTO_TT = 90;
export const LIMITE_TITULO_YT = 100;
export const LIMITE_TITULO_PIN = 100;

/**
 * Bloco "Publicar também em" — TikTok, YouTube e Pinterest pela Buffer.
 * Um switch por rede, cada um com seus campos e sua linha no banco.
 */
export interface FormTikTok {
  ativo: boolean;
  titulo: string;
  capaOffsetMs: number | null;
  capaIndex: number;
}
export interface FormYouTube {
  ativo: boolean;
  descricao: string;
  titulo: string;
  privacidade: "public" | "unlisted" | "private";
  paraCriancas: boolean;
  notificar: boolean;
}
export interface FormPinterest {
  ativo: boolean;
  boardId: string;
  titulo: string;
  descricao: string;
  url: string;
}
export interface BufferFormState {
  tiktok: FormTikTok;
  youtube: FormYouTube;
  pinterest: FormPinterest;
}

export const BUFFER_FORM_VAZIO: BufferFormState = {
  tiktok: { ativo: false, titulo: "", capaOffsetMs: null, capaIndex: 0 },
  youtube: {
    ativo: false,
    descricao: "",
    titulo: "",
    privacidade: "public",
    paraCriancas: false,
    notificar: true,
  },
  pinterest: { ativo: false, boardId: "", titulo: "", descricao: "", url: "" },
};

/** Converte as linhas já salvas do grupo para o estado do formulário. */
export function bufferFormDasLinhas(linhas: BufferPublicacao[]): BufferFormState {
  const f: BufferFormState = {
    tiktok: { ...BUFFER_FORM_VAZIO.tiktok },
    youtube: { ...BUFFER_FORM_VAZIO.youtube },
    pinterest: { ...BUFFER_FORM_VAZIO.pinterest },
  };
  for (const l of linhas) {
    if (l.servico === "tiktok") {
      f.tiktok = {
        ativo: true,
        titulo: l.titulo ?? "",
        capaOffsetMs: l.capa_offset_ms ?? null,
        capaIndex: l.capa_index ?? 0,
      };
    } else if (l.servico === "youtube") {
      f.youtube = {
        ativo: true,
        descricao: l.titulo ?? "",
        titulo: l.youtube_titulo ?? "",
        privacidade: (l.youtube_privacidade as FormYouTube["privacidade"]) ?? "public",
        paraCriancas: l.youtube_para_criancas ?? false,
        notificar: l.youtube_notificar ?? true,
      };
    } else if (l.servico === "pinterest") {
      f.pinterest = {
        ativo: true,
        boardId: l.pinterest_board_id ?? "",
        titulo: l.pinterest_titulo ?? "",
        descricao: l.titulo ?? "",
        url: l.pinterest_url ?? "",
      };
    }
  }
  return f;
}

export interface MidiaBase {
  url: string;
  isVideo: boolean;
}

export interface CompatBuffer {
  ok: boolean;
  motivo?: string;
  tipo: "VIDEO" | "PHOTO";
  urls: string[];
}

/** Regra de compatibilidade entre o formato do Instagram e o da Buffer. */
export function compatibilidadeBuffer(tipoIg: string, midias: MidiaBase[]): CompatBuffer {
  const temVideo = midias.some((m) => m.isVideo);
  if (tipoIg === "STORIES") {
    return { ok: false, motivo: "Este formato não sai pela Buffer", tipo: "VIDEO", urls: [] };
  }
  if (tipoIg === "CAROUSEL") {
    if (temVideo) {
      return { ok: false, motivo: "Este formato não sai pela Buffer", tipo: "PHOTO", urls: [] };
    }
    return { ok: true, tipo: "PHOTO", urls: midias.slice(0, 35).map((m) => m.url) };
  }
  const primeira = midias[0];
  if (!primeira) return { ok: true, tipo: tipoIg === "REELS" ? "VIDEO" : "PHOTO", urls: [] };
  return primeira.isVideo
    ? { ok: true, tipo: "VIDEO", urls: [primeira.url] }
    : { ok: true, tipo: "PHOTO", urls: [primeira.url] };
}

function CabecalhoSwitch({
  servico,
  ativo,
  bloqueado,
  motivo,
  onChange,
}: {
  servico: ServicoBuffer;
  ativo: boolean;
  bloqueado: boolean;
  motivo?: string | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{NOME_SERVICO[servico]}</p>
        {motivo && <p className="text-[11px] text-muted-foreground mt-0.5">{motivo}</p>}
      </div>
      <Switch
        id={`sw-${servico}`}
        checked={ativo}
        disabled={bloqueado}
        onCheckedChange={onChange}
        aria-label={`Publicar também no ${NOME_SERVICO[servico]}`}
      />
    </div>
  );
}

export function BlocoBuffer({
  form,
  onChange,
  canais,
  compat,
  legendaIg,
  produtoIds,
  linhas,
  onErroValidacao,
}: {
  form: BufferFormState;
  onChange: (f: BufferFormState) => void;
  canais: BufferCanal[];
  compat: CompatBuffer;
  legendaIg: string;
  produtoIds: string[];
  linhas: BufferPublicacao[];
  onErroValidacao: (erro: string | null) => void;
}) {
  const [duracao, setDuracao] = useState<number | null>(null);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [gerando, setGerando] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const set = (p: Partial<BufferFormState>) => onChange({ ...form, ...p });
  const setTt = (p: Partial<FormTikTok>) => set({ tiktok: { ...form.tiktok, ...p } });
  const setYt = (p: Partial<FormYouTube>) => set({ youtube: { ...form.youtube, ...p } });
  const setPin = (p: Partial<FormPinterest>) => set({ pinterest: { ...form.pinterest, ...p } });

  const urls = compat.urls;
  const tipo = compat.tipo;
  const videoSrc = tipo === "VIDEO" ? urls[0] ?? null : null;
  const limiteLegendaTt = tipo === "VIDEO" ? LIMITE_LEGENDA_TT : LIMITE_TITULO_FOTO_TT;

  const publicado = (s: ServicoBuffer) =>
    linhas.some((l) => l.servico === s && l.status === "publicado");

  const canalDe = (s: ServicoBuffer) => canalDoServico(canais, s);
  const desconectado = (s: ServicoBuffer) => canalDe(s)?.desconectado === true;
  const semCanal = (s: ServicoBuffer) => !canalDe(s);

  const boards = canalDe("pinterest")?.boards ?? [];

  // Pré-preenchimentos quando o switch liga
  useEffect(() => {
    if (form.tiktok.ativo && !form.tiktok.titulo && legendaIg) {
      setTt({ titulo: legendaIg.slice(0, limiteLegendaTt) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tiktok.ativo]);

  useEffect(() => {
    if (form.youtube.ativo && !form.youtube.descricao && legendaIg) {
      setYt({ descricao: legendaIg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.youtube.ativo]);

  useEffect(() => {
    if (!form.pinterest.ativo) return;
    const patch: Partial<FormPinterest> = {};
    if (!form.pinterest.descricao && legendaIg) patch.descricao = legendaIg;
    if (!form.pinterest.titulo && legendaIg) {
      patch.titulo = legendaIg.split("\n")[0].slice(0, LIMITE_TITULO_PIN);
    }
    if (Object.keys(patch).length) setPin(patch);
    if (!form.pinterest.url) {
      linkDoProduto(produtoIds).then((l) => {
        if (l) setPin({ url: l });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pinterest.ativo]);

  useEffect(() => {
    let vivo = true;
    if (!videoSrc) {
      setDuracao(null);
      return;
    }
    duracaoDoVideo(videoSrc).then((d) => vivo && setDuracao(d));
    return () => {
      vivo = false;
    };
  }, [videoSrc]);

  const erro = useMemo(() => {
    const algum = form.tiktok.ativo || form.youtube.ativo || form.pinterest.ativo;
    if (!algum) return null;
    if (!compat.ok) return compat.motivo ?? "Formato incompatível com a Buffer.";
    if (urls.length === 0) return "Anexe a mídia antes de publicar pela Buffer.";
    if (form.tiktok.ativo) {
      if (!form.tiktok.titulo.trim()) return "Escreva a legenda do TikTok.";
      if (form.tiktok.titulo.length > limiteLegendaTt)
        return `A legenda do TikTok aceita até ${limiteLegendaTt} caracteres.`;
    }
    if (form.youtube.ativo) {
      if (tipo !== "VIDEO") return "O YouTube recebe só vídeo.";
      if (!form.youtube.titulo.trim()) return "Escreva o título do YouTube.";
      if (form.youtube.titulo.length > LIMITE_TITULO_YT)
        return `O título do YouTube aceita até ${LIMITE_TITULO_YT} caracteres.`;
    }
    if (form.pinterest.ativo) {
      if (!form.pinterest.boardId) return "Escolha o board do Pinterest.";
      if (form.pinterest.titulo.length > LIMITE_TITULO_PIN)
        return `O título do pin aceita até ${LIMITE_TITULO_PIN} caracteres.`;
      if (form.pinterest.url.trim() && !/^https?:\/\//i.test(form.pinterest.url.trim()))
        return "O link do pin precisa começar com http:// ou https://";
    }
    return null;
  }, [form, compat.ok, compat.motivo, urls.length, tipo, limiteLegendaTt]);

  useEffect(() => {
    onErroValidacao(erro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erro]);

  const gerarTitulos = async () => {
    if (gerando) return;
    setGerando(true);
    try {
      const ts = await sugerirTitulosYoutube(legendaIg || form.youtube.descricao, 3);
      setSugestoes(ts);
      if (!ts.length) toast.info("Nenhuma sugestão devolvida.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao sugerir títulos");
    } finally {
      setGerando(false);
    }
  };

  const motivoBloqueio = (s: ServicoBuffer): string | null => {
    if (semCanal(s)) return "Canal não conectado na Buffer.";
    if (desconectado(s)) return "Canal desconectado na Buffer. Reconecte por lá.";
    if (!compat.ok) return compat.motivo ?? "Formato incompatível.";
    if (s === "youtube" && tipo !== "VIDEO") return "O YouTube recebe só vídeo.";
    if (publicado(s)) return `Já publicado no ${NOME_SERVICO[s]}`;
    return null;
  };

  const bloqueado = (s: ServicoBuffer) =>
    semCanal(s) || desconectado(s) || (!compat.ok && !form[s].ativo) || (s === "youtube" && tipo !== "VIDEO") || publicado(s);

  return (
    <section className="space-y-4 rounded-lg border-2 border-border p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Publicar também em
      </p>

      {/* ===== TikTok ===== */}
      <div className="space-y-3 rounded-lg border p-3">
        <CabecalhoSwitch
          servico="tiktok"
          ativo={form.tiktok.ativo}
          bloqueado={bloqueado("tiktok")}
          motivo={motivoBloqueio("tiktok")}
          onChange={(v) => setTt({ ativo: v })}
        />
        {form.tiktok.ativo && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Legenda do TikTok</Label>
                <span
                  className={`text-[10px] ${
                    form.tiktok.titulo.length > limiteLegendaTt
                      ? "text-danger font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {form.tiktok.titulo.length}/{limiteLegendaTt}
                </span>
              </div>
              <Textarea
                value={form.tiktok.titulo}
                onChange={(e) => setTt({ titulo: e.target.value.slice(0, limiteLegendaTt) })}
                className="min-h-[90px]"
                placeholder="Legenda com as hashtags no próprio texto…"
              />
            </div>

            {tipo === "VIDEO"
              ? videoSrc && (
                  <div className="space-y-2">
                    <Label>Capa do vídeo (frame)</Label>
                    <div className="flex gap-4 items-start">
                      <video
                        ref={videoRef}
                        src={videoSrc}
                        className="w-28 aspect-[9/16] rounded-lg border bg-muted object-cover"
                        muted
                        playsInline
                      />
                      <div className="flex-1 space-y-2">
                        <Slider
                          min={0}
                          max={Math.max(1, Math.round((duracao ?? 10) * 1000))}
                          step={100}
                          value={[form.tiktok.capaOffsetMs ?? 0]}
                          onValueChange={([ms]) => {
                            setTt({ capaOffsetMs: ms });
                            if (videoRef.current) videoRef.current.currentTime = ms / 1000;
                          }}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Frame em {((form.tiktok.capaOffsetMs ?? 0) / 1000).toFixed(1).replace(".", ",")}s.
                        </p>
                      </div>
                    </div>
                  </div>
                )
              : urls.length > 1 && (
                  <div className="space-y-2">
                    <Label>Capa (qual foto abre o post)</Label>
                    <div className="flex gap-2 flex-wrap">
                      {urls.map((u, i) => (
                        <button
                          key={u + i}
                          type="button"
                          onClick={() => setTt({ capaIndex: i })}
                          className={`h-16 w-16 rounded-lg overflow-hidden border-2 ${
                            form.tiktok.capaIndex === i ? "border-primary" : "border-border"
                          }`}
                        >
                          <img src={u} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
          </div>
        )}
      </div>

      {/* ===== YouTube ===== */}
      <div className="space-y-3 rounded-lg border p-3">
        <CabecalhoSwitch
          servico="youtube"
          ativo={form.youtube.ativo}
          bloqueado={bloqueado("youtube")}
          motivo={motivoBloqueio("youtube")}
          onChange={(v) => setYt({ ativo: v })}
        />
        {form.youtube.ativo && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Título do vídeo</Label>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] ${
                      form.youtube.titulo.length > LIMITE_TITULO_YT
                        ? "text-danger font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {form.youtube.titulo.length}/{LIMITE_TITULO_YT}
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={gerarTitulos} disabled={gerando}>
                    {gerando ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                    )}
                    Sugerir títulos
                  </Button>
                </div>
              </div>
              <Input
                value={form.youtube.titulo}
                onChange={(e) => setYt({ titulo: e.target.value.slice(0, LIMITE_TITULO_YT) })}
                placeholder="O que faz a pessoa clicar no Shorts…"
              />
              {sugestoes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {sugestoes.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setYt({ titulo: t.slice(0, LIMITE_TITULO_YT) })}
                      className="rounded-full border px-2.5 py-1 text-[11px] hover:bg-accent transition-colors text-left"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={form.youtube.descricao}
                onChange={(e) => setYt({ descricao: e.target.value })}
                className="min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Privacidade</Label>
                <Select
                  value={form.youtube.privacidade}
                  onValueChange={(v) => setYt({ privacidade: v as FormYouTube["privacidade"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Público</SelectItem>
                    <SelectItem value="unlisted">Não listado</SelectItem>
                    <SelectItem value="private">Privado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Conteúdo para crianças?</Label>
                <RadioGroup
                  value={form.youtube.paraCriancas ? "sim" : "nao"}
                  onValueChange={(v) => setYt({ paraCriancas: v === "sim" })}
                  className="flex gap-4 pt-1.5"
                >
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <RadioGroupItem value="nao" /> Não
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <RadioGroupItem value="sim" /> Sim
                  </label>
                </RadioGroup>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="yt-notificar" className="text-sm">Notificar inscritos</Label>
              <Switch
                id="yt-notificar"
                checked={form.youtube.notificar}
                onCheckedChange={(v) => setYt({ notificar: v })}
              />
            </div>
          </div>
        )}
      </div>

      {/* ===== Pinterest ===== */}
      <div className="space-y-3 rounded-lg border p-3">
        <CabecalhoSwitch
          servico="pinterest"
          ativo={form.pinterest.ativo}
          bloqueado={bloqueado("pinterest")}
          motivo={motivoBloqueio("pinterest")}
          onChange={(v) => setPin({ ativo: v })}
        />
        {form.pinterest.ativo && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Board</Label>
              <Select value={form.pinterest.boardId} onValueChange={(v) => setPin({ boardId: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha o board" /></SelectTrigger>
                <SelectContent>
                  {boards.map((b) => (
                    <SelectItem key={b.service_id ?? b.id ?? b.nome ?? ""} value={String(b.service_id ?? "")}>
                      {b.nome ?? b.service_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Título do pin</Label>
                <span
                  className={`text-[10px] ${
                    form.pinterest.titulo.length > LIMITE_TITULO_PIN
                      ? "text-danger font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {form.pinterest.titulo.length}/{LIMITE_TITULO_PIN}
                </span>
              </div>
              <Input
                value={form.pinterest.titulo}
                onChange={(e) => setPin({ titulo: e.target.value.slice(0, LIMITE_TITULO_PIN) })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={form.pinterest.descricao}
                onChange={(e) => setPin({ descricao: e.target.value })}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Link do pin</Label>
              <Input
                value={form.pinterest.url}
                onChange={(e) => setPin({ url: e.target.value })}
                placeholder="https://…"
              />
              {!form.pinterest.url.trim() && (
                <p className="text-xs rounded border border-warning/30 bg-warning/10 p-2 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-px" />
                  Pin sem link. O Pinterest é buscador de compra: sem destino, o pin gera alcance e
                  nenhuma visita.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {erro && <p className="text-xs text-danger font-medium">{erro}</p>}
    </section>
  );
}

/** Monta o payload da linha de um destino na tabela `tiktok_publicacoes`. */
export function payloadDestino(
  servico: ServicoBuffer,
  form: BufferFormState,
  compat: CompatBuffer,
  extras: {
    grupoId: string;
    publicacaoIgId?: string | number | null;
    agendadoPara: string | null;
    status: string;
    produtoIds: string[];
  },
): Record<string, any> {
  const urls = compat.urls;
  const tipo: "VIDEO" | "PHOTO" = urls[0] && ehUrlDeVideo(urls[0]) ? "VIDEO" : compat.tipo;
  const base: Record<string, any> = {
    servico,
    grupo_id: extras.grupoId,
    publicacao_ig_id: extras.publicacaoIgId ?? null,
    tipo,
    midia_urls: urls,
    agendado_para: extras.agendadoPara,
    status: extras.status,
    produto_ids: extras.produtoIds,
  };

  if (servico === "tiktok") {
    return {
      ...base,
      titulo: form.tiktok.titulo || null,
      capa_offset_ms: tipo === "VIDEO" ? form.tiktok.capaOffsetMs : null,
      capa_index: tipo === "PHOTO" ? form.tiktok.capaIndex : null,
    };
  }
  if (servico === "youtube") {
    return {
      ...base,
      titulo: form.youtube.descricao || null,
      youtube_titulo: form.youtube.titulo || null,
      youtube_privacidade: form.youtube.privacidade,
      youtube_para_criancas: form.youtube.paraCriancas,
      youtube_notificar: form.youtube.notificar,
    };
  }
  return {
    ...base,
    titulo: form.pinterest.descricao || null,
    pinterest_board_id: form.pinterest.boardId || null,
    pinterest_titulo: form.pinterest.titulo || null,
    pinterest_url: form.pinterest.url.trim() || null,
  };
}
