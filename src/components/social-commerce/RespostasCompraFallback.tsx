import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ChevronDown, ChevronUp, Eye, Plus, X } from "lucide-react";
import { brl } from "@/lib/financeiroFormat";
import type { ProdutoPai } from "./SeletorProdutos";

/**
 * Marcadores aceitos na resposta completa (pergunta de preço).
 * Guardar SEMPRE com marcador, nunca com o valor cravado:
 * preço mudou na Tray, a resposta muda junto.
 */
export const MARCADORES_COMPRA = [
  { token: "{PRODUTO}", desc: "Nome da peça principal do post" },
  { token: "{PRECO}", desc: "Preço atual em R$" },
  { token: "{PARCELAS}", desc: "Número máximo de parcelas" },
  { token: "{PARCELA}", desc: "Valor da parcela" },
  { token: "{PIX}", desc: "Preço no Pix" },
  { token: "{PIX_PCT}", desc: "% de desconto no Pix" },
  { token: "{BIO}", desc: "Frase apontando o link da bio" },
  { token: "{CUPOM_FRASE}", desc: "Frase do cupom, quando houver" },
] as const;

/** Preview: resolve na tela o que dá (produto, preço, bio); os demais a Anna preenche no envio. */
function preencherPreview(texto: string, produto?: ProdutoPai | null): string {
  return texto
    .replaceAll("{PRODUTO}", produto?.nome?.trim() || "o produto do post")
    .replaceAll("{PRECO}", produto?.preco_venda != null ? brl(produto.preco_venda) : "o preço atual")
    .replaceAll("{BIO}", "o link está na bio");
}

/** Lista editável de variações (multi-linha, com marcadores). */
function ListaEditavel({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const atualizar = (i: number, t: string) => onChange(value.map((v, j) => (j === i ? t : v)));
  const remover = (i: number) => onChange(value.filter((_, j) => j !== i));
  return (
    <div className="space-y-1.5">
      {value.map((v, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <Textarea
            value={v}
            onChange={(e) => atualizar(i, e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="min-h-[44px] text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-danger"
            onClick={() => remover(i)}
            aria-label="Remover variação"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ""])} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Adicionar variação
        </Button>
      </div>
    </div>
  );
}

/**
 * 4.4 — Resposta completa (pergunta de preço).
 * Lista editável com os marcadores documentados ao lado e preview preenchido
 * com o produto principal do post. Vazio = a Anna usa as 4 padrão.
 * Campo: respostas_publicas_compra (text[]).
 */
export function BlocoRespostasCompra({
  value,
  onChange,
  produto,
  combo,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  /** Produto principal do post — alimenta o preview */
  produto?: ProdutoPai | null;
  /** Post com 2+ produtos: sem resposta completa, pergunta de preço fica pendente */
  combo?: boolean;
}) {
  const primeira = value.find((v) => v.trim());
  const preview = primeira ? preencherPreview(primeira, produto) : null;
  const restamMarcadores = preview ? /\{[A-Z_]+\}/.test(preview) : false;

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Resposta completa (pergunta de preço)</Label>
        <span className="text-[10px] text-muted-foreground">
          {value.length} {value.length === 1 ? "variação" : "variações"}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Vazio = a Anna usa as 4 padrão. Guarde com marcadores, nunca com o valor cravado:
        preço mudou na Tray, a resposta muda junto.
      </p>

      {combo && value.every((v) => !v.trim()) && (
        <p className="text-[11px] rounded border border-warning/30 bg-warning/10 p-2 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-px" />
          <span>Post de combo: pergunta de preço fica pendente sem esta resposta.</span>
        </p>
      )}

      {/* Marcadores documentados ao lado */}
      <div className="flex flex-wrap gap-1">
        {MARCADORES_COMPRA.map((m) => (
          <span
            key={m.token}
            title={m.desc}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground cursor-help"
          >
            {m.token}
          </span>
        ))}
      </div>

      <ListaEditavel
        value={value}
        onChange={onChange}
        placeholder='Ex.: "A {PRODUTO} está por {PRECO} — em até {PARCELAS}x de {PARCELA}. No Pix sai por {PIX} 💛 {BIO}."'
      />

      {/* Preview já preenchido com o produto do post */}
      {preview && (
        <div className="rounded border border-primary/20 bg-primary/5 p-2">
          <p className="text-[10px] font-semibold text-primary flex items-center gap-1">
            <Eye className="h-3 w-3" /> Preview com {produto?.nome ?? "o produto do post"}
          </p>
          <p className="text-xs mt-0.5 whitespace-pre-wrap">{preview}</p>
          {restamMarcadores && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Os marcadores restantes a Anna preenche na hora do envio.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Exemplo do estilo das 4 padrão (as oficiais ficam no backend, com a Anna). */
const EXEMPLOS_FALLBACK = [
  "Oiii! Amei que você gostou 💛",
  "Que bom que gostou! Me conta o que achou 💛",
  "Ficamos felizes demais com seu comentário 💛",
  "Obrigada pelo carinho! Estamos sempre por aqui 💛",
];

/**
 * 4.5 — Se a cliente não aceitar Direct.
 * Bloco recolhido, lista editável. Vazio mostra as padrão em cinza, como exemplo.
 * Campo: respostas_publicas_fallback (text[]).
 */
export function BlocoRespostasFallback({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 p-3 text-left"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        <span className="text-xs font-semibold">
          Se a cliente não aceitar Direct
          {value.length > 0 && (
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {value.length} {value.length === 1 ? "variação própria" : "variações próprias"}
            </span>
          )}
        </span>
        {aberto ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {aberto && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Usadas só quando a Meta recusa a mensagem privada. Não prometem Direct e não citam
            preço, cupom ou link.
          </p>

          {value.length === 0 && (
            <div className="rounded bg-muted/50 p-2 space-y-1">
              <p className="text-[10px] text-muted-foreground font-semibold">
                Vazio = a Anna usa as 4 padrão. Exemplo do estilo:
              </p>
              {EXEMPLOS_FALLBACK.map((e, i) => (
                <p key={i} className="text-[11px] text-muted-foreground italic">“{e}”</p>
              ))}
            </div>
          )}

          <ListaEditavel
            value={value}
            onChange={onChange}
            placeholder='Ex.: "Oiii! Amei que você gostou 💛"'
          />
        </div>
      )}
    </div>
  );
}
