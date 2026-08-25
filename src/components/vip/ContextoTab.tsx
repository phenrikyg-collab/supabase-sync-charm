import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { brl, num } from "@/lib/financeiroFormat";
import { vipContexto } from "@/lib/vip";

const CARTOES: Array<{ chave: string; titulo: string; descricao: string }> = [
  { chave: "grupos", titulo: "Grupos e perfis", descricao: "Para quem a IA escreve e em qual tom." },
  { chave: "best_sellers", titulo: "Best-sellers com estoque", descricao: "Peças que vendem e ainda têm grade." },
  { chave: "promocoes", titulo: "Promoções vigentes", descricao: "Descontos ativos na Tray." },
  { chave: "estoque_baixo", titulo: "Estoque baixo", descricao: "Base honesta para escassez." },
  { chave: "pecas_liquidar", titulo: "Peças para liquidar", descricao: "Estoque parado por cor e tamanho." },
  { chave: "produtos_campanha", titulo: "Produtos em campanha", descricao: "O que a mídia já está empurrando." },
  { chave: "prova_social", titulo: "Prova social recente", descricao: "Depoimentos e prints disponíveis." },
  { chave: "acoes_comerciais", titulo: "Ações comerciais", descricao: "Sem ação cadastrada, a data vira relacionamento." },
  { chave: "datas_sazonais", titulo: "Datas sazonais", descricao: "Calendário do período." },
  { chave: "rfm", titulo: "RFM", descricao: "Quem é a base hoje." },
  { chave: "faq", titulo: "FAQ", descricao: "Objeções que a IA já sabe responder." },
];

function valorLegivel(v: any): string {
  if (v == null) return "—";
  if (typeof v === "number") return num(v);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(valorLegivel).join(" · ");
  const nome = v.nome ?? v.titulo ?? v.produto ?? v.descricao;
  const extras = [
    v.sku && `SKU ${v.sku}`,
    v.estoque != null && `estoque ${num(v.estoque)}`,
    v.tamanho && `${v.tamanho}`,
    v.cor && `${v.cor}`,
    v.preco != null && brl(v.preco),
    v.quantidade != null && `${num(v.quantidade)} un`,
  ].filter(Boolean);
  return [nome, extras.join(" · ")].filter(Boolean).join(" — ") || JSON.stringify(v);
}

export function ContextoTab() {
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    vipContexto()
      .then(setDados)
      .catch((e) => toast.error(e.message ?? "Falha ao carregar contexto"))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) return <Skeleton className="h-96" />;

  const chavesConhecidas = CARTOES.map((c) => c.chave);
  const extras = Object.keys(dados ?? {}).filter((k) => !chavesConhecidas.includes(k));

  const render = (chave: string, titulo: string, descricao?: string) => {
    const valor = dados?.[chave];
    const itens = Array.isArray(valor) ? valor : valor && typeof valor === "object" ? Object.entries(valor) : [];
    return (
      <Card key={chave}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{titulo}</CardTitle>
          {descricao && <p className="text-[11px] text-muted-foreground">{descricao}</p>}
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {itens.length === 0 && <p className="text-xs text-muted-foreground">Nada cadastrado no período.</p>}
          {Array.isArray(valor)
            ? valor.slice(0, 15).map((v: any, i: number) => (
                <div key={i} className="border-b border-dashed py-1 last:border-0">{valorLegivel(v)}</div>
              ))
            : (itens as any[]).slice(0, 15).map(([k, v]: any, i: number) => (
                <div key={i} className="flex justify-between gap-2 border-b border-dashed py-1 last:border-0">
                  <span className="capitalize text-muted-foreground">{String(k).replace(/_/g, " ")}</span>
                  <span className="text-right">{valorLegivel(v)}</span>
                </div>
              ))}
          {Array.isArray(valor) && valor.length > 15 && (
            <Badge variant="outline">+{valor.length - 15} itens</Badge>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        É exatamente isto que a IA enxerga ao montar o calendário. Se uma data importante aparecer sem ação comercial
        cadastrada, a IA trata a data como relacionamento e não como oferta.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CARTOES.map((c) => render(c.chave, c.titulo, c.descricao))}
        {extras.map((k) => render(k, k.replace(/_/g, " ")))}
      </div>
    </div>
  );
}
