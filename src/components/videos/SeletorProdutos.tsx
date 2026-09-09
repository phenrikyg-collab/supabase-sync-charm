import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, X } from "lucide-react";
import {
  buscarProdutos,
  produtosPorIds,
  formatarMoeda,
  type ProdutoPai,
  type VideoProduto,
} from "@/lib/videosVitrine";

interface Props {
  valor: VideoProduto[];
  onChange: (v: VideoProduto[]) => void;
}

export function SeletorProdutos({ valor, onChange }: Props) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ProdutoPai[]>([]);
  const [info, setInfo] = useState<Record<string, ProdutoPai>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      if (!termo.trim()) return setResultados([]);
      buscarProdutos(termo).then(setResultados).catch(() => setResultados([]));
    }, 300);
    return () => clearTimeout(t);
  }, [termo]);

  useEffect(() => {
    produtosPorIds(valor.map((p) => String(p.tray_product_id)))
      .then((m) => setInfo((a) => ({ ...a, ...m })))
      .catch(() => {});
  }, [valor]);

  const adicionar = (p: ProdutoPai) => {
    const id = String(p.produto_id);
    if (valor.some((v) => String(v.tray_product_id) === id)) return;
    setInfo((a) => ({ ...a, [id]: p }));
    onChange([...valor, { tray_product_id: id, principal: valor.length === 0, ordem: valor.length }]);
    setTermo("");
    setResultados([]);
  };

  const remover = (id: string) =>
    onChange(valor.filter((v) => String(v.tray_product_id) !== id).map((v, i) => ({ ...v, ordem: i })));

  const marcarPrincipal = (id: string) =>
    onChange(valor.map((v) => ({ ...v, principal: String(v.tray_product_id) === id })));

  return (
    <div className="space-y-2">
      <Input
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar produto pelo nome..."
      />
      {resultados.length > 0 && (
        <div className="max-h-52 overflow-y-auto rounded-md border divide-y">
          {resultados.map((p) => (
            <button
              key={p.produto_id}
              type="button"
              onClick={() => adicionar(p)}
              className="flex w-full items-center gap-3 p-2 text-left hover:bg-muted"
            >
              {p.imagem && <img src={p.imagem} alt="" className="h-10 w-10 rounded object-cover" />}
              <span className="flex-1 text-sm">{p.nome}</span>
              <span className="text-xs text-muted-foreground">{formatarMoeda(p.preco_venda)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {valor.map((v) => {
          const id = String(v.tray_product_id);
          const p = info[id];
          return (
            <Badge key={id} variant="secondary" className="gap-1.5 py-1 pl-1 pr-1.5">
              {p?.imagem && <img src={p.imagem} alt="" className="h-6 w-6 rounded object-cover" />}
              <span className="max-w-[160px] truncate">{p?.nome ?? id}</span>
              <span className="text-[10px] text-muted-foreground">{formatarMoeda(p?.preco_venda)}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                title={v.principal ? "Produto principal" : "Marcar como principal"}
                onClick={() => marcarPrincipal(id)}
              >
                <Star className={`h-3 w-3 ${v.principal ? "fill-primary text-primary" : ""}`} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => remover(id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          );
        })}
        {valor.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum produto vinculado ainda.</p>
        )}
      </div>
    </div>
  );
}
