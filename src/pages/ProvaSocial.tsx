import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BellRing, X, Pause, Play, SkipForward, Search } from "lucide-react";

type Config = {
  id: number;
  ativo: boolean;
  janela_dias: number;
  min_compras_produto: number;
  min_pedidos: number;
  max_itens: number;
  max_por_produto: number;
  exigir_imagem: boolean;
  delay_inicial_ms: number;
  intervalo_ms: number;
  template_produto: string;
  produtos_excluidos: string[];
};

type PoolItem = {
  product_id: string;
  produto: string | null;
  compras: number | null;
  ultima_compra: string | null;
  tem_foto: boolean | null;
  excluido: boolean | null;
  status: string | null;
};

type FeedItem = {
  nome: string | null;
  cidade: string | null;
  uf: string | null;
  produto: string | null;
  link: string | null;
  imagem: string | null;
  quando: string | null;
};

type Feed = {
  ativo: boolean;
  janela_dias: number;
  delay_inicial_ms: number;
  intervalo_ms: number;
  template: string;
  itens: FeedItem[];
};

const db = supabase as any;

const STATUS_CORES: Record<string, string> = {
  "No feed": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Excluído manualmente": "bg-red-100 text-red-800 border-red-200",
};

function corStatus(status?: string | null) {
  if (!status) return "bg-muted text-muted-foreground";
  return STATUS_CORES[status] ?? "bg-muted text-muted-foreground border-border";
}

function dataBR(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function aplicarTemplate(tpl: string, item: FeedItem) {
  const nome = item.nome ?? "";
  const texto = (tpl || "{nome} de {cidade}/{uf} comprou")
    .replace(/\{cidade\}/g, item.cidade ?? "")
    .replace(/\{uf\}/g, item.uf ?? "");
  const partes = texto.split("{nome}");
  return { partes, nome };
}

export default function ProvaSocial() {
  const [rascunho, setRascunho] = useState<Config | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [indicePreview, setIndicePreview] = useState(0);
  const [pausado, setPausado] = useState(false);

  const configQuery = useQuery({
    queryKey: ["prova-social-config"],
    queryFn: async () => {
      const { data, error } = await db.from("prova_social_config").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as Config | null;
    },
  });

  const poolQuery = useQuery({
    queryKey: ["prova-social-pool"],
    queryFn: async () => {
      const { data, error } = await db.rpc("prova_social_pool");
      if (error) throw error;
      return (data ?? []) as PoolItem[];
    },
  });

  const feedQuery = useQuery({
    queryKey: ["prova-social-feed"],
    queryFn: async () => {
      const { data, error } = await db.rpc("prova_social_feed");
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as Feed | null;
    },
  });

  useEffect(() => {
    if (configQuery.data && !rascunho) {
      setRascunho({
        ...configQuery.data,
        produtos_excluidos: configQuery.data.produtos_excluidos ?? [],
      });
    }
  }, [configQuery.data, rascunho]);

  useEffect(() => {
    const erro = configQuery.error || poolQuery.error || feedQuery.error;
    if (erro) toast.error("Erro ao carregar dados da prova social", { description: (erro as Error).message });
  }, [configQuery.error, poolQuery.error, feedQuery.error]);

  const itensFeed = feedQuery.data?.itens ?? [];

  useEffect(() => {
    if (pausado || itensFeed.length < 2) return;
    const t = setInterval(() => setIndicePreview((i) => (i + 1) % itensFeed.length), 4000);
    return () => clearInterval(t);
  }, [pausado, itensFeed.length]);

  const contadores = useMemo(() => {
    const pool = poolQuery.data ?? [];
    return {
      noFeed: pool.filter((p) => p.status === "No feed").length,
      poucasVendas: pool.filter((p) => p.status === "Fora — poucas vendas").length,
      semFoto: pool.filter((p) => p.status === "Fora — sem foto").length,
      excluidos: pool.filter((p) => p.status === "Excluído manualmente").length,
    };
  }, [poolQuery.data]);

  const statusDisponiveis = useMemo(() => {
    const set = new Set((poolQuery.data ?? []).map((p) => p.status ?? "").filter(Boolean));
    return Array.from(set);
  }, [poolQuery.data]);

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (poolQuery.data ?? [])
      .filter((p) => (termo ? (p.produto ?? "").toLowerCase().includes(termo) : true))
      .filter((p) => (filtroStatus === "todos" ? true : p.status === filtroStatus))
      .sort((a, b) => (b.compras ?? 0) - (a.compras ?? 0));
  }, [poolQuery.data, busca, filtroStatus]);

  const alterado = useMemo(() => {
    if (!rascunho || !configQuery.data) return false;
    return JSON.stringify({ ...configQuery.data, produtos_excluidos: configQuery.data.produtos_excluidos ?? [] }) !== JSON.stringify(rascunho);
  }, [rascunho, configQuery.data]);

  function atualizar<K extends keyof Config>(campo: K, valor: Config[K]) {
    setRascunho((r) => (r ? { ...r, [campo]: valor } : r));
  }

  function alternarExclusao(productId: string, excluir: boolean) {
    setRascunho((r) => {
      if (!r) return r;
      const atuais = r.produtos_excluidos ?? [];
      return {
        ...r,
        produtos_excluidos: excluir
          ? Array.from(new Set([...atuais, productId]))
          : atuais.filter((id) => id !== productId),
      };
    });
  }

  async function salvar() {
    if (!rascunho) return;
    if (rascunho.min_pedidos > rascunho.max_itens) {
      toast.error("O mínimo de itens não pode ser maior que o tamanho da fila.");
      return;
    }
    setSalvando(true);
    try {
      const { id, ...campos } = rascunho;
      const { error } = await db.from("prova_social_config").update(campos).eq("id", 1);
      if (error) throw error;
      toast.success("Alterações salvas");
      const novo = await configQuery.refetch();
      if (novo.data) setRascunho({ ...novo.data, produtos_excluidos: novo.data.produtos_excluidos ?? [] });
      await Promise.all([poolQuery.refetch(), feedQuery.refetch()]);
      setIndicePreview(0);
    } catch (e) {
      toast.error("Não foi possível salvar", { description: (e as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  const carregandoConfig = configQuery.isLoading || !rascunho;
  const itemAtual = itensFeed[indicePreview % Math.max(itensFeed.length, 1)];
  const excluidos = rascunho?.produtos_excluidos ?? [];

  return (
    <div className="p-6 space-y-6 pb-28">
      <div className="flex items-center gap-3">
        <BellRing className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Prova Social</h1>
          <p className="text-sm text-muted-foreground">Controle do pop-up de compras recentes na página de produto.</p>
        </div>
      </div>

      {/* SEÇÃO 1 — Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {carregandoConfig ? (
            <Skeleton className="h-10 w-64" />
          ) : (
            <div className="flex items-center gap-3">
              <Switch
                checked={rascunho.ativo}
                onCheckedChange={(v) => atualizar("ativo", v)}
                className="scale-125"
              />
              <span className="text-base font-medium">
                {rascunho.ativo ? "Pop-up ativo no site" : "Pop-up desligado"}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-8">
            {[
              { rotulo: "No feed", valor: contadores.noFeed },
              { rotulo: "Fora — poucas vendas", valor: contadores.poucasVendas },
              { rotulo: "Fora — sem foto", valor: contadores.semFoto },
              { rotulo: "Excluídos manualmente", valor: contadores.excluidos },
            ].map((c) => (
              <div key={c.rotulo} className="text-center lg:text-right">
                {poolQuery.isLoading ? (
                  <Skeleton className="h-7 w-12 mx-auto lg:ml-auto lg:mr-0" />
                ) : (
                  <div className="text-2xl font-semibold">{c.valor}</div>
                )}
                <div className="text-xs text-muted-foreground">{c.rotulo}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2 — Pré-visualização */}
      <Card>
        <CardHeader>
          <CardTitle>Pré-visualização</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            {feedQuery.isLoading ? (
              <Skeleton className="h-24 w-[330px] max-w-full" />
            ) : !feedQuery.data?.ativo || itensFeed.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Nenhuma compra atende aos critérios atuais — o pop não vai aparecer no site.
              </div>
            ) : (
              <>
                <div
                  className="relative flex bg-white"
                  style={{
                    borderRadius: 12,
                    boxShadow: "0 6px 24px rgba(0,0,0,.14)",
                    padding: "10px 34px 10px 10px",
                    gap: 12,
                    maxWidth: 330,
                  }}
                >
                  <img
                    src={itemAtual?.imagem ?? ""}
                    alt={itemAtual?.produto ?? "Produto"}
                    style={{ width: 52, height: 66, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                  />
                  <div style={{ fontSize: 13, minWidth: 0 }}>
                    <div style={{ color: "#5c554d" }}>
                      {(() => {
                        const { partes, nome } = aplicarTemplate(feedQuery.data?.template ?? "", itemAtual ?? {} as FeedItem);
                        return partes.map((p, i) => (
                          <span key={i}>
                            {p}
                            {i < partes.length - 1 && (
                              <strong style={{ color: "#1b1917" }}>{nome}</strong>
                            )}
                          </span>
                        ));
                      })()}
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#1b1917",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {itemAtual?.produto ?? ""}
                    </div>
                    <div style={{ fontSize: 11, color: "#9a938a" }}>{itemAtual?.quando ?? ""}</div>
                  </div>
                  <button
                    type="button"
                    className="absolute right-2 top-2 text-[#9a938a]"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPausado((p) => !p)}>
                    {pausado ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                    {pausado ? "Retomar" : "Pausar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIndicePreview((i) => (i + 1) % itensFeed.length)}
                  >
                    <SkipForward className="mr-2 h-4 w-4" />
                    Próximo
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {itensFeed.length ? `${(indicePreview % itensFeed.length) + 1} de ${itensFeed.length}` : ""}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            {carregandoConfig ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Delay até o primeiro pop (segundos)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={rascunho.delay_inicial_ms / 1000}
                      onChange={(e) => atualizar("delay_inicial_ms", Math.round(Number(e.target.value || 0) * 1000))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Intervalo entre pops (segundos)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={rascunho.intervalo_ms / 1000}
                      onChange={(e) => atualizar("intervalo_ms", Math.round(Number(e.target.value || 0) * 1000))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Texto da primeira linha</Label>
                  <Textarea
                    rows={2}
                    value={rascunho.template_produto ?? ""}
                    onChange={(e) => atualizar("template_produto", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Placeholders disponíveis: <code>{"{nome}"}</code>, <code>{"{cidade}"}</code>, <code>{"{uf}"}</code>
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 3 — Regras e produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Regras e produtos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            {carregandoConfig ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                {([
                  { campo: "janela_dias", rotulo: "Janela de busca (dias)", min: 7, max: 60 },
                  { campo: "min_compras_produto", rotulo: "Mínimo de vendas por produto", min: 1, max: 10 },
                  { campo: "min_pedidos", rotulo: "Mínimo de itens na fila", min: 1, max: 10 },
                  { campo: "max_itens", rotulo: "Tamanho da fila", min: 3, max: 20 },
                  { campo: "max_por_produto", rotulo: "Máximo por produto", min: 1, max: 5 },
                ] as const).map((c) => (
                  <div key={c.campo} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{c.rotulo}</Label>
                      <span className="text-sm font-medium">{rascunho[c.campo]}</span>
                    </div>
                    <Slider
                      min={c.min}
                      max={c.max}
                      step={1}
                      value={[Number(rascunho[c.campo] ?? c.min)]}
                      onValueChange={([v]) => atualizar(c.campo, v as never)}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Exigir imagem</Label>
                    <p className="text-xs text-muted-foreground">Esconde produtos sem foto cadastrada.</p>
                  </div>
                  <Switch checked={rascunho.exigir_imagem} onCheckedChange={(v) => atualizar("exigir_imagem", v)} />
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar produto..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {statusDisponiveis.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              {poolQuery.isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : linhas.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Nenhum produto encontrado.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead>Última compra</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Excluir do feed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((p) => (
                      <TableRow key={p.product_id}>
                        <TableCell className="max-w-[220px] truncate">{p.produto ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.product_id}</TableCell>
                        <TableCell className="text-right">{p.compras ?? 0}</TableCell>
                        <TableCell>{dataBR(p.ultima_compra)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={corStatus(p.status)}>
                            {p.status ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={excluidos.includes(p.product_id)}
                            onCheckedChange={(v) => alternarExclusao(p.product_id, v)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground">
            {alterado ? "Alterações pendentes" : "Tudo salvo"}
          </span>
          <Button onClick={salvar} disabled={!alterado || salvando}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>
    </div>
  );
}
