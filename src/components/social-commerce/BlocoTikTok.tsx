import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { uploadMidia, ehUrlDeVideo } from "./midiaUpload";
import { duracaoDoVideo, type TikTokConfig, type TikTokPublicacao } from "@/lib/tiktok";

export const LIMITE_LEGENDA_TT = 2200;
export const LIMITE_TITULO_FOTO_TT = 90;

/**
 * Bloco "Também no TikTok".
 * Desde 03/09 quem publica é a Buffer — sumiram privacidade, interações,
 * conteúdo comercial e consentimento, que só existiam para a auditoria do TikTok.
 */
export interface TikTokFormState {
  ativo: boolean;
  usarOutraMidia: boolean;
  midiaUrls: string[];
  titulo: string;
  capaOffsetMs: number | null;
  capaIndex: number;
}

export const TIKTOK_FORM_VAZIO: TikTokFormState = {
  ativo: false,
  usarOutraMidia: false,
  midiaUrls: [],
  titulo: "",
  capaOffsetMs: null,
  capaIndex: 0,
};

/** Converte a linha do banco para o estado do formulário. */
export function tiktokFormDaLinha(l: TikTokPublicacao): TikTokFormState {
  return {
    ativo: true,
    usarOutraMidia: false,
    midiaUrls: l.midia_urls ?? [],
    titulo: l.titulo ?? "",
    capaOffsetMs: l.capa_offset_ms ?? null,
    capaIndex: l.capa_index ?? 0,
  };
}

export interface MidiaBase {
  url: string;
  isVideo: boolean;
}

export interface CompatTikTok {
  ok: boolean;
  motivo?: string;
  tipo: "VIDEO" | "PHOTO";
  urls: string[];
}

/** Regra de compatibilidade entre o formato do Instagram e o do TikTok. */
export function compatibilidadeTikTok(tipoIg: string, midias: MidiaBase[]): CompatTikTok {
  const temVideo = midias.some((m) => m.isVideo);
  if (tipoIg === "STORIES") {
    return { ok: false, motivo: "Este formato não existe no TikTok", tipo: "VIDEO", urls: [] };
  }
  if (tipoIg === "CAROUSEL") {
    if (temVideo) {
      return { ok: false, motivo: "Este formato não existe no TikTok", tipo: "PHOTO", urls: [] };
    }
    return { ok: true, tipo: "PHOTO", urls: midias.slice(0, 35).map((m) => m.url) };
  }
  const primeira = midias[0];
  if (!primeira) return { ok: true, tipo: tipoIg === "REELS" ? "VIDEO" : "PHOTO", urls: [] };
  return primeira.isVideo
    ? { ok: true, tipo: "VIDEO", urls: [primeira.url] }
    : { ok: true, tipo: "PHOTO", urls: [primeira.url] };
}

export function BlocoTikTok({
  form,
  onChange,
  config,
  compat,
  legendaIg,
  onErroValidacao,
}: {
  form: TikTokFormState;
  onChange: (f: TikTokFormState) => void;
  config: TikTokConfig | null;
  compat: CompatTikTok;
  legendaIg: string;
  onErroValidacao: (erro: string | null) => void;
}) {
  const [subindo, setSubindo] = useState(false);
  const [duracao, setDuracao] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const set = (p: Partial<TikTokFormState>) => onChange({ ...form, ...p });

  const conectado = config?.buffer_conectado === true;

  const urlsEfetivas = form.usarOutraMidia ? form.midiaUrls : compat.urls;
  const tipo: "VIDEO" | "PHOTO" = form.usarOutraMidia
    ? urlsEfetivas[0] && ehUrlDeVideo(urlsEfetivas[0])
      ? "VIDEO"
      : "PHOTO"
    : compat.tipo;

  const limiteLegenda = tipo === "VIDEO" ? LIMITE_LEGENDA_TT : LIMITE_TITULO_FOTO_TT;
  const videoSrc = tipo === "VIDEO" ? urlsEfetivas[0] ?? null : null;
  const movSuspeito = !!videoSrc && /\.mov(\?|#|$)/i.test(videoSrc);
  const maxDuracao = config?.max_video_post_duration_sec ?? null;
  const duracaoLonga = !!(duracao && maxDuracao && duracao > maxDuracao);

  // Legenda pré-preenchida com a legenda do Instagram
  useEffect(() => {
    if (!form.ativo) return;
    if (!form.titulo && legendaIg) set({ titulo: legendaIg.slice(0, limiteLegenda) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ativo, tipo]);

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
    if (!form.ativo) return null;
    if (!conectado) return "Publicação no TikTok desligada. A chave da Buffer não está configurada.";
    if (!compat.ok && !form.usarOutraMidia) return compat.motivo ?? "Formato incompatível com o TikTok.";
    if (urlsEfetivas.length === 0) return "Escolha a mídia do TikTok.";
    if (!form.titulo.trim()) return "Escreva a legenda do TikTok.";
    if (duracaoLonga) return `O TikTok desta conta aceita vídeos de até ${maxDuracao}s`;
    if (movSuspeito) return "Arquivo .mov costuma ser recusado pelo TikTok — envie um .mp4.";
    if (form.titulo.length > limiteLegenda)
      return `A legenda do TikTok aceita até ${limiteLegenda} caracteres.`;
    return null;
  }, [
    form.ativo, conectado, compat.ok, compat.motivo, form.usarOutraMidia,
    urlsEfetivas.length, form.titulo, duracaoLonga, maxDuracao, movSuspeito, limiteLegenda,
  ]);

  useEffect(() => {
    onErroValidacao(erro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erro]);

  const switchBloqueado = !conectado || (!compat.ok && !form.ativo);

  const enviarOutraMidia = async (files: File[]) => {
    if (subindo || files.length === 0) return;
    setSubindo(true);
    try {
      const urls = await Promise.all(files.map((f) => uploadMidia(f, "tiktok")));
      set({ midiaUrls: urls, usarOutraMidia: true, capaIndex: 0, capaOffsetMs: null });
      toast.success("Mídia do TikTok enviada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar a mídia");
    } finally {
      setSubindo(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border-2 border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Também no TikTok
          </p>
          {!compat.ok && <p className="text-[11px] text-danger mt-1">{compat.motivo}</p>}
          {!conectado && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Publicação no TikTok desligada. A chave da Buffer não está configurada.
            </p>
          )}
          {conectado && config?.buffer_channel_nome && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Sai pela Buffer, canal @{config.buffer_channel_nome}.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label htmlFor="tt-switch" className="text-sm">Publicar também no TikTok</Label>
          <Switch
            id="tt-switch"
            checked={form.ativo}
            disabled={switchBloqueado}
            onCheckedChange={(v) => set({ ativo: v })}
          />
        </div>
      </div>

      {form.ativo && (
        <div className="space-y-5 pt-1">
          {/* Mídia */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label>Mídia no TikTok ({tipo === "VIDEO" ? "vídeo" : `${urlsEfetivas.length} foto(s)`})</Label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={form.usarOutraMidia}
                  onCheckedChange={(v) => set({ usarOutraMidia: !!v, midiaUrls: v ? form.midiaUrls : [] })}
                />
                Usar outra mídia no TikTok
              </label>
            </div>

            {form.usarOutraMidia && (
              <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 cursor-pointer hover:bg-accent/40 transition-colors text-sm text-muted-foreground">
                {subindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {form.midiaUrls.length > 0
                  ? `${form.midiaUrls.length} arquivo(s) — selecionar substitui`
                  : "Selecionar arquivo (vídeo .mp4 ou até 35 fotos)"}
                <input
                  type="file"
                  accept="image/*,video/mp4"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const fs = Array.from(e.target.files ?? []).slice(0, 35);
                    if (fs.length) enviarOutraMidia(fs);
                    e.target.value = "";
                  }}
                />
              </label>
            )}

            {movSuspeito && (
              <p className="text-xs rounded border border-warning/30 bg-warning/10 p-2 flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-px" />
                Arquivo .mov costuma ser recusado pelo TikTok — envie um .mp4.
              </p>
            )}

            {tipo === "VIDEO" && duracao != null && (
              <p className={`text-[11px] ${duracaoLonga ? "text-danger font-medium" : "text-muted-foreground"}`}>
                Duração: {duracao.toFixed(1).replace(".", ",")}s
                {maxDuracao ? ` · limite da conta: ${maxDuracao}s` : ""}
                {duracaoLonga && ` — O TikTok desta conta aceita vídeos de até ${maxDuracao}s`}
              </p>
            )}
          </div>

          {/* Legenda */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Legenda do TikTok</Label>
              <span
                className={`text-[10px] ${
                  form.titulo.length > limiteLegenda ? "text-danger font-semibold" : "text-muted-foreground"
                }`}
              >
                {form.titulo.length}/{limiteLegenda}
              </span>
            </div>
            <Textarea
              value={form.titulo}
              onChange={(e) => set({ titulo: e.target.value.slice(0, limiteLegenda) })}
              className="min-h-[90px]"
              placeholder="Legenda com as hashtags no próprio texto…"
            />
          </div>

          {/* Capa */}
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
                        value={[form.capaOffsetMs ?? 0]}
                        onValueChange={([ms]) => {
                          set({ capaOffsetMs: ms });
                          if (videoRef.current) videoRef.current.currentTime = ms / 1000;
                        }}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Frame em {((form.capaOffsetMs ?? 0) / 1000).toFixed(1).replace(".", ",")}s.
                      </p>
                    </div>
                  </div>
                </div>
              )
            : urlsEfetivas.length > 1 && (
                <div className="space-y-2">
                  <Label>Capa (qual foto abre o post)</Label>
                  <div className="flex gap-2 flex-wrap">
                    {urlsEfetivas.map((u, i) => (
                      <button
                        key={u + i}
                        type="button"
                        onClick={() => set({ capaIndex: i })}
                        className={`h-16 w-16 rounded-lg overflow-hidden border-2 ${
                          form.capaIndex === i ? "border-primary" : "border-border"
                        }`}
                      >
                        <img src={u} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

          {erro && <p className="text-xs text-danger font-medium">{erro}</p>}
        </div>
      )}
    </section>
  );
}

/** Monta o payload da tabela `tiktok_publicacoes`. */
export function payloadTikTok(
  form: TikTokFormState,
  compat: CompatTikTok,
  extras: {
    publicacaoIgId?: string | number | null;
    agendadoPara: string | null;
    status: string;
    produtoIds: string[];
  },
): Record<string, any> {
  const urls = form.usarOutraMidia ? form.midiaUrls : compat.urls;
  const tipo: "VIDEO" | "PHOTO" = form.usarOutraMidia
    ? urls[0] && ehUrlDeVideo(urls[0])
      ? "VIDEO"
      : "PHOTO"
    : compat.tipo;
  return {
    publicacao_ig_id: extras.publicacaoIgId ?? null,
    tipo,
    midia_urls: urls,
    titulo: form.titulo || null,
    capa_offset_ms: tipo === "VIDEO" ? form.capaOffsetMs : null,
    capa_index: tipo === "PHOTO" ? form.capaIndex : null,
    agendado_para: extras.agendadoPara,
    status: extras.status,
    produto_ids: extras.produtoIds,
  };
}
