import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** "agora", "5 min", "3 h", "2 d" ou DD/MM/AAAA */
export function tempoRelativo(iso?: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 0) return "agora";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `${dias} d`;
  return new Date(t).toLocaleDateString("pt-BR");
}

export function dataHoraBR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Janela de 24h do Direct: verde > 6h, âmbar < 6h, vermelho expirada. */
export function janelaInfo(expira?: string | null):
  | { label: string; classe: string; expirada: boolean }
  | null {
  if (!expira) return null;
  const alvo = new Date(expira).getTime();
  if (Number.isNaN(alvo)) return null;
  const ms = alvo - Date.now();
  if (ms <= 0) {
    return { label: "Janela expirada", classe: "bg-danger/10 text-danger border-danger/20", expirada: true };
  }
  const h = ms / 3600000;
  const label =
    h >= 1
      ? `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, "0")}`
      : `${Math.max(1, Math.ceil(ms / 60000))} min`;
  const classe =
    h > 6
      ? "bg-success/10 text-success border-success/20"
      : "bg-warning/10 text-warning border-warning/20";
  return { label, classe, expirada: false };
}

/** Campo de tags (Enter ou vírgula adiciona). */
export function CampoTags({
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [txt, setTxt] = useState("");
  const add = () => {
    if (disabled) return;
    const t = txt.trim();
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setTxt("");
  };
  return (
    <div
      className={`space-y-2 transition-opacity ${disabled ? "opacity-50 pointer-events-none select-none" : ""}`}
      aria-disabled={disabled}
    >
      <div className="flex gap-2">
        <Input
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          placeholder={placeholder ?? "Digite e pressione Enter"}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add} disabled={disabled}>
          Adicionar
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 pr-1">
              {t}
              <button
                type="button"
                className="ml-1 rounded-full hover:bg-foreground/10 p-0.5"
                onClick={() => onChange(value.filter((v) => v !== t))}
                aria-label={`Remover ${t}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
