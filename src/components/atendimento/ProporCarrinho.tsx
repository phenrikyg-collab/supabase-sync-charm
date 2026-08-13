import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, Loader2, Plus, ShoppingCart, Trash2, Truck } from "lucide-react";
import { BuscaProduto, ProdutoPagamento, moedaBR, precoProduto } from "@/components/atendimento/BuscaProduto";

const EXTERNAL_SUPABASE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co";
const PROPOR_CARRINHO_URL = `${EXTERNAL_SUPABASE_URL}/functions/v1/propor-carrinho`;
const CALCULAR_FRETE_URL = `${EXTERNAL_SUPABASE_URL}/functions/v1/calcular-frete`;

const chaveProposta = (conversaId: string | number) => `proposta-carrinho:${conversaId}`;

export function salvarPropostaDaConversa(conversaId: string | number, propostaId: string | number) {
  try {
    localStorage.setItem(chaveProposta(conversaId), String(propostaId));
  } catch {
    /* ignora */
  }
}

function lerPropostaDaConversa(conversaId: string | number) {
  try {
    return localStorage.getItem(chaveProposta(conversaId));
  } catch {
    return null;
  }
}

type OpcaoFrete = {
  id?: string | number;
  nome?: string;
  transportadora?: string;
  valor?: number;
  prazo_minimo_dias?: number;
  prazo_maximo_dias?: number;
  gratis?: boolean;
};

type ItemCarrinho = {
  produto_id?: string | number | null;
  variant_id?: string | number | null;
  cor?: string | null;
  tamanho?: string | null;
  nome?: string;
  imagem?: string | null;
  preco_catalogo?: number | null;
  descricao: string;
  valor_unitario: string;
  quantidade: number;
};

type RespostaProposta = {
  ok?: boolean;
  proposta_id?: string | number;
  subtotal?: number | string;
  desconto?: number | string;
  frete?: number | string;
  total_cartao?: number | string;
  total_pix?: number | string;
  erro?: string;
  error?: string;
};

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function paraNumero(valor: string) {
  const limpo = String(valor ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}

function itemCompleto(i: ItemCarrinho) {
  if (i.quantidade <= 0) return false;
  if (i.produto_id != null && String(i.produto_id).trim() !== "") return true;
  return i.descricao.trim().length > 0 && paraNumero(i.valor_unitario) > 0;
}

function FormularioProposta({
  conversaId,
  telefone,
  emailInicial,
  onEnviada,
}: {
  conversaId?: string | number;
  telefone?: string | null;
  emailInicial?: string | null;
  onEnviada?: (propostaId: string | number) => void;
}) {
  const [email, setEmail] = useState(emailInicial ?? "");
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [frete, setFrete] = useState("");
  const [desconto, setDesconto] = useState("");
  const [cep, setCep] = useState("");
  const [opcoesFrete, setOpcoesFrete] = useState<OpcaoFrete[]>([]);
  const [freteSelecionado, setFreteSelecionado] = useState<number | null>(null);
  const [calculandoFrete, setCalculandoFrete] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<RespostaProposta | null>(null);

  useEffect(() => {
    setEmail(emailInicial ?? "");
  }, [emailInicial]);

  const precoItem = (i: ItemCarrinho) =>
    i.produto_id ? i.preco_catalogo ?? 0 : paraNumero(i.valor_unitario);
  const subtotal = itens.reduce((acc, i) => acc + precoItem(i) * (i.quantidade || 0), 0);
  const total = Math.max(subtotal + paraNumero(frete) - paraNumero(desconto), 0);
  const itensIncompletos = itens.filter((i) => !itemCompleto(i));
  const emailValido = email.trim() === "" || /\S+@\S+\.\S+/.test(email.trim());
  const valido = itens.length > 0 && itensIncompletos.length === 0 && emailValido && !!telefone;

  const atualizarItem = (index: number, patch: Partial<ItemCarrinho>) =>
    setItens((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const adicionarProduto = (p: ProdutoPagamento) => {
    if (p?.produto_id == null || String(p.produto_id).trim() === "") {
      toast({
        title: "Produto sem identificador",
        description: "Não foi possível adicionar este produto.",
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
      if (!r.ok || json.ok === false) throw new Error(json.erro || json.error || `HTTP ${r.status}`);
      const opcoes: OpcaoFrete[] = json.opcoes ?? [];
      setOpcoesFrete(opcoes);
      if (opcoes.length === 0) toast({ title: "Nenhuma opção de entrega para este CEP" });
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      setErro(mensagem);
      toast({ title: "Erro ao calcular frete", description: mensagem, variant: "destructive" });
    } finally {
      setCalculandoFrete(false);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    setErro("");
    setResultado(null);
    try {
      if (itensIncompletos.length > 0) {
        throw new Error(
          "Há itens incompletos: cada item precisa de um produto do catálogo OU descrição e valor unitário.",
        );
      }
      const payload = {
        telefone,
        customer_email: email.trim() || undefined,
        conversa_id: conversaId,
        itens: itens.map((i) =>
          i.produto_id
            ? { produto_id: i.produto_id, quantidade: i.quantidade }
            : {
                descricao: i.descricao.trim(),
                valor_unitario: paraNumero(i.valor_unitario).toFixed(2),
                quantidade: i.quantidade,
              },
        ),
        valor_frete: paraNumero(frete).toFixed(2),
        desconto: paraNumero(desconto).toFixed(2),
      };
      const r = await fetch(PROPOR_CARRINHO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const texto = await r.text();
      let json: RespostaProposta = {};
      if (texto) {
        try {
          json = JSON.parse(texto) as RespostaProposta;
        } catch {
          throw new Error(`Resposta inválida (HTTP ${r.status}): ${texto}`);
        }
      }
      if (!r.ok || json.ok === false) throw new Error(json.erro || json.error || `HTTP ${r.status}`);
      setResultado(json);
      if (json.proposta_id != null) {
        if (conversaId != null) salvarPropostaDaConversa(conversaId, json.proposta_id);
        onEnviada?.(json.proposta_id);
      }
      toast({ title: "Proposta enviada no WhatsApp" });
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      setErro(mensagem);
      toast({ title: "Erro ao propor carrinho", description: mensagem, variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    return (
      <div className="space-y-3">
        <div className="space-y-2 rounded-md border border-success/30 bg-success/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" />
            Proposta enviada!
          </p>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{moeda(Number(resultado.subtotal ?? subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span>Frete</span>
              <span>{moeda(Number(resultado.frete ?? paraNumero(frete)))}</span>
            </div>
            <div className="flex justify-between">
              <span>Desconto</span>
              <span>-{moeda(Number(resultado.desconto ?? paraNumero(desconto)))}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-border pt-2 text-sm font-semibold text-foreground">
            <span>Total no cartão: {moeda(Number(resultado.total_cartao ?? total))}</span>
            <span className="text-success">
              Total no Pix: {moeda(Number(resultado.total_pix ?? total))}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            A cliente já recebeu as fotos dos produtos e o resumo completo no WhatsApp. Nenhuma ação a mais é
            necessária — o bot gera a cobrança automaticamente quando ela confirmar a forma de pagamento.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setResultado(null);
            setItens([]);
            setFrete("");
            setDesconto("");
            setOpcoesFrete([]);
            setFreteSelecionado(null);
          }}
        >
          Montar outra proposta
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!telefone && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          Esta conversa não tem telefone identificado — não é possível enviar a proposta.
        </p>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Buscar produto no catálogo</Label>
        <BuscaProduto onSelecionar={adicionarProduto} />
      </div>

      <div className="space-y-2">
        {itens.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            Nenhum item na proposta. Busque um produto acima ou adicione um item avulso.
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
          {itensIncompletos.length} item(ns) incompleto(s): escolha um produto do catálogo ou preencha
          descrição e valor unitário.
        </p>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={() => setItens((prev) => [...prev, { descricao: "", valor_unitario: "", quantidade: 1 }])}
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
            {calculandoFrete ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
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
            onClick={() => {
              setFreteSelecionado(i);
              setFrete(o.gratis ? "0" : String(o.valor ?? 0));
            }}
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="proposta-frete">Frete (R$)</Label>
          <Input
            id="proposta-frete"
            value={frete}
            onChange={(e) => setFrete(e.target.value)}
            placeholder="15.00"
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proposta-desconto">Desconto (R$)</Label>
          <Input
            id="proposta-desconto"
            value={desconto}
            onChange={(e) => setDesconto(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="proposta-email">E-mail da cliente (opcional)</Label>
        <Input
          id="proposta-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="cliente@email.com"
          type="email"
        />
        {!emailValido && <p className="text-xs text-destructive">E-mail inválido.</p>}
      </div>

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
        <div className="flex items-center justify-between border-t border-border pt-1 text-sm font-semibold text-foreground">
          <span>Total</span>
          <span>{moeda(total)}</span>
        </div>
      </div>

      <Button onClick={enviar} disabled={!valido || enviando} className="w-full">
        {enviando ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ShoppingCart className="mr-2 h-4 w-4" />
        )}
        Enviar proposta no WhatsApp
      </Button>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="break-words text-xs text-destructive">{erro}</p>
        </div>
      )}
    </div>
  );
}

export function ProporCarrinhoDialog({
  open,
  onOpenChange,
  conversaId,
  telefone,
  emailCliente,
  nomeCliente,
  onEnviada,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversaId?: string | number;
  telefone?: string | null;
  emailCliente?: string | null;
  nomeCliente?: string | null;
  onEnviada?: (propostaId: string | number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Propor carrinho</DialogTitle>
          <DialogDescription>
            {nomeCliente
              ? `Monta o resumo do carrinho e envia para ${nomeCliente} confirmar no WhatsApp.`
              : "Monta o resumo do carrinho e envia para a cliente confirmar no WhatsApp."}{" "}
            Nenhuma cobrança é criada agora.
          </DialogDescription>
        </DialogHeader>
        <FormularioProposta
          conversaId={conversaId}
          telefone={telefone}
          emailInicial={emailCliente}
          onEnviada={onEnviada}
        />
      </DialogContent>
    </Dialog>
  );
}

type Proposta = {
  id?: string | number;
  status?: string | null;
  total_cartao?: number | string | null;
  total_pix?: number | string | null;
  forma_pagamento?: string | null;
};

/** Card de acompanhamento da última proposta enviada nesta conversa. */
export function PropostaDaConversa({
  conversaId,
  propostaId,
}: {
  conversaId: string | number;
  propostaId?: string | number | null;
}) {
  const id = propostaId ?? lerPropostaDaConversa(conversaId);

  const { data: proposta } = useQuery({
    queryKey: ["proposta-carrinho", String(id ?? "")],
    enabled: !!id,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pagamentos_buscar_proposta" as any, { p_id: id });
      if (error) throw error;
      const item = Array.isArray(data) ? data[0] : data;
      return (item ?? null) as Proposta | null;
    },
  });

  if (!id || !proposta) return null;

  const status = String(proposta.status ?? "");
  const aguardando = status === "aguardando_confirmacao";
  const confirmado = status.startsWith("confirmado");
  const forma = String(proposta.forma_pagamento ?? "").toLowerCase();

  const rotulo = aguardando
    ? "Proposta enviada — aguardando confirmação"
    : confirmado
      ? forma.includes("pix")
        ? "Confirmado — Pix gerado"
        : "Confirmado — Link de pagamento gerado"
      : `Proposta: ${status || "sem status"}`;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs ${
        confirmado ? "bg-success/5 text-success" : "bg-muted/40 text-muted-foreground"
      }`}
    >
      <span className="flex items-center gap-2 font-medium">
        {confirmado ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
        {rotulo}
      </span>
      <span className="text-[11px]">
        Cartão {moeda(Number(proposta.total_cartao ?? 0))} · Pix {moeda(Number(proposta.total_pix ?? 0))}
      </span>
    </div>
  );
}
