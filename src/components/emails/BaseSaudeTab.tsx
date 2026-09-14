import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { dataBrHora, inteiro, numero, rpcEmails } from "@/lib/emails";

const CORES = [
  "hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))",
  "hsl(var(--danger))", "hsl(var(--muted-foreground))", "hsl(var(--accent))",
];

export function BaseSaudeTab({ dias }: { dias: number }) {
  const queryClient = useQueryClient();
  const [confirmaTexto, setConfirmaTexto] = useState("");
  const [confirmaAberto, setConfirmaAberto] = useState(false);
  const [regras, setRegras] = useState<any[]>([]);

  const { data: kpis } = useQuery({
    queryKey: ["emails-kpis", dias],
    queryFn: () => rpcEmails<any>("emails_kpis", { p_dias: dias }),
  });
  const { data: painel } = useQuery({
    queryKey: ["emails-painel-resumo", dias],
    queryFn: () => rpcEmails<any>("emails_painel_resumo", { p_dias: dias }),
  });
  const { data: config } = useQuery({
    queryKey: ["emails-config"],
    queryFn: () => rpcEmails<any>("emails_config_get"),
  });
  const { data: spf } = useQuery({
    queryKey: ["emails-spf"],
    queryFn: () => rpcEmails<any>("emails_spf_config_get"),
  });
  const { data: dns = [] } = useQuery({
    queryKey: ["emails-dns"],
    queryFn: async () => (await rpcEmails<any>("emails_dns_historico_listar", { p_limite: 10 })) ?? [],
  });

  const base = kpis?.base ?? {};
  const porOrigem = Object.entries(base.por_origem ?? {}).map(([name, value]) => ({ name, value: numero(value) }));

  useEffect(() => {
    const vindas = painel?.frequencia_regras ?? config?.frequencia_regras ?? [];
    setRegras(Array.isArray(vindas) ? vindas.map((r: any) => ({ ...r })) : []);
  }, [painel, config]);

  const salvarConfig = useMutation({
    mutationFn: (patch: Record<string, any>) => rpcEmails("emails_config_salvar", { p_patch: patch }),
    onSuccess: () => {
      toast({ title: "Configuração salva" });
      queryClient.invalidateQueries({ queryKey: ["emails-config"] });
    },
    onError: (e: any) => toast({ title: "Não deu para salvar", description: e.message, variant: "destructive" }),
  });

  const tetoTotal = regras.reduce(
    (acc, r) => acc + numero(r.contatos ?? 0) * numero(r.por_mes ?? 0),
    0
  );

  const alterarRegra = (i: number, campo: string, valor: number) =>
    setRegras((prev) => prev.map((r, idx) => (idx === i ? { ...r, [campo]: valor } : r)));

  return (
    <div className="space-y-6">
      {/* Bloco 1 */}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="space-y-4 p-5">
          <h3 className="font-serif text-lg">Contatos</h3>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {[
              ["Total", base.contatos],
              ["Contactáveis", base.contactaveis],
              ["Descadastrados", base.descadastrados],
              ["Novos no período", base.novos_no_periodo],
              ["Engajados 90 dias", base.engajados_90d],
            ].map(([r, v]: any) => (
              <div key={r} className="rounded-lg border p-3">
                <p className="font-serif text-xl">{inteiro(v)}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{r}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-2 font-serif text-lg">Origem dos contatos</h3>
          <div className="h-56">
            {porOrigem.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem contatos para dividir por origem.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porOrigem} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                    {porOrigem.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <RTooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </section>

      {/* Bloco 2 */}
      <Card className="space-y-3 p-5">
        <h3 className="font-serif text-lg">Tetos de frequência</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segmento RFM</TableHead>
                <TableHead className="text-right">Por semana</TableHead>
                <TableHead className="text-right">Por mês</TableHead>
                <TableHead className="text-right">Teto mensal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regras.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Nenhuma regra de frequência cadastrada.
                  </TableCell>
                </TableRow>
              )}
              {regras.map((r: any, i: number) => (
                <TableRow key={r.segmento ?? i}>
                  <TableCell className="font-medium">{r.segmento ?? r.segmento_rfm}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number" className="ml-auto h-8 w-20 text-right"
                      value={r.por_semana ?? 0}
                      onChange={(e) => alterarRegra(i, "por_semana", Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number" className="ml-auto h-8 w-20 text-right"
                      value={r.por_mes ?? 0}
                      onChange={(e) => alterarRegra(i, "por_mes", Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {inteiro(numero(r.contatos ?? 0) * numero(r.por_mes ?? 0))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Teto total da base: {inteiro(tetoTotal)} e-mails por mês</p>
          {regras.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => salvarConfig.mutate({ frequencia_regras: regras })}>
              Salvar tetos
            </Button>
          )}
        </div>
      </Card>

      {/* Bloco 3 */}
      <Card className="space-y-4 p-5">
        <h3 className="font-serif text-lg">Configuração de envio</h3>
        <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Provedor", config?.provedor],
            ["Região", config?.regiao],
            ["Remetente", config?.remetente],
            ["Responder para", config?.responder_para],
            ["Janela de horário", config?.janela_horario ?? `${config?.hora_inicio ?? ""} às ${config?.hora_fim ?? ""}`],
            ["Lote", config?.lote],
          ].map(([r, v]: any) => (
            <div key={r} className="rounded-lg border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{r}</p>
              <p className="font-medium">{v ?? "sem dados"}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning/5 p-4">
            <div>
              <p className="font-medium">Modo teste</p>
              <p className="text-xs text-muted-foreground">Com o modo teste ligado, só os endereços de teste recebem.</p>
            </div>
            <Switch
              checked={!!config?.modo_teste}
              onCheckedChange={(v) => {
                if (!v) { setConfirmaTexto(""); setConfirmaAberto(true); }
                else salvarConfig.mutate({ modo_teste: true });
              }}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-danger/40 bg-danger/5 p-4">
            <div>
              <p className="font-medium">Envio ativo</p>
              <p className="text-xs text-muted-foreground">Desligar para o motor de envio inteiro.</p>
            </div>
            <Switch
              checked={!!config?.envio_ativo}
              onCheckedChange={(v) => salvarConfig.mutate({ envio_ativo: v })}
            />
          </div>
        </div>

        {config?.modo_teste && (
          <div className="space-y-1">
            <p className="text-sm font-medium">E-mails de teste cadastrados</p>
            <div className="flex flex-wrap gap-2">
              {(config?.emails_teste ?? []).map((e: string) => (
                <Badge key={e} variant="secondary">{e}</Badge>
              ))}
              {(config?.emails_teste ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum endereço de teste cadastrado.</p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Bloco 4 */}
      <Card className="space-y-4 p-5">
        <h3 className="font-serif text-lg">Saúde do domínio</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">SPF atual</p>
            <p className="break-all font-mono text-xs">{spf?.spf_atual ?? spf?.registro ?? "sem dados"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lookups</p>
            <p className="font-serif text-xl">
              {inteiro(spf?.lookups)} de {inteiro(spf?.max_lookups)}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Última manutenção automática: {dataBrHora(spf?.ultima_execucao)} · {spf?.ultimo_resultado ?? "sem registro"}
        </p>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Valor anterior</TableHead>
                <TableHead>Valor novo</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(dns as any[]).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Nenhuma escrita de DNS registrada.
                  </TableCell>
                </TableRow>
              )}
              {(dns as any[]).map((d: any, i: number) => (
                <TableRow key={d.id ?? i}>
                  <TableCell className="whitespace-nowrap text-sm">{dataBrHora(d.created_at ?? d.data)}</TableCell>
                  <TableCell className="text-sm">{d.registro}</TableCell>
                  <TableCell className="max-w-[220px] truncate font-mono text-xs">{d.valor_anterior}</TableCell>
                  <TableCell className="max-w-[220px] truncate font-mono text-xs">{d.valor_novo}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.motivo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={confirmaAberto} onOpenChange={setConfirmaAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Desligar o modo teste</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Com o modo teste desligado, os e-mails vão para as clientes de verdade. Digite SAIR DO TESTE para confirmar.
          </p>
          <Input value={confirmaTexto} onChange={(e) => setConfirmaTexto(e.target.value)} placeholder="SAIR DO TESTE" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmaAberto(false)}>Cancelar</Button>
            <Button
              disabled={confirmaTexto.trim().toUpperCase() !== "SAIR DO TESTE"}
              onClick={() => { salvarConfig.mutate({ modo_teste: false }); setConfirmaAberto(false); }}
            >
              Desligar modo teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
