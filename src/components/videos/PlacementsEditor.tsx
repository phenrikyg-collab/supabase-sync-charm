import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import {
  buscarProdutos,
  type Placement,
  type PlacementFormato,
  type PlacementTipo,
  type ProdutoPai,
} from "@/lib/videosVitrine";

const TIPOS: PlacementTipo[] = ["home", "produto", "categoria", "url", "global"];
const FORMATOS: PlacementFormato[] = ["carrossel", "bolha", "inline", "banner", "galeria"];

function BuscaProduto({ valor, onChange }: { valor: string | null; onChange: (v: string) => void }) {
  const [termo, setTermo] = useState("");
  const [res, setRes] = useState<ProdutoPai[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!termo.trim()) return setRes([]);
      buscarProdutos(termo).then(setRes).catch(() => setRes([]));
    }, 300);
    return () => clearTimeout(t);
  }, [termo]);

  return (
    <div className="relative">
      <Input
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder={valor ? `Produto ${valor}` : "Buscar produto..."}
      />
      {res.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {res.map((p) => (
            <button
              key={p.produto_id}
              type="button"
              className="block w-full p-2 text-left text-sm hover:bg-muted"
              onClick={() => { onChange(String(p.produto_id)); setTermo(""); setRes([]); }}
            >
              {p.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  valor: Placement[];
  onChange: (v: Placement[]) => void;
}

export function PlacementsEditor({ valor, onChange }: Props) {
  const atualizar = (i: number, patch: Partial<Placement>) =>
    onChange(valor.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const adicionar = () =>
    onChange([
      ...valor,
      { tipo: "home", alvo: null, formato: "carrossel", ordem: valor.length, inicio: null, fim: null, ativo: true },
    ]);

  return (
    <div className="space-y-3">
      {valor.map((p, i) => (
        <div key={i} className="grid gap-3 rounded-lg border p-3 md:grid-cols-12">
          <div className="md:col-span-2">
            <Label className="text-xs">Tipo</Label>
            <Select
              value={p.tipo}
              onValueChange={(v: PlacementTipo) =>
                atualizar(i, { tipo: v, alvo: v === "home" || v === "global" ? null : p.alvo })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {p.tipo !== "home" && p.tipo !== "global" && (
            <div className="md:col-span-3">
              <Label className="text-xs">Alvo</Label>
              {p.tipo === "produto" ? (
                <BuscaProduto valor={p.alvo} onChange={(v) => atualizar(i, { alvo: v })} />
              ) : (
                <Input
                  value={p.alvo ?? ""}
                  onChange={(e) => atualizar(i, { alvo: e.target.value })}
                  placeholder={p.tipo === "url" ? "/calcas" : "nome da categoria"}
                />
              )}
              {p.tipo === "url" && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  /calcas pega tudo dentro de calças
                </p>
              )}
            </div>
          )}

          <div className="md:col-span-2">
            <Label className="text-xs">Formato</Label>
            <Select value={p.formato} onValueChange={(v: PlacementFormato) => atualizar(i, { formato: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMATOS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {p.formato === "galeria" && (
            <p className="text-[11px] text-muted-foreground md:col-span-12">
              galeria entra como slide na galeria de fotos do produto
            </p>
          )}


          <div className="md:col-span-1">
            <Label className="text-xs">Ordem</Label>
            <Input
              type="number"
              value={p.ordem}
              onChange={(e) => atualizar(i, { ordem: Number(e.target.value) })}
            />
          </div>

          <div className="md:col-span-1">
            <Label className="text-xs">Início</Label>
            <Input
              type="date"
              value={p.inicio ?? ""}
              onChange={(e) => atualizar(i, { inicio: e.target.value || null })}
            />
          </div>

          <div className="md:col-span-1">
            <Label className="text-xs">Fim</Label>
            <Input
              type="date"
              value={p.fim ?? ""}
              onChange={(e) => atualizar(i, { fim: e.target.value || null })}
            />
          </div>

          <div className="flex items-end gap-2 md:col-span-2">
            <div className="flex items-center gap-2">
              <Switch checked={p.ativo} onCheckedChange={(v) => atualizar(i, { ativo: v })} />
              <span className="text-xs">Ativo</span>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onChange(valor.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={adicionar}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar onde aparece
      </Button>
    </div>
  );
}
