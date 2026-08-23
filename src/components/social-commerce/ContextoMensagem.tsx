import { useMemo, useState } from "react";
import { db } from "@/lib/socialCommerce";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ExternalLink, ImageIcon, Loader2, Search, ShoppingBag, TriangleAlert } from "lucide-react";
import { carregarProdutosPai, normalizarBusca, type ProdutoPai } from "./SeletorProdutos";

/** Campos de contexto de story/mídia expostos por vw_ig_mensagens_painel. */
export type MensagemContexto = {
  id: number;
  tipo?: string | null;
  contexto_rotulo?: string | null;
  imagem_url?: string | null;
  story_link?: string | null;
  story_produto_id?: string | null;
  story_produto_nome?: string | null;
  look_descricao?: string | null;
  look_confianca?: string | null;
  look_produtos_nomes?: string[] | string | null;
  look_analisado?: boolean | null;
  look_produto_confirmado_id?: string | null;
};

function ehMencao(m: MensagemContexto): boolean {
  return (
    m.tipo === "mencao_story" ||
    (m.contexto_rotulo ?? "").toLowerCase().includes("mencionou")
  );
}

function nomesLook(v: string[] | string | null | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  return String(v).split(/[;,]/).map((s) => s.trim()).filter(Boolean);
}

/** Seletor manual de produto para menções com confiança média/baixa. */
function SeletorProdutoManual({
  m,
  saida,
  onConfirmado,
}: {
  m: MensagemContexto;
  saida: boolean;
  onConfirmado: (mensagemId: number, p: ProdutoPai) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoPai[] | null>(null);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  const filtrados = useMemo(() => {
    if (!produtos) return [];
    const q = normalizarBusca(busca);
    if (!q) return produtos;
    return produtos.filter(
      (p) =>
        normalizarBusca(p.nome ?? "").includes(q) ||
        normalizarBusca(p.codigo_sku ?? "").includes(q) ||
        (p.chave_busca ?? "").includes(q),
    );
  }, [produtos, busca]);

  const abrir = async (v: boolean) => {
    setAberto(v);
    if (v && produtos === null) {
      try {
        setProdutos(await carregarProdutosPai());
      } catch (e: any) {
        toast.error("Falha ao carregar produtos", { description: e?.message });
      }
    }
  };

  const escolher = async (p: ProdutoPai) => {
    setSalvando(true);
    try {
      const { error } = await db
        .from("instagram_mensagens")
        .update({ look_produto_confirmado_id: p.produto_id })
        .eq("id", m.id);
      if (error) throw error;
      onConfirmado(m.id, p);
      setAberto(false);
      toast.success(`Peça confirmada: ${p.nome}`);
    } catch (e: any) {
      toast.error("Falha ao confirmar a peça", {
        description: `${e?.message ?? ""} (rode a migração instagram_mensagens_look_confirmado.sql se a coluna não existir)`,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
            saida
              ? "border-primary-foreground/30 text-primary-foreground/90 hover:bg-primary-foreground/10"
              : "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20"
          }`}
        >
          {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingBag className="h-3 w-3" />}
          Escolher produto
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou código…"
            className="pl-8 h-8 text-sm"
            autoFocus
          />
        </div>
        <ScrollArea className="h-48">
          {produtos === null ? (
            <p className="text-xs text-muted-foreground p-2 flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando produtos…
            </p>
          ) : filtrados.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">Nenhum produto para “{busca}”.</p>
          ) : (
            filtrados.slice(0, 50).map((p) => (
              <button
                key={p.produto_id}
                type="button"
                disabled={salvando}
                onClick={() => escolher(p)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-accent/60 text-sm truncate"
              >
                {p.nome}
                {p.codigo_sku && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">{p.codigo_sku}</span>
                )}
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Cabeçalho de contexto do balão: resposta/menção a story ou mídia enviada.
 * Mostra o que a Anna viu — miniatura, rótulo, produto do sticker e análise de imagem.
 */
export function ContextoMensagem({
  m,
  saida,
  onConfirmado,
}: {
  m: MensagemContexto;
  saida: boolean;
  onConfirmado: (mensagemId: number, p: ProdutoPai) => void;
}) {
  const [lightbox, setLightbox] = useState(false);
  const [imgErro, setImgErro] = useState(false);

  if (!m.contexto_rotulo) return null;

  const mencao = ehMencao(m);
  const analisando = !!m.imagem_url && m.look_analisado === false;
  const confianca = (m.look_confianca ?? "").toLowerCase();
  const nomes = nomesLook(m.look_produtos_nomes);

  const corRotulo = saida ? "text-primary-foreground/80" : "text-muted-foreground";
  const corBorda = saida ? "border-primary-foreground/25" : "border-border";

  return (
    <div className={`mb-1.5 rounded-lg border ${corBorda} overflow-hidden`}>
      <div className="flex gap-2.5 p-2">
        {/* Miniatura 9:16 — clique abre lightbox */}
        {m.imagem_url && !imgErro ? (
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="shrink-0 rounded-md overflow-hidden w-16 h-28 bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
            title="Ampliar imagem"
          >
            <img
              src={m.imagem_url}
              alt={m.contexto_rotulo}
              loading="lazy"
              onError={() => setImgErro(true)}
              className="w-full h-full object-cover"
            />
          </button>
        ) : (
          <div
            className={`shrink-0 rounded-md w-16 h-28 flex items-center justify-center ${
              saida ? "bg-primary-foreground/10" : "bg-background/60"
            }`}
          >
            <ImageIcon className={`h-5 w-5 ${corRotulo}`} />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <p className={`text-[11px] font-semibold leading-tight ${corRotulo}`}>{m.contexto_rotulo}</p>

          {/* Produto apontado pelo sticker do story */}
          {m.story_produto_nome ? (
            <a
              href={m.story_link ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold max-w-full ${
                saida
                  ? "border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                  : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              <ShoppingBag className="h-3 w-3 shrink-0" />
              <span className="truncate">{m.story_produto_nome}</span>
              {m.story_link && <ExternalLink className="h-2.5 w-2.5 shrink-0" />}
            </a>
          ) : m.story_link ? (
            <a
              href={m.story_link}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-[10px] font-medium hover:underline ${
                saida ? "text-primary-foreground/90" : "text-primary"
              }`}
            >
              ver link do story <ExternalLink className="h-2.5 w-2.5" />
            </a>
          ) : null}

          {/* Análise de imagem (menções a story) */}
          {mencao && (
            <>
              {analisando ? (
                <p className={`text-[10px] italic flex items-center gap-1 ${corRotulo}`}>
                  <Loader2 className="h-3 w-3 animate-spin" /> analisando…
                </p>
              ) : (
                <>
                  {m.look_descricao && (
                    <p className={`text-[10px] leading-snug ${corRotulo}`}>{m.look_descricao}</p>
                  )}
                  {m.look_produto_confirmado_id ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        saida
                          ? "border-primary-foreground/30 text-primary-foreground/90"
                          : "border-success/30 bg-success/10 text-success"
                      }`}
                    >
                      <ShoppingBag className="h-3 w-3" /> Peça confirmada pela equipe
                    </span>
                  ) : confianca === "alta" && nomes.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {nomes.map((n) => (
                        <span
                          key={n}
                          className={`inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-medium ${
                            saida
                              ? "border-primary-foreground/25 text-primary-foreground/80"
                              : "border-border bg-background/60 text-foreground/80"
                          }`}
                        >
                          {n}
                        </span>
                      ))}
                    </span>
                  ) : confianca ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          saida
                            ? "border-primary-foreground/30 text-primary-foreground/90"
                            : "border-warning/30 bg-warning/10 text-warning"
                        }`}
                      >
                        <TriangleAlert className="h-3 w-3" /> peça não confirmada
                      </span>
                      <SeletorProdutoManual m={m} saida={saida} onConfirmado={onConfirmado} />
                    </span>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lightbox da miniatura */}
      {m.imagem_url && !imgErro && (
        <Dialog open={lightbox} onOpenChange={setLightbox}>
          <DialogContent className="max-w-sm p-2 bg-transparent border-none shadow-none">
            <img
              src={m.imagem_url}
              alt={m.contexto_rotulo}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
