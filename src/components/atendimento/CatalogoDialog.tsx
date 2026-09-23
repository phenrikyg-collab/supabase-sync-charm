import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Check, Search, X } from "lucide-react";
import { chamarRpc } from "@/lib/supabaseRpc";

export const MAX_SELECAO_CATALOGO = 10;

export type TamanhoDisponivel = { tamanho: string; estoque: number };

export type TamanhoDetalhe = { tamanho: string; estoque: number };

export type CorDisponivel = {
  cor: string;
  estoque?: number | null;
  imagem?: string | null;
  tamanhos?: string[] | null;
  tamanhos_detalhe?: TamanhoDetalhe[] | null;
};

export type ProdutoCatalogo = {
  id?: number | string;
  produto_id?: number | string;
  nome: string;
  preco?: number | null;
  preco_cheio?: number | null;
  preco_parcelado_5x?: number | null;
  preco_pix?: number | null;
  preco_vigente?: number | null;
  parcela_5x?: number | null;
  imagem?: string | null;
  link?: string | null;
  url?: string | null;
  disponivel?: boolean | null;
  tamanhos_disponiveis?: TamanhoDisponivel[] | null;
  cores_disponiveis?: (string | CorDisponivel)[] | null;
};

export type EscolhaProduto = {
  cor?: string | null;
  tamanho?: string | null;
  imagem?: string | null;
  tamanhos_detalhe?: TamanhoDetalhe[] | null;
};

export function formatarPreco(v?: number | null) {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Tamanhos da cor que têm estoque, já em ordem (a RPC entrega PP..EG). */
const tamanhosComEstoque = (lista?: TamanhoDetalhe[] | null) =>
  (lista ?? []).filter((t) => t.estoque > 0);

/** Legenda enviada junto da foto: preço vigente, parcelamento, Pix e tamanhos com estoque. */
export function legendaProduto(p: ProdutoCatalogo, escolha?: EscolhaProduto) {
  const vigente = p.preco_vigente ?? p.preco ?? null;
  const cheio = p.preco_cheio ?? null;
  const parcela = p.parcela_5x ?? p.preco_parcelado_5x ?? null;
  const pix = p.preco_pix ?? null;

  const linhas: string[] = [`*${p.nome}*`];

  if (vigente != null) {
    if (cheio != null && cheio > vigente) {
      linhas.push(`De ${formatarPreco(cheio)} por *${formatarPreco(vigente)}*`);
    } else {
      linhas.push(`*${formatarPreco(vigente)}*`);
    }
  }
  if (parcela != null) linhas.push(`em 5x de ${formatarPreco(parcela)} sem juros`);
  if (pix != null) linhas.push(`*${formatarPreco(pix)} no Pix* (5% de desconto)`);

  const cor = escolha?.cor?.trim();
  const tamanho = escolha?.tamanho?.trim();
  const detalhe = escolha?.tamanhos_detalhe ?? null;

  if (cor && tamanho) {
    const estoque = detalhe?.find((t) => t.tamanho === tamanho)?.estoque;
    const aviso = estoque != null && estoque <= 3 ? ` (últimas ${estoque})` : "";
    linhas.push(`${cor} · tamanho ${tamanho}${aviso}`);
  } else if (cor) {
    const disponiveis = tamanhosComEstoque(detalhe);
    if (disponiveis.length) {
      const texto = disponiveis
        .map((t) => (t.estoque <= 3 ? `${t.tamanho} (últimas ${t.estoque})` : t.tamanho))
        .join(", ");
      linhas.push(`${cor} · ${texto}`);
    } else {
      linhas.push(cor);
    }
  } else {
    // Sem variante escolhida: cores com estoque, sem tamanho.
    const cores = (p.cores_disponiveis ?? [])
      .map((c) => (typeof c === "string" ? { cor: c, estoque: null as number | null } : { cor: c.cor ?? "", estoque: c.estoque ?? null }))
      .filter((c) => c.cor && (c.estoque == null || c.estoque > 0))
      .map((c) => c.cor);
    if (cores.length) linhas.push(cores.join(", "));
  }

  const link = p.link || p.url;
  if (link) linhas.push(link);

  return linhas.join("\n");
}

type VariantesProduto = {
  produto_id?: string | number;
  nome?: string | null;
  preco?: number | null;
  preco_cheio?: number | null;
  preco_pix?: number | null;
  parcela_5x?: number | null;
  estoque_total?: number | null;
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

/** Chips de cor do card, a partir do campo que a própria busca já devolve. */
function CoresDoCard({ cores }: { cores?: (string | CorDisponivel)[] | null }) {
  const lista = (cores ?? []).map((c) => (typeof c === "string" ? { cor: c } : c)).filter((c) => !!c?.cor);
  if (lista.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-0.5">
      {lista.slice(0, 4).map((c) => (
        <span
          key={c.cor}
          title={c.estoque != null ? `${c.estoque} em estoque` : undefined}
          className="inline-flex rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium"
        >
          {c.cor}
        </span>
      ))}
      {lista.length > 4 && (
        <span className="text-[10px] text-muted-foreground">+{lista.length - 4}</span>
      )}
    </div>
  );
}

export type ItemSelecionado = { produto: ProdutoCatalogo; escolha?: EscolhaProduto };

type ItemSelecao = { chave: string; produto: ProdutoCatalogo; escolha: EscolhaProduto };

const chaveItem = (p: ProdutoCatalogo, escolha?: EscolhaProduto) =>
  [idProduto(p) || p.nome, escolha?.cor ?? "", escolha?.tamanho ?? ""].join("|");

/** Quantas cores a busca já conhece para o produto (sem chamar a RPC de variantes). */
const qtdCoresConhecidas = (p: ProdutoCatalogo) =>
  (p.cores_disponiveis ?? []).map((c) => (typeof c === "string" ? c : c?.cor)).filter(Boolean).length;

const primeiraCor = (p: ProdutoCatalogo): EscolhaProduto => {
  const bruta = (p.cores_disponiveis ?? [])[0];
  const c = typeof bruta === "string" ? { cor: bruta } : bruta;
  return { cor: c?.cor ?? null, tamanho: null, imagem: c?.imagem || p.imagem || null };
};

function EscolherVariacao({
  produto,
  inicial,
  rotuloAcao,
  onVoltar,
  onEnviar,
}: {
  produto: ProdutoCatalogo;
  inicial?: EscolhaProduto;
  rotuloAcao: string;
  onVoltar: () => void;
  onEnviar: (escolha: EscolhaProduto) => void;
}) {
  const { data, isLoading } = useVariantes(idProduto(produto), true);
  const cores = useMemo(() => data?.cores ?? [], [data]);
  const [cor, setCor] = useState<string | null>(inicial?.cor ?? null);
  const [tamanho, setTamanho] = useState<string | null>(inicial?.tamanho ?? null);

  useEffect(() => {
    if (cores.length === 1) setCor(cores[0].cor);
  }, [cores]);

  const tamanhos = useMemo(
    () => (cores.find((c) => c.cor === cor)?.tamanhos ?? []).filter(Boolean),
    [cores, cor],
  );

  const tamanhosDetalhe = useMemo(
    () => cores.find((c) => c.cor === cor)?.tamanhos_detalhe ?? null,
    [cores, cor],
  );


  useEffect(() => {
    if (tamanhos.length === 1) setTamanho(tamanhos[0]);
    else if (!tamanhos.includes(tamanho ?? "")) setTamanho(null);
  }, [tamanhos]); // eslint-disable-line react-hooks/exhaustive-deps

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
          {(() => {
            const vigente = produto.preco_vigente ?? produto.preco_cheio ?? produto.preco ?? null;
            const cheio = produto.preco_cheio ?? null;
            const temPromo = vigente != null && cheio != null && cheio > vigente;
            const pix = produto.preco_pix ?? data?.preco_pix ?? null;
            return (
              <>
                <p className="text-sm font-bold">
                  {temPromo && (
                    <span className="mr-1 text-[11px] font-normal text-muted-foreground line-through">
                      {formatarPreco(cheio)}
                    </span>
                  )}
                  {formatarPreco(vigente)}
                </p>
                {pix != null && (
                  <p className="text-[11px] text-success font-semibold">
                    {formatarPreco(pix)} no Pix (5% OFF)
                  </p>
                )}
              </>
            );
          })()}
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
        <p className="whitespace-pre-wrap text-xs">{legendaProduto(produto, { cor, tamanho, tamanhos_detalhe: tamanhosDetalhe })}</p>
      </div>

      <Button className="w-full" disabled={!podeEnviar} onClick={() => onEnviar({ cor, tamanho, imagem: imagemSelecionada, tamanhos_detalhe: tamanhosDetalhe })}>
        {rotuloAcao}
      </Button>
      {!podeEnviar && (
        <p className="text-[11px] text-muted-foreground text-center">Escolha a cor antes de enviar.</p>
      )}
    </div>
  );
}

/** Barra fixa no rodapé com as peças escolhidas. */
function BarraSelecao({
  itens,
  onRemover,
  onEditar,
  onLimpar,
  onEnviar,
}: {
  itens: ItemSelecao[];
  onRemover: (chave: string) => void;
  onEditar: (item: ItemSelecao) => void;
  onLimpar: () => void;
  onEnviar: () => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 border-t border-border bg-background/95 p-3 backdrop-blur">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {itens.map((item) => (
          <div key={item.chave} className="relative shrink-0">
            <button
              type="button"
              onClick={() => onEditar(item)}
              title={`${item.produto.nome}${item.escolha.cor ? ` - ${item.escolha.cor}` : ""}${item.escolha.tamanho ? ` (${item.escolha.tamanho})` : ""} · tocar para editar`}
              className="block h-14 w-14 overflow-hidden rounded border border-border bg-muted hover:border-primary"
            >
              {item.escolha.imagem || item.produto.imagem ? (
                <img
                  src={item.escolha.imagem || item.produto.imagem || ""}
                  alt={item.produto.nome}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => onRemover(item.chave)}
              aria-label={`Remover ${item.produto.nome}`}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-danger"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {itens.length === 1 ? "1 peça selecionada" : `${itens.length} peças selecionadas`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onLimpar}>
            Limpar seleção
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={onEnviar}>
            {itens.length === 1 ? "Enviar a peça para a cliente" : `Enviar as ${itens.length} para a cliente`}
          </Button>
        </div>
      </div>
    </div>
  );
}

type TelaVariacao =
  | { modo: "enviar"; produto: ProdutoCatalogo }
  | { modo: "selecionar"; produto: ProdutoCatalogo }
  | { modo: "editar"; produto: ProdutoCatalogo; chave: string; inicial: EscolhaProduto };

export function CatalogoDialog({
  open,
  onOpenChange,
  onSelecionar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelecionar: (itens: ItemSelecionado[]) => void;
}) {
  const [busca, setBusca] = useState("");
  const [buscaAdiada, setBuscaAdiada] = useState("");
  const [cor, setCor] = useState<string | null>(null);
  const [tamanho, setTamanho] = useState<string | null>(null);
  const [aberto, setAberto] = useState<TelaVariacao | null>(null);
  const [selecao, setSelecao] = useState<ItemSelecao[]>([]);

  // A seleção zera sempre que o diálogo fecha.
  useEffect(() => {
    if (!open) {
      setAberto(null);
      setSelecao([]);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setBuscaAdiada(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data: opcoes } = useQuery({
    queryKey: ["catalogo-opcoes-filtro"],
    enabled: open,
    staleTime: 30 * 60 * 1000,
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
    queryKey: ["catalogo-buscar-produtos", buscaAdiada, cor, tamanho],
    enabled: open,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await chamarRpc("catalogo_buscar_produtos" as any, {
        p_palavra_chave: buscaAdiada.trim() || null,
        p_cor: cor,
        p_tamanho: tamanho,
        p_limit: 30,
      });
      if (error) throw error;
      return (data ?? []) as ProdutoCatalogo[];
    },
  });

  const noLimite = selecao.length >= MAX_SELECAO_CATALOGO;
  const chavesProdutos = useMemo(
    () => new Set(selecao.map((i) => idProduto(i.produto) || i.produto.nome)),
    [selecao],
  );

  const adicionar = useCallback(
    (produto: ProdutoCatalogo, escolha: EscolhaProduto, chaveAnterior?: string) => {
      setSelecao((atual) => {
        const chave = chaveItem(produto, escolha);
        const base = chaveAnterior ? atual.filter((i) => i.chave !== chaveAnterior) : atual;
        if (base.some((i) => i.chave === chave)) return base;
        if (base.length >= MAX_SELECAO_CATALOGO) return base;
        const novo: ItemSelecao = { chave, produto, escolha };
        if (!chaveAnterior) return [...base, novo];
        const pos = atual.findIndex((i) => i.chave === chaveAnterior);
        const copia = [...base];
        copia.splice(pos < 0 ? copia.length : pos, 0, novo);
        return copia;
      });
      setAberto(null);
    },
    [],
  );

  const alternarSelecao = (p: ProdutoCatalogo) => {
    const jaTem = chavesProdutos.has(idProduto(p) || p.nome);
    if (jaTem) {
      setSelecao((atual) => atual.filter((i) => (idProduto(i.produto) || i.produto.nome) !== (idProduto(p) || p.nome)));
      return;
    }
    if (noLimite) return;
    if (qtdCoresConhecidas(p) > 1) {
      setAberto({ modo: "selecionar", produto: p });
      return;
    }
    adicionar(p, primeiraCor(p));
  };

  const enviarSelecao = () => {
    if (!selecao.length) return;
    const itens = selecao.map((i) => ({ produto: i.produto, escolha: i.escolha }));
    setSelecao([]);
    onSelecionar(itens);
  };

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

  const tituloTela = aberto
    ? aberto.modo === "editar"
      ? "Editar a peça"
      : aberto.modo === "selecionar"
        ? "Escolher cor e tamanho"
        : "Escolher a cor"
    : "Catálogo de produtos";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-whatsapp max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tituloTela}</DialogTitle>
        </DialogHeader>

        {aberto ? (
          <EscolherVariacao
            produto={aberto.produto}
            inicial={aberto.modo === "editar" ? aberto.inicial : undefined}
            rotuloAcao={aberto.modo === "enviar" ? "Enviar para a cliente" : "Adicionar à seleção"}
            onVoltar={() => setAberto(null)}
            onEnviar={(escolha) => {
              if (aberto.modo === "enviar") {
                onSelecionar([{ produto: aberto.produto, escolha }]);
                setAberto(null);
                return;
              }
              adicionar(aberto.produto, escolha, aberto.modo === "editar" ? aberto.chave : undefined);
            }}
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
            <div className="relative">
              <ScrollArea className="h-[420px] pr-2">
                {isLoading && <p className="text-sm text-muted-foreground p-2">Carregando…</p>}
                {!isLoading && produtos.length === 0 && (
                  <p className="text-sm text-muted-foreground p-2">Nenhum produto encontrado.</p>
                )}
                <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${selecao.length ? "pb-32" : ""}`}>
                  {produtos.map((p, i) => {
                    const marcado = chavesProdutos.has(idProduto(p) || p.nome);
                    const bloqueado = !marcado && noLimite;
                    return (
                      <div
                        key={idProduto(p) || i}
                        role="button"
                        tabIndex={0}
                        onClick={() => setAberto({ modo: "enviar", produto: p })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setAberto({ modo: "enviar", produto: p });
                          }
                        }}
                        className="relative cursor-pointer text-left border border-border rounded-lg overflow-hidden hover:border-primary transition-colors"
                      >
                        <button
                          type="button"
                          disabled={bloqueado}
                          title={bloqueado ? "máximo de 10 por envio" : undefined}
                          aria-label={marcado ? `Tirar ${p.nome} da seleção` : `Selecionar ${p.nome}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            alternarSelecao(p);
                          }}
                          className={
                            "absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded border shadow-sm transition-colors " +
                            (marcado
                              ? "border-primary bg-primary text-primary-foreground"
                              : bloqueado
                                ? "border-border bg-background/80 text-muted-foreground opacity-50 cursor-not-allowed"
                                : "border-border bg-background/90 text-muted-foreground hover:border-primary")
                          }
                        >
                          {marcado && <Check className="h-4 w-4" />}
                        </button>
                        <div className="aspect-square bg-muted overflow-hidden">
                          {p.imagem ? (
                            <img src={p.imagem} alt={p.nome} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                          ) : null}
                        </div>
                        <div className="p-2 space-y-1">
                          <p className="text-xs font-medium line-clamp-2">{p.nome}</p>
                          {(() => {
                            const vigente = p.preco_vigente ?? p.preco_cheio ?? p.preco ?? null;
                            const cheio = p.preco_cheio ?? null;
                            const temPromo = vigente != null && cheio != null && cheio > vigente;
                            return (
                              <p className="text-sm font-bold">
                                {temPromo && (
                                  <span className="mr-1 text-[10px] font-normal text-muted-foreground line-through">
                                    {formatarPreco(cheio)}
                                  </span>
                                )}
                                {formatarPreco(vigente)}
                              </p>
                            );
                          })()}
                          <CoresDoCard cores={p.cores_disponiveis} />
                          {(() => {
                            const parcela = p.parcela_5x ?? p.preco_parcelado_5x ?? null;
                            if (parcela == null) return null;
                            return (
                              <p className="text-[11px] text-muted-foreground">
                                 ou 5x de {formatarPreco(parcela)} sem juros
                              </p>
                            );
                          })()}
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
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {noLimite && (
                <p className="pt-1 text-[11px] text-muted-foreground">máximo de 10 por envio</p>
              )}

              {selecao.length > 0 && (
                <BarraSelecao
                  itens={selecao}
                  onRemover={(chave) => setSelecao((atual) => atual.filter((i) => i.chave !== chave))}
                  onEditar={(item) =>
                    setAberto({ modo: "editar", produto: item.produto, chave: item.chave, inicial: item.escolha })
                  }
                  onLimpar={() => setSelecao([])}
                  onEnviar={enviarSelecao}
                />
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
