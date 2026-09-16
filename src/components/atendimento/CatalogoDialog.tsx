import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Search } from "lucide-react";
import { chamarRpc } from "@/lib/supabaseRpc";

export type TamanhoDisponivel = { tamanho: string; estoque: number };

export type CorDisponivel = { cor: string; estoque?: number | null; imagem?: string | null; tamanhos?: string[] | null };

export type ProdutoCatalogo = {
  id?: number | string;
  produto_id?: number | string;
  nome: string;
  preco?: number | null;
  preco_cheio?: number | null;
  preco_parcelado_5x?: number | null;
  preco_pix?: number | null;
  imagem?: string | null;
  link?: string | null;
  url?: string | null;
  disponivel?: boolean | null;
  tamanhos_disponiveis?: TamanhoDisponivel[] | null;
};

export type EscolhaProduto = { cor?: string | null; tamanho?: string | null; imagem?: string | null };

export function formatarPreco(v?: number | null) {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Legenda enviada na conversa: Nome da peça - Cor | R$ 149,00 | link */
export function legendaProduto(p: ProdutoCatalogo, escolha?: EscolhaProduto) {
  const cor = escolha?.cor?.trim();
  const tamanho = escolha?.tamanho?.trim();
  const titulo = [p.nome, cor].filter(Boolean).join(" - ") + (tamanho ? ` (${tamanho})` : "");
  const partes = [titulo, formatarPreco(p.preco_cheio ?? p.preco)].filter(Boolean);
  const link = p.link || p.url;
  if (link) partes.push(link);
  const base = partes.join(" | ");
  const extras: string[] = [];
  if (p.preco_parcelado_5x != null) extras.push(`5x de ${formatarPreco(p.preco_parcelado_5x)} sem juros`);
  if (p.preco_pix != null) extras.push(`${formatarPreco(p.preco_pix)} no Pix (5% OFF)`);
  return extras.length ? `${base}\n${extras.join(" | ")}` : base;
}

type VariantesProduto = {
  produto_id?: string | number;
  nome?: string | null;
  preco?: number | null;
  preco_cheio?: number | null;
  imagem?: string | null;
  cores?: CorDisponivel[] | null;
};

const idProduto = (p: ProdutoCatalogo) => String(p.produto_id ?? p.id ?? "");

function useVariantes(produtoId: string, ativo: boolean) {
  return useQuery({
    queryKey: ["catalogo-produto-variantes", produtoId],
    enabled: ativo && !!produtoId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await chamarRpc("catalogo_produto_variantes" as any, {
        p_produto_id: produtoId,
      });
      if (error) throw error;
      const raw = (Array.isArray(data) ? data[0] : data) as VariantesProduto | null;
      return { ...(raw ?? {}), cores: (raw?.cores ?? []) as CorDisponivel[] };
    },
  });
}

function CoresDoCard({ produtoId, ativo }: { produtoId: string; ativo: boolean }) {
  const { data } = useVariantes(produtoId, ativo);
  const cores = data?.cores ?? [];
  if (cores.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-0.5">
      {cores.slice(0, 4).map((c) => (
        <span
          key={c.cor}
          title={c.estoque != null ? `${c.estoque} em estoque` : undefined}
          className="inline-flex rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium"
        >
          {c.cor}
        </span>
      ))}
      {cores.length > 4 && (
        <span className="text-[10px] text-muted-foreground">+{cores.length - 4}</span>
      )}
    </div>
  );
}

function EscolherVariacao({
  produto,
  onVoltar,
  onEnviar,
}: {
  produto: ProdutoCatalogo;
  onVoltar: () => void;
  onEnviar: (escolha: EscolhaProduto) => void;
}) {
  const { data, isLoading } = useVariantes(idProduto(produto), true);
  const cores = useMemo(() => data?.cores ?? [], [data]);
  const [cor, setCor] = useState<string | null>(null);
  const [tamanho, setTamanho] = useState<string | null>(null);

  useEffect(() => {
    if (cores.length === 1) setCor(cores[0].cor);
  }, [cores]);

  const tamanhos = useMemo(
    () => (cores.find((c) => c.cor === cor)?.tamanhos ?? []).filter(Boolean),
    [cores, cor],
  );

  useEffect(() => {
    if (tamanhos.length === 1) setTamanho(tamanhos[0]);
    else setTamanho(null);
  }, [tamanhos]);

  const precisaCor = cores.length > 1;
  const podeEnviar = !precisaCor || !!cor;
  const imagemSelecionada = (cor ? cores.find((c) => c.cor === cor)?.imagem : null) || produto.imagem || null;

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onVoltar}>
        <ArrowLeft className="h-3.5 w-3.5 mr-1" />
        Voltar ao catálogo
      </Button>
      <div className="flex gap-3">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded bg-muted">
          {imagemSelecionada ? (
            <img src={imagemSelecionada} alt={produto.nome} className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{produto.nome}</p>
          <p className="text-sm font-bold">{formatarPreco(produto.preco_cheio ?? produto.preco)}</p>
          {produto.preco_pix != null && (
            <p className="text-[11px] text-success font-semibold">
              {formatarPreco(produto.preco_pix)} no Pix (5% OFF)
            </p>
          )}
        </div>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Carregando cores…</p>}
      {!isLoading && cores.length === 0 && (
        <p className="text-xs text-muted-foreground">Sem cores com estoque no momento.</p>
      )}

      {cores.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Cor</p>
          <div className="flex flex-wrap gap-1.5">
            {cores.map((c) => (
              <button
                key={c.cor}
                type="button"
                onClick={() => setCor(c.cor)}
                className={
                  cor === c.cor
                    ? "rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                    : "rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                }
              >
                {c.cor}
                {c.estoque != null && <span className="ml-1 opacity-60">{c.estoque}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {tamanhos.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Tamanho</p>
          <div className="flex flex-wrap gap-1.5">
            {tamanhos.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTamanho(t)}
                className={
                  tamanho === t
                    ? "rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                    : "rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-muted/40 p-2">
        <p className="text-[11px] text-muted-foreground">A cliente recebe:</p>
        <p className="whitespace-pre-wrap text-xs">{legendaProduto(produto, { cor, tamanho })}</p>
      </div>

      <Button className="w-full" disabled={!podeEnviar} onClick={() => onEnviar({ cor, tamanho, imagem: imagemSelecionada })}>
        Enviar para a cliente
      </Button>
      {!podeEnviar && (
        <p className="text-[11px] text-muted-foreground text-center">Escolha a cor antes de enviar.</p>
      )}
    </div>
  );
}

export function CatalogoDialog({
  open,
  onOpenChange,
  onSelecionar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelecionar: (produto: ProdutoCatalogo, escolha?: EscolhaProduto) => void;
}) {
  const [busca, setBusca] = useState("");
  const [cor, setCor] = useState<string | null>(null);
  const [tamanho, setTamanho] = useState<string | null>(null);
  const [aberto, setAberto] = useState<ProdutoCatalogo | null>(null);

  useEffect(() => {
    if (!open) setAberto(null);
  }, [open]);

  const { data: opcoes } = useQuery({
    queryKey: ["catalogo-opcoes-filtro"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await chamarRpc("catalogo_opcoes_filtro" as any);
      if (error) throw error;
      const raw = (Array.isArray(data) ? data[0] : data) as
        | { cores?: string[]; tamanhos?: string[] }
        | null;
      return { cores: raw?.cores ?? [], tamanhos: raw?.tamanhos ?? [] };
    },
  });

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["catalogo-buscar-produtos", busca, cor, tamanho],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await chamarRpc("catalogo_buscar_produtos" as any, {
        p_palavra_chave: busca.trim() || null,
        p_cor: cor,
        p_tamanho: tamanho,
        p_limit: 30,
      });
      if (error) throw error;
      return (data ?? []) as ProdutoCatalogo[];
    },
  });

  const Pill = ({
    ativo,
    children,
    onClick,
  }: {
    ativo: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={
        ativo
          ? "rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
          : "rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
      }
    >
      {children}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{aberto ? "Escolher a cor" : "Catálogo de produtos"}</DialogTitle>
        </DialogHeader>

        {aberto ? (
          <EscolherVariacao
            produto={aberto}
            onVoltar={() => setAberto(null)}
            onEnviar={(escolha) => onSelecionar(aberto, escolha)}
          />
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto…"
                className="pl-8"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">Cor:</span>
                <Pill ativo={cor === null} onClick={() => setCor(null)}>
                  Todas
                </Pill>
                {(opcoes?.cores ?? []).map((c) => (
                  <Pill key={c} ativo={cor === c} onClick={() => setCor(cor === c ? null : c)}>
                    {c}
                  </Pill>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">Tamanho:</span>
                <Pill ativo={tamanho === null} onClick={() => setTamanho(null)}>
                  Todos
                </Pill>
                {(opcoes?.tamanhos ?? []).map((t) => (
                  <Pill key={t} ativo={tamanho === t} onClick={() => setTamanho(tamanho === t ? null : t)}>
                    {t}
                  </Pill>
                ))}
              </div>
            </div>
            <ScrollArea className="h-[420px] pr-2">
              {isLoading && <p className="text-sm text-muted-foreground p-2">Carregando…</p>}
              {!isLoading && produtos.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">Nenhum produto encontrado.</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {produtos.map((p, i) => (
                  <button
                    key={idProduto(p) || i}
                    onClick={() => setAberto(p)}
                    className="text-left border border-border rounded-lg overflow-hidden hover:border-primary transition-colors"
                  >
                    <div className="aspect-square bg-muted overflow-hidden">
                      {p.imagem ? (
                        <img src={p.imagem} alt={p.nome} className="w-full h-full object-cover" loading="lazy" />
                      ) : null}
                    </div>
                    <div className="p-2 space-y-1">
                      <p className="text-xs font-medium line-clamp-2">{p.nome}</p>
                      <p className="text-sm font-bold">{formatarPreco(p.preco_cheio ?? p.preco)}</p>
                      <CoresDoCard produtoId={idProduto(p)} ativo={open} />
                      {p.preco_parcelado_5x != null && (
                        <p className="text-[11px] text-muted-foreground">
                          ou 5x de {formatarPreco(p.preco_parcelado_5x)} sem juros
                        </p>
                      )}
                      {p.preco_pix != null && (
                        <p className="text-[11px] font-semibold text-success">
                          💚 {formatarPreco(p.preco_pix)} no Pix (5% OFF)
                        </p>
                      )}
                      {!!p.tamanhos_disponiveis?.length && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {p.tamanhos_disponiveis.map((t) => (
                            <span
                              key={t.tamanho}
                              title={`${t.estoque} em estoque`}
                              className={
                                t.estoque > 0
                                  ? "inline-flex rounded bg-muted text-foreground px-1.5 py-0.5 text-[10px] font-medium"
                                  : "inline-flex rounded bg-muted/50 text-muted-foreground line-through opacity-60 px-1.5 py-0.5 text-[10px]"
                              }
                            >
                              {t.tamanho}
                            </span>
                          ))}
                        </div>
                      )}
                      {p.disponivel === false && (
                        <span className="inline-flex rounded-full border border-danger/20 bg-danger/10 text-danger px-2 py-0.5 text-[10px] font-semibold">
                          indisponível
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
