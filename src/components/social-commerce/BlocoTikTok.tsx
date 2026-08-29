import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { uploadMidia, ehUrlDeVideo } from "./midiaUpload";
import {
  ROTULO_PRIVACIDADE,
  duracaoDoVideo,
  type TikTokConfig,
  type TikTokCreatorInfo,
  type TikTokPublicacao,
} from "@/lib/tiktok";

export const LIMITE_LEGENDA_TT = 2200;
export const LIMITE_TITULO_FOTO_TT = 90;
export const LIMITE_DESCRICAO_TT = 4000;

export interface TikTokFormState {
  ativo: boolean;
  usarOutraMidia: boolean;
  midiaUrls: string[];
  titulo: string;
  descricao: string;
  capaOffsetMs: number | null;
  capaIndex: number;
  privacyLevel: string;
  permitirComentario: boolean;
  permitirDuet: boolean;
  permitirStitch: boolean;
  comercial: boolean;
  marcaPropria: boolean;
  conteudoPatrocinado: boolean;
  autoAddMusic: boolean;
  isAigc: boolean;
}

export const TIKTOK_FORM_VAZIO: TikTokFormState = {
  ativo: false,
  usarOutraMidia: false,
  midiaUrls: [],
  titulo: "",
  descricao: "",
  capaOffsetMs: null,
  capaIndex: 0,
  privacyLevel: "",
  permitirComentario: false,
  permitirDuet: false,
  permitirStitch: false,
  comercial: false,
  marcaPropria: false,
  conteudoPatrocinado: false,
  autoAddMusic: false,
  isAigc: false,
};

/** Converte a linha do banco para o estado do formulário. */
export function tiktokFormDaLinha(l: TikTokPublicacao): TikTokFormState {
  return {
    ativo: true,
    usarOutraMidia: false,
    midiaUrls: l.midia_urls ?? [],
    titulo: l.titulo ?? "",
    descricao: l.descricao ?? "",
    capaOffsetMs: l.capa_offset_ms ?? null,
    capaIndex: l.capa_index ?? 0,
    privacyLevel: l.privacy_level ?? "",
    permitirComentario: !l.desabilitar_comentario,
    permitirDuet: !l.desabilitar_duet,
    permitirStitch: !l.desabilitar_stitch,
    comercial: !!(l.marca_propria || l.conteudo_patrocinado),
    marcaPropria: !!l.marca_propria,
    conteudoPatrocinado: !!l.conteudo_patrocinado,
    autoAddMusic: !!l.auto_add_music,
    isAigc: !!l.is_aigc,
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

function TravadaTooltip({ children, texto }: { children: React.ReactNode; texto: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
        <TooltipContent>{texto}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function BlocoTikTok({
  form,
  onChange,
  config,
  creatorInfo,
  carregandoCreator,
  compat,
  legendaIg,
  onErroValidacao,
}: {
  form: TikTokFormState;
  onChange: (f: TikTokFormState) => void;
  config: TikTokConfig | null;
  creatorInfo: TikTokCreatorInfo | null;
  carregandoCreator: boolean;
  compat: CompatTikTok;
  legendaIg: string;
  onErroValidacao: (erro: string | null) => void;
}) {
  const [subindo, setSubindo] = useState(false);
  const [duracao, setDuracao] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const set = (p: Partial<TikTokFormState>) => onChange({ ...form, ...p });

  const auditado = config?.auditado !== false;
  const podePostar = creatorInfo ? creatorInfo.can_post !== false : true;
  const conectado = config?.conectado === true;

  const urlsEfetivas = form.usarOutraMidia ? form.midiaUrls : compat.urls;
  const tipo: "VIDEO" | "PHOTO" = form.usarOutraMidia
    ? urlsEfetivas[0] && ehUrlDeVideo(urlsEfetivas[0])
      ? "VIDEO"
      : "PHOTO"
    : compat.tipo;

  const opcoesPrivacidade =
    creatorInfo?.privacy_level_options?.length
      ? creatorInfo.privacy_level_options
      : config?.privacy_level_options ?? Object.keys(ROTULO_PRIVACIDADE);

  const videoSrc = tipo === "VIDEO" ? urlsEfetivas[0] ?? null : null;
  const movSuspeito = !!videoSrc && /\.mov(\?|#|$)/i.test(videoSrc);
  const maxDuracao = creatorInfo?.max_video_post_duration_sec ?? config?.max_video_post_duration_sec ?? null;
  const duracaoLonga = !!(duracao && maxDuracao && duracao > maxDuracao);

  // Legenda / descrição pré-preenchidas com a legenda do Instagram
  useEffect(() => {
    if (!form.ativo) return;
    if (tipo === "VIDEO" && !form.titulo && legendaIg) {
      set({ titulo: legendaIg.slice(0, LIMITE_LEGENDA_TT) });
    }
    if (tipo === "PHOTO" && !form.descricao && legendaIg) {
      set({ descricao: legendaIg.slice(0, LIMITE_DESCRICAO_TT) });
    }
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

  const brandPrivado = form.conteudoPatrocinado && form.privacyLevel === "SELF_ONLY";

  const erro = useMemo(() => {
    if (!form.ativo) return null;
    if (!conectado) return "Conecte a conta do TikTok em Configurações › Integrações.";
    if (!podePostar) return creatorInfo?.erro ?? "Esta conta não pode publicar no TikTok agora.";
    if (!compat.ok && !form.usarOutraMidia) return compat.motivo ?? "Formato incompatível com o TikTok.";
    if (urlsEfetivas.length === 0) return "Escolha a mídia do TikTok.";
    if (!form.privacyLevel) return "Escolha quem pode ver no TikTok.";
    if (duracaoLonga) return `O TikTok desta conta aceita vídeos de até ${maxDuracao}s`;
    if (movSuspeito) return "Arquivo .mov costuma ser recusado pelo TikTok — envie um .mp4.";
    if (brandPrivado) return "Conteúdo de marca não pode ser privado";
    if (tipo === "PHOTO" && form.titulo.length > LIMITE_TITULO_FOTO_TT)
      return `O título do TikTok aceita até ${LIMITE_TITULO_FOTO_TT} caracteres.`;
    return null;
  }, [
    form.ativo, conectado, podePostar, compat.ok, compat.motivo, form.usarOutraMidia,
    urlsEfetivas.length, form.privacyLevel, duracaoLonga, maxDuracao, movSuspeito,
    brandPrivado, tipo, form.titulo.length, creatorInfo?.erro,
  ]);

  useEffect(() => {
    onErroValidacao(erro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erro]);

  const switchBloqueado = !conectado || !podePostar || (!compat.ok && !form.ativo);

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

  const comentarioTravado = creatorInfo?.comment_disabled === true;
  const duetTravado = creatorInfo?.duet_disabled === true;
  const stitchTravado = creatorInfo?.stitch_disabled === true;
  const TXT_TRAVADO = "Desativado nas configurações da conta do TikTok";

  return (
    <section className="space-y-4 rounded-lg border-2 border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Também no TikTok
          </p>
          {!compat.ok && (
            <p className="text-[11px] text-danger mt-1">{compat.motivo}</p>
          )}
          {!conectado && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Conta do TikTok não conectada — conecte em Configurações › Integrações.
            </p>
          )}
          {conectado && creatorInfo && creatorInfo.can_post === false && (
            <p className="text-[11px] text-danger mt-1">{creatorInfo.erro ?? "Esta conta não pode publicar agora."}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {carregandoCreator && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
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
          {/* 2.1 Cabeçalho obrigatório */}
          <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 p-2.5">
            {(creatorInfo?.creator_avatar_url ?? config?.creator_avatar_url) && (
              <img
                src={(creatorInfo?.creator_avatar_url ?? config?.creator_avatar_url) as string}
                alt=""
                className="h-8 w-8 rounded-full object-cover border"
              />
            )}
            <p className="text-sm">
              Vai publicar em:{" "}
              <strong>
                {creatorInfo?.creator_nickname ?? config?.creator_nickname ?? "—"}
              </strong>{" "}
              (@{creatorInfo?.creator_username ?? config?.creator_username ?? "—"})
            </p>
          </div>

          {/* 2.2 Mídia */}
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

          {/* 2.3 Texto */}
          {tipo === "VIDEO" ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Legenda do TikTok</Label>
                <span className="text-[10px] text-muted-foreground">
                  {form.titulo.length}/{LIMITE_LEGENDA_TT}
                </span>
              </div>
              <Textarea
                value={form.titulo}
                onChange={(e) => set({ titulo: e.target.value.slice(0, LIMITE_LEGENDA_TT) })}
                className="min-h-[90px]"
                placeholder="Legenda com as hashtags no próprio texto…"
              />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Título</Label>
                  <span className={`text-[10px] ${form.titulo.length > LIMITE_TITULO_FOTO_TT ? "text-danger font-semibold" : "text-muted-foreground"}`}>
                    {form.titulo.length}/{LIMITE_TITULO_FOTO_TT}
                  </span>
                </div>
                <Input
                  value={form.titulo}
                  onChange={(e) => set({ titulo: e.target.value.slice(0, LIMITE_TITULO_FOTO_TT) })}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Descrição</Label>
                  <span className="text-[10px] text-muted-foreground">
                    {form.descricao.length}/{LIMITE_DESCRICAO_TT}
                  </span>
                </div>
                <Textarea
                  value={form.descricao}
                  onChange={(e) => set({ descricao: e.target.value.slice(0, LIMITE_DESCRICAO_TT) })}
                  className="min-h-[80px]"
                />
              </div>
            </>
          )}

          {/* 2.4 Capa */}
          {tipo === "VIDEO" ? (
            videoSrc && (
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
                      Frame em {((form.capaOffsetMs ?? 0) / 1000).toFixed(1).replace(".", ",")}s. O TikTok
                      não aceita imagem de capa enviada, só frame do vídeo.
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : (
            urlsEfetivas.length > 1 && (
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
            )
          )}

          {/* 2.5 Quem pode ver */}
          <div className="space-y-1.5">
            <Label>Quem pode ver</Label>
            <Select value={form.privacyLevel} onValueChange={(v) => set({ privacyLevel: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha…" />
              </SelectTrigger>
              <SelectContent>
                {opcoesPrivacidade.map((op) => {
                  const bloqueada = !auditado && op !== "SELF_ONLY";
                  return (
                    <SelectItem key={op} value={op} disabled={bloqueada}>
                      {ROTULO_PRIVACIDADE[op] ?? op}
                      {bloqueada && (
                        <span className="text-[10px] text-muted-foreground ml-1.5">
                          (Disponível após a auditoria do app)
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {!form.privacyLevel && (
              <p className="text-[10px] text-muted-foreground">
                Obrigatório — o agendamento fica bloqueado até escolher.
              </p>
            )}
          </div>

          {/* 2.6 Interações */}
          <div className="space-y-2">
            <Label>Interações</Label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                {comentarioTravado ? (
                  <TravadaTooltip texto={TXT_TRAVADO}>
                    <Checkbox checked={false} disabled />
                  </TravadaTooltip>
                ) : (
                  <Checkbox
                    checked={form.permitirComentario}
                    onCheckedChange={(v) => set({ permitirComentario: !!v })}
                  />
                )}
                <span className={comentarioTravado ? "text-muted-foreground" : ""}>Permitir comentários</span>
              </label>

              {tipo === "VIDEO" && (
                <>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    {duetTravado ? (
                      <TravadaTooltip texto={TXT_TRAVADO}>
                        <Checkbox checked={false} disabled />
                      </TravadaTooltip>
                    ) : (
                      <Checkbox checked={form.permitirDuet} onCheckedChange={(v) => set({ permitirDuet: !!v })} />
                    )}
                    <span className={duetTravado ? "text-muted-foreground" : ""}>Permitir duet</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    {stitchTravado ? (
                      <TravadaTooltip texto={TXT_TRAVADO}>
                        <Checkbox checked={false} disabled />
                      </TravadaTooltip>
                    ) : (
                      <Checkbox checked={form.permitirStitch} onCheckedChange={(v) => set({ permitirStitch: !!v })} />
                    )}
                    <span className={stitchTravado ? "text-muted-foreground" : ""}>Permitir stitch</span>
                  </label>
                </>
              )}

              {tipo === "PHOTO" && (
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    id="tt-music"
                    checked={form.autoAddMusic}
                    onCheckedChange={(v) => set({ autoAddMusic: v })}
                  />
                  <Label htmlFor="tt-music" className="text-sm">Adicionar música automaticamente</Label>
                </div>
              )}
            </div>
          </div>

          {/* 2.7 Conteúdo comercial */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Switch
                id="tt-comercial"
                checked={form.comercial}
                onCheckedChange={(v) =>
                  set({ comercial: v, ...(v ? {} : { marcaPropria: false, conteudoPatrocinado: false }) })
                }
              />
              <Label htmlFor="tt-comercial" className="text-sm">Divulgar conteúdo comercial</Label>
            </div>
            {form.comercial && (
              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox
                    className="mt-0.5"
                    checked={form.marcaPropria}
                    onCheckedChange={(v) => set({ marcaPropria: !!v })}
                  />
                  <span>
                    Sua marca
                    <span className="block text-[11px] text-muted-foreground">
                      Seu vídeo/foto será rotulado como "Conteúdo promocional"
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox
                    className="mt-0.5"
                    checked={form.conteudoPatrocinado}
                    onCheckedChange={(v) => set({ conteudoPatrocinado: !!v })}
                  />
                  <span>
                    Conteúdo de marca / parceria paga
                    <span className="block text-[11px] text-muted-foreground">
                      Seu vídeo/foto será rotulado como "Parceria paga"
                    </span>
                  </span>
                </label>
                {brandPrivado && (
                  <p className="text-xs text-danger">Conteúdo de marca não pode ser privado</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Na nossa operação o normal é marcar "Sua marca", já que a UMC promove os próprios produtos.
                </p>
              </div>
            )}
          </div>

          {/* 2.9 IA */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={form.isAigc} onCheckedChange={(v) => set({ isAigc: !!v })} />
            Conteúdo gerado por IA
          </label>

          {/* 2.8 Consentimento */}
          <p className="text-[11px] text-muted-foreground border-t pt-3">
            {form.conteudoPatrocinado ? (
              <>
                Ao publicar, você concorda com a{" "}
                <a
                  href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Política de Conteúdo de Marca
                </a>{" "}
                e a{" "}
                <a
                  href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Confirmação de Uso de Música do TikTok
                </a>
                .
              </>
            ) : (
              <>
                Ao publicar, você concorda com a{" "}
                <a
                  href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Confirmação de Uso de Música do TikTok
                </a>
                .
              </>
            )}
          </p>

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
    descricao: tipo === "PHOTO" ? form.descricao || null : null,
    capa_offset_ms: tipo === "VIDEO" ? form.capaOffsetMs : null,
    capa_index: tipo === "PHOTO" ? form.capaIndex : null,
    privacy_level: form.privacyLevel,
    desabilitar_comentario: !form.permitirComentario,
    desabilitar_duet: tipo === "VIDEO" ? !form.permitirDuet : true,
    desabilitar_stitch: tipo === "VIDEO" ? !form.permitirStitch : true,
    marca_propria: form.comercial ? form.marcaPropria : false,
    conteudo_patrocinado: form.comercial ? form.conteudoPatrocinado : false,
    auto_add_music: tipo === "PHOTO" ? form.autoAddMusic : false,
    is_aigc: form.isAigc,
    agendado_para: extras.agendadoPara,
    status: extras.status,
    produto_ids: extras.produtoIds,
  };
}
