import { useState } from "react";
import { Clapperboard, ExternalLink, ImageOff } from "lucide-react";

/**
 * Mensagem tipo 'conteudo_compartilhado' = a cliente mandou um reels na conversa.
 * Nunca renderizar como "[anexo: ig_reel]" — sempre como card de post.
 *
 * Com ref_media_id: o reels é da marca → miniatura + legenda do próprio post,
 * card clicável para o permalink. Sem ref_media_id: conteúdo de outra conta →
 * mostra só o link, marcado como tal (sem inventar miniatura).
 */

export type PostReel = {
  media_id: string;
  permalink?: string | null;
  caption?: string | null;
  legenda?: string | null;
  thumb_cache_url?: string | null;
  thumbnail_url?: string | null;
  media_url?: string | null;
  /** Capa escolhida no agendamento — prioridade sobre o frame da Meta */
  capa_url?: string | null;
};

export type MensagemReel = {
  id: number;
  tipo?: string | null;
  conteudo?: string | null;
  ref_media_id?: string | null;
  imagem_url?: string | null;
};

export function ehReelCompartilhado(m: { tipo?: string | null }): boolean {
  return m.tipo === "conteudo_compartilhado";
}

/** Remove a marcação crua "[anexo: ig_reel]" — o card já comunica o anexo. */
export function textoSemAnexo(texto?: string | null): string {
  return (texto ?? "")
    .replace(/\[anexo:\s*ig_reel\]/gi, "")
    .trim();
}

/** Primeiro link do Instagram encontrado no texto da mensagem. */
export function extrairLinkInsta(texto?: string | null): string | null {
  if (!texto) return null;
  const m = texto.match(/https?:\/\/[^\s]*instagram\.com[^\s]*/i) ?? texto.match(/https?:\/\/[^\s]+/i);
  return m ? m[0] : null;
}

function resumoLegenda(caption?: string | null, palavras = 14): string | null {
  if (!caption) return null;
  const limpa = caption.replace(/\s+/g, " ").trim();
  if (!limpa) return null;
  const partes = limpa.split(" ");
  return partes.length > palavras ? partes.slice(0, palavras).join(" ") + "…" : limpa;
}

export function ReelCompartilhado({
  m,
  post,
  saida,
}: {
  m: MensagemReel;
  post?: PostReel | null;
  saida: boolean;
}) {
  const [imgErro, setImgErro] = useState(false);

  const daMarca = !!m.ref_media_id;
  const permalink = post?.permalink ?? null;
  const legenda = resumoLegenda(post?.caption ?? post?.legenda);
  const thumb = daMarca
    ? post?.capa_url || post?.thumb_cache_url || post?.thumbnail_url || post?.media_url || m.imagem_url
    : null; // reels de outra conta: sem miniatura — não inventar

  const corRotulo = saida ? "text-primary-foreground/80" : "text-muted-foreground";
  const corBorda = saida ? "border-primary-foreground/25" : "border-border";
  const corLink = saida ? "text-primary-foreground/90" : "text-primary";

  // ---------- Reels de outra conta: só o link, marcado como tal ----------
  if (!daMarca) {
    const link = extrairLinkInsta(m.conteudo);
    return (
      <div className={`mb-1.5 rounded-lg border ${corBorda} p-2 flex items-center gap-2.5`}>
        <div
          className={`shrink-0 rounded-md w-9 h-9 flex items-center justify-center ${
            saida ? "bg-primary-foreground/10" : "bg-background/60"
          }`}
        >
          <Clapperboard className={`h-4 w-4 ${corRotulo}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold leading-tight ${corRotulo}`}>
            Reels compartilhado · de outra conta
          </p>
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-[11px] font-medium hover:underline break-all ${corLink}`}
            >
              Abrir link do post <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <p className={`text-[10px] italic ${corRotulo}`}>Link não disponível nesta mensagem.</p>
          )}
        </div>
      </div>
    );
  }

  // ---------- Reels da marca: miniatura + legenda + card clicável ----------
  const miniatura =
    thumb && !imgErro ? (
      <img
        src={thumb}
        alt="Miniatura do reels"
        loading="lazy"
        onError={() => setImgErro(true)}
        className="w-full h-full object-cover"
      />
    ) : (
      <div className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground/50 w-full h-full">
        <ImageOff className="h-4 w-4" />
        <span className="text-[8px] leading-none">Sem prévia</span>
      </div>
    );

  return (
    <div className={`mb-1.5 rounded-lg border ${corBorda} overflow-hidden`}>
      <div className="flex gap-2.5 p-2">
        {permalink ? (
          <a
            href={permalink}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir reels no Instagram"
            className="shrink-0 rounded-md overflow-hidden w-16 h-28 bg-muted/50 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {miniatura}
          </a>
        ) : (
          <div className="shrink-0 rounded-md overflow-hidden w-16 h-28 bg-muted/50">{miniatura}</div>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <p className={`text-[11px] font-semibold leading-tight flex items-center gap-1 ${corRotulo}`}>
            <Clapperboard className="h-3 w-3 shrink-0" /> Compartilhou um reels da marca
          </p>
          {legenda && <p className={`text-[11px] leading-snug italic ${corRotulo}`}>“{legenda}”</p>}
          {permalink && (
            <a
              href={permalink}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-[11px] font-medium hover:underline ${corLink}`}
            >
              Ver post no Instagram <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
