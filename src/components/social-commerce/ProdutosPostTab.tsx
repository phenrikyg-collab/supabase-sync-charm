import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "@/lib/socialCommerce";
import { CampoTags } from "./comum";
import { SeletorProdutos, carregarProdutosPai, type ProdutoPai } from "./SeletorProdutos";
import { BotaoGerarRespostas } from "./BotaoGerarRespostas";
import { ListaVariacoesRespostas } from "./ListaVariacoesRespostas";
import { carregarPostsPainel } from "./PostsNoAr";
import { SeletorObjetivoPost, objetivoInferido, type ObjetivoPost } from "./ObjetivoPost";
import { BlocoRespostasCompra, BlocoRespostasFallback } from "./RespostasCompraFallback";
import { formatarData } from "@/utils/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, ImageOff, Megaphone, MessageSquare, Settings2, Star, Zap } from "lucide-react";

type Post = {
  media_id: string;
  permalink?: string | null;
  thumb_cache_url?: string | null;
  thumbnail_url?: string | null;
  media_url?: string | null;
  imagem?: string | null;
  caption?: string | null;
  legenda_curta?: string | null;
  data_publicacao?: string | null;
  comments_count?: number | null;
  eh_anuncio?: boolean | null;
  tem_automacao?: boolean | null;
  automacao_ativa?: boolean | null;
  sem_texto?: boolean | null;
  reach?: number | null;
  views?: number | null;
};

/** Imagem do post com fallback (cache → thumbnail → mídia → imagem da view) e placeholder "Sem prévia". */
function ImagemPost({ post }: { post: Post }) {
  const [erro, setErro] = useState(false);
  const src = post.thumb_cache_url || post.thumbnail_url || post.media_url || post.imagem;
  if (!src || erro) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground/50">
        <ImageOff className="h-8 w-8" />
        <span className="text-[10px]">Sem prévia</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="Post do Instagram"
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setErro(true)}
    />
  );
}

/**
 * Automação ligada, com produto vinculado e sem texto salvo.
 * Usa o campo sem_texto da view quando disponível; senão calcula localmente.
 */
function semTextoDe(p: Post, auto?: Automacao, vinculos: LinkProduto[] = []): boolean {
  if (p.sem_texto != null) return !!p.sem_texto;
  if (!auto?.ativo || auto.modo !== "automatico" || vinculos.length === 0) return false;
  const semPublica = !(auto.respostas_publicas?.length || auto.resposta_gatilho_publica?.trim());
  // Objetivo conversa não usa Direct — só a resposta pública conta para "textos pendentes"
  const obj = objetivoInferido(auto.objetivo, !!(auto.resposta_gatilho_dm || auto.cupom || auto.link_combo));
  const semDm = obj === "venda" && !auto.resposta_gatilho_dm?.trim();
  return semPublica || semDm;
}

type LinkProduto = { media_id: string; produto_id: string; principal?: boolean | null };

type Automacao = {
  media_id: string;
  modo?: string | null;
  objetivo?: string | null;
  gatilho_qualquer?: boolean | null;
  palavras_gatilho?: string[] | null;
  resposta_gatilho_publica?: string | null;
  respostas_publicas?: string[] | null;
  /** 4.4 — resposta completa (pergunta de preço), com marcadores {PRODUTO} {PRECO}… */
  respostas_publicas_compra?: string[] | null;
  /** 4.5 — usadas só quando a Meta recusa o Direct */
  respostas_publicas_fallback?: string[] | null;
  resposta_gatilho_dm?: string | null;
  link_combo?: string | null;
  cupom?: string | null;
  cupom_beneficio?: string | null;
  cupom_validade?: string | null;
  produto_id?: string | null;
  ativo?: boolean | null;
  expira_em?: string | null;
  limite_hora?: number | null;
};

type EditState = {
  post: Post;
  selecionados: string[];
  principal: string | null;
  modo: string;
  objetivo: ObjetivoPost;
  qualquer: boolean;
  gatilhos: string[];
  respostasPublicas: string[];
  respostasCompra: string[];
  respostasFallback: string[];
  respostaDm: string;
  linkCombo: string;
  cupom: string;
  cupomBeneficio: string;
  cupomValidade: string;
  ativo: boolean;
  avisosIa: string[];
};

export function ProdutosPostTab() {
  const [params, setParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [links, setLinks] = useState<LinkProduto[]>([]);
  const [automacoes, setAutomacoes] = useState<Map<string, Automacao>>(new Map());
  const [produtos, setProdutos] = useState<ProdutoPai[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [soSemProduto, setSoSemProduto] = useState(false);
  const [soAutomacaoAtiva, setSoAutomacaoAtiva] = useState(false);
  const [soSemAutomacao, setSoSemAutomacao] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    // Fonte: vw_ig_posts_painel (inclui anúncios descobertos pelo backend).
    // carregarPostsPainel cai para instagram_posts se a view ainda não existir.
    const lista = [...(await carregarPostsPainel().catch((e) => {
      toast.error("Falha ao carregar posts", { description: e?.message });
      return [];
    }))].sort((a, b) => (b.data_publicacao ?? "").localeCompare(a.data_publicacao ?? ""));
    setPosts(lista as Post[]);

    const mediaIds = lista.map((p) => p.media_id).filter(Boolean);
    const promProdutos = carregarProdutosPai().catch((e) => {
      toast.error("Falha ao carregar produtos", { description: e?.message });
      return [] as ProdutoPai[];
    });
    if (mediaIds.length > 0) {
      const [{ data: ls }, { data: autos }, prods] = await Promise.all([
        db.from("instagram_post_produtos").select("*").in("media_id", mediaIds),
        db.from("instagram_post_automacao").select("*").in("media_id", mediaIds),
        promProdutos,
      ]);
      setLinks((ls ?? []) as LinkProduto[]);
      setAutomacoes(new Map((autos ?? []).map((a: any) => [a.media_id, a as Automacao])));
      setProdutos(prods);
    } else {
      setProdutos(await promProdutos);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Deep-link: ?media=<id> abre a configuração do post; ?filtro=sem_automacao liga o filtro.
  // Usado pelo alerta de anúncios da aba Comentários e pelos cards da visão "No ar".
  useEffect(() => {
    if (carregando) return;
    const mid = params.get("media");
    const filtro = params.get("filtro");
    if (!mid && !filtro) return;
    if (filtro === "sem_automacao") setSoSemAutomacao(true);
    if (mid) {
      const post = posts.find((p) => p.media_id === mid);
      if (post) abrirConfig(post);
      else toast.warning("Post não encontrado nesta lista.");
    }
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando]);

  const linksPorMedia = useMemo(() => {
    const m = new Map<string, LinkProduto[]>();
    for (const l of links) m.set(l.media_id, [...(m.get(l.media_id) ?? []), l]);
    return m;
  }, [links]);

  const produtosMap = useMemo(() => new Map(produtos.map((p) => [p.produto_id, p])), [produtos]);

  const totalVinculados = useMemo(
    () => posts.filter((p) => (linksPorMedia.get(p.media_id) ?? []).length > 0).length,
    [posts, linksPorMedia],
  );

  const filtrados = useMemo(
    () =>
      posts.filter((p) => {
        if (soSemProduto && (linksPorMedia.get(p.media_id) ?? []).length > 0) return false;
        if (soAutomacaoAtiva && !automacoes.get(p.media_id)?.ativo) return false;
        if (soSemAutomacao) {
          const ativo = p.tem_automacao != null ? !!p.automacao_ativa : !!automacoes.get(p.media_id)?.ativo;
          if (ativo) return false;
        }
        return true;
      }),
    [posts, soSemProduto, soAutomacaoAtiva, soSemAutomacao, linksPorMedia, automacoes],
  );

  /** Botão de pânico: liga/desliga a automação direto na grade, sem abrir modal. */
  const alternarAutomacao = async (post: Post, ativo: boolean) => {
    const atual = automacoes.get(post.media_id);
    const payload: Record<string, any> = atual
      ? { ...atual, ativo }
      : { media_id: post.media_id, modo: "sombra", ativo };
    const { error } = await db
      .from("instagram_post_automacao")
      .upsert(payload, { onConflict: "media_id" });
    if (error) {
      toast.error("Falha ao alterar automação", { description: error.message });
      return;
    }
    setAutomacoes((prev) => new Map(prev).set(post.media_id, { ...payload, media_id: post.media_id } as Automacao));
    toast.success(ativo ? "Automação ativada neste post" : "Automação desligada neste post");
  };

  const abrirConfig = (post: Post) => {
    const ls = linksPorMedia.get(post.media_id) ?? [];
    const auto = automacoes.get(post.media_id);
    setEdit({
      post,
      selecionados: ls.map((l) => l.produto_id),
      principal: ls.find((l) => l.principal)?.produto_id ?? null,
      modo: auto?.modo ?? "sombra",
      // Sem objetivo salvo: quem já tem Direct/cupom/combo configurado era venda; o resto, conversa
      objetivo: objetivoInferido(auto?.objetivo, !!(auto?.resposta_gatilho_dm || auto?.cupom || auto?.link_combo)),
      qualquer: auto?.gatilho_qualquer ?? false,
      gatilhos: auto?.palavras_gatilho ?? [],
      respostasPublicas:
        auto?.respostas_publicas?.length
          ? auto.respostas_publicas
          : auto?.resposta_gatilho_publica
            ? [auto.resposta_gatilho_publica]
            : [],
      respostasCompra: auto?.respostas_publicas_compra ?? [],
      respostasFallback: auto?.respostas_publicas_fallback ?? [],
      respostaDm: auto?.resposta_gatilho_dm ?? "",
      linkCombo: auto?.link_combo ?? "",
      cupom: auto?.cupom ?? "",
      cupomBeneficio: auto?.cupom_beneficio ?? "",
      cupomValidade: auto?.cupom_validade ?? "",
      ativo: auto?.ativo ?? false,
      avisosIa: [],
    });
  };

  const salvar = async () => {
    if (!edit || salvando) return;
    setSalvando(true);
    try {
      const mid = edit.post.media_id;

      // Produtos vinculados: recria os vínculos do post
      const { error: errDel } = await db.from("instagram_post_produtos").delete().eq("media_id", mid);
      if (errDel) throw errDel;
      if (edit.selecionados.length > 0) {
        const { error: errIns } = await db.from("instagram_post_produtos").insert(
          edit.selecionados.map((produto_id) => ({
            media_id: mid,
            produto_id,
            principal: produto_id === edit.principal,
          })),
        );
        if (errIns) throw errIns;
      }

      // Automação do post
      const variacoes = edit.respostasPublicas.map((v) => v.trim()).filter(Boolean);
      const compra = edit.respostasCompra.map((v) => v.trim()).filter(Boolean);
      const fallback = edit.respostasFallback.map((v) => v.trim()).filter(Boolean);
      const autoPayload: Record<string, any> = {
        media_id: mid,
        modo: edit.modo,
        objetivo: edit.objetivo,
        gatilho_qualquer: edit.modo === "automatico" ? edit.qualquer : false,
        palavras_gatilho: edit.modo === "automatico" ? edit.gatilhos : [],
        respostas_publicas: edit.modo === "automatico" ? variacoes : null,
        respostas_publicas_compra: edit.modo === "automatico" ? (compra.length ? compra : null) : null,
        respostas_publicas_fallback: edit.modo === "automatico" ? (fallback.length ? fallback : null) : null,
        // Compatibilidade: a primeira variação continua no campo antigo
        resposta_gatilho_publica: edit.modo === "automatico" ? variacoes[0] ?? null : null,
        resposta_gatilho_dm: edit.modo === "automatico" ? edit.respostaDm : null,
        link_combo: edit.modo === "automatico" ? edit.linkCombo.trim() || null : null,
        cupom: edit.modo === "automatico" ? edit.cupom.trim() || null : null,
        cupom_beneficio: edit.modo === "automatico" ? edit.cupomBeneficio.trim() || null : null,
        cupom_validade: edit.modo === "automatico" ? edit.cupomValidade.trim() || null : null,
        produto_id: edit.principal,
        ativo: edit.ativo,
      };
      let { error: errAuto } = await db
        .from("instagram_post_automacao")
        .upsert(autoPayload, { onConflict: "media_id" });
      // Colunas novas podem ainda não existir no banco — tenta de novo sem elas
      for (const coluna of ["respostas_publicas_compra", "respostas_publicas_fallback", "objetivo", "respostas_publicas", "gatilho_qualquer", "link_combo", "cupom_beneficio", "cupom_validade", "cupom"]) {
        if (errAuto && new RegExp(coluna, "i").test(errAuto.message ?? "")) {
          delete autoPayload[coluna];
          ({ error: errAuto } = await db
            .from("instagram_post_automacao")
            .upsert(autoPayload, { onConflict: "media_id" }));
        }
      }
      if (errAuto) throw errAuto;

      toast.success("Post atualizado");
      const editSalvo = edit;
      setEdit(null);
      await carregar();

      // Salvou com automação ativa, produto vinculado e sem texto: o backend
      // escreve na hora do primeiro comentário — mas oferece gerar agora p/ revisão.
      const ficouSemTexto =
        editSalvo.ativo &&
        editSalvo.modo === "automatico" &&
        editSalvo.selecionados.length > 0 &&
        (variacoes.length === 0 || (editSalvo.objetivo === "venda" && !editSalvo.respostaDm.trim()));
      if (ficouSemTexto) {
        toast.warning("Automação ativa sem textos de resposta.", {
          description: "A Anna vai escrever no primeiro comentário — ou gere agora e revise.",
          duration: 12000,
          action: {
            label: "Gerar respostas agora",
            onClick: () => setEdit({ ...editSalvo, avisosIa: [] }),
          },
        });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={soSemProduto} onCheckedChange={(v) => setSoSemProduto(!!v)} />
          Somente posts sem produto vinculado
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={soAutomacaoAtiva} onCheckedChange={(v) => setSoAutomacaoAtiva(!!v)} />
          Somente posts com automação ativa
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={soSemAutomacao} onCheckedChange={(v) => setSoSemAutomacao(!!v)} />
          Somente posts sem automação ativa
        </label>
        <span className="text-xs text-muted-foreground ml-auto">
          {totalVinculados} de {posts.length} posts vinculados
        </span>
      </div>

      {carregando ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            <ImageOff className="h-8 w-8 mx-auto mb-2 opacity-40" />
            {soSemProduto
              ? "Tudo vinculado — não há posts sem produto."
              : "Nenhum post encontrado neste filtro."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtrados.map((p) => {
            const ls = linksPorMedia.get(p.media_id) ?? [];
            const auto = automacoes.get(p.media_id);
            return (
              <Card key={p.media_id} className="overflow-hidden flex flex-col">
                <div className="aspect-square bg-muted relative">
                  <ImagemPost post={p} />
                  {p.eh_anuncio && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-foreground text-background px-2 py-0.5 text-[10px] font-semibold">
                      <Megaphone className="h-3 w-3" /> Anúncio
                    </span>
                  )}
                  {auto?.ativo && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold">
                      <Zap className="h-3 w-3" /> {auto.modo === "automatico" ? "Automático" : auto.modo === "desligado" ? "Desligado" : "Sombra"}
                    </span>
                  )}
                </div>
                <CardContent className="p-3 flex-1 flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                    {p.caption || p.legenda_curta || "(sem legenda)"}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{formatarData((p.data_publicacao ?? "").slice(0, 10))}</span>
                    {p.permalink && (
                      <a
                        href={p.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> Ver no Instagram
                      </a>
                    )}
                    {(p.comments_count ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3" /> {p.comments_count}
                      </span>
                    )}
                  </div>

                  {/* Produtos vinculados */}
                  <div className="flex flex-wrap gap-1">
                    {ls.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground italic">Sem produto vinculado</span>
                    ) : (
                      ls.map((l) => {
                        const prod = produtosMap.get(l.produto_id);
                        return (
                          <Badge key={l.produto_id} variant="secondary" className="text-[10px] font-normal gap-0.5">
                            {l.principal && <Star className="h-2.5 w-2.5 fill-warning text-warning" />}
                            {prod?.nome ?? "Produto"}
                          </Badge>
                        );
                      })
                    )}
                  </div>

                  {/* Selo: automação ligada sem texto salvo — a Anna escreve na hora */}
                  {semTextoDe(p, auto, ls) && (
                    <p className="text-[10px] rounded border border-warning/30 bg-warning/10 p-1.5 flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-px" />
                      <span>Sem resposta salva. A Anna vai escrever no primeiro comentário.</span>
                    </p>
                  )}

                  <div className="mt-auto pt-2 border-t flex items-center justify-between gap-2">
                    {/* Botão de pânico: um clique desliga a campanha */}
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                      <Switch
                        checked={!!auto?.ativo}
                        onCheckedChange={(v) => alternarAutomacao(p, v)}
                        className="scale-90"
                      />
                      Automação
                    </label>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => abrirConfig(p)}>
                      <Settings2 className="h-3.5 w-3.5 mr-1" /> Configurar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de configuração */}
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-serif">Produtos e automação do post</DialogTitle>
          </DialogHeader>
          {edit && (
            <>
              <div className="max-h-[calc(90vh-140px)] overflow-y-auto pr-4">
                <div className="space-y-5 pb-4">
                  {/* Produtos */}
                  <section className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Produtos vinculados
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Marque os produtos do post. A estrela indica o produto principal (vai na resposta automática).
                    </p>
                    <SeletorProdutos
                      produtos={produtos}
                      selecionados={edit.selecionados}
                      onToggle={(id, marcado) =>
                        setEdit({
                          ...edit,
                          selecionados: marcado
                            ? [...edit.selecionados, id]
                            : edit.selecionados.filter((x) => x !== id),
                          principal: edit.principal === id && !marcado ? null : edit.principal,
                        })
                      }
                      principal={edit.principal}
                      onPrincipalChange={(id) => setEdit({ ...edit, principal: id })}
                    />
                  </section>

                  {/* Automação */}
                  <section className="space-y-3 rounded-lg border-2 border-primary/20 bg-primary/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Automação de resposta
                      </p>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} />
                        Ativa
                      </label>
                    </div>

                    <SeletorObjetivoPost
                      value={edit.objetivo}
                      onChange={(v) => setEdit({ ...edit, objetivo: v })}
                    />

                    <div className="space-y-1.5">
                      <Label>Modo</Label>
                      <Select value={edit.modo} onValueChange={(v) => setEdit({ ...edit, modo: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sombra">Modo sombra — Anna redige, equipe aprova</SelectItem>
                          <SelectItem value="automatico">Automático — Anna responde sozinha</SelectItem>
                          <SelectItem value="desligado">Desligado — nenhuma resposta automática</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {edit.modo === "automatico" && (
                      <>
                        <p className="text-[11px] rounded border border-warning/30 bg-warning/10 p-2">
                          Comentários que <strong>não</strong> baterem a palavra-chave serão respondidos
                          pela Anna automaticamente, sem aprovação.
                        </p>
                        {edit.objetivo === "conversa" && (
                          <p className="text-[11px] rounded border border-border bg-muted/50 p-2">
                            Objetivo <strong>conversa</strong>: a Anna responde só no comentário.
                            Mensagem de Direct, card e cupom ficam desligados — quem pedir preço
                            continua sendo atendido normalmente.
                          </p>
                        )}
                        {edit.objetivo === "venda" && (
                          <>
                            <div className="space-y-1.5">
                              <Label>Link do combo (card do Direct)</Label>
                              <Input
                                type="url"
                                value={edit.linkCombo}
                                onChange={(e) => setEdit({ ...edit, linkCombo: e.target.value })}
                                placeholder="https://…"
                              />
                              <p className="text-[10px] text-muted-foreground">
                                Use quando o post vende um combo com página própria. Vazio = usa os links individuais das peças.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1.5">
                                <Label>Cupom</Label>
                                <Input
                                  value={edit.cupom}
                                  onChange={(e) => setEdit({ ...edit, cupom: e.target.value })}
                                  placeholder="Ex.: COMBOANNA"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>O que o cupom dá</Label>
                                <Input
                                  value={edit.cupomBeneficio}
                                  onChange={(e) => setEdit({ ...edit, cupomBeneficio: e.target.value })}
                                  placeholder="Ex.: R$50 de desconto"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Validade</Label>
                                <Input
                                  value={edit.cupomValidade}
                                  onChange={(e) => setEdit({ ...edit, cupomValidade: e.target.value })}
                                  placeholder="Ex.: válidos até amanhã"
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground -mt-1">
                              Vazio = a mensagem sai sem a linha de cupom.
                            </p>
                          </>
                        )}
                        {edit.ativo &&
                          edit.selecionados.length > 0 &&
                          (edit.respostasPublicas.every((v) => !v.trim()) ||
                            (edit.objetivo === "venda" && !edit.respostaDm.trim())) && (
                            <p className="text-[11px] rounded border border-warning/30 bg-warning/10 p-2 flex items-start gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-px" />
                              <span>
                                Sem resposta salva. A Anna vai escrever no primeiro comentário — gere agora
                                com o botão abaixo e revise antes.
                              </span>
                            </p>
                          )}
                        <div>
                          <BotaoGerarRespostas
                            produtoIds={edit.selecionados}
                            gatilhos={edit.gatilhos}
                            objetivo={edit.objetivo}
                            mediaId={edit.post.media_id}
                            linkCombo={edit.linkCombo}
                            cupom={edit.cupom}
                            cupomBeneficio={edit.cupomBeneficio}
                            cupomValidade={edit.cupomValidade}
                            onResultado={(r) =>
                              setEdit({
                                ...edit,
                                respostasPublicas: r.respostasPublicas.map((v) => v.slice(0, 280)),
                                respostaDm: r.respostaDm,
                                avisosIa: r.avisos,
                              })
                            }
                          />
                        </div>
                        <label className="flex items-start gap-2 text-xs cursor-pointer">
                          <Checkbox
                            checked={edit.qualquer}
                            onCheckedChange={(v) => setEdit({ ...edit, qualquer: !!v })}
                            className="mt-0.5"
                          />
                          <span>
                            Responder qualquer comentário
                            {edit.qualquer && (
                              <span className="block text-[10px] text-muted-foreground mt-0.5">
                                Todos os comentários recebem a resposta fixa, a palavra-chave não é usada.
                              </span>
                            )}
                          </span>
                        </label>
                        <div className="space-y-1.5">
                          <Label>Palavras-gatilho</Label>
                          <CampoTags
                            value={edit.gatilhos}
                            onChange={(v) => setEdit({ ...edit, gatilhos: v })}
                            placeholder="Ex.: EU QUERO, QUERO"
                            disabled={edit.qualquer}
                          />
                          {!edit.qualquer && (
                            <p className="text-[10px] text-muted-foreground">
                              Maiúsculas, acentos e emojis são ignorados — "EU QUERO!!! 💛" casa com "eu quero".
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <ListaVariacoesRespostas
                            value={edit.respostasPublicas}
                            onChange={(v) => setEdit({ ...edit, respostasPublicas: v })}
                          />
                          {edit.avisosIa.map((aviso, i) => (
                            <p key={i} className="text-[11px] rounded border border-warning/30 bg-warning/10 p-2 flex items-start gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-px" />
                              <span>{aviso}</span>
                            </p>
                          ))}
                        </div>
                        <BlocoRespostasCompra
                          value={edit.respostasCompra}
                          onChange={(v) => setEdit({ ...edit, respostasCompra: v })}
                          produto={produtos.find((p: any) => (p.produto_id ?? p.id) === edit.principal) ?? null}
                          combo={edit.selecionados.length > 1}
                        />
                        <BlocoRespostasFallback
                          value={edit.respostasFallback}
                          onChange={(v) => setEdit({ ...edit, respostasFallback: v })}
                        />
                        {edit.objetivo === "venda" && (
                          <div className="space-y-1.5">
                            <Label>Resposta no Direct</Label>
                            <Textarea
                              value={edit.respostaDm}
                              onChange={(e) => setEdit({ ...edit, respostaDm: e.target.value })}
                              className="min-h-[70px]"
                              placeholder="Mensagem privada com o link do produto…"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </section>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t shrink-0">
                <Button variant="outline" onClick={() => setEdit(null)} disabled={salvando}>
                  Cancelar
                </Button>
                <Button onClick={salvar} disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
