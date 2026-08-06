import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Users, Loader2, Search } from "lucide-react";

type Lista = {
  id: number | string;
  nome: string;
  descricao?: string | null;
  criterio_tipo?: string | null;
  criterio_config?: any;
  total_membros?: number | null;
};

const SEGMENTOS_RFM = [
  "Campeões", "Clientes Fiéis", "Potenciais Fiéis", "Novos Clientes", "Promissores",
  "Precisam Atenção", "Em Risco", "Não Posso Perdê-los", "Hibernando", "Perdidos",
];

const LABEL_CRITERIO: Record<string, string> = {
  manual: "Manual",
  rfm: "Segmento RFM",
  segmento: "Segmento RFM",
  tag: "Tag",
  avancado: "Avançado",
};

type Tipo = "manual" | "rfm" | "tag" | "avancado";

function NovaListaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<Tipo>("manual");
  const [segmento, setSegmento] = useState("");
  const [tagId, setTagId] = useState("");

  // avançado
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [freqMin, setFreqMin] = useState("");
  const [freqMax, setFreqMax] = useState("");
  const [diasMin, setDiasMin] = useState("");
  const [diasMax, setDiasMax] = useState("");
  const [segAv, setSegAv] = useState("");
  const [tagAv, setTagAv] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [produtoNome, setProdutoNome] = useState("");
  const [carrinho, setCarrinho] = useState(false);
  const [carrinhoDias, setCarrinhoDias] = useState("7");
  const [preview, setPreview] = useState<number | null>(null);

  const { data: tags = [] } = useQuery({
    queryKey: ["whatsapp-tags"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_listar_tags" as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-busca", buscaProduto],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome_do_produto")
        .ilike("nome_do_produto", `%${buscaProduto}%`)
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && tipo === "avancado" && buscaProduto.length >= 2,
  });

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const montarCriterioAvancado = () => {
    const c: Record<string, any> = {};
    if (num(valorMin) !== undefined) c.valor_gasto_min = num(valorMin);
    if (num(valorMax) !== undefined) c.valor_gasto_max = num(valorMax);
    if (num(freqMin) !== undefined) c.frequencia_min = num(freqMin);
    if (num(freqMax) !== undefined) c.frequencia_max = num(freqMax);
    if (num(diasMin) !== undefined) c.dias_ultima_compra_min = num(diasMin);
    if (num(diasMax) !== undefined) c.dias_ultima_compra_max = num(diasMax);
    if (segAv) c.segmento_rfm = segAv;
    if (produtoId) c.produto_comprado_id = produtoId;
    if (carrinho) {
      c.tem_carrinho_abandonado = true;
      if (num(carrinhoDias) !== undefined) c.carrinho_abandonado_dias = num(carrinhoDias);
    }
    if (tagAv) c.tag_id = Number(tagAv);
    return c;
  };

  const previewMembros = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("listas_resolver_membros_avancado" as any, {
        p_criterio_config: montarCriterioAvancado(),
      });
      if (error) throw error;
      return Array.isArray(data) ? data.length : 0;
    },
    onSuccess: (total) => setPreview(total),
    onError: (e: any) => toast({ title: "Erro no preview", description: e.message, variant: "destructive" }),
  });

  const criar = useMutation({
    mutationFn: async () => {
      const criterio_config =
        tipo === "manual" ? {}
        : tipo === "rfm" ? { segmento }
        : tipo === "tag" ? { tag_id: Number(tagId) }
        : montarCriterioAvancado();
      const { error } = await supabase.rpc("listas_criar" as any, {
        p_nome: nome,
        p_descricao: descricao || null,
        p_criterio_tipo: tipo,
        p_criterio_config: criterio_config,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lista criada" });
      queryClient.invalidateQueries({ queryKey: ["wpp-listas"] });
      onOpenChange(false);
      setNome(""); setDescricao(""); setPreview(null);
    },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova lista</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <Label>Tipo de critério</Label>
            <Select value={tipo} onValueChange={(v) => { setTipo(v as Tipo); setPreview(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="rfm">Segmento RFM</SelectItem>
                <SelectItem value="tag">Tag</SelectItem>
                <SelectItem value="avancado">Avançado (múltiplas variáveis)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === "rfm" && (
            <div>
              <Label>Segmento</Label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {SEGMENTOS_RFM.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === "tag" && (
            <div>
              <Label>Tag</Label>
              <Select value={tagId} onValueChange={setTagId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {tags.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === "avancado" && (
            <div className="space-y-3 border-t pt-3">
              <p className="text-xs text-muted-foreground">
                Todos os campos são opcionais e se combinam com E lógico.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Valor gasto mín (R$)</Label><Input value={valorMin} onChange={(e) => setValorMin(e.target.value)} /></div>
                <div><Label className="text-xs">Valor gasto máx (R$)</Label><Input value={valorMax} onChange={(e) => setValorMax(e.target.value)} /></div>
                <div><Label className="text-xs">Frequência mín</Label><Input value={freqMin} onChange={(e) => setFreqMin(e.target.value)} /></div>
                <div><Label className="text-xs">Frequência máx</Label><Input value={freqMax} onChange={(e) => setFreqMax(e.target.value)} /></div>
                <div><Label className="text-xs">Dias desde última compra mín</Label><Input value={diasMin} onChange={(e) => setDiasMin(e.target.value)} /></div>
                <div><Label className="text-xs">Dias desde última compra máx</Label><Input value={diasMax} onChange={(e) => setDiasMax(e.target.value)} /></div>
              </div>
              <div>
                <Label className="text-xs">Segmento RFM</Label>
                <Select value={segAv} onValueChange={setSegAv}>
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    {SEGMENTOS_RFM.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Produto comprado</Label>
                {produtoId ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{produtoNome}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => { setProdutoId(null); setProdutoNome(""); }}>Remover</Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-8" value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} placeholder="Buscar produto" />
                    </div>
                    {produtos.length > 0 && (
                      <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                        {produtos.map((p: any) => (
                          <button
                            key={p.id}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                            onClick={() => { setProdutoId(String(p.id)); setProdutoNome(p.nome_do_produto); setBuscaProduto(""); }}
                          >
                            {p.nome_do_produto}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={carrinho} onCheckedChange={setCarrinho} />
                <span className="text-sm">Tem carrinho abandonado</span>
                {carrinho && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">nos últimos</span>
                    <Input className="w-16" value={carrinhoDias} onChange={(e) => setCarrinhoDias(e.target.value)} />
                    <span className="text-xs text-muted-foreground">dias</span>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs">Tag aplicada</Label>
                <Select value={tagAv} onValueChange={setTagAv}>
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    {tags.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => previewMembros.mutate()} disabled={previewMembros.isPending}>
                  {previewMembros.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Pré-visualizar membros
                </Button>
                {preview !== null && (
                  <span className="text-sm text-muted-foreground">{preview} cliente(s)</span>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => criar.mutate()} disabled={!nome || criar.isPending}>
            {criar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar lista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SegmentosTab() {
  const [nova, setNova] = useState(false);

  const { data: listas = [], isLoading } = useQuery({
    queryKey: ["wpp-listas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listas_listar" as any);
      if (error) throw error;
      return (data ?? []) as Lista[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNova(true)}><Plus className="h-4 w-4 mr-2" /> Nova lista</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : listas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhuma lista criada ainda.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {listas.map((l) => (
            <Card key={l.id} className="p-4 space-y-2">
              <p className="font-medium">{l.nome}</p>
              {l.descricao && <p className="text-xs text-muted-foreground">{l.descricao}</p>}
              <div className="flex items-center justify-between">
                <Badge variant="outline">{LABEL_CRITERIO[l.criterio_tipo ?? "manual"] ?? l.criterio_tipo}</Badge>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {l.total_membros ?? 0}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NovaListaDialog open={nova} onOpenChange={setNova} />
    </div>
  );
}
