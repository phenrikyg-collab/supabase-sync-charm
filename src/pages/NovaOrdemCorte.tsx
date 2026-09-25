import { useState, useMemo } from "react";
import { useProdutos, useCores, useOrdensCorte } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Search, X, Plus } from "lucide-react";
import { chamarRpc } from "@/lib/supabaseRpc";
import { rpcAusente, totalPorTamanho, type ItemGrade } from "@/lib/oficinaFluxo";

const TAMANHOS = ["PP", "P", "M", "G", "GG", "EG"];

interface ProdutoSelecionado { id: string; nome: string }

/** Etapa 1: planeja a OC (modelos, cores e grade por folha). O tecido é informado depois, em "Cortar". */
export default function NovaOrdemCorte() {
  const { data: produtos } = useProdutos();
  const { data: cores } = useCores();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);

  const [produtosSelecionados, setProdutosSelecionados] = useState<ProdutoSelecionado[]>([]);
  const [searchProduto, setSearchProduto] = useState("");
  const [coresSel, setCoresSel] = useState<string[]>([]);
  const [searchCor, setSearchCor] = useState("");
  const [grade, setGrade] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [metrosRisco, setMetrosRisco] = useState(0);

  const { data: ordensExistentes } = useOrdensCorte();
  const numeroOC = useMemo(() => {
    const ano = new Date().getFullYear();
    const re = new RegExp(`^OC-${ano}-(\\d+)$`);
    const max = Math.max(0, ...(ordensExistentes ?? []).map((o) => Number(o.numero_oc?.match(re)?.[1] ?? 0)));
    return `OC-${ano}-${String(max + 1).padStart(3, "0")}`;
  }, [ordensExistentes]);

  const coresMap = useMemo(() => new Map((cores ?? []).map((c) => [c.id, c])), [cores]);

  const produtosFiltrados = useMemo(() => {
    if (!produtos) return [];
    const sel = new Set(produtosSelecionados.map((p) => p.id));
    const ativos = produtos.filter((p) => p.ativo && !sel.has(p.id));
    const t = searchProduto.toLowerCase();
    return t ? ativos.filter((p) => p.nome_do_produto?.toLowerCase().includes(t) || p.codigo_sku?.toLowerCase().includes(t)) : ativos;
  }, [produtos, searchProduto, produtosSelecionados]);

  const coresFiltradas = useMemo(() => {
    const t = searchCor.toLowerCase();
    return (cores ?? []).filter((c) => c.ativo !== false && !coresSel.includes(c.id) && (!t || (c.nome_cor ?? "").toLowerCase().includes(t)));
  }, [cores, searchCor, coresSel]);

  const setQtd = (produtoId: string, corId: string, tamanho: string, qty: number) =>
    setGrade((prev) => ({
      ...prev,
      [produtoId]: { ...(prev[produtoId] ?? {}), [corId]: { ...(prev[produtoId]?.[corId] ?? {}), [tamanho]: Math.max(0, qty || 0) } },
    }));

  // Grade POR FOLHA do risco
  const gradeItems = useMemo(() => {
    const itens: ItemGrade[] = [];
    for (const p of produtosSelecionados)
      for (const corId of coresSel)
        for (const t of TAMANHOS) {
          const q = grade[p.id]?.[corId]?.[t] ?? 0;
          if (q > 0) itens.push({ produto_id: p.id, cor_id: corId, tamanho: t, quantidade: q });
        }
    return itens;
  }, [grade, produtosSelecionados, coresSel]);

  const totaisTamanho = totalPorTamanho(gradeItems);
  const pecasPorFolha = gradeItems.reduce((s, g) => s + g.quantidade, 0);

  const handleSubmit = async () => {
    if (!produtosSelecionados.length) { toast.error("Selecione ao menos um produto"); return; }
    if (!coresSel.length) { toast.error("Selecione ao menos uma cor"); return; }
    if (!gradeItems.length) { toast.error("Informe a grade por folha"); return; }
    setSalvando(true);
    try {
      const { data, error } = await chamarRpc("criar_ordem_corte", {
        p: {
          grade_tamanhos: TAMANHOS.filter((t) => totaisTamanho[t]),
          metragem_risco: metrosRisco || null,
          produtos: produtosSelecionados.map((p) => ({ produto_id: p.id, nome_produto: p.nome })),
          grade: gradeItems,
        },
      });
      if (error) {
        if (rpcAusente(error)) { toast.error("A criação de ordem de corte ainda não foi ativada no banco."); return; }
        throw error;
      }
      qc.invalidateQueries({ queryKey: ["ordens-corte"] });
      toast.success(`${data?.numero_oc ?? "Ordem de corte"} planejada. Informe o tecido ao cortar.`);
      navigate(data?.id ? `/oc/${data.id}` : "/ordens-corte");
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string };
      toast.error([err?.message, err?.details, err?.hint].filter(Boolean).join(" | ") || "Erro ao criar ordem de corte");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold text-foreground">
        Nova <span className="text-primary">Ordem de Corte</span>
      </h1>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número da OC (prévia)</Label>
              <Input value={numeroOC} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Metros do risco</Label>
              <Input type="number" step="0.01" inputMode="decimal" value={metrosRisco || ""} placeholder="0" onChange={(e) => setMetrosRisco(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Produtos ({produtosSelecionados.length})</Label>
            {produtosSelecionados.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {produtosSelecionados.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 text-sm">
                    <span className="font-medium text-foreground">{p.nome}</span>
                    <button onClick={() => setProdutosSelecionados((prev) => prev.filter((x) => x.id !== p.id))} className="ml-1 text-muted-foreground hover:text-destructive" aria-label="Remover">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar produto por nome ou SKU..." value={searchProduto} onChange={(e) => setSearchProduto(e.target.value)} className="pl-9" />
            </div>
            {searchProduto && (produtosFiltrados.length ? (
              <div className="border border-border rounded-lg max-h-48 overflow-y-auto bg-popover shadow-md">
                {produtosFiltrados.map((p) => (
                  <button key={p.id} className="w-full text-left px-4 py-2.5 hover:bg-accent text-sm flex items-center justify-between"
                    onClick={() => { setProdutosSelecionados((prev) => [...prev, { id: p.id, nome: p.nome_do_produto }]); setSearchProduto(""); }}>
                    <span className="flex items-center gap-2"><Plus className="h-3.5 w-3.5 text-primary" /><span className="font-medium text-popover-foreground">{p.nome_do_produto}</span></span>
                    {p.codigo_sku && <span className="text-muted-foreground text-xs">{p.codigo_sku}</span>}
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground py-2">Nenhum produto encontrado</p>)}
          </div>

          <div className="space-y-3">
            <Label>Cores ({coresSel.length})</Label>
            {coresSel.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coresSel.map((id) => {
                  const c = coresMap.get(id);
                  return (
                    <div key={id} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">
                      <span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: c?.cor_hex ?? "transparent" }} />
                      <span className="font-medium">{c?.nome_cor ?? "-"}</span>
                      <button onClick={() => setCoresSel((prev) => prev.filter((x) => x !== id))} className="ml-1 text-muted-foreground hover:text-destructive" aria-label="Remover">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar cor para adicionar..." value={searchCor} onChange={(e) => setSearchCor(e.target.value)} className="pl-9" />
            </div>
            {searchCor && (coresFiltradas.length ? (
              <div className="border border-border rounded-lg max-h-48 overflow-y-auto bg-popover shadow-md">
                {coresFiltradas.map((c) => (
                  <button key={c.id} className="w-full text-left px-4 py-2.5 hover:bg-accent text-sm flex items-center gap-2"
                    onClick={() => { setCoresSel((prev) => [...prev, c.id]); setSearchCor(""); }}>
                    <span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: c.cor_hex ?? "transparent" }} />
                    <span className="font-medium text-popover-foreground">{c.nome_cor}</span>
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground py-2">Nenhuma cor encontrada</p>)}
          </div>

          {coresSel.length > 0 && produtosSelecionados.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label>Grade por folha</Label>
                <span className="text-xs text-muted-foreground">Peças de cada tamanho em uma folha do risco</span>
              </div>
              {produtosSelecionados.map((prod) => (
                <div key={prod.id} className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <span className="font-serif text-base font-semibold text-foreground">{prod.nome}</span>
                  {coresSel.map((corId) => {
                    const c = coresMap.get(corId);
                    const sub = TAMANHOS.reduce((s, t) => s + (grade[prod.id]?.[corId]?.[t] ?? 0), 0);
                    return (
                      <div key={corId} className="p-3 rounded-lg border border-border bg-background space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: c?.cor_hex ?? "transparent" }} />
                            <span className="font-medium text-sm text-foreground">{c?.nome_cor ?? "-"}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">Por folha: <strong className="text-foreground">{sub} pç</strong></span>
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                          {TAMANHOS.map((t) => (
                            <div key={t} className="space-y-1">
                              <span className="text-xs font-medium text-muted-foreground">{t}</span>
                              <Input type="number" min={0} inputMode="numeric" placeholder="0"
                                value={grade[prod.id]?.[corId]?.[t] || ""}
                                onChange={(e) => setQtd(prod.id, corId, t, Number(e.target.value))} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <div className="p-3 bg-accent/50 border border-accent rounded-lg text-sm text-muted-foreground">
            A ordem é salva como <strong className="text-foreground">Planejada</strong>. Depois, na página da ordem, quem corta usa <strong className="text-foreground">Cortar</strong> para informar as folhas e os rolos usados. Só então as ordens de produção são geradas.
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div><p className="text-xs text-muted-foreground">Peças por folha</p><p className="text-lg font-bold text-foreground">{pecasPorFolha}</p></div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="lg" onClick={() => navigate("/ordens-corte")}>Cancelar</Button>
            <Button size="lg" onClick={handleSubmit} disabled={salvando}>{salvando ? "Salvando..." : "Salvar ordem"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
