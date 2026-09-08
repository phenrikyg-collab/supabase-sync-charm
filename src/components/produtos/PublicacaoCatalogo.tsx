import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Loader2, Trash2, Upload, FlaskConical, Save, Link2 } from "lucide-react";
import {
  CatalogoCategoria,
  CatalogoCor,
  CatalogoCustos,
  CatalogoSku,
  CatalogoSugestaoNcm,
  CatalogoTamanho,
  CatalogoValidacao,
  DESCRICAO_MODELO,
  catalogoCategorias,
  catalogoCoresTamanhos,
  catalogoCustosDoProduto,
  catalogoGerarGrade,
  catalogoLigarCusto,
  catalogoProdutoLer,
  catalogoProdutoSalvar,
  catalogoProdutosListar,
  catalogoPublicar,
  catalogoSkuAtualizar,
  catalogoSkuRemover,
  catalogoSugerirNcm,
  catalogoValidarProduto,
  chaveCatalogo,
} from "@/lib/catalogo";

interface Props {
  produtoId?: string;
  nome: string;
  precoVenda: number;
  precoCusto: number;
}

interface FormCatalogo {
  apelido: string;
  categoria_tray: string;
  categoria_bling: string;
  peso: string;
  altura: string;
  largura: string;
  comprimento: string;
  ncm: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  descricao_curta: string;
  descricao: string;
}

const vazio: FormCatalogo = {
  apelido: "",
  categoria_tray: "",
  categoria_bling: "",
  peso: "",
  altura: "",
  largura: "",
  comprimento: "",
  ncm: "",
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
  descricao_curta: "",
  descricao: DESCRICAO_MODELO,
};

const num = (v: string) => (v === "" ? null : Number(v));

export default function PublicacaoCatalogo({ produtoId, nome, precoVenda, precoCusto }: Props) {
  const [catalogoId, setCatalogoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormCatalogo>(vazio);
  const [categorias, setCategorias] = useState<CatalogoCategoria[]>([]);
  const [cores, setCores] = useState<CatalogoCor[]>([]);
  const [tamanhos, setTamanhos] = useState<CatalogoTamanho[]>([]);
  const [coresSel, setCoresSel] = useState<string[]>([]);
  const [tamanhosSel, setTamanhosSel] = useState<string[]>([]);
  const [skus, setSkus] = useState<CatalogoSku[]>([]);
  const [validacao, setValidacao] = useState<CatalogoValidacao[]>([]);
  const [custos, setCustos] = useState<CatalogoCustos | null>(null);
  const [sugestao, setSugestao] = useState<CatalogoSugestaoNcm | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [imagens, setImagens] = useState<string[]>([]);
  const [imagensPorCor, setImagensPorCor] = useState<Record<string, string[]>>({});
  const [imagensEnviadasEm, setImagensEnviadasEm] = useState<string | null>(null);

  const set = (campo: keyof FormCatalogo, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  // Catálogos auxiliares
  useEffect(() => {
    catalogoCategorias().then(setCategorias).catch(() => undefined);
    catalogoCoresTamanhos()
      .then((r) => {
        setCores(r?.cores ?? []);
        setTamanhos([...(r?.tamanhos ?? [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)));
      })
      .catch(() => undefined);
  }, []);

  // Descobre o registro do catálogo ligado a este produto
  useEffect(() => {
    if (!produtoId) return;
    const salvo = localStorage.getItem(chaveCatalogo(produtoId));
    if (salvo) {
      setCatalogoId(salvo);
      return;
    }
    catalogoProdutosListar(nome, 50)
      .then((lista) => {
        const achado = (lista || []).find(
          (p) => (p.nome ?? "").trim().toLowerCase() === (nome ?? "").trim().toLowerCase(),
        );
        if (achado?.id) {
          localStorage.setItem(chaveCatalogo(produtoId), achado.id);
          setCatalogoId(achado.id);
        }
      })
      .catch(() => undefined);
  }, [produtoId, nome]);

  const carregar = async (id: string) => {
    try {
      const r = await catalogoProdutoLer(id);
      const p = r?.produto ?? ({} as any);
      setForm({
        apelido: p.apelido ?? "",
        categoria_tray: p.categoria_tray ? String(p.categoria_tray) : "",
        categoria_bling: p.categoria_bling ? String(p.categoria_bling) : "",
        peso: p.peso != null ? String(p.peso) : "",
        altura: p.altura != null ? String(p.altura) : "",
        largura: p.largura != null ? String(p.largura) : "",
        comprimento: p.comprimento != null ? String(p.comprimento) : "",
        ncm: p.ncm ?? "",
        seo_title: p.seo_title ?? "",
        seo_description: p.seo_description ?? "",
        seo_keywords: p.seo_keywords ?? "",
        descricao_curta: p.descricao_curta ?? "",
        descricao: p.descricao?.trim() ? p.descricao : DESCRICAO_MODELO,
      });
      setSkus(r?.skus ?? []);
      validar(id);
      lerCustos(id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    if (catalogoId) carregar(catalogoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogoId]);

  const validar = async (id: string) => {
    try {
      const linhas = await catalogoValidarProduto(id);
      setValidacao(Array.isArray(linhas) ? linhas : []);
    } catch {
      setValidacao([]);
    }
  };

  const lerCustos = async (id: string) => {
    try {
      const r = await catalogoCustosDoProduto(id);
      const c = Array.isArray(r) ? r[0] ?? null : r;
      setCustos(c ?? null);
    } catch {
      setCustos(null);
    }
  };

  // Sugestão de NCM pelo nome (nunca preenche sozinho)
  useEffect(() => {
    if (!nome?.trim()) return setSugestao(null);
    const t = setTimeout(() => {
      catalogoSugerirNcm(nome)
        .then((r) => setSugestao(Array.isArray(r) ? r[0] ?? null : (r as any)))
        .catch(() => setSugestao(null));
    }, 600);
    return () => clearTimeout(t);
  }, [nome]);

  const salvar = async () => {
    if (!nome?.trim()) {
      toast.error("Preencha o nome do produto antes de salvar a publicação.");
      return;
    }
    setSalvando(true);
    try {
      const r = await catalogoProdutoSalvar({
        id: catalogoId,
        nome,
        apelido: form.apelido || null,
        categoria_tray: form.categoria_tray || null,
        categoria_bling: form.categoria_bling || null,
        peso: num(form.peso),
        altura: num(form.altura),
        largura: num(form.largura),
        comprimento: num(form.comprimento),
        ncm: form.ncm || null,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        seo_keywords: form.seo_keywords || null,
        descricao_curta: form.descricao_curta || null,
        descricao: form.descricao || null,
      });
      const novoId = typeof r === "string" ? r : (r as any)?.id;
      if (novoId) {
        setCatalogoId(novoId);
        if (produtoId) localStorage.setItem(chaveCatalogo(produtoId), novoId);
        await carregar(novoId);
      }
      toast.success("Publicação salva.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const gerarGrade = async () => {
    if (!catalogoId) {
      toast.error("Salve a publicação antes de gerar a grade.");
      return;
    }
    if (!coresSel.length || !tamanhosSel.length) {
      toast.error("Escolha ao menos uma cor e um tamanho.");
      return;
    }
    setGerando(true);
    try {
      const linhas = await catalogoGerarGrade({
        produtoId: catalogoId,
        cores: coresSel,
        tamanhos: tamanhosSel,
        preco: precoVenda || null,
        custo: precoCusto || null,
      });
      setSkus(Array.isArray(linhas) ? linhas : []);
      await validar(catalogoId);
      toast.success("Grade gerada.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGerando(false);
    }
  };

  const atualizarSku = async (sku: CatalogoSku, campo: "preco" | "custo" | "ean", valor: string) => {
    setSkus((s) => s.map((x) => (x.id === sku.id ? { ...x, [campo]: campo === "ean" ? valor : Number(valor) } : x)));
    try {
      await catalogoSkuAtualizar(sku.id, { [campo]: campo === "ean" ? valor || null : num(valor) });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removerSku = async (sku: CatalogoSku) => {
    try {
      await catalogoSkuRemover(sku.id);
      setSkus((s) => s.filter((x) => x.id !== sku.id));
      if (catalogoId) validar(catalogoId);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const publicar = async (dryRun: boolean, etapas: string[] = ["tray", "bling", "vinculo"]) => {
    if (!catalogoId) return;
    setPublicando(true);
    setResultado(null);
    try {
      const r = await catalogoPublicar({ produto_id: catalogoId, dryRun, etapas });
      setResultado(r?.corpo ?? r);
      if (!dryRun && !r?.erro) {
        try {
          await catalogoLigarCusto(catalogoId);
        } catch {
          /* ligação de custo pode acontecer depois do sync */
        }
        toast.success("Publicação enviada.");
        await carregar(catalogoId);
      } else if (r?.erro) {
        toast.error("A publicação não passou na validação.");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPublicando(false);
    }
  };

  const erros = validacao.filter((v) => v.severidade === "erro");
  const avisos = validacao.filter((v) => v.severidade === "aviso");

  const catTray = useMemo(() => categorias.filter((c) => c.canal === "tray"), [categorias]);
  const catBling = useMemo(() => categorias.filter((c) => c.canal === "bling"), [categorias]);
  const rotuloCat = (c: CatalogoCategoria) => (c.pai ? `${c.pai} > ${c.nome}` : c.nome);

  const alternar = (lista: string[], valor: string, setter: (v: string[]) => void) =>
    setter(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);

  const validacaoErros: string[] = resultado?.validacao?.erros ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
        <span>
          Fotos ainda são enviadas pelo admin da Tray. O envio por API está em análise com o suporte.
        </span>
      </div>

      {/* Identificação */}
      <div className="space-y-2">
        <Label>Apelido</Label>
        <Input
          value={form.apelido}
          onChange={(e) =>
            set(
              "apelido",
              e.target.value
                .toUpperCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, ""),
            )
          }
          placeholder="CALCA-HELENA"
        />
        <p className="text-xs text-muted-foreground">
          entra no SKU. Ex.: CALCA-HELENA gera CALCA-HELENA-PT-G. Se estiver vazio, o SKU sai com o nome inteiro.
        </p>
      </div>

      {/* Categorias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoria na loja (Tray)</Label>
          <Select value={form.categoria_tray || undefined} onValueChange={(v) => set("categoria_tray", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {catTray.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{rotuloCat(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Categoria no Bling</Label>
          <Select value={form.categoria_bling || undefined} onValueChange={(v) => set("categoria_bling", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {catBling.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{rotuloCat(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Fiscal e logística */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Peso (gramas)</Label>
          <Input type="number" value={form.peso} onChange={(e) => set("peso", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Altura (cm)</Label>
          <Input type="number" step="0.1" value={form.altura} onChange={(e) => set("altura", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Largura (cm)</Label>
          <Input type="number" step="0.1" value={form.largura} onChange={(e) => set("largura", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Comprimento (cm)</Label>
          <Input type="number" step="0.1" value={form.comprimento} onChange={(e) => set("comprimento", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">NCM</Label>
          <Input value={form.ncm} onChange={(e) => set("ncm", e.target.value)} placeholder="0000.00.00" />
        </div>
      </div>

      {sugestao && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span>
              Sugestão para {sugestao.tipo}: <strong>{sugestao.ncm_sugerido}</strong> (confiança {sugestao.confianca},{" "}
              {sugestao.ocorrencias} produtos)
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => set("ncm", sugestao.ncm_sugerido)}>
              Usar
            </Button>
          </div>
          {!!sugestao.alternativos?.length && (
            <div className="flex flex-wrap gap-2">
              {sugestao.alternativos.map((a) => (
                <Badge
                  key={a.ncm}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => set("ncm", a.ncm)}
                >
                  {a.ncm} · {a.ocorrencias}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grade */}
      <div className="space-y-3">
        <h3 className="font-serif font-bold text-foreground">Grade de cor e tamanho</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Cores</Label>
            <div className="max-h-40 overflow-auto flex flex-wrap gap-2 rounded-md border border-border p-2">
              {cores.map((c) => (
                <Badge
                  key={c.sigla}
                  variant={coresSel.includes(c.nome) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => alternar(coresSel, c.nome, setCoresSel)}
                >
                  {c.nome} · {c.sigla}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Tamanhos</Label>
            <div className="flex flex-wrap gap-2 rounded-md border border-border p-2">
              {tamanhos.map((t) => (
                <Badge
                  key={t.sigla}
                  variant={tamanhosSel.includes(t.nome) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => alternar(tamanhosSel, t.nome, setTamanhosSel)}
                >
                  {t.nome}
                  {t.rotulo_numerico ? ` (${t.rotulo_numerico})` : ""}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={gerarGrade} disabled={gerando || !catalogoId}>
          {gerando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Gerar grade
        </Button>
        <p className="text-xs text-muted-foreground">
          O estoque não é lançado aqui: ele entra pela ordem de produção.
        </p>

        {skus.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead>EAN</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skus.map((s, i) => (
                <TableRow key={s.id ?? `${s.sku}-${i}`} className={s.conflito ? "bg-destructive/15" : ""}>
                  <TableCell className="font-medium">
                    {s.sku}
                    {s.conflito && (
                      <p className="text-xs text-destructive">SKU já existe em: {s.conflito}</p>
                    )}
                  </TableCell>
                  <TableCell>{s.cor}</TableCell>
                  <TableCell>{s.tamanho}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24 ml-auto"
                      value={s.preco ?? ""}
                      onChange={(e) => atualizarSku(s, "preco", e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24 ml-auto"
                      value={s.custo ?? ""}
                      onChange={(e) => atualizarSku(s, "custo", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-36"
                      value={s.ean ?? ""}
                      onChange={(e) => atualizarSku(s, "ean", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    {!s.tray_sku_id && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removerSku(s)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Fotos */}
      <FotosCatalogo
        catalogoId={catalogoId}
        cores={coresDaGrade}
        imagensIniciais={imagens}
        imagensPorCorIniciais={imagensPorCor}
        enviadasEm={imagensEnviadasEm}
      />



      {/* Conteúdo e SEO */}
      <div className="space-y-3">
        <h3 className="font-serif font-bold text-foreground">Conteúdo e SEO</h3>
        <div className="space-y-2">
          <Label>Título SEO</Label>
          <Input value={form.seo_title} onChange={(e) => set("seo_title", e.target.value)} />
          <p className={`text-xs ${form.seo_title.length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
            {form.seo_title.length} caracteres {form.seo_title.length > 60 ? "· acima de 60" : ""}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Descrição SEO</Label>
          <Textarea value={form.seo_description} onChange={(e) => set("seo_description", e.target.value)} rows={2} />
          <p
            className={`text-xs ${
              form.seo_description.length < 70 || form.seo_description.length > 160
                ? "text-warning"
                : "text-muted-foreground"
            }`}
          >
            {form.seo_description.length} caracteres · faixa boa entre 70 e 160
          </p>
        </div>
        <div className="space-y-2">
          <Label>Palavras-chave (separadas por vírgula)</Label>
          <Input value={form.seo_keywords} onChange={(e) => set("seo_keywords", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Descrição curta</Label>
          <Textarea value={form.descricao_curta} onChange={(e) => set("descricao_curta", e.target.value)} rows={2} />
        </div>
        <div className="space-y-2">
          <Label>Descrição (HTML)</Label>
          <Textarea
            value={form.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            rows={10}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            escreva por resultado verificável (compressão, cós que não marca, caimento, grade). Não use promessa de
            efeito no corpo nem promoção com prazo.
          </p>
        </div>
      </div>

      {/* Custos (leitura) */}
      <Card className="bg-muted/50">
        <CardContent className="pt-5 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-foreground">Custos</h3>
            <Link to="/produtos" className="text-xs text-primary underline">
              abrir a tela de precificação
            </Link>
          </div>
          {custos ? (
            <>
              <p className="text-xs text-muted-foreground">vem da tela de precificação</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["Preço de venda", custos.preco_venda],
                  ["Custo", custos.preco_custo],
                  ["Corte", custos.custo_corte],
                  ["Costura", custos.custo_costura],
                  ["Embalagem", custos.custo_embalagem],
                  ["Margem %", custos.margem_real_percentual],
                  ["Preço sugerido", custos.preco_venda_sugerido],
                ].map(([rotulo, valor]) => (
                  <div key={String(rotulo)}>
                    <p className="text-xs text-muted-foreground">{rotulo as string}</p>
                    <p className="font-medium">{valor == null ? "—" : Number(valor).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              custos aparecem depois que o produto for publicado e sincronizado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Resultado da publicação */}
      {resultado && (
        <div className="rounded-md border border-border p-3 space-y-2 text-sm">
          <h4 className="font-medium">Resultado</h4>
          {validacaoErros.length > 0 && (
            <ul className="list-disc pl-5 text-destructive">
              {validacaoErros.map((e, i) => (
                <li key={i}>{typeof e === "string" ? e : JSON.stringify(e)}</li>
              ))}
            </ul>
          )}
          {["tray", "bling", "vinculo"].map((etapa) => {
            const dado = resultado?.etapas?.[etapa];
            if (!dado) return null;
            const errosEtapa: any[] = dado.erros ?? [];
            return (
              <div key={etapa} className="rounded border border-border p-2">
                <div className="flex items-center justify-between">
                  <strong className="capitalize">{etapa}</strong>
                  <div className="flex gap-2">
                    {errosEtapa.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => publicar(false, [etapa])}
                        disabled={publicando}
                      >
                        Reprocessar {etapa}
                      </Button>
                    )}
                  </div>
                </div>
                <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-muted-foreground">
                  {JSON.stringify(dado, null, 2)}
                </pre>
              </div>
            );
          })}
        </div>
      )}

      {/* Painel de validação fixo */}
      <div className="sticky bottom-0 -mx-6 border-t border-border bg-background/95 px-6 py-3 backdrop-blur space-y-2">
        {erros.map((v, i) => (
          <p key={`e${i}`} className="text-sm text-destructive">
            {v.regra}: {v.detalhe}
          </p>
        ))}
        {avisos.map((v, i) => (
          <p key={`a${i}`} className="text-sm text-warning">
            {v.regra}: {v.detalhe}
          </p>
        ))}
        {catalogoId && validacao.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum apontamento de validação.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={salvar} disabled={salvando} variant="outline">
            {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar publicação
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => publicar(true)}
            disabled={!catalogoId || publicando}
          >
            <FlaskConical className="h-4 w-4 mr-1" /> Simular
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    onClick={() => publicar(false)}
                    disabled={!catalogoId || publicando || erros.length > 0}
                  >
                    {publicando ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    Publicar
                  </Button>
                </span>
              </TooltipTrigger>
              {erros.length > 0 && <TooltipContent>Corrija os erros acima para publicar</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
          {catalogoId && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => publicar(false, ["vinculo"])}
              disabled={publicando}
            >
              <Link2 className="h-4 w-4 mr-1" /> Refazer vínculo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
