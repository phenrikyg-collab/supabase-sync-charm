import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Copy, Link2, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { brl, dataCurta, num } from "@/lib/financeiroFormat";
import {
  ORIGENS_PADRAO,
  copiar,
  linkEntrada,
  vipConfigGet,
  vipConfigSalvar,
  vipDisparar,
  vipEntradaConfigSalvar,
  vipEntradasResumo,
  vipGrupoSalvar,
  vipMembrosMovimento,

  vipGruposListar,
  type VipConfig,
  type VipGrupo,
} from "@/lib/vip";

export function GruposTab() {
  const [grupos, setGrupos] = useState<VipGrupo[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [mov7, setMov7] = useState<Record<string, { entradas: number; saidas: number }>>({});
  const [config, setConfig] = useState<VipConfig>({});
  const [apiKey, setApiKey] = useState("");
  const [margem, setMargem] = useState(20);
  const [carregando, setCarregando] = useState(true);
  const [dias, setDias] = useState(30);
  const [origem, setOrigem] = useState("popup");

  const carregar = useCallback(async () => {
    try {
      const [g, r, c] = await Promise.all([vipGruposListar(), vipEntradasResumo(dias), vipConfigGet()]);
      setGrupos(g ?? []);
      setResumo(r);
      setConfig(c ?? {});
      if ((r as any)?.config?.margem_seguranca != null) setMargem(Number((r as any).config.margem_seguranca));
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao carregar grupos");
    } finally {
      setCarregando(false);
    }
  }, [dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    vipMembrosMovimento(7)
      .then((m) => {
        const mapa: Record<string, { entradas: number; saidas: number }> = {};
        (m?.por_grupo ?? []).forEach((g: any) => {
          const chave = String(g.grupo_id ?? g.grupo ?? g.nome ?? "");
          if (chave) mapa[chave] = { entradas: Number(g.entradas ?? 0), saidas: Number(g.saidas ?? 0) };
        });
        setMov7(mapa);
      })
      .catch(() => undefined);
  }, []);


  const totalMembros = useMemo(() => grupos.reduce((s, g) => s + Number(g.membros ?? 0), 0), [grupos]);
  const totalBroadcast = useMemo(
    () => grupos.filter((g) => g.perfil !== "comunidade").reduce((s, g) => s + Number(g.membros ?? 0), 0),
    [grupos],
  );
  const totalComunidade = totalMembros - totalBroadcast;

  const grupoDaVez = useMemo(
    () =>
      [...grupos]
        .filter((g) => g.ativo && g.aceita_novos)
        .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
        .find((g) => Number(g.membros ?? 0) < Number(g.capacidade ?? 1024) - margem),
    [grupos, margem],
  );

  const salvarGrupo = async (g: VipGrupo) => {
    try {
      await vipGrupoSalvar(g);
      toast.success("Grupo salvo.");
      carregar();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar grupo");
    }
  };

  const acao = async (a: "testar" | "sincronizar_grupos" | "sincronizar_convites") => {
    try {
      const r: any = await vipDisparar(a);
      if (a === "testar") {
        toast[r?.estado === "open" || r?.status === "open" ? "success" : "warning"](
          `Conexão: ${r?.estado ?? r?.status ?? "desconhecida"}`,
        );
      } else {
        toast.success(r?.mensagem ?? "Sincronizado.");
      }
      if (r?.aviso) toast.warning(r.aviso, { duration: 8000 });
      carregar();
    } catch (e: any) {
      toast.error(e.message ?? "Falha na ação");
    }
  };

  const serie = (resumo?.por_dia ?? []).map((d: any) => ({
    dia: dataCurta(d.dia ?? d.data) ?? "",
    entradas: Number(d.entradas ?? d.total ?? 0),
  }));

  if (carregando) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      {/* Porta de entrada */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Porta de entrada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            A cada clique o link manda para o primeiro grupo da fila com vaga e registra a entrada com origem e UTM.
            Preview de link não conta. Sem vaga em nenhum grupo, cai no site.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-[11px]">Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORIGENS_PADRAO.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input readOnly value={linkEntrada(origem)} className="min-w-[320px] flex-1 font-mono text-xs" />
            <Button variant="outline" onClick={() => copiar(linkEntrada(origem)).then(() => toast.success("Link copiado"))}>
              <Copy className="mr-1 h-4 w-4" /> Copiar
            </Button>
            <Button variant="outline" onClick={() => acao("sincronizar_convites")}>
              <RefreshCw className="mr-1 h-4 w-4" /> Sincronizar convites
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {ORIGENS_PADRAO.map((o) => (
              <button
                key={o}
                onClick={() => copiar(linkEntrada(o)).then(() => toast.success(`Link de ${o} copiado`))}
                className="rounded-md border p-2 text-left text-xs hover:bg-muted"
              >
                <div className="font-medium">{o}</div>
                <div className="truncate text-[10px] text-muted-foreground">{linkEntrada(o)}</div>
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            Recebendo os novos agora: <strong>{grupoDaVez?.nome ?? "nenhum grupo com vaga — as entradas caem no site"}</strong>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-[11px]">Margem de segurança (vagas)</Label>
              <Input type="number" className="w-32" value={margem} onChange={(e) => setMargem(Number(e.target.value))} />
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                await vipEntradaConfigSalvar({ margem_seguranca: margem, ativo: true });
                toast.success("Configuração da porta de entrada salva.");
              }}
            >
              <Save className="mr-1 h-4 w-4" /> Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Relatório de captação */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Relatório de captação</CardTitle>
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <Button key={d} size="sm" variant={d === dias ? "default" : "outline"} onClick={() => setDias(d)}>
                {d}d
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-3xl font-semibold tabular-nums">{num(resumo?.total ?? 0)} entradas</div>
          {(resumo?.sem_vaga?.length > 0 || resumo?.sem_link?.length > 0) && (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção na fila de entrada</AlertTitle>
              <AlertDescription className="text-xs">
                {resumo?.sem_vaga?.length > 0 && (
                  <div>Sem vaga: {resumo.sem_vaga.map((g: any) => g.nome ?? g).join(", ")}</div>
                )}
                {resumo?.sem_link?.length > 0 && (
                  <div>Sem link de convite: {resumo.sem_link.map((g: any) => g.nome ?? g).join(", ")}</div>
                )}
              </AlertDescription>
            </Alert>
          )}
          {serie.length > 0 && (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="dia" fontSize={11} />
                  <YAxis fontSize={11} />
                  <RTooltip />
                  <Bar dataKey="entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide">Por grupo</div>
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Membros</TableHead>
                    <TableHead className="text-right">Vagas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(resumo?.por_grupo ?? []).map((g: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{g.nome ?? g.grupo_nome}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(g.entradas ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(g.membros ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(g.vagas ?? g.vagas_restantes ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide">Ranking por origem</div>
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(resumo?.por_origem ?? []).map((o: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{o.origem ?? "(sem origem)"}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(o.entradas ?? o.total ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grupos */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm">Grupos</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {num(totalMembros)} membros · {num(totalBroadcast)} em broadcast · {num(totalComunidade)} em comunidade
            </p>
          </div>
          <Button variant="outline" onClick={() => acao("sincronizar_grupos")}>
            <RefreshCw className="mr-1 h-4 w-4" /> Sincronizar com o WhatsApp
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            <strong>broadcast</strong>: a marca fala, a base lê. <strong>comunidade</strong>: clientes conversam entre si —
            recebe tudo, inclusive oferta, mas com texto próprio, mais curto e sempre puxando resposta. Grupos novos
            entram inativos.
          </p>
          {grupos.map((g, idx) => {
            const m = mov7[String(g.id)] ?? mov7[String(g.nome ?? "")];
            return (
            <div key={g.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-12">
              <div className="md:col-span-3">
                <Label className="text-[11px]">Nome</Label>
                <Input
                  value={g.nome ?? ""}
                  onChange={(e) => setGrupos(grupos.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x)))}
                />
                {m && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    <span className="text-emerald-600">+{m.entradas}</span> /{" "}
                    <span className="text-destructive">-{m.saidas}</span> nos últimos 7 dias
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <Label className="text-[11px]">Perfil</Label>
                <Select
                  value={g.perfil ?? "broadcast"}
                  onValueChange={(v) => setGrupos(grupos.map((x, i) => (i === idx ? { ...x, perfil: v as any } : x)))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broadcast">broadcast</SelectItem>
                    <SelectItem value="comunidade">comunidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-1">
                <Label className="text-[11px]">Membros</Label>
                <Input
                  type="number"
                  value={g.membros ?? 0}
                  onChange={(e) => setGrupos(grupos.map((x, i) => (i === idx ? { ...x, membros: Number(e.target.value) } : x)))}
                />
              </div>
              <div className="md:col-span-1">
                <Label className="text-[11px]">Capacidade</Label>
                <Input
                  type="number"
                  value={g.capacidade ?? 1024}
                  onChange={(e) => setGrupos(grupos.map((x, i) => (i === idx ? { ...x, capacidade: Number(e.target.value) } : x)))}
                />
              </div>
              <div className="md:col-span-1">
                <Label className="text-[11px]">Ordem</Label>
                <Input
                  type="number"
                  value={g.ordem ?? 0}
                  onChange={(e) => setGrupos(grupos.map((x, i) => (i === idx ? { ...x, ordem: Number(e.target.value) } : x)))}
                />
              </div>
              <div className="flex items-end gap-3 md:col-span-2">
                <div className="flex items-center gap-1">
                  <Switch
                    checked={!!g.ativo}
                    onCheckedChange={(v) => setGrupos(grupos.map((x, i) => (i === idx ? { ...x, ativo: v } : x)))}
                  />
                  <span className="text-xs">ativo</span>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={!!g.aceita_novos}
                    onCheckedChange={(v) => setGrupos(grupos.map((x, i) => (i === idx ? { ...x, aceita_novos: v } : x)))}
                  />
                  <span className="text-xs">aceita novos</span>
                </div>
              </div>
              <div className="flex items-end md:col-span-2">
                <Button size="sm" onClick={() => salvarGrupo(grupos[idx])}>
                  <Save className="mr-1 h-4 w-4" /> Salvar
                </Button>
              </div>
              <div className="md:col-span-6">
                <Label className="text-[11px]">JID</Label>
                <Input
                  className="font-mono text-xs"
                  value={g.jid ?? ""}
                  onChange={(e) => setGrupos(grupos.map((x, i) => (i === idx ? { ...x, jid: e.target.value } : x)))}
                />
              </div>
              <div className="md:col-span-6">
                <Label className="text-[11px]">Observação</Label>
                <Input
                  value={g.observacao ?? ""}
                  onChange={(e) => setGrupos(grupos.map((x, i) => (i === idx ? { ...x, observacao: e.target.value } : x)))}
                />
              </div>
              {!g.link_convite && (
                <Badge variant="outline" className="md:col-span-12 w-fit border-amber-500/40 text-amber-600">
                  sem link de convite — rode Sincronizar convites
                </Badge>
              )}
            </div>
            );
          })}

        </CardContent>
      </Card>

      {/* Configuração de envio */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Configuração de envio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Risco do canal</AlertTitle>
            <AlertDescription className="text-xs">
              O envio para grupos usa API não oficial do WhatsApp (Evolution). Há risco de bloqueio do número. Mantenha
              intervalo de no mínimo 45 s, no máximo um disparo por dia por grupo, e use número dedicado.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label className="text-[11px]">Provedor</Label>
              <Input value={config.provedor ?? "evolution"} onChange={(e) => setConfig({ ...config, provedor: e.target.value })} />
            </div>
            <div>
              <Label className="text-[11px]">Base URL</Label>
              <Input value={config.base_url ?? ""} onChange={(e) => setConfig({ ...config, base_url: e.target.value })} />
            </div>
            <div>
              <Label className="text-[11px]">Instância</Label>
              <Input value={config.instancia ?? ""} onChange={(e) => setConfig({ ...config, instancia: e.target.value })} />
            </div>
            <div>
              <Label className="text-[11px]">API key {config.api_key_definida ? "(já definida)" : ""}</Label>
              <Input type="password" placeholder={config.api_key_definida ? "••••••••" : ""} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
            <div>
              <Label className="text-[11px]">Horário padrão</Label>
              <Input type="time" value={(config.horario_padrao ?? "20:30").slice(0, 5)} onChange={(e) => setConfig({ ...config, horario_padrao: e.target.value })} />
            </div>
            <div>
              <Label className="text-[11px]">Intervalo entre grupos (s)</Label>
              <Input
                type="number"
                min={45}
                value={config.intervalo_segundos ?? 45}
                onChange={(e) => setConfig({ ...config, intervalo_segundos: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-[11px]">Custo mensal (habilita o ROI)</Label>
              <Input
                type="number"
                value={config.custo_mensal ?? ""}
                onChange={(e) => setConfig({ ...config, custo_mensal: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end gap-2">
              <Switch
                checked={!!config.envio_automatico}
                onCheckedChange={(v) => setConfig({ ...config, envio_automatico: v })}
              />
              <span className="text-sm">Envio automático</span>
            </div>
          </div>

          <div>
            <Label className="text-[11px]">Webhook para colar no provedor (MESSAGES_UPDATE e MESSAGES_UPSERT)</Label>
            <div className="flex gap-2">
              <Input readOnly value={config.webhook_url ?? ""} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copiar(config.webhook_url ?? "").then(() => toast.success("Webhook copiado"))}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Mensagem agendada + automático ligado → no dia e horário (fuso São Paulo) o cron cria um envio por grupo ativo,
            respeita o intervalo e marca como enviada. Cada grupo recebe o seu link curto e o texto do seu perfil, com até
            3 tentativas. Com o automático desligado, tudo funciona no copiar e colar com “Marcar como enviada”.
          </p>

          <div className="flex gap-2">
            <Button
              onClick={async () => {
                try {
                  await vipConfigSalvar({ ...config, ...(apiKey ? { api_key: apiKey } : {}) });
                  setApiKey("");
                  toast.success("Configuração salva.");
                  carregar();
                } catch (e: any) {
                  toast.error(e.message ?? "Falha ao salvar");
                }
              }}
            >
              <Save className="mr-1 h-4 w-4" /> Salvar configuração
            </Button>
            <Button variant="outline" onClick={() => acao("testar")}>Testar conexão</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
