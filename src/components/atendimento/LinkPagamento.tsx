import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Copy, Link2, Loader2, Plus, Trash2, Truck } from "lucide-react";
import { formatarValorParaAPI } from "@/components/atendimento/CobrancaPix";
import { BuscaProduto, ProdutoPagamento, moedaBR, precoProduto } from "@/components/atendimento/BuscaProduto";


const EXTERNAL_SUPABASE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co";
const CRIAR_LINK_URL = `${EXTERNAL_SUPABASE_URL}/functions/v1/criar-link-pagamento`;
const CALCULAR_FRETE_URL = `${EXTERNAL_SUPABASE_URL}/functions/v1/calcular-frete`;

export type ItemResolvido = {
  nome?: string;
  name?: string;
  titulo?: string;
  descricao?: string;
  description?: string;
  produto_id?: string | number;
  product_id?: string | number;
  quantidade?: number;
  quantity?: number;
  valor_unitario?: number | string;
  preco?: number | string;
  price?: number | string;
  total?: number | string;
};

type RespostaLink = {
  ok?: boolean;
  url?: string;
  link?: string;
  payment_url?: string;
  link_pagamento?: string;
  itens_resolvidos?: ItemResolvido[];
  erro?: string;
  error?: string;
};

type OpcaoFrete = {
  id?: string | number;
  nome?: string;
  transportadora?: string;
  valor?: number;
  prazo_minimo_dias?: number;
  prazo_maximo_dias?: number;
  gratis?: boolean;
};

/** Item enviado ao endpoint: catálogo (produto_id) ou avulso (descricao + valor) */
export type ItemPayload =
  | { produto_id: string | number; quantidade: number }
  | { descricao: string; valor_unitario: string; quantidade: number };

export type ItemCarrinho = {
  produto_id?: string | number | null;
  nome?: string;
  imagem?: string | null;
  preco_catalogo?: number | null;
  descricao: string;
  valor_unitario: string;
  quantidade: number;
};

export async function criarLinkPagamento(payload: {
  valor?: string;
  itens?: ItemPayload[];
  valor_frete?: string;
  desconto?: string;
  customer_email: string;
  descricao?: string;
  order_number?: string;
  conversa_id?: string | number;
}): Promise<{ url: string; itens_resolvidos: ItemResolvido[] }> {
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
  return { url, itens_resolvidos: resposta.itens_resolvidos ?? [] };
}


function paraNumero(valor: string) {
  try {
    const n = parseFloat(formatarValorParaAPI(valor || "0"));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const nomeResolvido = (it: ItemResolvido) =>
  it.nome || it.name || it.titulo || it.descricao || it.description || null;

const precoResolvido = (it: ItemResolvido) =>
  Number(it.valor_unitario ?? it.preco ?? it.price ?? 0);

/** Item de catálogo válido? */
function itemCompleto(i: ItemCarrinho) {
  if (i.quantidade <= 0) return false;
  if (i.produto_id != null && String(i.produto_id).trim() !== "") return true;
  return i.descricao.trim().length > 0 && paraNumero(i.valor_unitario) > 0;
}

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
  const [desconto, setDesconto] = useState("");
  const [cep, setCep] = useState("");
  const [opcoesFrete, setOpcoesFrete] = useState<OpcaoFrete[]>([]);
  const [freteSelecionado, setFreteSelecionado] = useState<number | null>(null);
  const [calculandoFrete, setCalculandoFrete] = useState(false);
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [gerando, setGerando] = useState(false);
  const [url, setUrl] = useState("");
  const [resolvidos, setResolvidos] = useState<ItemResolvido[]>([]);
  const [erro, setErro] = useState("");

  const emailValido = /\S+@\S+\.\S+/.test(email.trim());
  const precoItem = (i: ItemCarrinho) =>
    i.produto_id ? i.preco_catalogo ?? 0 : paraNumero(i.valor_unitario);
  const subtotal = itens.reduce((acc, i) => acc + precoItem(i) * (i.quantidade || 0), 0);
  const totalCarrinho = Math.max(subtotal + paraNumero(frete) - paraNumero(desconto), 0);
  const itensIncompletos = itens.filter((i) => !itemCompleto(i));
  const carrinhoValido = itens.length > 0 && itensIncompletos.length === 0;

  const valido =
    emailValido && (modo === "unico" ? valor.trim().length > 0 : carrinhoValido);

  const atualizarItem = (index: number, patch: Partial<ItemCarrinho>) =>
    setItens((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const adicionarProduto = (p: ProdutoPagamento) => {
    if (p?.produto_id == null || String(p.produto_id).trim() === "") {
      toast({
        title: "Produto sem identificador",
        description: "Não foi possível adicionar este produto ao carrinho.",
        variant: "destructive",
      });
      return;
    }
    const preco = precoProduto(p);
    setItens((prev) => {
      const existente = prev.findIndex((i) => String(i.produto_id) === String(p.produto_id));
      if (existente >= 0) {
        return prev.map((i, idx) => (idx === existente ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [
        ...prev,
        {
          produto_id: p.produto_id,
          nome: p.nome,
          imagem: p.imagem ?? null,
          preco_catalogo: preco,
          descricao: p.nome ?? "",
          valor_unitario: String(preco ?? 0),
          quantidade: 1,
        },
      ];
    });
  };

  const cepLimpo = cep.replace(/\D/g, "");
  const itensCatalogo = itens.filter((i) => i.produto_id);

  const calcularFrete = async () => {
    setCalculandoFrete(true);
    setErro("");
    setOpcoesFrete([]);
    setFreteSelecionado(null);
    try {
      const r = await fetch(CALCULAR_FRETE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep: cepLimpo,
          itens: itensCatalogo.map((i) => ({
            product_id: i.produto_id,
            price: precoItem(i),
            quantity: i.quantidade,
          })),
        }),
      });
      const texto = await r.text();
      const json = texto ? JSON.parse(texto) : {};
      if (!r.ok || json.ok === false) {
        throw new Error(json.erro || json.error || `HTTP ${r.status}`);
      }
      const opcoes: OpcaoFrete[] = json.opcoes ?? [];
      setOpcoesFrete(opcoes);
      if (opcoes.length === 0) {
        toast({ title: "Nenhuma opção de entrega para este CEP" });
      }
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      setErro(mensagem);
      toast({ title: "Erro ao calcular frete", description: mensagem, variant: "destructive" });
    } finally {
      setCalculandoFrete(false);
    }
  };

  const selecionarFrete = (i: number, o: OpcaoFrete) => {
    setFreteSelecionado(i);
    setFrete(o.gratis ? "0" : String(o.valor ?? 0));
  };

  const gerar = async () => {
    setGerando(true);
    setErro("");
    setUrl("");
    setResolvidos([]);
    try {
      if (modo === "carrinho" && !carrinhoValido) {
        throw new Error(
          "Há itens incompletos no carrinho. Cada item precisa ter um produto do catálogo OU descrição e valor unitário preenchidos.",
        );
      }
      const base = {
        customer_email: email.trim(),
        order_number: pedido.trim() || undefined,
        conversa_id: conversaId,
      };
      const resultado = await criarLinkPagamento(
        modo === "unico"
          ? { ...base, valor: formatarValorParaAPI(valor), descricao: descricao.trim() || undefined }
          : {
              ...base,
              itens: itens.map((i) =>
                i.produto_id
                  ? { produto_id: i.produto_id, quantidade: i.quantidade }
                  : {
                      descricao: i.descricao.trim(),
                      valor_unitario: formatarValorParaAPI(i.valor_unitario),
                      quantidade: i.quantidade,
                    },
              ),
              valor_frete: paraNumero(frete).toFixed(2),
              desconto: paraNumero(desconto).toFixed(2),
            },
      );
      setUrl(resultado.url);
      setResolvidos(resultado.itens_resolvidos);
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
          <div className="space-y-1.5">
            <Label className="text-xs">Buscar produto no catálogo</Label>
            <BuscaProduto onSelecionar={adicionarProduto} />
          </div>

          <div className="space-y-2">
            {itens.length === 0 && (
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                Nenhum item no carrinho. Busque um produto acima ou adicione um item avulso.
              </p>
            )}
            {itens.map((item, index) => (
              <div
                key={index}
                className={`rounded-md border p-2 ${
                  itemCompleto(item) ? "border-border" : "border-destructive/50 bg-destructive/5"
                }`}
              >
                {item.produto_id ? (
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                      {item.imagem ? (
                        <img src={item.imagem} alt={item.nome} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{item.nome}</p>
                      <p className="text-[11px] text-muted-foreground">
                        catálogo #{String(item.produto_id)} · {moedaBR(item.preco_catalogo)}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      className="w-16"
                      value={item.quantidade}
                      onChange={(e) =>
                        atualizarItem(index, { quantidade: Math.max(1, Number(e.target.value) || 1) })
                      }
                      aria-label="Quantidade"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setItens((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-[1fr_100px_70px_auto] items-end gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Descrição (avulso)</Label>
                      <Input
                        value={item.descricao}
                        onChange={(e) => atualizarItem(index, { descricao: e.target.value })}
                        placeholder="Taxa extra"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor un.</Label>
                      <Input
                        value={item.valor_unitario}
                        onChange={(e) => atualizarItem(index, { valor_unitario: e.target.value })}
                        placeholder="229.00"
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Qtd</Label>
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
                      onClick={() => setItens((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {itensIncompletos.length > 0 && (
            <p role="alert" className="text-xs text-destructive">
              {itensIncompletos.length} item(ns) incompleto(s): preencha descrição e valor unitário, escolha um
              produto do catálogo ou remova o item.
            </p>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setItens((prev) => [...prev, { descricao: "", valor_unitario: "", quantidade: 1 }])
            }
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Adicionar item sem catálogo
          </Button>

          <div className="space-y-2 rounded-md border border-border p-3">
            <Label className="text-xs">Frete por CEP</Label>
            <div className="flex gap-2">
              <Input
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="01310-100"
                inputMode="numeric"
              />
              <Button
                type="button"
                variant="outline"
                onClick={calcularFrete}
                disabled={calculandoFrete || cepLimpo.length !== 8 || itensCatalogo.length === 0}
              >
                {calculandoFrete ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="h-4 w-4" />
                )}
                <span className="ml-2">Calcular</span>
              </Button>
            </div>
            {itensCatalogo.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Adicione ao menos um produto do catálogo para calcular o frete.
              </p>
            )}
            {opcoesFrete.map((o, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selecionarFrete(i, o)}
                className={`flex w-full items-center justify-between gap-2 rounded-md border p-2 text-left ${
                  freteSelecionado === i ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{o.nome || o.transportadora}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {o.prazo_minimo_dias != null || o.prazo_maximo_dias != null
                      ? `${o.prazo_minimo_dias ?? "?"}–${o.prazo_maximo_dias ?? "?"} dias úteis`
                      : "prazo não informado"}
                  </p>
                </div>
                <span className="text-xs font-semibold text-foreground">
                  {o.gratis ? "Grátis" : moedaBR(o.valor)}
                </span>
              </button>
            ))}
          </div>

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
            <div className="space-y-1.5">
              <Label htmlFor="link-desconto">Desconto (R$)</Label>
              <Input
                id="link-desconto"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>
          </div>
          {camposComuns}

          <div className="space-y-1 rounded-md border border-border bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span>{moeda(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Frete</span>
              <span>{moeda(paraNumero(frete))}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Desconto</span>
              <span>-{moeda(paraNumero(desconto))}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1">
              <span className="text-xs text-muted-foreground">Total do carrinho</span>
              <span className="text-sm font-semibold text-foreground">{moeda(totalCarrinho)}</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Button onClick={gerar} disabled={gerando || !valido} className={compacto ? "w-full" : undefined}>
        {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
        Gerar link de pagamento
      </Button>
      {resolvidos.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-border bg-muted/40 p-3">
          <p className="text-xs font-semibold text-foreground">Itens usados no link (preços reais)</p>
          {resolvidos.map((it, i) => {
            const preco = precoResolvido(it);
            const qtd = Number(it.quantidade ?? it.quantity ?? 1);
            const id = it.produto_id ?? it.product_id;
            return (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">
                  {qtd}× {nomeResolvido(it) || (id != null ? `Produto #${id}` : "Item")}
                </span>
                <span className="font-medium text-foreground">
                  {moedaBR(Number(it.total ?? preco * qtd))}
                </span>
              </div>
            );
          })}
        </div>
      )}
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
          Link de checkout — item único ou carrinho com vários itens, frete e desconto. O status atualiza sozinho.
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
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
