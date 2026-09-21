import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ChevronDown, ChevronUp, Film, ImageOff, Link as LinkIcon, Loader2, Package, Plus, Search, Trash2, Upload } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/financeiroFormat";
import { whatsappParaHtml } from "@/lib/vip";
import { cn } from "@/lib/utils";
import { rpcFluxos, type Catalogo } from "./api";

export type FormatoJanela = "texto" | "botoes" | "video" | "link" | "vitrine";

type Figurinha = {
  intent_tag: string;
  label?: string | null;
  media_url?: string | null;
};

type ProdutoCatalogo = {
  retailer_id: string;
  nome?: string | null;
  categoria?: string | null;
  imagem_url?: string | null;
  url?: string | null;
  preco?: number | null;
  preco_promocional?: number | null;
  promo_vigente?: boolean | null;
  disponibilidade?: string | null;
  no_catalogo?: boolean | null;
  atualizado_em?: string | null;
  posicao?: number | null;
};

type EstadoCatalogo = {
  total?: number | null;
  em_estoque?: number | null;
  fora_catalogo?: number | null;
  ultima_ok?: string | null;
  ultimo_erro?: string | null;
};

const MAX_VIDEO = 16 * 1024 * 1024;
const MAX_PRODUTOS = 30;

const listaTextos = (valor: unknown) =>
  Array.isArray(valor) ? valor.map((item) => String(item ?? "")).filter(Boolean) : [];

export function formatoDaConfig(config: Record<string, any>): FormatoJanela {
  const salvo = String(config.formato_editor ?? "");
  if (["texto", "botoes", "video", "link", "vitrine"].includes(salvo)) return salvo as FormatoJanela;
  if (config.vitrine?.produtos?.length) return "vitrine";
  if (listaTextos(config.botoes_resposta).length) return "botoes";
  if (config.video?.url) return "video";
  if (config.botao_url || config.botao_texto) return "link";
  return "texto";
}

export function errosWhatsappJanela(config: Record<string, any>): string[] {
  const erros: string[] = [];
  const formato = formatoDaConfig(config);
  const botoes = listaTextos(config.botoes_resposta);
  const produtos = listaTextos(config.vitrine?.produtos);
  if (botoes.length > 3) erros.push("Use no máximo 3 botões de resposta.");
  if (botoes.some((botao) => botao.length > 20)) erros.push("Cada botão de resposta pode ter até 20 caracteres.");
  if (String(config.botao_texto ?? "").length > 20) erros.push("O texto do botão de link pode ter até 20 caracteres.");
  if (formato === "video" && String(config.texto ?? "").length > 1024) erros.push("A legenda do vídeo pode ter até 1.024 caracteres.");
  if (String(config.vitrine?.header ?? "").length > 60) erros.push("O título da vitrine pode ter até 60 caracteres.");
  if (String(config.vitrine?.footer ?? "").length > 60) erros.push("O rodapé da vitrine pode ter até 60 caracteres.");
  if (String(config.vitrine?.secao ?? "").length > 24) erros.push("O nome da seção pode ter até 24 caracteres.");
  if (formato === "vitrine" && produtos.length === 0) erros.push("Escolha pelo menos 1 produto para a vitrine.");
  if (produtos.length > MAX_PRODUTOS) erros.push("A vitrine pode ter até 30 produtos.");
  return erros;
}

/** O banco pode não ter a função de catálogo publicada ainda. */
function funcaoIndisponivel(error: any): boolean {
  const codigo = String(error?.code ?? "");
  const msg = String(error?.message ?? "").toLowerCase();
  return codigo === "PGRST202" || codigo === "42883" || msg.includes("does not exist");
}

type RespostaCatalogo = { produtos: ProdutoCatalogo[]; indisponivel: boolean };

async function listarProdutosCatalogo(busca: string, soEstoque: boolean): Promise<RespostaCatalogo> {
  const { data, error } = await supabase.rpc("whatsapp_catalogo_produtos_listar" as any, {
    p_busca: busca,
    p_so_estoque: soEstoque,
    p_limite: 300,
  });
  if (error) {
    if (funcaoIndisponivel(error)) return { produtos: [], indisponivel: true };
    throw error;
  }
  return { produtos: (data ?? []) as unknown as ProdutoCatalogo[], indisponivel: false };
}

async function produtosCatalogoPorIds(ids: string[]): Promise<ProdutoCatalogo[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc("whatsapp_catalogo_produtos_por_ids" as any, { p_ids: ids });
  if (error) {
    if (funcaoIndisponivel(error)) return [];
    throw error;
  }
  return (data ?? []) as unknown as ProdutoCatalogo[];
}

function PrecoProduto({ produto, compacto = false }: { produto: ProdutoCatalogo; compacto?: boolean }) {
  const promocional = produto.promo_vigente && produto.preco_promocional != null;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-1.5", compacto ? "text-[10px]" : "text-xs")}>
      {promocional && produto.preco != null && <span className="text-muted-foreground line-through">{brl(produto.preco)}</span>}
      <span className={cn("font-medium", promocional && "text-success")}>
        {brl(promocional ? produto.preco_promocional : produto.preco)}
      </span>
    </div>
  );
}

function ImagemProduto({ produto, className }: { produto: ProdutoCatalogo; className: string }) {
  return produto.imagem_url ? (
    <img src={produto.imagem_url} alt="" className={cn(className, "bg-muted object-cover")} />
  ) : (
    <div className={cn(className, "flex items-center justify-center bg-muted text-muted-foreground")}><ImageOff className="h-5 w-5" /></div>
  );
}

function Contador({ atual, limite }: { atual: number; limite: number }) {
  return <span className={cn("text-[10px] text-muted-foreground", atual > limite && "font-medium text-danger")}>{atual}/{limite}</span>;
}

function CampoComContador({
  rotulo, valor, limite, onChange, placeholder,
}: {
  rotulo: string;
  valor: string;
  limite: number;
  onChange: (valor: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2"><Label className="text-xs">{rotulo}</Label><Contador atual={valor.length} limite={limite} /></div>
      <Input value={valor} maxLength={limite} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function PreviaWhatsappJanela({ config, compacta = false }: { config: Record<string, any>; compacta?: boolean }) {
  const formato = formatoDaConfig(config);
  const texto = String(config.texto ?? "")
    .split("{{primeiro_nome}}").join("Mariana")
    .split("{{cupom_unico}}").join("MC-EXEMPLO");
  const botoes = listaTextos(config.botoes_resposta);
  const produtos = listaTextos(config.vitrine?.produtos);
  const video = String(config.video?.url ?? "");
  const { data: produtoCapa } = useQuery({
    queryKey: ["whatsapp-catalogo-produto-capa", produtos[0]],
    queryFn: async () => (await produtosCatalogoPorIds([produtos[0]]))[0],
    enabled: formato === "vitrine" && !!produtos[0],
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className={cn("rounded-lg bg-sidebar p-2", compacta ? "w-full" : "p-3")}>
      <div className="overflow-hidden rounded-md rounded-tl-none bg-success text-success-foreground shadow-sm">
        {(formato === "video" || formato === "botoes") && video && (
          <div className="relative aspect-video bg-muted">
            <video src={video} muted preload="metadata" className="h-full w-full object-cover" />
            <Film className="absolute left-2 top-2 h-4 w-4 text-foreground" />
          </div>
        )}
        {formato === "vitrine" && (
          <div className="space-y-2 bg-card p-2 text-card-foreground">
            {produtoCapa?.imagem_url ? <img src={produtoCapa.imagem_url} alt="" className="aspect-[16/9] w-full rounded bg-muted object-cover" /> : <div className="flex aspect-[16/9] items-center justify-center rounded bg-muted"><Package className="h-8 w-8 text-muted-foreground" /></div>}
            <p className="text-xs font-semibold">{config.vitrine?.header || "Vitrine de produtos"}</p>
            <p className="text-[10px] text-muted-foreground">
              {produtoCapa?.nome || (produtos[0] ? `Produto ${produtos[0]}` : "O primeiro produto define a miniatura")}
            </p>
            {config.vitrine?.secao && <p className="text-[10px] font-medium">{config.vitrine.secao}</p>}
          </div>
        )}
        {(formato !== "vitrine" || texto) && (
          <div
            className={cn("break-words p-2 text-xs leading-relaxed", !compacta && "text-sm")}
            dangerouslySetInnerHTML={{ __html: whatsappParaHtml(texto) || "<em>Sem texto</em>" }}
          />
        )}
        {formato === "link" && (
          <div className="border-t border-success-foreground/20 px-2 py-2 text-center text-xs font-medium">
            <LinkIcon className="mr-1 inline h-3.5 w-3.5" />{config.botao_texto || "Abrir link"}
          </div>
        )}
        {formato === "botoes" && botoes.length > 0 && (
          <div className="border-t border-success-foreground/20">
            {botoes.map((botao, i) => (
              <div key={`${botao}-${i}`} className="border-b border-success-foreground/20 px-2 py-2 text-center text-xs font-medium last:border-b-0">
                {botao}
              </div>
            ))}
          </div>
        )}
        {formato === "vitrine" && config.vitrine?.footer && (
          <p className="bg-card px-2 pb-2 text-[10px] text-muted-foreground">{config.vitrine.footer}</p>
        )}
      </div>
      {config.figurinha && <p className="mt-1.5 text-[10px] text-sidebar-foreground">Depois: figurinha {String(config.figurinha)}</p>}
    </div>
  );
}

function EditorBotoes({ config, patch }: { config: Record<string, any>; patch: (p: Record<string, any>) => void }) {
  const botoes = listaTextos(config.botoes_resposta);
  const mudar = (indice: number, texto: string) => patch({ botoes_resposta: botoes.map((b, i) => i === indice ? texto : b) });
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2"><Label className="text-xs">Botões de resposta</Label><Contador atual={botoes.length} limite={3} /></div>
      {botoes.map((botao, indice) => (
        <div key={indice} className="flex items-center gap-1.5">
          <Input className="min-w-0" value={botao} maxLength={20} placeholder={`Botão ${indice + 1}`} onChange={(e) => mudar(indice, e.target.value)} />
          <Contador atual={botao.length} limite={20} />
          <Button size="icon" variant="ghost" aria-label={`Remover botão ${indice + 1}`} onClick={() => patch({ botoes_resposta: botoes.filter((_, i) => i !== indice) })}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" className="w-full" disabled={botoes.length >= 3} onClick={() => patch({ botoes_resposta: [...botoes, ""] })}>
        <Plus className="mr-2 h-4 w-4" />Adicionar botão
      </Button>
      <p className="text-[11px] text-muted-foreground">Cada botão vira uma saída no passo Aguardar botão.</p>
    </div>
  );
}

function EditorVideo({ config, patch, opcional = false }: { config: Record<string, any>; patch: (p: Record<string, any>) => void; opcional?: boolean }) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [enviando, setEnviando] = useState(false);
  const url = String(config.video?.url ?? "");
  const subir = async (arquivo?: File) => {
    if (!arquivo) return;
    const nome = arquivo.name.toLowerCase();
    if (!nome.endsWith(".mp4") && !nome.endsWith(".3gp")) {
      toast({ title: "Use um vídeo MP4 ou 3GP", variant: "destructive" });
      return;
    }
    if (arquivo.size > MAX_VIDEO) {
      toast({ title: "O vídeo passa de 16 MB", variant: "destructive" });
      return;
    }
    setEnviando(true);
    try {
      const ext = nome.endsWith(".3gp") ? "3gp" : "mp4";
      const path = `automacoes/videos/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("mc-imagens").upload(path, arquivo, {
        contentType: arquivo.type || (ext === "3gp" ? "video/3gpp" : "video/mp4"),
        cacheControl: "31536000",
        upsert: true,
      });
      if (error) throw error;
      const publicUrl = supabase.storage.from("mc-imagens").getPublicUrl(path).data.publicUrl;
      patch({ video: { ...(config.video ?? {}), url: publicUrl } });
      toast({ title: "Vídeo enviado" });
    } catch (e: any) {
      toast({ title: "Não deu para enviar o vídeo", description: e.message, variant: "destructive" });
    } finally {
      setEnviando(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <div className="space-y-2">
      <Label className="text-xs">{opcional ? "Vídeo no cabeçalho (opcional)" : "Vídeo"}</Label>
      {url && <video src={url} muted controls preload="metadata" className="aspect-video w-full rounded-md border border-border bg-muted object-cover" />}
      <div className="flex gap-2">
        <Input className="min-w-0" value={url} placeholder="URL do vídeo" onChange={(e) => patch({ video: { ...(config.video ?? {}), url: e.target.value } })} />
        <Button size="icon" variant="outline" disabled={enviando} onClick={() => ref.current?.click()} aria-label="Enviar vídeo">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
      </div>
      <input ref={ref} type="file" className="hidden" accept="video/mp4,video/3gpp,.mp4,.3gp" onChange={(e) => subir(e.target.files?.[0])} />
      <p className="text-[11px] text-muted-foreground">MP4 ou 3GP, até 16 MB. A Meta não aceita MOV.</p>
    </div>
  );
}

function SeletorProdutosCatalogo({ ids, onConfirmar }: { ids: string[]; onConfirmar: (ids: string[]) => void }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [soEstoque, setSoEstoque] = useState(true);
  const [selecionados, setSelecionados] = useState<string[]>(ids);
  const [codigo, setCodigo] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setBuscaDebounced(busca.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    if (aberto) setSelecionados(ids);
  }, [aberto, ids]);

  const { data: resposta, isLoading } = useQuery({
    queryKey: ["whatsapp-catalogo-produtos", buscaDebounced, soEstoque],
    queryFn: () => listarProdutosCatalogo(buscaDebounced, soEstoque),
    enabled: aberto,
    staleTime: 60 * 1000,
  });
  const produtos = resposta?.produtos ?? [];
  const catalogoIndisponivel = !!resposta?.indisponivel;

  const alternar = (id: string) => {
    if (selecionados.includes(id)) return setSelecionados((atuais) => atuais.filter((item) => item !== id));
    if (selecionados.length >= MAX_PRODUTOS) {
      toast({ title: "A vitrine aceita no máximo 30 produtos" });
      return;
    }
    setSelecionados((atuais) => [...atuais, id]);
  };

  const adicionarCodigo = () => {
    const id = codigo.trim();
    if (!id || selecionados.includes(id)) return;
    if (selecionados.length >= MAX_PRODUTOS) {
      toast({ title: "A vitrine aceita no máximo 30 produtos" });
      return;
    }
    setSelecionados((atuais) => [...atuais, id]);
    setCodigo("");
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setAberto(true)}>
        <Package className="mr-2 h-4 w-4" />Escolher produtos
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Escolher produtos</DialogTitle>
            <DialogDescription>Selecione e confirme os produtos que vão aparecer na vitrine.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou código" className="pl-9" />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <Label htmlFor="catalogo-so-estoque" className="text-xs">Só em estoque</Label>
              <Switch id="catalogo-so-estoque" checked={soEstoque} onCheckedChange={setSoEstoque} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="space-y-2 rounded-md border border-border p-2"><Skeleton className="aspect-[3/4] w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-2/5" /></div>)}
              </div>
            ) : produtos.length === 0 ? (
              <div className="flex min-h-52 items-center justify-center px-4 text-center text-sm text-muted-foreground">Nenhum produto do catálogo bate com a busca.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {produtos.map((produto) => {
                  const selecionado = selecionados.includes(produto.retailer_id);
                  const bloqueado = !selecionado && selecionados.length >= MAX_PRODUTOS;
                  return (
                    <Button type="button" key={produto.retailer_id} variant="outline" disabled={bloqueado} onClick={() => alternar(produto.retailer_id)} className={cn("relative block h-auto overflow-hidden whitespace-normal rounded-md bg-card p-2 text-left transition-colors", selecionado ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50", bloqueado && "cursor-not-allowed opacity-50")}>
                      <ImagemProduto produto={produto} className="aspect-[3/4] w-full rounded" />
                      {selecionado && <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-4 w-4" /></span>}
                      <p className="mt-2 truncate text-xs font-medium" title={produto.nome || produto.retailer_id}>{produto.nome || produto.retailer_id}</p>
                      <PrecoProduto produto={produto} compacto />
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="rounded-md border border-dashed border-border p-2">
            <Label className="text-[11px] text-muted-foreground">Adicionar por código</Label>
            <div className="mt-1 flex gap-2">
              <Input className="h-8 min-w-0 text-xs" value={codigo} onChange={(e) => setCodigo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarCodigo(); } }} placeholder="retailer_id" />
              <Button type="button" size="sm" variant="secondary" className="h-8" disabled={!codigo.trim() || selecionados.length >= MAX_PRODUTOS} onClick={adicionarCodigo}>Adicionar</Button>
            </div>
          </div>
          {selecionados.length >= MAX_PRODUTOS && <p className="text-xs text-warning">Limite de 30 produtos atingido. Remova um produto para escolher outro.</p>}
          <DialogFooter className="items-center gap-2 sm:justify-between sm:space-x-0">
            <span className="text-xs text-muted-foreground">{selecionados.length} de 30 selecionados</span>
            <Button type="button" disabled={selecionados.length === 0} onClick={() => { onConfirmar(selecionados); setAberto(false); }}>Confirmar produtos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EstadoEspelhoCatalogo() {
  const { data } = useQuery({
    queryKey: ["whatsapp-catalogo-espelho-estado"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_catalogo_espelho_estado" as any);
      if (error) throw error;
      return ((data as unknown as EstadoCatalogo[] | null)?.[0] ?? data ?? null) as EstadoCatalogo | null;
    },
    staleTime: 60 * 1000,
  });
  if (!data) return null;
  const ultimaOk = data.ultima_ok ? new Date(data.ultima_ok) : null;
  const atrasado = !!data.ultimo_erro && (!ultimaOk || Date.now() - ultimaOk.getTime() > 48 * 60 * 60 * 1000);
  const atualizado = ultimaOk && !Number.isNaN(ultimaOk.getTime()) ? formatDistanceToNow(ultimaOk, { locale: ptBR }) : "sem sincronização recente";
  return <p className={cn("text-[11px] text-muted-foreground", atrasado && "font-medium text-warning")}>Catálogo espelhado: {Number(data.total ?? 0).toLocaleString("pt-BR")} produtos, atualizado há {atualizado}{atrasado ? ". Verifique a última sincronização." : ""}</p>;
}

function EditorVitrine({ config, patch }: { config: Record<string, any>; patch: (p: Record<string, any>) => void }) {
  const vitrine = config.vitrine && typeof config.vitrine === "object" ? config.vitrine : {};
  const produtos = listaTextos(vitrine.produtos);
  const atualizar = (p: Record<string, any>) => patch({ vitrine: { ...vitrine, ...p } });
  const { data: encontrados = [], isLoading } = useQuery({
    queryKey: ["whatsapp-catalogo-produtos-salvos", produtos],
    queryFn: () => produtosCatalogoPorIds(produtos),
    enabled: produtos.length > 0,
    staleTime: 60 * 1000,
  });
  const porId = useMemo(() => new Map(encontrados.map((produto) => [produto.retailer_id, produto])), [encontrados]);
  const mover = (indice: number, direcao: -1 | 1) => {
    const destino = indice + direcao;
    if (destino < 0 || destino >= produtos.length) return;
    const novos = [...produtos];
    [novos[indice], novos[destino]] = [novos[destino], novos[indice]];
    atualizar({ produtos: novos });
  };
  return (
    <div className="space-y-3">
      <CampoComContador rotulo="Título" valor={String(vitrine.header ?? "")} limite={60} onChange={(header) => atualizar({ header })} />
      <CampoComContador rotulo="Rodapé" valor={String(vitrine.footer ?? "")} limite={60} onChange={(footer) => atualizar({ footer })} />
      <CampoComContador rotulo="Nome da seção" valor={String(vitrine.secao ?? "")} limite={24} onChange={(secao) => atualizar({ secao })} />
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2"><Label className="text-xs">Produtos</Label><Contador atual={produtos.length} limite={30} /></div>
        {isLoading && produtos.length > 0 ? Array.from({ length: Math.min(produtos.length, 3) }).map((_, i) => <Skeleton key={i} className="h-[74px] w-full rounded-md" />) : produtos.map((id, indice) => {
          const produto = porId.get(id);
          const saiuCatalogo = !produto;
          return (
            <div key={`${id}-${indice}`} className={cn("flex min-w-0 items-center gap-2 rounded-md border border-border p-2", saiuCatalogo && "bg-muted/50 text-muted-foreground")}>
              {produto ? <ImagemProduto produto={produto} className="h-14 w-14 shrink-0 rounded-md" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted"><ImageOff className="h-5 w-5" /></div>}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-xs font-medium" title={produto?.nome || id}>{produto?.nome || id}</p>
                  {indice === 0 && <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[9px]">capa</Badge></TooltipTrigger><TooltipContent className="max-w-56 text-xs">A foto deste produto é a miniatura que a cliente vê antes de abrir a vitrine.</TooltipContent></Tooltip></TooltipProvider>}
                </div>
                {produto ? <PrecoProduto produto={produto} compacto /> : <p className="text-[10px] font-medium text-destructive">Saiu do catálogo</p>}
              </div>
              <div className="flex shrink-0 items-center">
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={indice === 0} onClick={() => mover(indice, -1)} aria-label="Mover produto para cima"><ChevronUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={indice === produtos.length - 1} onClick={() => mover(indice, 1)} aria-label="Mover produto para baixo"><ChevronDown className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant={saiuCatalogo ? "destructive" : "ghost"} className="h-8 w-8" onClick={() => atualizar({ produtos: produtos.filter((_, i) => i !== indice) })} aria-label="Remover produto"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          );
        })}
        {produtos.length === 0 && <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Nenhum produto escolhido.</div>}
        <SeletorProdutosCatalogo ids={produtos} onConfirmar={(novos) => atualizar({ produtos: novos })} />
        <p className="text-[11px] text-muted-foreground">A ordem importa: o primeiro produto define a miniatura da vitrine.</p>
        <EstadoEspelhoCatalogo />
      </div>
    </div>
  );
}

function OpcoesJanela({ config, catalogo, patch, templateReserva }: { config: Record<string, any>; catalogo?: Catalogo; patch: (p: Record<string, any>) => void; templateReserva: React.ReactNode }) {
  const cupomAtivo = config.cupom === "unico";
  const { data: figurinhas = [] } = useQuery({
    queryKey: ["vw-figurinhas", "automacoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_figurinhas" as any).select("intent_tag,label,media_url");
      if (error) throw error;
      return (data ?? []) as unknown as Figurinha[];
    },
  });
  const { data: catalogoWhatsapp } = useQuery({
    queryKey: ["whatsapp-catalogo-ler"],
    queryFn: () => rpcFluxos<any>("whatsapp_catalogo_ler"),
    retry: false,
  });
  const figurinha = figurinhas.find((f) => f.intent_tag === config.figurinha);
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="opcoes" className="rounded-md border border-border px-3">
        <AccordionTrigger className="py-3 text-xs hover:no-underline">Opções</AccordionTrigger>
        <AccordionContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Figurinha enviada depois</Label>
            <Select value={config.figurinha || "__nenhuma__"} onValueChange={(v) => patch({ figurinha: v === "__nenhuma__" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__nenhuma__">Sem figurinha</SelectItem>{figurinhas.map((f) => <SelectItem key={f.intent_tag} value={f.intent_tag}>{f.label || f.intent_tag}</SelectItem>)}</SelectContent>
            </Select>
            {figurinha?.media_url && <img src={figurinha.media_url} alt={figurinha.label || "Figurinha"} className="h-16 w-16 object-contain" />}
          </div>
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2"><Label className="text-xs">Cupom de uso único</Label><Switch checked={cupomAtivo} onCheckedChange={(v) => patch({ cupom: v ? "unico" : null })} /></div>
            {cupomAtivo && <>
              <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label className="text-xs">Valor</Label><Input type="number" min={0} value={config.cupom_valor ?? ""} onChange={(e) => patch({ cupom_valor: Number(e.target.value) })} /></div><div className="space-y-1"><Label className="text-xs">Tipo</Label><Input value={config.cupom_tipo ?? ""} placeholder="percentual ou valor" onChange={(e) => patch({ cupom_tipo: e.target.value })} /></div></div>
              <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label className="text-xs">Prefixo</Label><Input value={config.cupom_prefixo ?? ""} onChange={(e) => patch({ cupom_prefixo: e.target.value })} /></div><div className="space-y-1"><Label className="text-xs">Validade em dias</Label><Input type="number" min={1} value={config.cupom_validade_dias ?? ""} onChange={(e) => patch({ cupom_validade_dias: Number(e.target.value) })} /></div></div>
              <div className="space-y-1"><Label className="text-xs">Finalidade</Label><Input value={config.cupom_finalidade ?? ""} onChange={(e) => patch({ cupom_finalidade: e.target.value })} /></div>
              <p className="text-[11px] text-muted-foreground">Use {"{{cupom_unico}}"} no texto para mostrar o código emitido na hora.</p>
            </>}
          </div>
          <div className="space-y-1"><Label className="text-xs">Quando não houver nome</Label><Input value={config.nome_fallback ?? "cliente"} onChange={(e) => patch({ nome_fallback: e.target.value })} /></div>
          <div className="flex items-center justify-between gap-2"><Label className="text-xs">Pode enviar no fim de semana</Label><Switch checked={!!config.permite_fim_semana} onCheckedChange={(v) => patch({ permite_fim_semana: v })} /></div>
          <div className="space-y-1">
            <Label className="text-xs">Se a janela estiver fechada</Label>
            <Select value={config.janela_fechada ?? "template"} onValueChange={(v) => patch({ janela_fechada: v === "template" ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="template">Enviar template reserva</SelectItem><SelectItem value="descartar">Encerrar sem enviar</SelectItem></SelectContent></Select>
          </div>
          {config.janela_fechada !== "descartar" && <div className="space-y-2 rounded-md border border-border p-3"><p className="text-xs font-medium">Template reserva</p>{templateReserva}</div>}
          <p className="text-[11px] text-muted-foreground">Catálogo conectado: {catalogoWhatsapp?.catalog_nome || catalogoWhatsapp?.catalog_id || "não identificado"}. A lista de produtos não está disponível no painel.</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function WhatsappJanelaEditor({
  config, catalogo, onChange, templateReserva,
}: {
  config: Record<string, any>;
  catalogo?: Catalogo;
  onChange: (patch: Record<string, any>) => void;
  templateReserva: React.ReactNode;
}) {
  const formato = formatoDaConfig(config);
  const erros = useMemo(() => errosWhatsappJanela(config), [config]);
  const escolherFormato = (novo: FormatoJanela) => {
    const limpeza: Record<string, any> = { formato_editor: novo };
    if (novo !== "botoes") limpeza.botoes_resposta = [];
    if (novo !== "video" && novo !== "botoes") limpeza.video = null;
    if (novo !== "link") { limpeza.botao_url = null; limpeza.botao_texto = null; }
    if (novo !== "vitrine") limpeza.vitrine = null;
    onChange(limpeza);
  };
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Formato da mensagem</Label>
        <Select value={formato} onValueChange={(v) => escolherFormato(v as FormatoJanela)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="texto">Só texto</SelectItem><SelectItem value="botoes">Texto com botões de resposta</SelectItem><SelectItem value="video">Vídeo</SelectItem><SelectItem value="link">Botão de link</SelectItem><SelectItem value="vitrine">Vitrine de produtos</SelectItem></SelectContent></Select>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2"><Label className="text-xs">Texto</Label>{formato === "video" && <Contador atual={String(config.texto ?? "").length} limite={1024} />}</div>
        <Textarea rows={6} maxLength={formato === "video" ? 1024 : undefined} value={config.texto ?? ""} onChange={(e) => onChange({ texto: e.target.value })} />
        <p className="text-[11px] text-muted-foreground">Aceita *negrito*, quebras de linha, {"{{primeiro_nome}}"} e {"{{cupom_unico}}"}.</p>
      </div>
      {formato === "botoes" && <><EditorBotoes config={config} patch={onChange} /><EditorVideo config={config} patch={onChange} opcional /></>}
      {formato === "video" && <EditorVideo config={config} patch={onChange} />}
      {formato === "link" && <div className="space-y-3"><CampoComContador rotulo="Texto do botão" valor={String(config.botao_texto ?? "")} limite={20} onChange={(botao_texto) => onChange({ botao_texto })} /><div className="space-y-1"><Label className="text-xs">Link</Label><Input type="url" value={config.botao_url ?? ""} placeholder="https://" onChange={(e) => onChange({ botao_url: e.target.value })} /><p className="text-[11px] text-muted-foreground">Abre uma página e não cria uma saída no fluxo.</p></div></div>}
      {formato === "vitrine" && <EditorVitrine config={config} patch={onChange} />}
      {erros.length > 0 && <div className="rounded-md border border-danger/40 bg-danger/5 p-2 text-[11px] text-danger">{erros.map((erro) => <p key={erro}>{erro}</p>)}</div>}
      <div className="space-y-1"><Label className="text-xs">Prévia</Label><PreviaWhatsappJanela config={config} /></div>
      <OpcoesJanela config={config} catalogo={catalogo} patch={onChange} templateReserva={templateReserva} />
      <p className="text-[11px] text-muted-foreground">A janela é conferida quando a mensagem vai sair, não quando a cliente chega neste passo.</p>
    </div>
  );
}