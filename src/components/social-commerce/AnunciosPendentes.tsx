import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/socialCommerce";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, ExternalLink, ImageOff, Loader2,
  Megaphone, MessageSquare, Search, Trash2, Zap,
} from "lucide-react";

type AnuncioLinha = {
  media_id: string;
  imagem?: string | null;
  permalink?: string | null;
  legenda_curta?: string | null;
  ad_name?: string | null;
  ad_id?: string | null;
  comentarios?: number | null;
  sem_resposta?: number | null;
  produto_id?: string | null;
  produto_nome?: string | null;
  produto_origem?: string | null;
  produto_confianca?: "alta" | "media" | "nenhuma" | string | null;
  tem_automacao?: boolean | null;
};

type ProdutoBusca = {
  produto_id: string;
  nome: string;
  preco?: number | null;
  disponivel?: boolean | null;
  url?: string | null;
};

type Apelido = { apelido: string; produto_id: string | null; criado_por?: string | null };

const ORIGEM_LABEL: Record<string, string> = {
  escolha_da_equipe: "escolha da equipe",
  link_do_anuncio: "link do anúncio",
  apelido: "por apelido",
  nao_identificado: "não identificado",
};

const MODOS = [
  { valor: "sombra", titulo: "Rascunho para aprovar", descricao: "a Anna escreve, alguém aprova antes de sair" },
  { valor: "automatico", titulo: "Responder sozinha", descricao: "resposta pública + Direct sem revisão" },
  { valor: "desligado", titulo: "Não responder", descricao: "ignora comentários deste anúncio" },
] as const;

/** REELS - CALCA ANNA — Cópia  ->  calca anna */
export function apelidoSugerido(adName?: string | null): string {
  if (!adName) return "";
  return adName
    .replace(/^\s*(REELS|VIDEO|VÍDEO|IMG|IMAGE|CAROUSEL|STORIES)\s*[-–—:]\s*/i, "")
    .replace(/\s*[-–—]\s*c[óo]pia.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const moeda = (v?: number | null) =>
  typeof v === "number"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "";

function Miniatura({ src }: { src?: string | null }) {
  const [erro, setErro] = useState(false);
  if (!src || erro) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }
  return <img src={src} alt="Mídia do anúncio" className="w-full h-full object-cover" loading="lazy" onError={() => setErro(true)} />;
}

function SecaoApelidos() {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Apelido[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await db.from("ig_apelidos_produto").select("*").order("apelido");
    if (error) toast.error("Falha ao carregar apelidos", { description: error.message });
    else setItens((data ?? []) as Apelido[]);
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (aberto) carregar();
  }, [aberto, carregar]);

  const apagar = async (apelido: string) => {
    const { error } = await db.from("ig_apelidos_produto").delete().eq("apelido", apelido);
    if (error) return toast.error(error.message);
    toast.success("Apelido apagado");
    carregar();
  };

  return (
    <Card>
      <CardContent className="p-3">
        <button className="flex items-center gap-1.5 text-xs font-medium" onClick={() => setAberto((v) => !v)}>
          {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Apelidos ensinados
        </button>
        {aberto && (
          <div className="mt-3 space-y-1.5">
            {carregando ? (
              <Skeleton className="h-8 w-full" />
            ) : itens.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum apelido cadastrado ainda.</p>
            ) : (
              itens.map((a) => (
                <div key={a.apelido} className="flex items-center gap-2 text-xs border rounded px-2 py-1.5">
                  <span className="font-medium">{a.apelido}</span>
                  <span className="text-muted-foreground truncate">{a.produto_id}</span>
                  {a.criado_por && <span className="text-muted-foreground ml-auto">{a.criado_por}</span>}
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-auto" onClick={() => apagar(a.apelido)}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AnunciosPendentes() {
  const { user } = useAuth();
  const [linhas, setLinhas] = useState<AnuncioLinha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroView, setErroView] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<AnuncioLinha | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await db
      .from("vw_ig_anuncios_para_configurar")
      .select("*")
      .order("comentarios", { ascending: false });
    if (error) setErroView(error.message);
    else {
      setErroView(null);
      setLinhas((data ?? []) as AnuncioLinha[]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const ordenadas = useMemo(
    () =>
      [...linhas].sort((a, b) => {
        const sr = (b.sem_resposta ?? 0) - (a.sem_resposta ?? 0);
        if (sr !== 0) return sr;
        return (b.comentarios ?? 0) - (a.comentarios ?? 0);
      }),
    [linhas],
  );

  const semProduto = ordenadas.filter((l) => !l.produto_id).length;
  const semResposta = ordenadas.reduce((s, l) => s + (l.sem_resposta ?? 0), 0);

  if (carregando) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (erroView) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-warning" />
          Não foi possível carregar os anúncios: {erroView}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">{semProduto}</strong> anúncios sem produto ·{" "}
        <strong className="text-foreground">{semResposta}</strong> comentários sem resposta
      </p>

      {ordenadas.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum anúncio para configurar.
          </CardContent>
        </Card>
      ) : (
        ordenadas.map((l) => {
          const conf = l.produto_id ? (l.produto_confianca ?? "media") : "nenhuma";
          return (
            <Card key={l.media_id}>
              <CardContent className="p-3 flex gap-3">
                <div className="h-20 w-20 shrink-0 rounded bg-muted overflow-hidden">
                  <Miniatura src={l.imagem} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                      <Megaphone className="h-3.5 w-3.5 shrink-0" />
                      {l.ad_name || "Anúncio sem nome na Meta"}
                    </p>
                    <div className="ml-auto text-right text-[11px] text-muted-foreground shrink-0">
                      <div className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> {l.comentarios ?? 0} comentários
                      </div>
                      {(l.sem_resposta ?? 0) > 0 && (
                        <div className="text-danger font-semibold">{l.sem_resposta} sem resposta</div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">{l.legenda_curta || "(sem legenda)"}</p>

                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    {conf === "alta" && (
                      <span className="inline-flex items-center gap-1 text-success font-medium">
                        <Check className="h-3.5 w-3.5" /> {l.produto_nome}
                      </span>
                    )}
                    {conf === "media" && (
                      <span className="inline-flex items-center gap-1 text-warning font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" /> {l.produto_nome} — palpite, confirme
                      </span>
                    )}
                    {conf === "nenhuma" && <span className="text-muted-foreground">escolher produto</span>}
                    {l.produto_origem && (
                      <span className="text-muted-foreground">· {ORIGEM_LABEL[l.produto_origem] ?? l.produto_origem}</span>
                    )}
                    {l.tem_automacao && (
                      <Badge variant="outline" className="h-5 text-[10px] gap-1">
                        <Zap className="h-3 w-3" /> automação
                      </Badge>
                    )}
                    {l.permalink && (
                      <a
                        href={l.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" /> ver no Instagram
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    {conf === "media" && (
                      <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => setAlvo(l)}>
                        Confirmar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAlvo(l)}>
                      {conf === "nenhuma" ? "Escolher produto" : "Trocar produto"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <SecaoApelidos />

      {alvo && (
        <DialogProduto
          anuncio={alvo}
          usuario={user?.email ?? "painel"}
          onFechar={() => setAlvo(null)}
          onSalvo={() => {
            setAlvo(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function DialogProduto({
  anuncio,
  usuario,
  onFechar,
  onSalvo,
}: {
  anuncio: AnuncioLinha;
  usuario: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [termo, setTermo] = useState(anuncio.produto_nome ?? apelidoSugerido(anuncio.ad_name));
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [escolhido, setEscolhido] = useState<ProdutoBusca | null>(
    anuncio.produto_id ? { produto_id: anuncio.produto_id, nome: anuncio.produto_nome ?? "" } : null,
  );
  const [link, setLink] = useState("");
  const [modo, setModo] = useState<"sombra" | "automatico" | "desligado">("sombra");
  const [apelido, setApelido] = useState(apelidoSugerido(anuncio.ad_name));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (termo.trim().length < 2) return setResultados([]);
      setBuscando(true);
      const { data, error } = await db.rpc("fn_ig_buscar_produto_painel", { p_busca: termo, p_limite: 20 });
      if (error) toast.error(error.message);
      else setResultados((data ?? []) as ProdutoBusca[]);
      setBuscando(false);
    }, 350);
    return () => clearTimeout(t);
  }, [termo]);

  const salvar = async () => {
    if (!escolhido && !link.trim()) {
      return toast.error("Escolha um produto ou informe um link de campanha.");
    }
    setSalvando(true);
    const { data, error } = await db.rpc("fn_ig_anuncio_definir_produto", {
      p_media_id: anuncio.media_id,
      p_produto_id: escolhido?.produto_id ?? null,
      p_link: link.trim() || null,
      p_modo: modo,
      p_usuario: usuario,
      p_salvar_apelido: apelido.trim() || null,
    });
    setSalvando(false);
    if (error) return toast.error(error.message);
    const r: any = data ?? {};
    const respondeSozinho = r.decisao_agora === "automatico_fixo" || r.decisao_agora === "automatico_ia";
    toast.success(r.produto_nome || "Anúncio configurado", {
      description: respondeSozinho ? "Este anúncio já responde sozinho." : undefined,
    });
    onSalvo();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{anuncio.ad_name || "Anúncio sem nome"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Produto do anúncio</Label>
            <div className="relative mt-1">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Buscar por nome ou SKU"
                className="pl-8 h-9"
              />
            </div>
            <div className="mt-2 max-h-56 overflow-y-auto space-y-1">
              {buscando && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> buscando…
                </p>
              )}
              {resultados.map((p) => (
                <button
                  key={p.produto_id}
                  onClick={() => setEscolhido(p)}
                  className={`w-full text-left text-xs border rounded px-2 py-1.5 flex items-center gap-2 ${
                    escolhido?.produto_id === p.produto_id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <span className="flex-1 truncate">{p.nome}</span>
                  {p.disponivel === false && (
                    <Badge variant="outline" className="h-5 text-[10px] text-danger border-danger/30">
                      esgotado
                    </Badge>
                  )}
                  <span className="text-muted-foreground">{moeda(p.preco)}</span>
                </button>
              ))}
            </div>
            {escolhido && (
              <p className="text-xs mt-2 text-success flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> {escolhido.nome}
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs">Link de campanha (opcional)</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className="h-9 mt-1" />
          </div>

          <div>
            <Label className="text-xs">Ensinar apelido</Label>
            <Input value={apelido} onChange={(e) => setApelido(e.target.value)} className="h-9 mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">
              Todo anúncio futuro com este texto no nome ou na legenda já vem com este produto.
            </p>
          </div>

          <div>
            <Label className="text-xs">Modo de resposta</Label>
            <RadioGroup value={modo} onValueChange={(v) => setModo(v as typeof modo)} className="mt-1.5 space-y-1.5">
              {MODOS.map((m) => (
                <label key={m.valor} className="flex items-start gap-2 border rounded p-2 cursor-pointer text-xs">
                  <RadioGroupItem value={m.valor} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{m.titulo}</span>
                    <span className="block text-muted-foreground">{m.descricao}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onFechar}>
              Cancelar
            </Button>
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
