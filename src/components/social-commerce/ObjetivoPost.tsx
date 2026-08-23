import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { HandCoins, MessagesSquare } from "lucide-react";

export type ObjetivoPost = "venda" | "conversa";

const OPCOES = [
  {
    valor: "venda" as ObjetivoPost,
    titulo: "Venda",
    descricao: "Comentário vira lead — a Anna chama no Direct.",
    icone: HandCoins,
  },
  {
    valor: "conversa" as ObjetivoPost,
    titulo: "Conversa",
    descricao:
      "Dica, bastidor, relacionamento. A Anna responde no comentário, sem Direct. Quem pedir preço continua sendo atendido normalmente.",
    icone: MessagesSquare,
  },
];

/**
 * "Objetivo deste post" — primeiro campo da automação, antes de tudo.
 * Venda: comentário vira lead, a Anna chama no Direct (usa card/cupom/link de combo).
 * Conversa: a Anna responde só no comentário; Direct, card e cupom ficam escondidos
 * para não convidar a configurar algo que nunca vai rodar.
 */
export function SeletorObjetivoPost({
  value,
  onChange,
}: {
  value: ObjetivoPost;
  onChange: (v: ObjetivoPost) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Objetivo deste post</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as ObjetivoPost)}
        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
      >
        {OPCOES.map((o) => (
          <label
            key={o.valor}
            className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${
              value === o.valor ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"
            }`}
          >
            <RadioGroupItem value={o.valor} className="mt-0.5" />
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <o.icone className="h-3.5 w-3.5" /> {o.titulo}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{o.descricao}</p>
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

/**
 * Registros antigos sem objetivo salvo: quem já tem Direct/cupom/combo configurado
 * nasceu como venda; o resto nasce conversa (mais fácil corrigir para venda do que
 * descobrir depois que 20 pessoas levaram abordagem comercial).
 */
export function objetivoInferido(
  objetivo: string | null | undefined,
  sinaisVenda: boolean,
): ObjetivoPost {
  if (objetivo === "venda" || objetivo === "conversa") return objetivo;
  return sinaisVenda ? "venda" : "conversa";
}
