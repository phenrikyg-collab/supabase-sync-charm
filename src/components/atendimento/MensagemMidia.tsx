import { Download, FileText } from "lucide-react";

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

/** Renderiza o corpo de mídia de uma mensagem conforme o tipo. */
export function MensagemMidia({ tipo, mediaUrl, conteudo }: Props) {
  const t = (tipo ?? "").toLowerCase();
  if (!mediaUrl) return null;

  if (t === "sticker") {
    return (
      <img
        src={mediaUrl}
        alt="Figurinha"
        className="mb-1 max-h-40 max-w-[160px] w-auto h-auto object-contain bg-transparent"
        loading="lazy"
      />
    );
  }

  if (["imagem", "image", "photo", "foto"].includes(t)) {
    return (
      <a href={mediaUrl} target="_blank" rel="noreferrer">
        <img
          src={mediaUrl}
          alt={conteudo || "Imagem enviada"}
          className="rounded-md max-h-64 w-auto object-contain mb-1"
          loading="lazy"
        />
      </a>
    );
  }

  if (t === "video") {
    return (
      <div className="mb-1 space-y-1">
        <video
          src={mediaUrl}
          controls
          playsInline
          preload="metadata"
          className="rounded-lg bg-black"
          style={{ maxWidth: 280, maxHeight: 420, width: "auto", height: "auto", objectFit: "contain" }}
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
    return <audio controls preload="metadata" src={mediaUrl} className="mb-1 w-full max-w-[280px]" />;
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
  return ["sticker", "video", "audio", "documento", "document", "arquivo"].includes(
    (tipo ?? "").toLowerCase(),
  );
}
