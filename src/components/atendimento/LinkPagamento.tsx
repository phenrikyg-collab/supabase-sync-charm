import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Copy, Link2, Loader2 } from "lucide-react";
import { formatarValorParaAPI } from "@/components/atendimento/CobrancaPix";

const EXTERNAL_SUPABASE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co";
const CRIAR_LINK_URL = `${EXTERNAL_SUPABASE_URL}/functions/v1/criar-link-pagamento`;

type RespostaLink = {
  ok?: boolean;
  url?: string;
  link?: string;
  payment_url?: string;
  erro?: string;
  error?: string;
};

export async function criarLinkPagamento(payload: {
  valor: string;
  customer_email: string;
  descricao?: string;
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
  const url = resposta.url || resposta.link || resposta.payment_url;
  if (!url) throw new Error("O endpoint não retornou o link de pagamento.");
  return url;
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
  const [valor, setValor] = useState("");
  const [email, setEmail] = useState(emailInicial ?? "");
  const [descricao, setDescricao] = useState("");
  const [gerando, setGerando] = useState(false);
  const [url, setUrl] = useState("");
  const [erro, setErro] = useState("");

  const gerar = async () => {
    setGerando(true);
    setErro("");
    setUrl("");
    try {
      const link = await criarLinkPagamento({
        valor: formatarValorParaAPI(valor),
        customer_email: email.trim(),
        descricao: descricao.trim() || undefined,
        conversa_id: conversaId,
      });
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

  const valido = valor.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim());

  return (
    <div className="space-y-3">
      <div className={compacto ? "space-y-3" : "grid gap-3 sm:grid-cols-3"}>
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
          <Label htmlFor="link-descricao">Descrição (opcional)</Label>
          <Input
            id="link-descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Pedido 12345"
          />
        </div>
      </div>
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
          Link de checkout (Vindi) — a cliente pode pagar com cartão ou boleto. O status atualiza sozinho.
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
      <DialogContent className="sm:max-w-sm">
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
