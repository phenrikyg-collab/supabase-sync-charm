import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { FlaskConical, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dataBrHora, horasDesde, inteiro, rpcEmails, textoDesde } from "@/lib/emails";
import {
  ConstrutorPublico, descreverFiltro, filtroVazio, mensagemErroPublico,
  SeloPublicoVivo, textoConsulta, usePublicoCampos, type No,
} from "./ConstrutorPublico";

const AJUDA_CONFIG: Record<string, string> = {
  min_visualizacoes: "Quantas vezes precisa ver a mesma peça",
  janela_sinal_horas: "Em quantas horas",
  espera_minutos: "Esperar quanto tempo depois da última visualização",
  max_pecas: "Máximo de peças no e-mail",
  intervalo_contato_dias: "Não mandar de novo para a mesma pessoa antes de",
  exige_estoque: "Nunca mandar peça esgotada",
  exclui_quem_tem_carrinho: "Pular quem colocou algo no carrinho",
};

const ROTULO_CONFIG: Record<string, string> = {
  min_visualizacoes: "Mínimo de visualizações",
  janela_sinal_horas: "Janela do sinal (horas)",
  espera_minutos: "Espera (minutos)",
  max_pecas: "Máximo de peças",
  intervalo_contato_dias: "Intervalo entre contatos (dias)",
  exige_estoque: "Exige estoque",
  exclui_quem_tem_carrinho: "Excluir quem tem carrinho",
};

function rotulo(chave: string) {
  return ROTULO_CONFIG[chave] ?? chave.replace(/_/g, " ");
}

function estadoBadge(a: any) {
  if (a.ativo) return { texto: "No ar", classe: "bg-success/15 text-success border-success/30" };
  if ((a.estado ?? a.status) === "pausado") return { texto: "Pausado", classe: "bg-warning/15 text-warning border-warning/30" };
  return { texto: "Planejado", classe: "bg-muted text-muted-foreground" };
}

const ehPublicoVivo = (a: any) => a?.gatilho === "filtro";

function PainelConfig({
  automacao, aberto, onFechar,
}: { automacao: any | null; aberto: boolean; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<Record<string, any>>({});
  const [templateId, setTemplateId] = useState<string>("");
  const [filtro, setFiltro] = useState<No>(filtroVazio());

  const porFiltro = ehPublicoVivo(automacao);
  const { data: campos = [] } = usePublicoCampos(aberto && porFiltro);

  useEffect(() => {
    setConfig({ ...(automacao?.config ?? {}) });
    setTemplateId(automacao?.template_id ? String(automacao.template_id) : "");
    setFiltro((automacao?.publico_filtro as No) ?? filtroVazio());
  }, [automacao]);

  const { data: templates = [] } = useQuery({
    queryKey: ["emails-templates", "automacao"],
    queryFn: async () => (await rpcEmails<any>("emails_templates_listar", { p_tipo: "automacao" })) ?? [],
    enabled: aberto,
  });

  const salvar = useMutation({
    mutationFn: () =>
      rpcEmails("emails_automacao_salvar", {
        p_slug: automacao.slug,
        p_patch: porFiltro
          ? {
              publico_filtro: filtro,
              config: {
                repetir: !!config.repetir,
                intervalo_contato_dias: Number(config.intervalo_contato_dias ?? 0),
                lote_max: Number(config.lote_max ?? 0),
              },
              template_id: templateId ? Number(templateId) : null,
            }
          : { config, template_id: templateId ? Number(templateId) : null },
      }),
    onSuccess: () => {
      toast({ title: "Configuração salva", description: "Vale a partir da próxima varredura." });
      queryClient.invalidateQueries({ queryKey: ["emails-automacoes"] });
      onFechar();
    },
    onError: (e: any) => toast({ title: "Não deu para salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle className="font-serif">{automacao?.nome}</SheetTitle></SheetHeader>

        <div className="mt-6 space-y-5">
          {porFiltro && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Público</p>
                <p className="text-xs text-muted-foreground">
                  O público é refeito a cada rodada. Quem entrar no critério amanhã entra amanhã, quem sair sai.
                </p>
              </div>
              <ConstrutorPublico filtro={filtro} campos={campos as any[]} onChange={setFiltro} />
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <SeloPublicoVivo filtro={filtro} enabled={aberto} />
                <p className="text-xs text-muted-foreground">{descreverFiltro(filtro, campos as any[])}</p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t pt-4">
                <p className="text-sm font-medium">Pode mandar de novo para a mesma pessoa</p>
                <Switch
                  checked={!!config.repetir}
                  onCheckedChange={(v) => setConfig((p) => ({ ...p, repetir: v }))}
                />
              </div>

              {config.repetir && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Esperar quantos dias antes de repetir</p>
                  <Input
                    type="number"
                    min={0}
                    value={config.intervalo_contato_dias ?? 0}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, intervalo_contato_dias: Number(e.target.value) }))
                    }
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-sm font-medium">Máximo por rodada</p>
                <p className="text-xs text-muted-foreground">
                  A automação roda de hora em hora. Com o lote em 200 e 2.945 pessoas no público, leva umas 15
                  horas para passar por todas.
                </p>
                <Input
                  type="number"
                  min={1}
                  value={config.lote_max ?? 0}
                  onChange={(e) => setConfig((p) => ({ ...p, lote_max: Number(e.target.value) }))}
                />
              </div>
            </div>
          )}

          {!porFiltro && Object.keys(config).length === 0 && (
            <p className="text-sm text-muted-foreground">Esta automação não tem ajustes configuráveis.</p>
          )}
          {!porFiltro && Object.entries(config).map(([chave, valor]) => (
            <div key={chave} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium capitalize">{rotulo(chave)}</p>
                  {AJUDA_CONFIG[chave] && <p className="text-xs text-muted-foreground">{AJUDA_CONFIG[chave]}</p>}
                </div>
                {typeof valor === "boolean" && (
                  <Switch checked={valor} onCheckedChange={(v) => setConfig((p) => ({ ...p, [chave]: v }))} />
                )}
              </div>
              {typeof valor === "number" && (
                <Input
                  type="number"
                  value={valor}
                  onChange={(e) => setConfig((p) => ({ ...p, [chave]: Number(e.target.value) }))}
                />
              )}
              {typeof valor === "string" && (
                <Input value={valor} onChange={(e) => setConfig((p) => ({ ...p, [chave]: e.target.value }))} />
              )}
            </div>
          ))}

          <div className="space-y-1.5 border-t pt-4">
            <p className="text-sm font-medium">Template</p>
            <p className="text-xs text-muted-foreground">
              O motor usa este template para montar o e-mail desta automação.
            </p>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
              <SelectContent>
                {(templates as any[]).map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <Button className="w-full" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            Salvar configuração
          </Button>
          <p className="text-xs text-muted-foreground">
            {porFiltro
              ? "Mudança aqui vale na próxima rodada, que acontece de hora em hora."
              : "Mudança aqui vale na próxima varredura, que roda a cada 15 minutos."}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PainelSimulacao({
  automacao, aberto, onFechar,
}: { automacao: any | null; aberto: boolean; onFechar: () => void }) {
  const { data, isFetching, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["emails-simular-automacao", automacao?.slug],
    queryFn: () =>
      rpcEmails<any>("emails_detectar_por_filtro", { p_slug: automacao.slug, p_simular: true }),
    enabled: aberto && !!automacao?.slug,
    retry: false,
  });

  const linhas: [string, any][] = data
    ? [
        ["No público agora", inteiro(data.no_publico)],
        ["Vão para a fila nesta rodada", inteiro(data.enfileirados)],
        ["Já receberam antes", inteiro(data.ja_receberam)],
        ["Bloqueados pelo teto de frequência", inteiro(data.bloqueados_teto)],
      ]
    : [];

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-serif">Simulação de {automacao?.nome}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isFetching && <p className="text-sm text-muted-foreground">Consultando o público…</p>}

          {error && (
            <Card className="space-y-2 border-danger/40 bg-danger/5 p-3">
              <p className="text-sm text-danger">{mensagemErroPublico((error as any).message ?? "")}</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar de novo</Button>
            </Card>
          )}

          {data && (
            <>
              <div className="space-y-2">
                {linhas.map(([r, v]) => (
                  <div key={r} className="flex items-baseline justify-between gap-3 rounded-lg border p-3">
                    <span className="text-xs text-muted-foreground">{r}</span>
                    <span className="font-serif text-xl">{v}</span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground">{textoConsulta(dataUpdatedAt)}</p>

              {data.bateu_no_lote && (
                <p className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
                  O lote de {inteiro(data.lote_max)} encheu. Faltam {inteiro(data.faltam_para_a_proxima)} para as
                  próximas rodadas.
                </p>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Exemplos de quem entraria agora</p>
                {(data.amostra ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ninguém entraria nesta rodada.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 font-normal">E-mail</th>
                        <th className="py-1 font-normal">RFM</th>
                        <th className="py-1 text-right font-normal">Dias sem comprar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.amostra ?? []).slice(0, 5).map((p: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="max-w-[160px] truncate py-1">{p.email}</td>
                          <td className="py-1">{p.rfm ?? "sem RFM"}</td>
                          <td className="py-1 text-right">{inteiro(p.dias_sem_comprar)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Simular não grava nada. O envio continua com o motor, de hora em hora.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AutomacoesTab({ onAbrirTemplate }: { onAbrirTemplate?: (slug: string) => void } = {}) {
  const queryClient = useQueryClient();
  const [configurando, setConfigurando] = useState<any | null>(null);
  const [simulando, setSimulando] = useState<any | null>(null);
  const [confirmarDesligar, setConfirmarDesligar] = useState<any | null>(null);

  const { data: automacoes = [], isLoading } = useQuery({
    queryKey: ["emails-automacoes"],
    queryFn: async () => (await rpcEmails<any>("emails_automacoes_listar")) ?? [],
  });

  const { data: config } = useQuery({
    queryKey: ["emails-config"],
    queryFn: () => rpcEmails<any>("emails_config_get"),
  });
  const varreduraPausada = config ? !config.envio_ativo : false;

  const alternar = useMutation({
    mutationFn: ({ slug, ativo }: { slug: string; ativo: boolean }) =>
      rpcEmails("emails_automacao_salvar", { p_slug: slug, p_patch: { ativo } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["emails-automacoes"] }),
    onError: (e: any) => toast({ title: "Não deu para mudar", description: e.message, variant: "destructive" }),
  });

  const lista = (Array.isArray(automacoes) ? automacoes : []).slice().sort(
    (a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0)
  );

  return (
    <div className="space-y-4">
      {varreduraPausada && (
        <Card className="bg-muted/50 p-3 text-sm text-muted-foreground">
          Varredura pausada. As automações voltam a detectar quando o envio for ligado.
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando automações…</p>}
      {!isLoading && lista.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">Nenhuma automação cadastrada ainda.</Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {lista.map((a: any) => {
          const badge = estadoBadge(a);
          const h = horasDesde(a.ultima_execucao);
          const atrasada = !varreduraPausada && a.ativo && h != null && h > 2;
          const templateSlug = a.template_slug ?? a.template?.slug;
          const templateNome = a.template_nome ?? a.template?.nome;
          return (
            <Card key={a.slug} className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg">{a.nome}</h3>
                    <Badge variant="outline" className={badge.classe}>{badge.texto}</Badge>
                    {ehPublicoVivo(a) && (
                      <Badge variant="outline" className="border-success/30 bg-success/15 text-[11px] text-success">
                        Público vivo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{a.descricao}</p>
                </div>
                <Switch
                  checked={!!a.ativo}
                  onCheckedChange={(v) => {
                    if (!v && a.ativo) setConfirmarDesligar(a);
                    else alternar.mutate({ slug: a.slug, ativo: v });
                  }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Template em uso:{" "}
                {templateNome ? (
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => templateSlug && onAbrirTemplate?.(templateSlug)}
                  >
                    {templateNome}
                  </button>
                ) : (
                  "sem template escolhido"
                )}
              </p>

              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  ["Enviados", a.enviados_30d],
                  ["Aberturas", a.aberturas_30d],
                  ["Cliques", a.cliques_30d],
                  ["Na fila", a.na_fila],
                ].map(([r, v]: any) => (
                  <div key={r} className="rounded-lg border p-2">
                    <p className="font-serif text-lg">{inteiro(v)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{r}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={cn("text-xs", atrasada ? "text-warning" : "text-muted-foreground")}>
                  Última execução: {dataBrHora(a.ultima_execucao)} · {a.ultimo_resultado ?? "sem registro"}
                  {atrasada && ` · sem rodar há ${textoDesde(a.ultima_execucao)}`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {ehPublicoVivo(a) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSimulando(a)}
                      title="Simular não grava nada"
                    >
                      <FlaskConical className="mr-1 h-3.5 w-3.5" /> Simular, sem gravar nada
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setConfigurando(a)}>
                    <Settings2 className="mr-1 h-3.5 w-3.5" /> Configurar
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>


      <PainelConfig automacao={configurando} aberto={!!configurando} onFechar={() => setConfigurando(null)} />

      <AlertDialog open={!!confirmarDesligar} onOpenChange={(v) => !v && setConfirmarDesligar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desligar {confirmarDesligar?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso para o envio deste e-mail. O que já está na fila continua.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                alternar.mutate({ slug: confirmarDesligar.slug, ativo: false });
                setConfirmarDesligar(null);
              }}
            >
              Desligar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
