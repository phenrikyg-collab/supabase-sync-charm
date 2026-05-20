import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Clipboard, ExternalLink, Copy, Sparkles, Loader2 } from "lucide-react";
import { CategoryFilter } from "./CategoryFilter";
import { CategoriaKey, categorizarProduto } from "@/lib/categorias";
import { usePrecoMinimo } from "@/hooks/usePrecoMinimo";
import { PrecoMinimoInfo } from "./PrecoMinimoInfo";
import { callClaude } from "@/lib/claudeApi";

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

const CONTEXTOS: { value: string; label: string }[] = [
  { value: "atendimento_whatsapp",  label: "💬 Atendimento WhatsApp — cliente perguntou sobre produto" },
  { value: "upsell",                label: "🔄 Upsell — cliente acabou de comprar, oferecer upgrade" },
  { value: "crossell",              label: "➕ Crossell — sugerir produto complementar à compra" },
  { value: "reativacao",            label: "💤 Reativação — cliente inativa há 60+ dias" },
  { value: "vip",                   label: "⭐ VIP — oferta exclusiva para cliente especial" },
  { value: "novidade",              label: "🆕 Novidade — apresentar produto novo para cliente" },
];

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
  const [categoria, setCategoria] = useState<CategoriaKey>("todos");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<VarianteRow[]>([]);
  const { map: precoMinMap } = usePrecoMinimo();

  // estado por produto para o gerador
  const [ctxPorProduto, setCtxPorProduto] = useState<Record<string, string>>({});
  const [textoPorProduto, setTextoPorProduto] = useState<Record<string, string>>({});
  const [loadingPorProduto, setLoadingPorProduto] = useState<Record<string, boolean>>({});

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

  const visiveis = useMemo(() => {
    return rows.filter((r) => {
      if (apenasCampanha && !r.em_campanha) return false;
      if (categoria !== "todos" && categorizarProduto(r.nome_produto) !== categoria) return false;
      return true;
    });
  }, [rows, apenasCampanha, categoria]);

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

  async function gerarTextoIA(p: VarianteRow) {
    const key = `${p.product_id}-${p.variant_id}`;
    const ctx = ctxPorProduto[key];
    if (!ctx) {
      toast.error("Selecione o contexto antes de gerar.");
      return;
    }
    const ctxLabel = CONTEXTOS.find((c) => c.value === ctx)?.label || ctx;
    setLoadingPorProduto((s) => ({ ...s, [key]: true }));
    try {
      const preco = p.preco_promocional && p.preco_promocional > 0 ? p.preco_promocional : p.preco;
      const prompt = `Você é uma consultora de moda sofisticada da Use Mariana Cardoso, marca premium para mulheres 30-45 anos.
Gere uma mensagem de WhatsApp natural, calorosa e sofisticada para o cenário abaixo.
Nunca mencione desconto. Use "investimento", "exclusivo", "especial para você".
Tom de amiga que entende de moda. Máximo 5 linhas. Emojis sutis.
Termine com pergunta ou CTA elegante.

Contexto: ${ctxLabel}
Produto: ${p.nome_produto}
Cor: ${p.cor || "—"}
Tamanho disponível: ${tamanho}
Preço: ${brl(preco)}
Estoque: ${p.estoque_variante ?? 0} unidades

Retorne APENAS o texto pronto para enviar, sem aspas e sem comentários.`;
      const result = await callClaude(prompt);
      setTextoPorProduto((s) => ({ ...s, [key]: result.trim() }));
    } catch (e: any) {
      toast.error("Erro ao gerar: " + (e.message || ""));
    } finally {
      setLoadingPorProduto((s) => ({ ...s, [key]: false }));
    }
  }

  async function copiarTextoIA(key: string) {
    const t = textoPorProduto[key];
    if (!t) return;
    await navigator.clipboard.writeText(t);
    toast.success("Texto copiado!");
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

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Categoria</p>
            <CategoryFilter value={categoria} onChange={setCategoria} />
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
          Nenhum produto disponível neste tamanho/categoria no momento
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiveis.map(p => {
            const key = `${p.product_id}-${p.variant_id}`;
            const temPromo = p.preco_promocional && p.preco_promocional > 0 && p.preco_promocional < (p.preco || Infinity);
            const pm = precoMinMap.get(String(p.product_id));
            const ctx = ctxPorProduto[key] || "";
            const txt = textoPorProduto[key] || "";
            const isLoadingTxt = !!loadingPorProduto[key];
            return (
              <Card key={key} className="relative">
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

                  <PrecoMinimoInfo row={pm} compact />

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

                  <div className="pt-3 border-t space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Gerar texto de oferta
                    </p>
                    <Select value={ctx} onValueChange={(v) => setCtxPorProduto((s) => ({ ...s, [key]: v }))}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Selecione o contexto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTEXTOS.map((c) => (
                          <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => gerarTextoIA(p)}
                      disabled={isLoadingTxt || !ctx}
                    >
                      {isLoadingTxt ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando texto...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" /> Gerar texto</>
                      )}
                    </Button>
                    {(txt || isLoadingTxt) && (
                      <>
                        <Textarea
                          value={txt}
                          onChange={(e) => setTextoPorProduto((s) => ({ ...s, [key]: e.target.value }))}
                          className="text-xs min-h-[120px]"
                          placeholder="Texto gerado aparecerá aqui..."
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => copiarTextoIA(key)}
                          disabled={!txt}
                        >
                          <Clipboard className="h-4 w-4 mr-2" /> 📋 Copiar
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
