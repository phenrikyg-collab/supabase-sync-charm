import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AJUDA_VARIAVEIS, TEM_TRAVESSAO, enviarImagem } from "@/lib/popups";
import { cn } from "@/lib/utils";

export function Campo({ rotulo, dica, children }: { rotulo?: string; dica?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {rotulo && <Label className="text-xs">{rotulo}</Label>}
      {children}
      {dica && <p className="text-[11px] leading-snug text-muted-foreground">{dica}</p>}
    </div>
  );
}

export function CampoTexto({
  rotulo,
  valor,
  aoMudar,
  multilinha,
  dicaExtra,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  multilinha?: boolean;
  dicaExtra?: string;
}) {
  const ruim = TEM_TRAVESSAO.test(valor ?? "");
  const Comp: any = multilinha ? Textarea : Input;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{rotulo}</Label>
      <Comp
        value={valor ?? ""}
        onChange={(e: any) => aoMudar(e.target.value)}
        className={cn(ruim && "border-danger focus-visible:ring-danger")}
        rows={multilinha ? 3 : undefined}
      />
      {ruim && <p className="text-[11px] font-medium text-danger">Troque por vírgula ou dois-pontos.</p>}
      <p className="text-[11px] leading-snug text-muted-foreground">{dicaExtra ? `${dicaExtra} ` : ""}{AJUDA_VARIAVEIS}</p>
    </div>
  );
}

export function CampoCor({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{rotulo}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(valor ?? "") ? valor : "#000000"}
          onChange={(e) => aoMudar(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded border border-input bg-background"
        />
        <Input value={valor ?? ""} onChange={(e) => aoMudar(e.target.value)} placeholder="#000000" />
      </div>
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {PALETA_MARCA.map((c) => (
          <button
            key={c.cor}
            type="button"
            title={`${c.nome} ${c.cor}`}
            onClick={() => aoMudar(c.cor)}
            className={cn(
              "h-5 w-5 rounded-full border border-border transition hover:scale-110",
              (valor ?? "").toUpperCase() === c.cor && "ring-2 ring-primary ring-offset-1"
            )}
            style={{ background: c.cor }}
          />
        ))}
      </div>
    </div>
  );
}

export function CampoNumero({
  rotulo, valor, aoMudar, min, max, passo = 1, dica, comSlider = true,
}: {
  rotulo: string; valor: number; aoMudar: (v: number) => void;
  min: number; max: number; passo?: number; dica?: string; comSlider?: boolean;
}) {
  const v = Number.isFinite(Number(valor)) ? Number(valor) : min;
  return (
    <Campo rotulo={rotulo} dica={dica}>
      <div className="flex items-center gap-2">
        {comSlider && (
          <Slider value={[v]} min={min} max={max} step={passo} onValueChange={([n]) => aoMudar(n)} className="flex-1" />
        )}
        <Input
          type="number" min={min} max={max} step={passo} value={v}
          onChange={(e) => aoMudar(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
          className="w-24"
        />
      </div>
    </Campo>
  );
}

export function CampoImagem({
  rotulo, valor, aoMudar, popupId,
}: {
  rotulo: string; valor: string; aoMudar: (v: string) => void; popupId: number | string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function escolher(arquivo?: File | null) {
    if (!arquivo) return;
    setEnviando(true);
    try {
      const { url, pesada } = await enviarImagem(arquivo, popupId);
      aoMudar(url);
      if (pesada) toast.warning("Imagem pesada deixa o popup lento no celular.");
      else toast.success("Imagem enviada.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <Campo rotulo={rotulo} dica="webp, png, jpg, gif ou avif, até 3 MB.">
      <div className="space-y-2">
        {valor && <img src={valor} alt="" className="h-20 w-full rounded border border-border object-contain" />}
        <div className="flex gap-2">
          <Input value={valor ?? ""} onChange={(e) => aoMudar(e.target.value)} placeholder="URL da imagem" />
          <Button variant="outline" size="sm" disabled={enviando} onClick={() => ref.current?.click()}>
            {enviando ? "..." : "Enviar"}
          </Button>
        </div>
        <input
          ref={ref} type="file" className="hidden"
          accept="image/webp,image/png,image/jpeg,image/gif,image/avif"
          onChange={(e) => escolher(e.target.files?.[0])}
        />
      </div>
    </Campo>
  );
}
