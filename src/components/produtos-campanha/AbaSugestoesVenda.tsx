import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Clipboard, ExternalLink, Copy } from "lucide-react";

interface VarianteRow {
  product_id: any;
  nome_produto: string;
  preco: number | null;
  preco_promocional: number | null;
  estoque_total: number | null;
  url_produto: string | null;
  total_vendas: number | null;
  variant_id: any;
  variant_reference: string | null;
  estoque_variante: number | null;
  tamanho_grupo: string;
  cor: string | null;
  em_campanha: boolean;
}

const TAMANHOS = ["PP", "P", "M", "G", "GG", "EG"];

function brl(v: number | null | undefined) {
  return v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function estoqueBadge(n: number | null) {
  const v = n ?? 0;
  const cls = v >= 10 ? "bg-green-100 text-green-800" :
              v >= 5 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";
  return <Badge variant="outline" className={cls}>{v} unid.</Badge>;
}

export function AbaSugestoesVenda() {
  const [tamanho, setTamanho] = useState("M");
  const [apenasCampanha, setApenasCampanha] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<VarianteRow[]>([]);

  async function carregar() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vw_produtos_por_tamanho" as any)
        .select("*")
        .eq("tamanho_grupo", tamanho)
        .order("em_campanha", { ascending: false })
        .order("total_vendas", { ascending: true })
        .limit(500);
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      toast.error("Erro ao carregar: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [tamanho]);

  const visiveis = useMemo(
    () => apenasCampanha ? rows.filter(r => r.em_campanha) : rows,
    [rows, apenasCampanha]
  );

  function copiarProduto(p: VarianteRow) {
    const preco = p.preco_promocional && p.preco_promocional > 0 ? p.preco_promocional : p.preco;
    const txt = `Olá! Temos disponível no tamanho ${tamanho}:

✨ ${p.nome_produto}
🎨 Cor: ${p.cor || "—"}
💰 Por apenas ${brl(preco)}
📦 Estoque: ${p.estoque_variante ?? 0} unidades
🔗 ${p.url_produto || ""}

Posso te ajudar a finalizar o pedido? 😊`;
    navigator.clipboard.writeText(txt);
    toast.success("Sugestão copiada!", { duration: 2000 });
  }

  function copiarLista() {
    const linhas = visiveis.map((p, i) => {
      const preco = p.preco_promocional && p.preco_promocional > 0 ? p.preco_promocional : p.preco;
      return `${i + 1}. ${p.nome_produto} - ${p.cor || "—"} - ${brl(preco)} - ${p.estoque_variante ?? 0} unidades`;
    }).join("\n");
    const txt = `Produtos disponíveis no tamanho ${tamanho}:

${linhas}

Qual desses te interessou? 😊`;
    navigator.clipboard.writeText(txt);
    toast.success("Lista copiada!", { duration: 2000 });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Selecione o tamanho</p>
            <div className="flex flex-wrap gap-2">
              {TAMANHOS.map(t => (
                <Button
                  key={t}
                  size="lg"
                  variant={tamanho === t ? "default" : "outline"}
                  onClick={() => setTamanho(t)}
                  className="min-w-[60px] text-lg font-medium"
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Badge variant="outline" className="text-sm">
              {visiveis.length} produtos disponíveis em {tamanho}
            </Badge>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id="campanha" checked={apenasCampanha} onCheckedChange={setApenasCampanha} />
                <Label htmlFor="campanha" className="cursor-pointer">Apenas em campanha</Label>
              </div>
              <Button variant="outline" size="sm" onClick={copiarLista} disabled={!visiveis.length}>
                <Clipboard className="h-4 w-4 mr-2" /> Copiar lista completa
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : !visiveis.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhum produto disponível neste tamanho no momento
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiveis.map(p => {
            const temPromo = p.preco_promocional && p.preco_promocional > 0 && p.preco_promocional < (p.preco || Infinity);
            return (
              <Card key={String(p.variant_id) + "-" + String(p.product_id)} className="relative">
                {p.em_campanha && (
                  <Badge className="absolute top-2 right-2 bg-orange-500 text-white border-0 z-10">
                    EM CAMPANHA
                  </Badge>
                )}
                <CardContent className="p-5 space-y-3">
                  <div>
                    <h3 className="font-medium text-foreground pr-20">{p.nome_produto}</h3>
                    <p className="text-sm text-muted-foreground mt-1">Cor: {p.cor || "—"}</p>
                    {p.variant_reference && (
                      <p className="text-xs text-muted-foreground font-mono">{p.variant_reference}</p>
                    )}
                  </div>

                  <div>
                    {temPromo ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-medium text-green-600">{brl(p.preco_promocional)}</span>
                        <span className="text-sm line-through text-muted-foreground">{brl(p.preco)}</span>
                      </div>
                    ) : (
                      <span className="text-xl font-medium">{brl(p.preco)}</span>
                    )}
                  </div>

                  {estoqueBadge(p.estoque_variante)}

                  {p.url_produto && (
                    <a href={p.url_produto} target="_blank" rel="noreferrer"
                       className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                      Ver no site <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  <Button className="w-full" variant="outline" onClick={() => copiarProduto(p)}>
                    <Copy className="h-4 w-4 mr-2" /> Copiar para WhatsApp
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
