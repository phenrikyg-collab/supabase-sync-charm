import { Download, FileText, Loader2 } from "lucide-react";

type Props = {
  tipo?: string | null;
  mediaUrl?: string | null;
  conteudo?: string | null;
};

const nomeArquivo = (url: string) => {
  try {
    const caminho = new URL(url).pathname;
    return decodeURIComponent(caminho.split("/").pop() || "arquivo");
  } catch {
    return url.split("/").pop() || "arquivo";
  }
};

/** Texto que indica que a transcrição do áudio falhou (não é fala, é aviso do sistema). */
const SEM_TRANSCRICAO = "[Cliente enviou um audio]";

/** Renderiza o corpo de mídia de uma mensagem conforme o tipo. */
export function MensagemMidia({ tipo, mediaUrl, conteudo }: Props) {
  const t = (tipo ?? "").toLowerCase();

  if (!mediaUrl) {
    // A mídia ainda está sendo baixada da Meta — o realtime preenche quando chegar.
    return (
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        Mídia carregando…
      </div>
    );
  }

  if (t === "sticker") {
    return (
      <img
        src={mediaUrl}
        alt="Figurinha"
        className="mb-1 block h-auto max-h-40 max-w-full object-contain bg-transparent"
        loading="lazy"
      />
    );
  }

  if (["imagem", "image", "photo", "foto"].includes(t)) {
    const legenda = (conteudo ?? "").trim();
    return (
      <div className="mb-1 min-w-0 max-w-full space-y-1 overflow-hidden">
        <a href={mediaUrl} target="_blank" rel="noreferrer" className="block max-w-full overflow-hidden">
          <img
            src={mediaUrl}
            alt={legenda || "Imagem enviada"}
            className="block h-auto max-h-64 max-w-full rounded-md object-contain"
            loading="lazy"
          />
        </a>
        {legenda && legenda !== SEM_TRANSCRICAO && (
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-xs">{legenda}</p>
        )}
      </div>
    );
  }

  if (t === "video") {
    return (
      <div className="mb-1 min-w-0 max-w-full space-y-1 overflow-hidden">
        <video
          src={mediaUrl}
          controls
          playsInline
          preload="metadata"
          className="block h-auto max-h-[420px] max-w-full rounded-lg bg-foreground object-contain"
        />
        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          download
          className="inline-flex items-center gap-1 text-[11px] text-primary underline underline-offset-2"
        >
          <Download className="h-3 w-3" />
          baixar
        </a>
      </div>
    );
  }

  if (t === "audio") {
    const transcricao = (conteudo ?? "").trim();
    const semTranscricao = !transcricao || transcricao === SEM_TRANSCRICAO;
    return (
      <div className="mb-1 min-w-0 max-w-full space-y-1 overflow-hidden">
        <audio controls preload="metadata" src={mediaUrl} className="block w-full max-w-full" />
        {!semTranscricao && (
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Transcrição</p>
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-xs">{transcricao}</p>
          </div>
        )}
      </div>
    );
  }

  if (["documento", "document", "arquivo"].includes(t)) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer"
        download
        className="mb-1 flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 hover:bg-accent/60 transition-colors"
      >
        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {conteudo?.trim() || nomeArquivo(mediaUrl)}
        </span>
        <Download className="h-4 w-4 text-muted-foreground shrink-0" />
      </a>
    );
  }

  return null;
}

/** true quando o conteúdo textual deve ser escondido (é só o nome do arquivo). */
export function ehTipoMidia(tipo?: string | null) {
  return [
    "sticker", "imagem", "image", "photo", "foto",
    "video", "audio", "documento", "document", "arquivo",
  ].includes((tipo ?? "").toLowerCase());
}
