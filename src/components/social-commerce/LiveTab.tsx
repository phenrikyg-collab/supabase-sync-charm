import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/socialCommerce";
import { brl } from "@/lib/financeiroFormat";
import { toast } from "sonner";
import {
  ConfigLive, Kit, Live, atualizarLive, carregarKits, carregarLives, dataHoraCurta,
  normalizarGatilho, problemasTexto, restante, totalKit,
} from "@/lib/kitsLive";
import { carregarProdutosPai, SeletorProdutos, type ProdutoPai } from "./SeletorProdutos";
import { CampoTags, tempoRelativo } from "./comum";
import { LiveChat } from "./LiveChat";
import { SeletorLive } from "./SeletorLive";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Loader2, MessageSquare, Package, Radio, Users, Zap } from "lucide-react";

type ComentarioLive = {
  comment_id: string;
  from_username?: string | null;
  texto?: string | null;
  publicado_em?: string | null;
  status?: string | null;
  kit_nome?: string | null;
  kit_id?: string | number | null;
  intencao?: string | null;
  resposta_texto?: string | null;
};

function Tile({ label, valor, sub }: { label: string; valor: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">{valor}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function LiveTab() {
  const [config, setConfig] = useState<ConfigLive | null>(null);
  const [kits, setKits] = useState<Kit[]>([]);
  const [produtos, setProdutos] = useState<ProdutoPai[]>([]);
  const [comentarios, setComentarios] = useState<ComentarioLive[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const [lives, setLives] = useState<Live[]>([]);
  const [mediaSelecionado, setMediaSelecionado] = useState<string | null>(null);
  const [ultimoComentarioEm, setUltimoComentarioEm] = useState<string | null>(null);


  const mapaProdutos = useMemo(
    () => new Map(produtos.map((p) => [String(p.produto_id), p])),
    [produtos],
  );

  const carregarConfig = useCallback(async () => {
    const { data, error } = await db
      .from("instagram_live_automacao")
      .select("*")
      .order("id", { ascending: true })
      .limit(1);
    if (error) throw error;
    const c = (data ?? [])[0] as any;
    setConfig({
      id: c?.id,
      ativo: !!c?.ativo,
      palavras_gatilho: Array.isArray(c?.palavras_gatilho) ? c.palavras_gatilho : [],
      respostas_publicas: Array.isArray(c?.respostas_publicas) ? c.respostas_publicas : [],
      resposta_gatilho_dm: c?.resposta_gatilho_dm ?? "",
      produto_ids: Array.isArray(c?.produto_ids) ? c.produto_ids.map(String) : [],
      usar_kits: c?.usar_kits ?? true,
      expira_em: c?.expira_em ?? null,
      media_id_atual: c?.media_id_atual ?? null,
      ativado_em: c?.ativado_em ?? null,
    });
  }, []);

  const carregarComentarios = useCallback(async () => {
    const { data } = await db
      .from("vw_comentarios_live")
      .select("*")
      .eq("origem_midia", "live")
      .order("publicado_em", { ascending: false })
      .limit(60);
    setComentarios((data ?? []) as ComentarioLive[]);
  }, []);

  const carregarTudo = useCallback(async () => {
    try {
      const [, k, p] = await Promise.all([
        carregarConfig(),
        carregarKits(true).catch(() => []),
        carregarProdutosPai().catch(() => []),
      ]);
      setKits(k);
      setProdutos(p);
      await carregarComentarios();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível carregar a automação da live.");
    } finally {
      setCarregando(false);
    }
  }, [carregarConfig, carregarComentarios]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  // lives registradas
  const recarregarLives = useCallback(async () => {
    try {
      const l = await carregarLives();
      setLives(l);
      setMediaSelecionado((atual) => {
        if (atual && l.some((x) => x.media_id === atual)) return atual;
        return (l.find((x) => x.status === "ao_vivo") ?? l[0])?.media_id ?? null;
      });
    } catch {
      /* tabela pode não existir ainda */
    }
  }, []);

  useEffect(() => {
    recarregarLives();
  }, [recarregarLives]);

  const liveSelecionada = useMemo(
    () => lives.find((l) => l.media_id === mediaSelecionado) ?? null,
    [lives, mediaSelecionado],
  );

  // recalcula contadores: a cada 30 s ao vivo, e uma vez ao abrir uma arquivada
  useEffect(() => {
    if (!mediaSelecionado) return;
    let cancelado = false;
    const rodar = async () => {
      await atualizarLive(mediaSelecionado);
      if (!cancelado) recarregarLives();
    };
    rodar();
    if (liveSelecionada?.status !== "ao_vivo") return () => { cancelado = true; };
    const t = setInterval(rodar, 30_000);
    return () => {
      cancelado = true;
      clearInterval(t);
    };
  }, [mediaSelecionado, liveSelecionada?.status, recarregarLives]);

  // contagem regressiva
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);


  // comentários em tempo real (refetch em segundo plano, sem apagar a lista)
  useEffect(() => {
    const ch = db
      .channel("live-comentarios")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instagram_comentarios" },
        () => carregarComentarios(),
      )
      .subscribe();
    return () => {
      db.removeChannel(ch);
    };
  }, [carregarComentarios]);

  // contadores do cabeçalho: a própria linha da live em tempo real
  useEffect(() => {
    if (!mediaSelecionado) return;
    const ch = db
      .channel(`live-row-${mediaSelecionado}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "instagram_lives",
          filter: `media_id=eq.${mediaSelecionado}`,
        },
        ({ new: novo }: any) =>
          setLives((prev) =>
            prev.map((l) => (l.media_id === novo?.media_id ? { ...l, ...novo } : l)),
          ),
      )
      .subscribe();
    return () => {
      db.removeChannel(ch);
    };
  }, [mediaSelecionado]);

  const salvar = async (patch: Partial<ConfigLive>) => {
    if (!config) return;
    const novo = { ...config, ...patch };
    setConfig(novo);
    setSalvando(true);
    try {
      const payload: any = {
        ativo: novo.ativo,
        palavras_gatilho: novo.palavras_gatilho,
        respostas_publicas: novo.respostas_publicas,
        resposta_gatilho_dm: novo.resposta_gatilho_dm ?? null,
        produto_ids: novo.produto_ids,
        usar_kits: novo.usar_kits,
      };
      const { error } = novo.id
        ? await db.from("instagram_live_automacao").update(payload).eq("id", novo.id)
        : await db.from("instagram_live_automacao").insert(payload);
      if (error) throw error;
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar.");
      carregarConfig();
    } finally {
      setSalvando(false);
    }
  };

  const restanteTxt = useMemo(() => restante(config?.expira_em), [config?.expira_em, agora]);
  const problemasDm = problemasTexto(config?.resposta_gatilho_dm);

  const gatilhosDosKits = useMemo(() => {
    const m = new Map<string, string>();
    kits.forEach((k) => k.gatilhos.forEach((g) => m.set(normalizarGatilho(g), k.nome)));
    return m;
  }, [kits]);

  const comKit = comentarios.filter((c) => !!c.kit_nome).length;
  const respondidos = comentarios.filter((c) => !!c.resposta_texto || c.status === "respondido").length;
  const pessoas = new Set(comentarios.map((c) => c.from_username ?? "")).size;

  if (carregando || !config) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SeletorLive
        lives={lives}
        selecionada={liveSelecionada}
        onSelecionar={setMediaSelecionado}
        kits={kits}
        ultimoComentarioEm={ultimoComentarioEm}
        onAtualizar={() => {
          recarregarLives();
          carregarConfig();
        }}
      />

      <LiveChat
        config={config}
        kits={kits}
        onToggleAtivo={(v) => salvar({ ativo: v })}
        live={liveSelecionada}
        mediaId={mediaSelecionado ?? config.media_id_atual ?? null}
        onSelecionarLive={setMediaSelecionado}
        onUltimoComentario={setUltimoComentarioEm}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Comentários" valor={comentarios.length} sub="últimos da live" />
            <Tile label="Com kit citado" valor={comKit} />
            <Tile label="Respondidos" valor={respondidos} />
            <Tile label="Pessoas" valor={pessoas} />
          </div>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 p-4 text-xs text-muted-foreground">
              <span>
                Post da live:{" "}
                <strong className="text-foreground">{config.media_id_atual ?? "ainda não detectado"}</strong>
              </span>
              <span>Ligada em {dataHoraCurta(config.ativado_em)}</span>
              <span>
                {restanteTxt ? (
                  <>
                    Expira em <strong className="text-foreground">{restanteTxt}</strong>
                  </>
                ) : config.expira_em ? (
                  "Janela expirada"
                ) : (
                  "Sem expiração definida"
                )}
              </span>
              {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </CardContent>
          </Card>
        </div>


      {/* configuração */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4" /> Palavras que a Anna escuta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CampoTags
              value={config.palavras_gatilho}
              onChange={(v) => salvar({ palavras_gatilho: v })}
              placeholder="quero, eu quero, link, preço"
            />
            <p className="text-[11px] text-muted-foreground">
              Além destas, a Anna sempre escuta as palavras-chave dos kits ativos.
            </p>
            <Separator />
            <div className="flex items-center gap-2">
              <Switch checked={config.usar_kits} onCheckedChange={(v) => salvar({ usar_kits: v })} />
              <Label className="cursor-pointer text-sm">Usar kits nesta live</Label>
            </div>
            {config.usar_kits && (
              <div className="space-y-1 pt-1">
                {kits.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Nenhum kit ativo no momento.</p>
                ) : (
                  kits.map((k) => (
                    <div key={String(k.id)} className="flex items-center justify-between text-xs">
                      <span className="truncate">{k.nome}</span>
                      <span className="text-muted-foreground">{brl(totalKit(k.itens, mapaProdutos))}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" /> Respostas públicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CampoTags
              value={config.respostas_publicas}
              onChange={(v) => salvar({ respostas_publicas: v })}
              placeholder="Te mandei no Direct 💛"
            />
            <p className="text-[11px] text-muted-foreground">
              A Anna sorteia entre estas frases para não repetir a mesma resposta no post.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Mensagem do Direct
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              rows={4}
              value={config.resposta_gatilho_dm ?? ""}
              onChange={(e) => setConfig({ ...config, resposta_gatilho_dm: e.target.value })}
              onBlur={() => salvar({ resposta_gatilho_dm: config.resposta_gatilho_dm })}
              placeholder="Oi! Vi seu comentário na live 💛 Me diz o seu tamanho que eu monto o carrinho."
            />
            {problemasDm.map((p) => (
              <p key={p} className="flex items-center gap-1.5 text-[11px] text-danger">
                <AlertTriangle className="h-3 w-3" /> {p}
              </p>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Usada quando o comentário não cita nenhum kit.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" /> Peças avulsas da live
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SeletorProdutos
              produtos={produtos}
              selecionados={config.produto_ids}
              onToggle={(id, marcado) =>
                salvar({
                  produto_ids: marcado
                    ? [...config.produto_ids, String(id)]
                    : config.produto_ids.filter((p) => p !== String(id)),
                })
              }
            />
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );

}
