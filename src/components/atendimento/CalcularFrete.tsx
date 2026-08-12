import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Trash2, Truck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { BuscaProduto, ProdutoPagamento, moedaBR, precoProduto } from "@/components/atendimento/BuscaProduto";

const CALCULAR_FRETE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/calcular-frete";

type OpcaoFrete = {
  nome?: string;
  transportadora?: string;
  valor?: number;
  prazo_minimo_dias?: number;
  prazo_maximo_dias?: number;
  gratis?: boolean;
  id?: string | number;
};

type RespostaFrete = {
  ok?: boolean;
  disponivel?: boolean;
  opcoes?: OpcaoFrete[];
  mais_barata?: OpcaoFrete | string | number | null;
  mais_rapida?: OpcaoFrete | string | number | null;
  erro?: string;
  error?: string;
};

type ItemFrete = ProdutoPagamento & { quantidade: number };

const chave = (o: OpcaoFrete) => `${o.id ?? ""}|${o.nome ?? o.transportadora ?? ""}|${o.valor ?? ""}`;

function ehMesmaOpcao(o: OpcaoFrete, ref: OpcaoFrete | string | number | null | undefined) {
  if (ref == null) return false;
  if (typeof ref === "object") return chave(o) === chave(ref);
  return String(ref) === String(o.id ?? "") || String(ref) === String(o.nome ?? o.transportadora ?? "");
}

function FormularioFrete() {
  const [cep, setCep] = useState("");
  const [itens, setItens] = useState<ItemFrete[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [resposta, setResposta] = useState<RespostaFrete | null>(null);
  const [erro, setErro] = useState("");

  const cepLimpo = cep.replace(/\D/g, "");
  const valido = cepLimpo.length === 8 && itens.length > 0;

  const calcular = async () => {
    setCarregando(true);
    setErro("");
    setResposta(null);
    try {
      const r = await fetch(CALCULAR_FRETE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep: cepLimpo,
          itens: itens.map((item) => ({
            product_id: item.produto_id,
            price: precoProduto(item),
            quantity: item.quantidade,
          })),
        }),
      });
      const texto = await r.text();
      let json: RespostaFrete = {};
      if (texto) {
        try {
          json = JSON.parse(texto) as RespostaFrete;
        } catch {
          throw new Error(`Resposta inválida (HTTP ${r.status}): ${texto}`);
        }
      }
      if (!r.ok || json.ok === false) {
        throw new Error(json.erro || json.error || `HTTP ${r.status}`);
      }
      setResposta(json);
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      setErro(mensagem);
      toast({ title: "Erro ao calcular frete", description: mensagem, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  };

  const opcoes = resposta?.opcoes ?? [];

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="frete-cep">CEP de entrega</Label>
        <Input
          id="frete-cep"
          value={cep}
          onChange={(e) => setCep(e.target.value)}
          placeholder="01310-100"
          inputMode="numeric"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Produtos</Label>
        <BuscaProduto
          onSelecionar={(p) => setItens((prev) => [...prev, { ...p, quantidade: 1 }])}
        />
      </div>

      <div className="space-y-2">
        {itens.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            Adicione ao menos um produto para calcular o frete.
          </p>
        )}
        {itens.map((item, index) => (
          <div key={index} className="flex items-center gap-2 rounded-md border border-border p-2">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
              {item.imagem ? (
                <img src={item.imagem} alt={item.nome} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{item.nome}</p>
              <p className="text-[11px] text-muted-foreground">{moedaBR(precoProduto(item))}</p>
            </div>
            <Input
              type="number"
              min={1}
              className="w-16"
              value={item.quantidade}
              onChange={(e) =>
                setItens((prev) =>
                  prev.map((it, i) =>
                    i === index ? { ...it, quantidade: Math.max(1, Number(e.target.value) || 1) } : it,
                  ),
                )
              }
              aria-label="Quantidade"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setItens((prev) => prev.filter((_, i) => i !== index))}
              aria-label="Remover produto"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button onClick={calcular} disabled={!valido || carregando} className="w-full">
        {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
        Calcular frete
      </Button>

      {resposta && resposta.disponivel === false && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Nenhuma opção de entrega disponível para este CEP.
        </p>
      )}

      {opcoes.length > 0 && (
        <div className="space-y-2">
          {opcoes.map((o, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded-md border border-border p-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-xs font-medium">{o.nome || o.transportadora}</p>
                  {ehMesmaOpcao(o, resposta?.mais_barata) && (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                      mais barata
                    </span>
                  )}
                  {ehMesmaOpcao(o, resposta?.mais_rapida) && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      mais rápida
                    </span>
                  )}
                  {o.gratis && (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                      grátis
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {o.prazo_minimo_dias != null || o.prazo_maximo_dias != null
                    ? `${o.prazo_minimo_dias ?? "?"}–${o.prazo_maximo_dias ?? "?"} dias úteis`
                    : "prazo não informado"}
                </p>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {o.gratis ? "Grátis" : moedaBR(o.valor)}
              </span>
            </div>
          ))}
        </div>
      )}

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="break-words text-xs text-destructive">{erro}</p>
        </div>
      )}
    </div>
  );
}

export function CalcularFreteDialog({
  open,
  onOpenChange,
  nomeCliente,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nomeCliente?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Calcular frete</DialogTitle>
          <DialogDescription>
            {nomeCliente ? `Simulação de entrega para ${nomeCliente}.` : "Simulação de entrega por CEP."}
          </DialogDescription>
        </DialogHeader>
        <FormularioFrete />
      </DialogContent>
    </Dialog>
  );
}
