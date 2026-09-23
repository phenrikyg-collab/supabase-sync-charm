import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Settings2, Loader2 } from "lucide-react";
import { chamarRpc } from "@/lib/supabaseRpc";
import { brl } from "@/lib/financeiroFormat";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BotaoConversa } from "@/components/recuperacao/BotaoConversa";
import { cn } from "@/lib/utils";

const TIPOS: { valor: string; rotulo: string }[] = [
  { valor: "checkout_abandonado", rotulo: "Checkout abandonado" },
  { valor: "carrinho_ativo_agora", rotulo: "Carrinho ativo agora" },
  { valor: "carrinho_cliente_conhecida", rotulo: "Carrinho de cliente conhecida" },
  { valor: "hesitacao_produto", rotulo: "Hesitação de produto" },
  { valor: "vip_navegando", rotulo: "Cliente VIP navegando" },
];

const ROTULO_TIPO: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.valor, t.rotulo]));

const SITUACOES: { valor: string; rotulo: string }[] = [
  { valor: "pendente", rotulo: "Pendente" },
  { valor: "enviado", rotulo: "Enviado" },
  { valor: "ignorado", rotulo: "Ignorado" },
  { valor: "falhou", rotulo: "Falhou" },
  { valor: "expirado", rotulo: "Expirado" },
];

type Resumo = {
  pendentes?: number | null;
  detectados?: number | null;
  enviados?: number | null;
  responderam?: number | null;
  compraram?: number | null;
  falhas?: number | null;
  pulados?: Record<string, number> | null;
  por_tipo?: Record<string, Record<string, number>> | null;
} | null;

type Config = {
  ativo?: boolean | null;
  tipos?: string[] | null;
  espera_min?: number | null;
  janela_max_horas?: number | null;
  teto_dia?: number | null;
  cooldown_dias?: number | null;
  silencio_marketing_horas?: number | null;
  silencio_atendimento_dias?: number | null;
  template?: string | null;
  preview?: string | null;
};

type Linha = {
  id: string | number;
  tipo: string | null;
  nome: string | null;
  telefone: string | null;
  titulo: string | null;
  situacao: string | null;
  valor: number | null;
  status: string | null;
  motivo_pulo: string | null;
  ocorrido_em: string | null;
  enviado_em: string | null;
  respondida_em: string | null;
  convertida_em: string | null;
  conversa_id: string | number | null;
  erro: string | null;
};

function dataHora(valor?: string | null) {
  if (!valor) return "-";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function hora(valor?: string | null) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function numero(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function Desfecho({ linha }: { linha: Linha }) {
  if (linha.convertida_em) {
    return <Badge className="bg-green-600 text-white">Comprou</Badge>;
  }
  if (linha.respondida_em) {
    return <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300" variant="outline">Respondeu</Badge>;
  }
  const situacao = (linha.situacao ?? linha.status ?? "").toLowerCase();
  if (situacao === "falhou") {
    return (
      <span className="text-xs text-destructive">{linha.erro?.trim() || "Falhou no envio"}</span>
    );
  }
  if (situacao === "ignorado") {
    return (
      <span className="text-xs text-muted-foreground">
        Ignorado{linha.motivo_pulo ? ` · ${linha.motivo_pulo}` : ""}
      </span>
    );
  }
  if (situacao === "expirado") return <span className="text-xs text-muted-foreground">Expirado</span>;
  if (linha.enviado_em) {
    return <span className="text-xs text-foreground/80">Enviado às {hora(linha.enviado_em)}</span>;
  }
  return <span className="text-xs text-muted-foreground">Aguardando</span>;
}

export function ResgateAutomatico({
  onAbrirConversa,
}: {
  onAbrirConversa?: (conversaId: string) => void;
}) {
  const [resumo, setResumo] = useState<Resumo>(null);
  const [config, setConfig] = useState<Config>({});
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [situacao, setSituacao] = useState<string>("pendente");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Config>({});

  const carregarTopo = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      chamarRpc<Resumo>("oportunidades_resgate_resumo", { p_dias: 7 }),
      chamarRpc<Config>("oportunidades_resgate_config", {}),
    ]);
    if (!r1.error) setResumo((r1.data ?? null) as Resumo);
    if (!r2.error && r2.data) setConfig(r2.data as Config);
  }, []);

  const carregarLista = useCallback(async () => {
    const { data, error } = await chamarRpc<Linha[]>("oportunidades_resgate_listar", {
      p_status: situacao,
      p_limite: 50,
    });
    if (!error) setLinhas(Array.isArray(data) ? data : []);
  }, [situacao]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      await Promise.all([carregarTopo(), carregarLista()]);
      if (vivo) setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [carregarTopo, carregarLista]);

  const salvarConfig = useCallback(
    async (p: Record<string, unknown>) => {
      const { data, error } = await chamarRpc<Config>("oportunidades_resgate_config_salvar", { p });
      if (error) {
        toast.error(error.message || "Não foi possível salvar a configuração");
        return false;
      }
      if (data) setConfig(data as Config);
      return true;
    },
    [],
  );

  const alternarAtivo = async (valor: boolean) => {
    setConfig((c) => ({ ...c, ativo: valor }));
    const ok = await salvarConfig({ ativo: valor });
    if (ok) toast.success(valor ? "Resgate automático ligado" : "Resgate automático desligado");
    else setConfig((c) => ({ ...c, ativo: !valor }));
  };

  const abrirConfig = () => {
    setRascunho({ ...config, tipos: Array.isArray(config.tipos) ? [...config.tipos] : [] });
    setDialogAberto(true);
  };

  const salvarDialog = async () => {
    setSalvando(true);
    const ok = await salvarConfig({
      teto_dia: numero(rascunho.teto_dia),
      espera_min: numero(rascunho.espera_min),
      janela_max_horas: numero(rascunho.janela_max_horas),
      cooldown_dias: numero(rascunho.cooldown_dias),
      silencio_marketing_horas: numero(rascunho.silencio_marketing_horas),
      silencio_atendimento_dias: numero(rascunho.silencio_atendimento_dias),
      tipos: Array.isArray(rascunho.tipos) ? rascunho.tipos : [],
    });
    setSalvando(false);
    if (ok) {
      toast.success("Configuração salva");
      setDialogAberto(false);
    }
  };

  const atualizarFila = async () => {
    setAtualizando(true);
    const { data, error } = await chamarRpc<{ novos?: number; vistos?: number; pulos?: number }>(
      "oportunidades_resgate_detectar",
      { p_limite: 200 },
    );
    setAtualizando(false);
    if (error) {
      toast.error(error.message || "Não foi possível atualizar a fila");
      return;
    }
    const novos = numero(data?.novos);
    toast.success(novos === 1 ? "1 oportunidade entrou na fila" : `${novos} oportunidades entraram na fila`);
    await Promise.all([carregarTopo(), carregarLista()]);
  };

  const numeros = useMemo(
    () => [
      { rotulo: "Detectados", valor: numero(resumo?.detectados) },
      { rotulo: "Enviados", valor: numero(resumo?.enviados) },
      { rotulo: "Responderam", valor: numero(resumo?.responderam) },
      { rotulo: "Compraram", valor: numero(resumo?.compraram) },
    ],
    [resumo],
  );

  const tiposMarcados = Array.isArray(rascunho.tipos) ? rascunho.tipos : [];
  const alternarTipo = (valor: string, marcado: boolean) => {
    setRascunho((r) => {
      const atuais = Array.isArray(r.tipos) ? r.tipos : [];
      return { ...r, tipos: marcado ? [...new Set([...atuais, valor])] : atuais.filter((t) => t !== valor) };
    });
  };

  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="font-serif text-xl font-bold">Resgate automático</h2>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={atualizarFila} disabled={atualizando}>
          {atualizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar fila agora
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          {carregando ? (
            <Skeleton className="h-16 rounded-lg" />
          ) : (
            <div className="flex flex-wrap gap-6">
              {numeros.map((n) => (
                <div key={n.rotulo}>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{n.rotulo}</p>
                  <p className="font-serif text-2xl font-bold">{n.valor}</p>
                </div>
              ))}
              <p className="self-end text-xs text-muted-foreground">últimos 7 dias</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            <div className="flex items-center gap-2">
              <Switch
                id="resgate-ativo"
                checked={config.ativo === true}
                onCheckedChange={(v) => alternarAtivo(v === true)}
              />
              <Label htmlFor="resgate-ativo" className="text-sm font-medium">
                Resgate automático ligado
              </Label>
            </div>
            <p className="text-xs text-muted-foreground flex-1 min-w-[14rem]">
              Manda template de WhatsApp para quem virou oportunidade e ficou sem resposta. Só em dia útil, das 10h
              às 20h.
            </p>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={abrirConfig}>
              <Settings2 className="h-3.5 w-3.5" /> Configurar
            </Button>
          </div>

          {(config.preview || config.template) && (
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <p className="text-xs font-medium text-muted-foreground">Mensagem que sai para a cliente</p>
                {config.template && (
                  <p className="text-[11px] text-muted-foreground">template: {config.template}</p>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{config.preview || config.template}</p>
              <p className="text-xs text-muted-foreground mt-1">
                A mensagem nunca oferece desconto: só pergunta se pode ajudar.
              </p>
            </div>
          )}

          <div className="border-t pt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-1">
              {SITUACOES.map((s) => (
                <Button
                  key={s.valor}
                  size="sm"
                  variant={situacao === s.valor ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setSituacao(s.valor)}
                >
                  {s.rotulo}
                </Button>
              ))}
            </div>

            {carregando ? (
              <Skeleton className="h-20 rounded-lg" />
            ) : linhas.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nada por aqui com essa situação</p>
            ) : (
              <ul className="divide-y">
                {linhas.map((l) => (
                  <li key={String(l.id)} className="flex flex-wrap items-center gap-2 py-2">
                    <div className="min-w-[12rem] flex-1">
                      <p className="text-sm font-medium leading-snug">
                        {l.nome?.trim() || l.telefone || "Cliente"}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {ROTULO_TIPO[l.tipo ?? ""] ?? l.tipo ?? "-"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.titulo?.trim() || "-"} · {dataHora(l.ocorrido_em)}
                        {l.valor != null ? ` · ${brl(l.valor)}` : ""}
                      </p>
                    </div>
                    <div className={cn("shrink-0")}>
                      <Desfecho linha={l} />
                    </div>
                    {l.conversa_id && (
                      <BotaoConversa
                        conversaId={l.conversa_id}
                        telefone={l.telefone}
                        onAbrirConversa={onAbrirConversa}
                        className="h-7 text-xs"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar resgate automático</DialogTitle>
            <DialogDescription>
              Ajuste os limites de envio e quais oportunidades entram na fila.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="teto_dia" className="text-xs">Envios por dia (teto)</Label>
              <Input
                id="teto_dia"
                type="number"
                min={0}
                value={rascunho.teto_dia ?? 0}
                onChange={(e) => setRascunho((r) => ({ ...r, teto_dia: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="espera_min" className="text-xs">Espera depois da oportunidade (minutos)</Label>
              <Input
                id="espera_min"
                type="number"
                min={0}
                value={rascunho.espera_min ?? 0}
                onChange={(e) => setRascunho((r) => ({ ...r, espera_min: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="janela_max_horas" className="text-xs">Janela máxima (horas)</Label>
              <Input
                id="janela_max_horas"
                type="number"
                min={0}
                value={rascunho.janela_max_horas ?? 0}
                onChange={(e) => setRascunho((r) => ({ ...r, janela_max_horas: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cooldown_dias" className="text-xs">Carência por cliente (dias)</Label>
              <Input
                id="cooldown_dias"
                type="number"
                min={0}
                value={rascunho.cooldown_dias ?? 0}
                onChange={(e) => setRascunho((r) => ({ ...r, cooldown_dias: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="silencio" className="text-xs">Silêncio depois de qualquer automação (horas)</Label>
              <Input
                id="silencio"
                type="number"
                min={0}
                value={rascunho.silencio_marketing_horas ?? 0}
                onChange={(e) =>
                  setRascunho((r) => ({ ...r, silencio_marketing_horas: Number(e.target.value) }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="silencio_atendimento" className="text-xs">Silêncio depois de a cliente escrever para nós (dias)</Label>
              <Input
                id="silencio_atendimento"
                type="number"
                min={0}
                value={rascunho.silencio_atendimento_dias ?? 0}
                onChange={(e) =>
                  setRascunho((r) => ({ ...r, silencio_atendimento_dias: Number(e.target.value) }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Quem falou com a loja nesse período não recebe o resgate, mesmo virando oportunidade de novo.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium">Tipos de oportunidade que entram</p>
            {TIPOS.map((t) => (
              <label key={t.valor} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={tiposMarcados.includes(t.valor)}
                  onCheckedChange={(v) => alternarTipo(t.valor, v === true)}
                />
                {t.rotulo}
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button onClick={salvarDialog} disabled={salvando}>
              {salvando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
