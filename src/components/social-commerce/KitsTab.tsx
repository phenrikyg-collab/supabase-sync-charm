import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/socialCommerce";
import { brl } from "@/lib/financeiroFormat";
import { toast } from "sonner";
import {
  Kit, ItemKit, DM_PADRAO, carregarKits, coresDisponiveis, dataCurtaDDMM,
  normalizarGatilho, pecasComProblema, precoProdutoPai, problemasTexto, totalKit,
} from "@/lib/kitsLive";
import { carregarProdutosPai, normalizarBusca, type ProdutoPai } from "./SeletorProdutos";
import { CampoTags } from "./comum";
import { uploadMidia } from "./midiaUpload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, GripVertical, ImageOff, Loader2, Package, Plus, Search, Trash2, X,
} from "lucide-react";

/* ------------------------------ busca de peça ----------------------------- */

function BuscaPeca({
  produtos,
  valor,
  onSelecionar,
}: {
  produtos: ProdutoPai[];
  valor?: ProdutoPai | null;
  onSelecionar: (p: ProdutoPai) => void;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);

  const filtrados = useMemo(() => {
    const q = normalizarBusca(busca);
    if (!q) return produtos.slice(0, 40);
    return produtos
      .filter(
        (p) =>
          (p.chave_busca ?? "").includes(q) ||
          normalizarBusca(p.nome ?? "").includes(q) ||
          normalizarBusca(p.codigo_sku ?? "").includes(q),
      )
      .slice(0, 40);
  }, [produtos, busca]);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm hover:bg-accent/40"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className={`flex-1 truncate ${valor ? "" : "text-muted-foreground"}`}>
            {valor?.nome ?? "Buscar peça no catálogo…"}
          </span>
          {valor && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {brl(precoProdutoPai(valor))} · est. {valor.estoque ?? 0}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[380px] p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou código…"
          className="h-8 text-sm"
        />
        <ScrollArea className="mt-2 h-64">
          {filtrados.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">Nenhuma peça encontrada.</p>
          ) : (
            filtrados.map((p) => (
              <button
                key={p.produto_id}
                type="button"
                onClick={() => {
                  onSelecionar(p);
                  setAberto(false);
                  setBusca("");
                }}
                className="flex w-full items-center gap-2 rounded p-1.5 text-left hover:bg-accent/40"
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-muted">
                  {(p as any).imagem ? (
                    <img src={(p as any).imagem} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <ImageOff className="m-2.5 h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{p.nome}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {brl(precoProdutoPai(p))} · estoque {p.estoque ?? 0}
                  </span>
                </span>
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------ testar carrinho --------------------------- */

function TestarCarrinho({
  kit,
  mapa,
  aberto,
  onOpenChange,
}: {
  kit: Kit;
  mapa: Map<string, ProdutoPai>;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [tamanhos, setTamanhos] = useState<Record<number, string>>({});
  const [verificando, setVerificando] = useState(false);
  const [linhas, setLinhas] = useState<
    {
      nome: string;
      ok: boolean;
      motivo?: string;
      estoque?: number | null;
      variant_id?: string | null;
      cores?: string[];
      tamanhos?: string[];
    }[] | null
  >(null);

  const testar = async () => {
    setVerificando(true);
    setLinhas(null);
    try {
      const saida = await Promise.all(
        kit.itens.map(async (i, idx) => {
          const nome = mapa.get(String(i.produto_id))?.nome ?? `Produto ${i.produto_id}`;
          const { data, error } = await db.rpc("whatsapp_tool_verificar_variante", {
            p_produto_id: String(i.produto_id),
            p_cor: i.cor ?? null,
            p_tamanho: tamanhos[idx] || null,
          });
          if (error) return { nome, ok: false, motivo: error.message };
          const r: any = Array.isArray(data) ? data[0] : data;
          const cores = (r?.cores_disponiveis ?? []).map((c: any) => (typeof c === "string" ? c : c?.cor));
          const tams = (r?.tamanhos_disponiveis ?? []).map((t: any) => (typeof t === "string" ? t : t?.tamanho));
          const disponivel = r?.disponivel_na_combinacao_pedida === true;
          return {
            nome,
            ok: disponivel,
            motivo: disponivel ? undefined : r?.motivo ?? "sem estoque nessa combinação",
            estoque: r?.estoque ?? null,
            variant_id: r?.variant_id ?? null,
            cores,
            tamanhos: tams,
          };
        }),
      );
      setLinhas(saida);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível testar o kit.");
    } finally {
      setVerificando(false);
    }
  };

  const total = totalKit(kit.itens, mapa);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Testar carrinho · {kit.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {kit.itens.map((i, idx) => {
            const p = mapa.get(String(i.produto_id));
            return (
              <div key={idx} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p?.nome ?? `Produto ${i.produto_id}`}
                  {i.cor && <span className="text-muted-foreground"> ({i.cor})</span>}
                </span>
                <Input
                  value={tamanhos[idx] ?? ""}
                  onChange={(e) => setTamanhos((t) => ({ ...t, [idx]: e.target.value }))}
                  placeholder="Tamanho"
                  className="h-8 w-24 text-sm"
                />
              </div>
            );
          })}
          <p className="pt-1 text-xs text-muted-foreground">Total das peças: {brl(total)}</p>
        </div>

        {linhas && (
          <div className="space-y-1.5 rounded-lg border p-3 text-sm">
            {linhas.map((l, i) => (
              <div key={i} className="text-xs">
                {l.ok ? (
                  <p className="text-success">
                    Disponível · <span className="text-foreground">{l.nome}</span>
                    {l.estoque != null && (
                      <span className="ml-1 text-muted-foreground">(estoque: {l.estoque})</span>
                    )}
                  </p>
                ) : (
                  <>
                    <p className="text-danger">
                      Indisponível · <span className="text-foreground">{l.nome}</span>
                    </p>
                    <p className="text-muted-foreground">
                      {l.motivo}
                      {l.cores?.length ? ` · cores: ${l.cores.join(", ")}` : ""}
                      {l.tamanhos?.length ? ` · tamanhos: ${l.tamanhos.join(", ")}` : ""}
                    </p>
                  </>
                )}
              </div>
            ))}
            {linhas.every((l) => l.ok) && (
              <p className="flex items-center gap-1.5 pt-1 font-medium text-success">
                Kit inteiro disponível: a Anna consegue montar o carrinho.
              </p>
            )}
            {linhas.some((l) => !l.ok) && (
              <p className="flex items-center gap-1.5 pt-1 text-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> Ajuste as peças antes de usar o kit na live.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={testar} disabled={verificando || (linhas?.some((l) => !l.ok) ?? false)}>
            {verificando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Testar carrinho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* --------------------------------- editor --------------------------------- */

function EditorKit({
  kit,
  kits,
  produtos,
  mapa,
  onFechar,
  onSalvo,
}: {
  kit: Kit;
  kits: Kit[];
  produtos: ProdutoPai[];
  mapa: Map<string, ProdutoPai>;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState<Kit>(kit);
  const [salvando, setSalvando] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const [coresPorProduto, setCoresPorProduto] = useState<Record<string, string[]>>({});
  const [testando, setTestando] = useState(false);
  const dragIndex = useRef<number | null>(null);

  const set = (patch: Partial<Kit>) => setForm((f) => ({ ...f, ...patch }));

  // cores em estoque de cada peça (para o campo "cor fixa")
  useEffect(() => {
    form.itens.forEach(async (i) => {
      const id = String(i.produto_id);
      if (!id || coresPorProduto[id]) return;
      const cores = await coresDisponiveis(id);
      setCoresPorProduto((c) => ({ ...c, [id]: cores }));
    });
  }, [form.itens]); // eslint-disable-line react-hooks/exhaustive-deps

  const gatilhosDuplicados = useMemo(() => {
    const outros = new Map<string, string>();
    kits
      .filter((k) => k.ativo && String(k.id) !== String(form.id ?? ""))
      .forEach((k) => k.gatilhos.forEach((g) => outros.set(normalizarGatilho(g), k.nome)));
    return form.gatilhos
      .map((g) => ({ gatilho: g, kit: outros.get(normalizarGatilho(g)) }))
      .filter((d) => !!d.kit) as { gatilho: string; kit: string }[];
  }, [form.gatilhos, form.id, kits, form.ativo]);

  const problemasDm = problemasTexto(form.resposta_dm);
  const total = totalKit(form.itens, mapa);

  const atualizarItem = (i: number, patch: Partial<ItemKit>) =>
    set({ itens: form.itens.map((it, j) => (j === i ? { ...it, ...patch } : it)) });

  const salvar = async () => {
    if (!form.nome.trim()) return toast.error("Dê um nome ao kit.");
    if (gatilhosDuplicados.length) return toast.error("Há palavra-chave já usada em outro kit ativo.");
    if (problemasDm.length) return toast.error(problemasDm[0]);
    setSalvando(true);
    try {
      const dm = (form.resposta_dm?.trim() || DM_PADRAO("{NOME}")).replace(/\{NOME\}/g, form.nome.trim());
      const payload: any = {
        nome: form.nome.trim(),
        gatilhos: form.gatilhos,
        descricao: form.descricao ?? null,
        itens: form.itens.filter((i) => !!i.produto_id),
        resposta_dm: dm,
        imagem_url: form.imagem_url ?? null,
        ativo: form.ativo,
        fim: form.fim || null,
      };
      const { error } = form.id
        ? await db.from("kits_ativos").update(payload).eq("id", form.id)
        : await db.from("kits_ativos").insert(payload);
      if (error) throw error;
      toast.success("Kit salvo.");
      onSalvo();
      onFechar();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar o kit.");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!form.id) return onFechar();
    const { error } = await db.from("kits_ativos").delete().eq("id", form.id);
    if (error) return toast.error(error.message);
    toast.success("Kit excluído.");
    onSalvo();
    onFechar();
  };

  return (
    <Sheet open onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-serif">{form.id ? "Editar kit" : "Novo kit"}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* 1. nome */}
          <div className="space-y-1.5">
            <Label>Nome do kit</Label>
            <Input value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Kit Juliana" />
          </div>

          {/* 2. gatilhos */}
          <div className="space-y-1.5">
            <Label>Palavras-chave</Label>
            <CampoTags
              value={form.gatilhos}
              onChange={(v) => set({ gatilhos: v })}
              placeholder="kit juliana, look completo, kit da live"
            />
            <p className="text-[11px] text-muted-foreground">
              A comparação ignora acento, maiúscula e pontuação. “EU QUERO O KIT JULIANA!!” bate com “kit juliana”.
            </p>
            {gatilhosDuplicados.map((d) => (
              <p key={d.gatilho} className="flex items-center gap-1.5 text-[11px] text-danger">
                <AlertTriangle className="h-3 w-3" /> “{d.gatilho}” já é usada no kit {d.kit}.
              </p>
            ))}
          </div>

          {/* 3. peças */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Peças do kit</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => set({ itens: [...form.itens, { produto_id: "", cor: null, papel: "" }] })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar peça
              </Button>
            </div>
            <div className="space-y-2">
              {form.itens.map((item, i) => {
                const p = mapa.get(String(item.produto_id));
                const cores = coresPorProduto[String(item.produto_id)] ?? [];
                return (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => (dragIndex.current = i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex.current != null && dragIndex.current !== i) {
                        const copia = [...form.itens];
                        const [mov] = copia.splice(dragIndex.current, 1);
                        copia.splice(i, 0, mov);
                        set({ itens: copia });
                      }
                      dragIndex.current = null;
                    }}
                    className="rounded-lg border p-2 space-y-2 bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <BuscaPeca
                          produtos={produtos}
                          valor={p}
                          onSelecionar={(sel) => atualizarItem(i, { produto_id: sel.produto_id, cor: null })}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => set({ itens: form.itens.filter((_, j) => j !== i) })}
                        className="rounded p-1 hover:bg-accent"
                        aria-label="Remover peça"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex gap-2 pl-6">
                      <Select
                        value={item.cor ?? "__livre"}
                        onValueChange={(v) => atualizarItem(i, { cor: v === "__livre" ? null : v })}
                      >
                        <SelectTrigger className="h-8 flex-1 text-xs">
                          <SelectValue placeholder="Cor fixa (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__livre">Cor: a cliente escolhe</SelectItem>
                          {cores.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={item.papel ?? ""}
                        onChange={(e) => atualizarItem(i, { papel: e.target.value })}
                        placeholder="papel: calça, blusa, body"
                        className="h-8 flex-1 text-xs"
                      />
                    </div>
                  </div>
                );
              })}
              {form.itens.length === 0 && (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Nenhuma peça ainda.
                </p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tamanho nunca fica fixo no kit: a Anna pergunta para a cliente.
            </p>
          </div>

          {/* 4. descrição */}
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={2}
              value={form.descricao ?? ""}
              onChange={(e) => set({ descricao: e.target.value })}
              placeholder="Como a Anna apresenta o kit, em 1 ou 2 linhas."
            />
          </div>

          {/* 5. resposta DM */}
          <div className="space-y-1.5">
            <Label>Mensagem do Direct</Label>
            <Textarea
              rows={4}
              value={form.resposta_dm ?? ""}
              onChange={(e) => set({ resposta_dm: e.target.value })}
              placeholder={DM_PADRAO("{NOME}")}
            />
            <div className="rounded-lg bg-muted/50 p-2 text-xs whitespace-pre-wrap">
              {(form.resposta_dm?.trim() || DM_PADRAO("{NOME}")).replace(
                /\{NOME\}/g,
                form.nome.trim() || "{NOME}",
              )}
            </div>
            {problemasDm.map((p) => (
              <p key={p} className="flex items-center gap-1.5 text-[11px] text-danger">
                <AlertTriangle className="h-3 w-3" /> {p}
              </p>
            ))}
          </div>

          {/* 6. imagem */}
          <div className="space-y-1.5">
            <Label>Imagem do kit (opcional)</Label>
            <div className="flex items-center gap-2">
              {form.imagem_url && (
                <img src={form.imagem_url} alt="" className="h-14 w-14 rounded object-cover" />
              )}
              <Input
                type="file"
                accept="image/*"
                className="text-xs"
                disabled={subindo}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setSubindo(true);
                  try {
                    set({ imagem_url: await uploadMidia(file, "kits") });
                  } catch (err: any) {
                    toast.error(err?.message ?? "Falha no upload.");
                  } finally {
                    setSubindo(false);
                  }
                }}
              />
            </div>
          </div>

          {/* 7. ativo + validade */}
          <div className="flex items-end gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => set({ ativo: v })} />
              <Label className="cursor-pointer">Ativo</Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Válido até</Label>
              <Input
                type="date"
                value={(form.fim ?? "").slice(0, 10)}
                onChange={(e) => set({ fim: e.target.value || null })}
                className="h-8 w-40 text-xs"
              />
            </div>
          </div>

          <p className="rounded-lg bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
            Preço do kit = soma dos preços do site, peça a peça. Para mudar o preço, mude o preço do produto na
            Tray. Hoje: <strong className="text-foreground">{brl(total)}</strong>
          </p>

          <div className="flex items-center gap-2 pb-8">
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Salvar kit
            </Button>
            <Button
              variant="outline"
              onClick={() => setTestando(true)}
              disabled={form.itens.filter((i) => i.produto_id).length === 0}
            >
              Testar carrinho
            </Button>
            {form.id && (
              <Button variant="ghost" className="ml-auto text-danger" onClick={excluir}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
              </Button>
            )}
          </div>
        </div>

        {testando && (
          <TestarCarrinho kit={form} mapa={mapa} aberto onOpenChange={(v) => !v && setTestando(false)} />
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ---------------------------------- aba ----------------------------------- */

const KIT_VAZIO: Kit = {
  nome: "",
  gatilhos: [],
  itens: [],
  ativo: true,
  descricao: "",
  resposta_dm: "",
  imagem_url: null,
  fim: null,
};

export function KitsTab() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [produtos, setProdutos] = useState<ProdutoPai[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Kit | null>(null);

  const mapa = useMemo(() => new Map(produtos.map((p) => [String(p.produto_id), p])), [produtos]);

  const carregar = useCallback(async () => {
    try {
      const [k, p] = await Promise.all([carregarKits(), carregarProdutosPai().catch(() => [])]);
      setKits(k);
      setProdutos(p);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível carregar os kits.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const alternarAtivo = async (kit: Kit, ativo: boolean) => {
    setKits((ks) => ks.map((k) => (k.id === kit.id ? { ...k, ativo } : k)));
    const { error } = await db.from("kits_ativos").update({ ativo }).eq("id", kit.id);
    if (error) {
      toast.error(error.message);
      carregar();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Kits são looks prontos. Quando a cliente cita uma palavra-chave, a Anna manda o Direct do kit e monta o
          carrinho com as peças.
        </p>
        <Button onClick={() => setEditando({ ...KIT_VAZIO })} className="shrink-0">
          <Plus className="mr-1.5 h-4 w-4" /> Novo kit
        </Button>
      </div>

      {carregando ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : kits.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Nenhum kit cadastrado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {kits.map((kit) => {
            const problemas = pecasComProblema(kit.itens, mapa);
            return (
              <Card
                key={String(kit.id)}
                className="cursor-pointer transition-colors hover:border-primary/40"
                onClick={() => setEditando(kit)}
              >
                <CardContent className="space-y-2 p-3.5">
                  <div className="flex items-start gap-3">
                    {kit.imagem_url ? (
                      <img src={kit.imagem_url} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-muted">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{kit.nome}</p>
                        <Badge
                          variant="outline"
                          className={
                            kit.ativo
                              ? "border-success/30 bg-success/10 text-success"
                              : "text-muted-foreground"
                          }
                        >
                          {kit.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {kit.itens.length} {kit.itens.length === 1 ? "peça" : "peças"} ·{" "}
                        <strong className="text-foreground">{brl(totalKit(kit.itens, mapa))}</strong>
                        {kit.fim && ` · até ${dataCurtaDDMM(kit.fim)}`}
                      </p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <Switch checked={kit.ativo} onCheckedChange={(v) => alternarAtivo(kit, v)} />
                    </div>
                  </div>

                  {kit.gatilhos.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {kit.gatilhos.map((g) => (
                        <Badge key={g} variant="secondary" className="text-[10px] font-normal">
                          {g}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {problemas.length > 0 && (
                    <p className="flex items-start gap-1.5 rounded border border-warning/30 bg-warning/10 p-1.5 text-[11px] text-warning">
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                      <span>
                        {problemas.length === 1 ? "1 peça com problema" : `${problemas.length} peças com problema`}:{" "}
                        {problemas
                          .map((p) => `${mapa.get(p.produto_id)?.nome ?? p.produto_id} (${p.motivo})`)
                          .join("; ")}
                      </span>
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editando && (
        <EditorKit
          kit={editando}
          kits={kits}
          produtos={produtos}
          mapa={mapa}
          onFechar={() => setEditando(null)}
          onSalvo={carregar}
        />
      )}
    </div>
  );
}
