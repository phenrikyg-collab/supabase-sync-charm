import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Copy, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { formatarValorParaAPI } from "@/components/atendimento/CobrancaPix";
import { BuscaProduto, ProdutoPagamento, moedaBR, precoProduto } from "@/components/atendimento/BuscaProduto";


const EXTERNAL_SUPABASE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co";
const CRIAR_LINK_URL = `${EXTERNAL_SUPABASE_URL}/functions/v1/criar-link-pagamento`;

type RespostaLink = {
  ok?: boolean;
  url?: string;
  link?: string;
  payment_url?: string;
  link_pagamento?: string;
  erro?: string;
  error?: string;
};

export type ItemCarrinho = {
  descricao: string;
  valor_unitario: string;
  quantidade: number;
};

export async function criarLinkPagamento(payload: {
  valor?: string;
  itens?: ItemCarrinho[];
  valor_frete?: string;
  customer_email: string;
  descricao?: string;
  order_number?: string;
  conversa_id?: string | number;
}): Promise<string> {
  let response: Response;
  try {
    response = await fetch(CRIAR_LINK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const detalhe = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new Error(`Falha de rede antes de receber resposta (${detalhe}). Endpoint: ${CRIAR_LINK_URL}`);
  }

  const texto = await response.text();
  let resposta: RespostaLink = {};
  if (texto) {
    try {
      resposta = JSON.parse(texto) as RespostaLink;
    } catch {
      throw new Error(`Resposta inválida do endpoint (HTTP ${response.status}): ${texto}`);
    }
  }
  if (!response.ok || resposta.ok === false) {
    throw new Error(resposta.erro || resposta.error || `HTTP ${response.status}: ${texto || "sem detalhes"}`);
  }
  const url = resposta.link_pagamento || resposta.url || resposta.link || resposta.payment_url;
  if (!url) throw new Error("O endpoint não retornou o link de pagamento.");
  return url;
}

function paraNumero(valor: string) {
  const n = parseFloat(formatarValorParaAPI(valor || "0"));
  return Number.isFinite(n) ? n : 0;
}

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ResultadoLink({ url }: { url: string }) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
      <p className="text-xs font-semibold text-foreground">Link de pagamento</p>
      <p className="break-all text-xs text-muted-foreground">{url}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            toast({ title: "Link copiado" });
          }}
        >
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copiar
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            Abrir
          </a>
        </Button>
      </div>
    </div>
  );
}

function FormularioLink({
  conversaId,
  emailInicial,
  compacto,
}: {
  conversaId?: string | number;
  emailInicial?: string | null;
  compacto?: boolean;
}) {
  const [modo, setModo] = useState<"unico" | "carrinho">("unico");
  const [valor, setValor] = useState("");
  const [email, setEmail] = useState(emailInicial ?? "");
  const [descricao, setDescricao] = useState("");
  const [pedido, setPedido] = useState("");
  const [frete, setFrete] = useState("");
  const [itens, setItens] = useState<ItemCarrinho[]>([
    { descricao: "", valor_unitario: "", quantidade: 1 },
  ]);
  const [gerando, setGerando] = useState(false);
  const [url, setUrl] = useState("");
  const [erro, setErro] = useState("");

  const emailValido = /\S+@\S+\.\S+/.test(email.trim());
  const totalCarrinho =
    itens.reduce((acc, i) => acc + paraNumero(i.valor_unitario) * (i.quantidade || 0), 0) +
    paraNumero(frete);
  const itensValidos = itens.filter(
    (i) => i.descricao.trim() && paraNumero(i.valor_unitario) > 0 && i.quantidade > 0,
  );

  const valido =
    emailValido &&
    (modo === "unico" ? valor.trim().length > 0 : itensValidos.length > 0);

  const atualizarItem = (index: number, patch: Partial<ItemCarrinho>) =>
    setItens((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const gerar = async () => {
    setGerando(true);
    setErro("");
    setUrl("");
    try {
      const base = {
        customer_email: email.trim(),
        order_number: pedido.trim() || undefined,
        conversa_id: conversaId,
      };
      const link = await criarLinkPagamento(
        modo === "unico"
          ? { ...base, valor: formatarValorParaAPI(valor), descricao: descricao.trim() || undefined }
          : {
              ...base,
              itens: itensValidos.map((i) => ({
                descricao: i.descricao.trim(),
                valor_unitario: formatarValorParaAPI(i.valor_unitario),
                quantidade: i.quantidade,
              })),
              valor_frete: formatarValorParaAPI(frete || "0"),
            },
      );
      setUrl(link);
      toast({ title: "Link de pagamento gerado" });
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      setErro(mensagem);
      toast({ title: "Erro ao gerar link", description: mensagem, variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  const camposComuns = (
    <div className={compacto ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
      <div className="space-y-1.5">
        <Label htmlFor="link-email">E-mail da cliente</Label>
        <Input
          id="link-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="cliente@email.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="link-pedido">Pedido (opcional)</Label>
        <Input
          id="link-pedido"
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          placeholder="55332"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <Tabs value={modo} onValueChange={(v) => setModo(v as "unico" | "carrinho")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="unico">Item único</TabsTrigger>
          <TabsTrigger value="carrinho">Carrinho (vários itens)</TabsTrigger>
        </TabsList>

        <TabsContent value="unico" className="mt-3 space-y-3">
          <div className={compacto ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
            <div className="space-y-1.5">
              <Label htmlFor="link-valor">Valor (R$)</Label>
              <Input
                id="link-valor"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="150.00"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-descricao">Descrição (opcional)</Label>
              <Input
                id="link-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Pedido 12345"
              />
            </div>
          </div>
          {camposComuns}
        </TabsContent>

        <TabsContent value="carrinho" className="mt-3 space-y-3">
          <div className="space-y-2">
            {itens.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_100px_70px_auto] items-end gap-2">
                <div className="space-y-1.5">
                  {index === 0 && <Label className="text-xs">Descrição</Label>}
                  <Input
                    value={item.descricao}
                    onChange={(e) => atualizarItem(index, { descricao: e.target.value })}
                    placeholder="Calça Modeladora Anna"
                  />
                </div>
                <div className="space-y-1.5">
                  {index === 0 && <Label className="text-xs">Valor un.</Label>}
                  <Input
                    value={item.valor_unitario}
                    onChange={(e) => atualizarItem(index, { valor_unitario: e.target.value })}
                    placeholder="229.00"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-1.5">
                  {index === 0 && <Label className="text-xs">Qtd</Label>}
                  <Input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) =>
                      atualizarItem(index, { quantidade: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={itens.length === 1}
                  onClick={() => setItens((prev) => prev.filter((_, i) => i !== index))}
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setItens((prev) => [...prev, { descricao: "", valor_unitario: "", quantidade: 1 }])
            }
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Adicionar item
          </Button>

          <div className={compacto ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
            <div className="space-y-1.5">
              <Label htmlFor="link-frete">Frete (R$)</Label>
              <Input
                id="link-frete"
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                placeholder="15.00"
                inputMode="decimal"
              />
            </div>
          </div>
          {camposComuns}

          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">Total do carrinho</span>
            <span className="text-sm font-semibold text-foreground">{moeda(totalCarrinho)}</span>
          </div>
        </TabsContent>
      </Tabs>

      <Button onClick={gerar} disabled={gerando || !valido} className={compacto ? "w-full" : undefined}>
        {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
        Gerar link de pagamento
      </Button>
      {url && <ResultadoLink url={url} />}
      {erro && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="break-words text-xs text-destructive">{erro}</p>
        </div>
      )}
    </div>
  );
}

/** Card com formulário para a aba Cobranças */
export function LinkPagamentoCard() {
  return (
    <Card className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Gerar link de pagamento</h3>
        <p className="text-xs text-muted-foreground">
          Link de checkout — item único ou carrinho com vários itens e frete. O status atualiza sozinho.
        </p>
      </div>
      <FormularioLink />
    </Card>
  );
}

/** Dialog usado dentro da conversa individual */
export function LinkPagamentoDialog({
  open,
  onOpenChange,
  conversaId,
  emailCliente,
  nomeCliente,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversaId: string | number;
  emailCliente?: string | null;
  nomeCliente?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar link de pagamento</DialogTitle>
          <DialogDescription>
            {nomeCliente ? `Link para ${nomeCliente}.` : "Link de pagamento para a cliente desta conversa."}
          </DialogDescription>
        </DialogHeader>
        <FormularioLink conversaId={conversaId} emailInicial={emailCliente} compacto />
      </DialogContent>
    </Dialog>
  );
}
