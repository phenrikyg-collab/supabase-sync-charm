import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const REMOVER = "__remover__";

/** Saídas que o motor trata sozinho e que nunca são botão de template. */
const ESPECIAIS = [
  "sem resposta",
  "timeout",
  "nao respondeu",
  "não respondeu",
  "respondeu",
  "digitou",
  "respondeu com texto",
];

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export const saidaEspecial = (label: string) =>
  ESPECIAIS.some((e) => semAcento(e) === semAcento(label));

export const mesmoBotao = (a: string, b: string) => semAcento(a) === semAcento(b);

/**
 * Bloco de remapeamento: aparece quando o passo alimenta uma espera de clique
 * e as saídas atuais não batem mais com os botões do template escolhido.
 */
export function RemapearSaidas({
  saidas, botoes, onAplicar,
}: {
  saidas: string[];
  botoes: string[];
  onAplicar: (mapa: Record<string, string | null>) => void;
}) {
  const chave = JSON.stringify([saidas, botoes]);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});

  useEffect(() => {
    // Caso mais comum: uma saída sobrando e um botão novo. Já vem escolhido.
    setEscolhas(saidas.length === 1 && botoes.length === 1 ? { [saidas[0]]: botoes[0] } : {});
  }, [chave]);

  if (saidas.length === 0) return null;

  const completo = saidas.every((s) => !!escolhas[s]);

  return (
    <div className="space-y-3 rounded-lg border border-warning/50 bg-warning/5 p-3">
      <div className="space-y-1">
        <p className="text-xs font-medium text-warning">
          Este passo alimenta uma espera de clique. As saídas precisam acompanhar os botões novos.
        </p>
        <p className="text-[11px] text-muted-foreground">
          {botoes.length > 0
            ? `Botões do template escolhido: ${botoes.join(", ")}.`
            : "O template escolhido não tem botão de resposta rápida, então só dá para remover as saídas."}
        </p>
      </div>

      {saidas.map((s) => (
        <div key={s} className="space-y-1">
          <Label className="text-xs">Saída "{s}" passa a ser</Label>
          <Select value={escolhas[s] ?? ""} onValueChange={(v) => setEscolhas((e) => ({ ...e, [s]: v }))}>
            <SelectTrigger><SelectValue placeholder="Escolha o botão novo" /></SelectTrigger>
            <SelectContent>
              {botoes.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
              <SelectItem value={REMOVER}>Remover esta saída</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}

      <Button
        size="sm"
        className="w-full"
        disabled={!completo}
        onClick={() => {
          const mapa: Record<string, string | null> = {};
          for (const s of saidas) mapa[s] = escolhas[s] === REMOVER ? null : escolhas[s];
          onAplicar(mapa);
        }}
      >
        Aplicar nas saídas
      </Button>
    </div>
  );
}
