import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2, Printer, Scissors } from "lucide-react";
import { toast } from "sonner";
import { useProdutos, useCores } from "@/hooks/useSupabase";
import {
  usePedidoItens,
  useCriarOcPedido,
  useAtualizarOcPedido,
  type ItemPedidoExpedicao,
} from "@/hooks/useBonificacaoExpedicao";

const TAMANHOS = ["PP", "P", "M", "G", "GG", "EG"];
const STATUS_OC = ["Planejada", "Em Produção", "Concluída", "Cancelada"];

const dataBr = (v: string | null | undefined) => {
  if (!v) return "-";
  const s = String(v).slice(0, 10);
  const p = s.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
};

interface LinhaItem {
  marcado: boolean;
  produto_id: string | null;
  cor_id: string | null;
  cor_texto: string | null;
  cor_hex: string | null;
  tamanho: string;
  quantidade: number;
  nome: string | null;
  referencia: string | null;
  disponibilidade: string | null;
  imagem: string | null;
}

function ComboProduto({
  valor,
  onChange,
}: {
  valor: string | null;
  onChange: (id: string) => void;
}) {
  const { data: produtos = [] } = useProdutos();
  const [aberto, setAberto] = useState(false);
  const ativos = useMemo(() => (produtos ?? []).filter((p: any) => p.ativo !== false), [produtos]);
  const atual = ativos.find((p: any) => p.id === valor);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{atual ? (atual as any).nome_do_produto : "Escolher produto"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar produto..." />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              {ativos.slice(0, 400).map((p: any) => (
                <CommandItem
                  key={p.id}
                  value={`${p.nome_do_produto ?? ""} ${p.codigo_sku ?? ""}`}
                  onSelect={() => {
                    onChange(p.id);
                    setAberto(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${p.id === valor ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate">{p.nome_do_produto}</span>
                  {p.codigo_sku && (
                    <span className="ml-auto text-xs text-muted-foreground">{p.codigo_sku}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function DialogOrdemCortePedido({
  pedido,
  aberto,
  onOpenChange,
}: {
  pedido: string | number | null;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: cores = [] } = useCores();
  const { data, isLoading } = usePedidoItens(aberto ? pedido : null);
  const criar = useCriarOcPedido();
  const atualizar = useAtualizarOcPedido();

  const [linhas, setLinhas] = useState<LinhaItem[]>([]);
  const [previsao, setPrevisao] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!data) return;
    setLinhas(
      (data.itens ?? []).map((i: ItemPedidoExpedicao) => ({
        marcado: true,
        produto_id: i.produto_id ?? null,
        cor_id: i.cor_id ?? null,
        cor_texto: i.cor_texto ?? null,
        cor_hex: i.cor_hex ?? null,
        tamanho: i.tamanho ?? "",
        quantidade: Number(i.quantidade ?? 1),
        nome: i.nome,
        referencia: i.referencia,
        disponibilidade: i.disponibilidade,
        imagem: i.imagem,
      })),
    );
  }, [data]);

  const hoje = new Date().toISOString().slice(0, 10);
  const mudar = (i: number, patch: Partial<LinhaItem>) =>
    setLinhas((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const gerar = async () => {
    const escolhidos = linhas.filter((l) => l.marcado);
    if (escolhidos.length === 0) {
      toast.error("Marque ao menos um item.");
      return;
    }
    if (!previsao) {
      toast.error("Informe a previsão de conclusão da produção.");
      return;
    }
    if (previsao < hoje) {
      toast.error("A previsão não pode ser uma data passada.");
      return;
    }
    try {
      const res = await criar.mutateAsync({
        pedido: pedido as string | number,
        previsao,
        itens: escolhidos.map((l) => ({
          produto_id: l.produto_id,
          cor_id: l.cor_id,
          tamanho: l.tamanho || null,
          quantidade: Number(l.quantidade ?? 1),
        })),
        observacao: observacao.trim() ? observacao.trim() : null,
      });
      toast.success(`${res?.numero_oc ?? "OC"} criada`);
      onOpenChange(false);
      if (res?.id) navigate(`/ordens-corte/${res.id}/imprimir`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar a ordem de corte.");
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Ordem de corte do pedido</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="py-16 text-center">
            <Loader2 className="w-6 h-6 animate-spin inline text-primary" />
          </div>
        )}

        {!isLoading && data && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Pedido #{data.pedido} · {data.cliente ?? "-"} · feito em {dataBr(data.data_pedido)} · prazo atual{" "}
              {dataBr(data.prazo_atual)}
            </p>

            {(data.ordens ?? []).length > 0 && (
              <Card className="p-4 space-y-3">
                <h4 className="font-serif text-base">OCs deste pedido</h4>
                {data.ordens.map((oc) => (
                  <OcExistente
                    key={oc.id}
                    oc={oc}
                    onImprimir={() => navigate(`/ordens-corte/${oc.id}/imprimir`)}
                    onSalvar={async (patch) => {
                      try {
                        await atualizar.mutateAsync({ oc: oc.id, ...patch });
                        toast.success("Ordem de corte atualizada.");
                      } catch (e: any) {
                        toast.error(e?.message ?? "Erro ao atualizar.");
                      }
                    }}
                  />
                ))}
              </Card>
            )}

            <div className="space-y-3">
              <h4 className="font-serif text-base">Itens para a nova ordem de corte</h4>
              {linhas.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum item encontrado neste pedido.</p>
              )}
              {linhas.map((l, i) => (
                <Card key={i} className="p-3">
                  <div className="flex gap-3">
                    <Checkbox
                      checked={l.marcado}
                      onCheckedChange={(v) => mudar(i, { marcado: Boolean(v) })}
                      className="mt-1"
                    />
                    {l.imagem ? (
                      <img src={l.imagem} alt={l.nome ?? ""} className="w-14 h-14 rounded object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded bg-muted" />
                    )}
                    <div className="flex-1 space-y-2 min-w-0">
                      <div>
                        <div className="font-medium truncate">
                          {l.nome ?? "-"}{" "}
                          {l.referencia && (
                            <span className="text-xs text-muted-foreground">({l.referencia})</span>
                          )}
                        </div>
                        {l.disponibilidade && (
                          <div className="text-xs text-muted-foreground">{l.disponibilidade}</div>
                        )}
                      </div>
                      {!l.cor_id && l.cor_texto && (
                        <div className="text-xs text-amber-700">
                          Cor da Tray: {l.cor_texto}. Escolha a cor do cadastro.
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="md:col-span-2">
                          <Label className="text-xs">Produto</Label>
                          <ComboProduto valor={l.produto_id} onChange={(id) => mudar(i, { produto_id: id })} />
                        </div>
                        <div>
                          <Label className="text-xs">Cor</Label>
                          <Select
                            value={l.cor_id ?? ""}
                            onValueChange={(v) => mudar(i, { cor_id: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Escolher cor" />
                            </SelectTrigger>
                            <SelectContent>
                              {(cores ?? []).map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>
                                  <span className="flex items-center gap-2">
                                    <span
                                      className="inline-block w-3 h-3 rounded-full border border-border"
                                      style={{ backgroundColor: c.cor_hex ?? "#ccc" }}
                                    />
                                    {c.nome_cor ?? "Sem nome"}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Tamanho</Label>
                            <Select value={l.tamanho} onValueChange={(v) => mudar(i, { tamanho: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                {TAMANHOS.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {t}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Qtd</Label>
                            <Input
                              type="number"
                              min={1}
                              value={l.quantidade}
                              onChange={(e) => mudar(i, { quantidade: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Previsão de conclusão da produção</Label>
                <Input type="date" min={hoje} value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
              </div>
              <div>
                <Label>Observação</Label>
                <Input
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: medidas sob medida"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              O prazo de envio deste pedido passa a ser a previsão + 2 dias úteis.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={gerar} disabled={criar.isPending || isLoading}>
            {criar.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Scissors className="w-4 h-4 mr-2" />
            )}
            Gerar ordem de corte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OcExistente({
  oc,
  onImprimir,
  onSalvar,
}: {
  oc: { id: string; numero_oc: string; status: string | null; previsao_pronto: string | null };
  onImprimir: () => void;
  onSalvar: (patch: { previsao?: string | null; status?: string | null }) => void;
}) {
  const [previsao, setPrevisao] = useState((oc.previsao_pronto ?? "").slice(0, 10));
  return (
    <div className="flex flex-wrap items-end gap-3 border-t pt-3 first:border-t-0 first:pt-0">
      <div>
        <div className="font-medium">{oc.numero_oc}</div>
        <div className="text-xs text-muted-foreground">
          {oc.status ?? "-"} · previsão {dataBr(oc.previsao_pronto)}
        </div>
      </div>
      <div>
        <Label className="text-xs">Alterar previsão</Label>
        <Input
          type="date"
          className="w-40"
          value={previsao}
          onChange={(e) => {
            setPrevisao(e.target.value);
            if (e.target.value) onSalvar({ previsao: e.target.value });
          }}
        />
      </div>
      <div>
        <Label className="text-xs">Status</Label>
        <Select value={oc.status ?? ""} onValueChange={(v) => onSalvar({ status: v })}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OC.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" size="sm" onClick={onImprimir}>
        <Printer className="w-4 h-4 mr-2" />
        Imprimir
      </Button>
      <Badge variant="outline" className="text-xs">
        Sob encomenda
      </Badge>
    </div>
  );
}
