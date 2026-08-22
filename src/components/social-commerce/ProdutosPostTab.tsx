import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/socialCommerce";
import { CampoTags } from "./comum";
import { SeletorProdutos, carregarProdutosPai, type ProdutoPai } from "./SeletorProdutos";
import { formatarData } from "@/utils/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ImageOff, MessageSquare, Settings2, Star, Zap } from "lucide-react";

type Post = {
  media_id: string;
  permalink?: string | null;
  thumbnail_url?: string | null;
  caption?: string | null;
  data_publicacao?: string | null;
  comments_count?: number | null;
  reach?: number | null;
  views?: number | null;
};

type LinkProduto = { media_id: string; produto_id: string; principal?: boolean | null };

type Automacao = {
  media_id: string;
  modo?: string | null;
  palavras_gatilho?: string[] | null;
  resposta_gatilho_publica?: string | null;
  resposta_gatilho_dm?: string | null;
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
  gatilhos: string[];
  respostaPublica: string;
  respostaDm: string;
  ativo: boolean;
};

export function ProdutosPostTab() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [links, setLinks] = useState<LinkProduto[]>([]);
  const [automacoes, setAutomacoes] = useState<Map<string, Automacao>>(new Map());
  const [produtos, setProdutos] = useState<ProdutoPai[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [soSemProduto, setSoSemProduto] = useState(false);
  const [soAutomacaoAtiva, setSoAutomacaoAtiva] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const { data: ps } = await db
      .from("instagram_posts")
      .select("*")
      .order("data_publicacao", { ascending: false })
      .limit(300);
    const lista = (ps ?? []) as Post[];
    setPosts(lista);

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
        return true;
      }),
    [posts, soSemProduto, soAutomacaoAtiva, linksPorMedia, automacoes],
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
      gatilhos: auto?.palavras_gatilho ?? [],
      respostaPublica: auto?.resposta_gatilho_publica ?? "",
      respostaDm: auto?.resposta_gatilho_dm ?? "",
      ativo: auto?.ativo ?? false,
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
      const { error: errAuto } = await db.from("instagram_post_automacao").upsert(
        {
          media_id: mid,
          modo: edit.modo,
          palavras_gatilho: edit.modo === "automatico" ? edit.gatilhos : [],
          resposta_gatilho_publica: edit.modo === "automatico" ? edit.respostaPublica : null,
          resposta_gatilho_dm: edit.modo === "automatico" ? edit.respostaDm : null,
          produto_id: edit.principal,
          ativo: edit.ativo,
        },
        { onConflict: "media_id" },
      );
      if (errAuto) throw errAuto;

      toast.success("Post atualizado");
      setEdit(null);
      await carregar();
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
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt="Post do Instagram" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageOff className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  {auto?.ativo && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold">
                      <Zap className="h-3 w-3" /> {auto.modo === "automatico" ? "Automático" : auto.modo === "desligado" ? "Desligado" : "Sombra"}
                    </span>
                  )}
                </div>
                <CardContent className="p-3 flex-1 flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                    {p.caption || "(sem legenda)"}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{formatarData((p.data_publicacao ?? "").slice(0, 10))}</span>
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
          <DialogHeader>
            <DialogTitle className="font-serif">Produtos e automação do post</DialogTitle>
          </DialogHeader>
          {edit && (
            <>
              <ScrollArea className="flex-1 pr-4">
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
                        <div className="space-y-1.5">
                          <Label>Palavras-gatilho</Label>
                          <CampoTags
                            value={edit.gatilhos}
                            onChange={(v) => setEdit({ ...edit, gatilhos: v })}
                            placeholder="Ex.: EU QUERO, QUERO"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Maiúsculas, acentos e emojis são ignorados — "EU QUERO!!! 💛" casa com "eu quero".
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Resposta pública</Label>
                          <Textarea
                            value={edit.respostaPublica}
                            onChange={(e) =>
                              setEdit({ ...edit, respostaPublica: e.target.value.slice(0, 280) })
                            }
                            className="min-h-[50px]"
                            placeholder='Ex.: "Te mandei no Direct 💛"'
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Fica visível para todo mundo — preço e link vão no Direct.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Resposta no Direct</Label>
                          <Textarea
                            value={edit.respostaDm}
                            onChange={(e) => setEdit({ ...edit, respostaDm: e.target.value })}
                            className="min-h-[70px]"
                            placeholder="Mensagem privada com o link do produto…"
                          />
                        </div>
                      </>
                    )}
                  </section>
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-3 border-t">
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
