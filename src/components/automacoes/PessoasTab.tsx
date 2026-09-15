import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { dataHoraBR, rpcFluxos, MOTIVOS_PULO, ROTULO_STATUS_EXECUCAO } from "./api";

type Execucao = {
  id: number | string;
  email?: string | null;
  nome?: string | null;
  telefone?: string | null;
  status?: string | null;
  teste?: boolean | null;
  iniciada_em?: string | null;
  finalizada_em?: string | null;
  motivo_saida?: string | null;
  erro?: string | null;
  proxima_execucao_em?: string | null;
  no_atual_id?: number | string | null;
  no_atual?: string | null;
};

const ACOES: Record<string, (d: any) => string> = {
  entrou: () => "Entrou",
  aguardando: (d) => `Esperando até ${d?.ate ?? "o horário"}`,
  email_enfileirado: () => "E-mail na fila",
  whatsapp_enfileirado: () => "WhatsApp na fila",
  sim: () => "Sim",
  nao: () => "Não",
  passou: () => "Passou no filtro",
  barrado: () => "Barrada no filtro",
  pulado: (d) => `Pulado: ${MOTIVOS_PULO[d?.motivo] ?? d?.motivo ?? "sem motivo"}`,
  tag_aplicada: () => "Tag aplicada",
  saiu_comprou: () => "Saiu: comprou",
  encerrada_manual: () => "Encerrada no painel",
  fim: () => "Fim",
  erro: (d) => `Erro: ${d?.erro ?? "sem detalhe"}`,
};

function TimelineSheet({ execucaoId, onFechar }: { execucaoId: number | string | null; onFechar: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["fluxo-execucao-timeline", execucaoId],
    enabled: !!execucaoId,
    queryFn: () => rpcFluxos<any>("fluxo_execucao_timeline", { p_execucao_id: execucaoId }),
  });

  const passos: any[] = data?.passos ?? [];

  return (
    <Sheet open={!!execucaoId} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{data?.execucao?.nome || data?.execucao?.email || "Passo a passo"}</SheetTitle>
        </SheetHeader>
        {isLoading && <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && passos.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">Nenhum passo registrado ainda.</p>
        )}
        <ol className="mt-4 space-y-3">
          {passos.map((p, i) => (
            <li key={i} className="border-l-2 border-border pl-3">
              <p className="text-[11px] text-muted-foreground">{dataHoraBR(p.em)}</p>
              <p className="text-sm font-medium">{p.no || p.tipo}</p>
              <p className="text-xs">{(ACOES[p.acao] ?? (() => p.acao))(p.detalhe ?? {})}</p>
              {p.email && (
                <p className="text-[11px] text-muted-foreground">
                  E-mail {p.email.status}
                  {p.email.assunto ? `: ${p.email.assunto}` : ""}
                  {p.email.aberto_em ? ", aberto" : ""}
                  {p.email.clicado_em ? ", clicado" : ""}
                  {p.email.cupom ? `, cupom ${p.email.cupom}` : ""}
                  {p.email.erro ? `, erro: ${p.email.erro}` : ""}
                </p>
              )}
              {p.whatsapp && (
                <p className="text-[11px] text-muted-foreground">
                  WhatsApp {p.whatsapp.status}
                  {p.whatsapp.enviado_como ? ` como ${p.whatsapp.enviado_como}` : ""}
                  {p.whatsapp.entrega ? `, ${p.whatsapp.entrega}` : ""}
                  {p.whatsapp.erro ? `, erro: ${p.whatsapp.erro}` : ""}
                </p>
              )}
              {p.sucesso === false && <Badge variant="outline" className="mt-1 text-[10px] text-danger">falhou</Badge>}
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}

export function PessoasTab({ fluxoId }: { fluxoId: string }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [selecionadas, setSelecionadas] = useState<(number | string)[]>([]);
  const [aberta, setAberta] = useState<number | string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["fluxo-execucoes", fluxoId, status, busca],
    queryFn: async () =>
      (await rpcFluxos<Execucao[]>("fluxo_execucoes", {
        p_fluxo_id: fluxoId,
        p_status: status === "todos" ? null : status,
        p_busca: busca || null,
        p_limite: 100,
      })) ?? [],
  });

  const encerrar = useMutation({
    mutationFn: async () => rpcFluxos("fluxo_execucao_encerrar", { p_execucao_ids: selecionadas }),
    onSuccess: () => {
      toast({ title: "Pessoas encerradas no fluxo" });
      setSelecionadas([]);
      setConfirmando(false);
      queryClient.invalidateQueries({ queryKey: ["fluxo-execucoes", fluxoId] });
    },
    onError: (e: any) => toast({ title: "Não deu para encerrar", description: e.message, variant: "destructive" }),
  });

  const alternar = (id: number | string) =>
    setSelecionadas((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(ROTULO_STATUS_EXECUCAO).map(([v, r]) => (
              <SelectItem key={v} value={v}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-[260px]"
          placeholder="Buscar por e-mail, nome ou telefone"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {selecionadas.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setConfirmando(true)}>
            Encerrar ({selecionadas.length})
          </Button>
        )}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-8 p-2" />
              <th className="p-2">Pessoa</th>
              <th className="p-2">Status</th>
              <th className="p-2">Passo atual</th>
              <th className="p-2">Próximo passo</th>
              <th className="p-2">Entrou</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="p-4 text-muted-foreground">Carregando pessoas…</td></tr>
            )}
            {!isLoading && linhas.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-muted-foreground">Ninguém neste filtro ainda.</td></tr>
            )}
            {linhas.map((l) => (
              <tr
                key={String(l.id)}
                className="cursor-pointer border-t border-border hover:bg-accent/40"
                onClick={() => setAberta(l.id)}
              >
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selecionadas.includes(l.id)} onCheckedChange={() => alternar(l.id)} />
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.nome || l.email || l.telefone}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{l.email || l.telefone}</p>
                    </div>
                    {l.teste && <Badge variant="outline" className="text-[10px]">teste</Badge>}
                  </div>
                </td>
                <td className="p-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {ROTULO_STATUS_EXECUCAO[String(l.status)] ?? l.status}
                  </Badge>
                  {l.erro && <p className="text-[11px] text-danger">{l.erro}</p>}
                </td>
                <td className="p-2 text-xs">{l.no_atual ?? ""}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {l.status === "ativa" && l.proxima_execucao_em ? dataHoraBR(l.proxima_execucao_em) : ""}
                </td>
                <td className="p-2 text-xs text-muted-foreground">{dataHoraBR(l.iniciada_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <TimelineSheet execucaoId={aberta} onFechar={() => setAberta(null)} />

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar no fluxo?</AlertDialogTitle>
            <AlertDialogDescription>
              {selecionadas.length} pessoas saem do fluxo e o que estiver na fila é cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => encerrar.mutate()}>Encerrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
