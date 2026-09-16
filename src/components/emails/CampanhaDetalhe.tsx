import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, inteiro, pct1, rpcEmails, SEM_DADOS } from "@/lib/emails";
import { ControlesPrevia, IframePrevia, usePreviaTemplate } from "./PreviaTemplate";

const CLASSE_STATUS: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  preparada: "bg-primary/15 text-primary border-primary/30",
  enviando: "bg-warning/15 text-warning border-warning/30 animate-pulse",
  concluida: "bg-success/15 text-success border-success/30",
  concluída: "bg-success/15 text-success border-success/30",
  cancelada: "bg-muted text-muted-foreground line-through",
};

const FUSO = "America/Sao_Paulo";

/** ISO do banco para o valor de um input datetime-local em horário de Brasília. */
function isoParaCampo(iso: any): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
  return p.replace(" ", "T").slice(0, 16);
}

/** Valor do input (horário de Brasília) de volta para ISO com fuso. */
function campoParaIso(v: string): string | null {
  if (!v) return null;
  return `${v}:00-03:00`;
}

function dataHoraBrasilia(iso: any): string {
  if (!iso) return SEM_DADOS;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.toLocaleString("pt-BR", {
    timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })} (Brasília)`;
}

function msgErro(e: any): string {
  return String(e?.message ?? e ?? "Não deu certo.");
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <p className={cn("font-serif text-2xl", destaque)}>{valor}</p>
    </Card>
  );
}

function Cabecalho({
  campanha, status, onVoltar,
}: { campanha: any; status: string; onVoltar: () => void }) {
  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onVoltar}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para a lista
      </Button>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-serif text-2xl">{campanha?.nome ?? "Campanha"}</h3>
        <Badge variant="outline" className={cn(CLASSE_STATUS[status] ?? "")}>{status}</Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Numero rotulo="Alvo" valor={inteiro(campanha?.total_alvo)} />
        <Numero rotulo="Enfileirados" valor={inteiro(campanha?.total_enfileirado)} />
        <Numero rotulo="Bloqueados por frequência" valor={inteiro(campanha?.total_bloqueado_frequencia)} />
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Disparo agendado</p>
          <p className="font-serif text-lg">{dataHoraBrasilia(campanha?.agendada_para)}</p>
        </Card>
      </div>
    </div>
  );
}

function Previa({ slug }: { slug?: string | null }) {
  const [mobile, setMobile] = useState(false);
  const { data: previa, isLoading } = usePreviaTemplate(slug);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Prévia do e-mail</p>
        <ControlesPrevia mobile={mobile} onMobile={setMobile} />
      </div>
      {!slug && <p className="text-sm text-muted-foreground">Esta campanha não aponta para um template.</p>}
      {slug && isLoading && <p className="text-sm text-muted-foreground">Carregando a prévia…</p>}
      {slug && <IframePrevia titulo="Prévia da campanha" mobile={mobile} altura={520} html={previa?.html} />}
    </div>
  );
}

function AberturaPorDominio({ id }: { id: any }) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["emails-campanha-dominios", id],
    queryFn: async () =>
      (await rpcEmails<any[]>("emails_campanha_abertura_por_dominio", {
        p_campanha_id: id, p_min_envios: 15,
      })) ?? [],
    retry: false,
  });

  const linhas = (data ?? [])
    .filter((l: any) => Number(l.enviados ?? 0) >= 15)
    .sort((a: any, b: any) => Number(b.enviados ?? 0) - Number(a.enviados ?? 0));

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-sm font-medium">Abertura por domínio de e-mail</p>
        <p className="text-xs text-muted-foreground">
          Só domínios com 15 envios ou mais. Queda concentrada em um domínio costuma ser problema de entrega.
        </p>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {error && (
        <p className="text-sm text-muted-foreground">
          Esta quebra ainda não está disponível no banco. Mensagem: {msgErro(error)}
        </p>
      )}
      {!isLoading && !error && linhas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum domínio chegou a 15 envios nesta campanha.
        </p>
      )}
      {linhas.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domínio</TableHead>
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead className="text-right">Aberturas</TableHead>
              <TableHead className="text-right">Taxa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l: any) => {
              const env = Number(l.enviados ?? 0);
              const ab = Number(l.aberturas ?? l.aberturas_unicas ?? 0);
              const taxa = l.taxa_pct ?? l.taxa ?? (env > 0 ? (ab / env) * 100 : null);
              return (
                <TableRow key={String(l.dominio)}>
                  <TableCell className="font-medium">{l.dominio}</TableCell>
                  <TableCell className="text-right">{inteiro(env)}</TableCell>
                  <TableCell className="text-right">{inteiro(ab)}</TableCell>
                  <TableCell className="text-right">{pct1(taxa)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function Preparada({
  id, resumo, onVoltar, onAbrirTemplate,
}: {
  id: any;
  resumo: any;
  onVoltar: () => void;
  onAbrirTemplate?: (slug: string) => void;
}) {
  const queryClient = useQueryClient();
  const campanha = resumo?.campanha ?? {};

  const { data: dados } = useQuery({
    queryKey: ["emails-campanha-get", id],
    queryFn: () => rpcEmails<any>("emails_campanha_get", { p_campanha_id: id }),
  });

  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [preheader, setPreheader] = useState("");
  const [quando, setQuando] = useState("");
  const [throttle, setThrottle] = useState("");
  const [carregado, setCarregado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    if (carregado || !dados) return;
    setNome(String(dados.nome ?? ""));
    setAssunto(String(dados.assunto ?? ""));
    setPreheader(String(dados.preheader ?? ""));
    setQuando(isoParaCampo(dados.agendada_para));
    setThrottle(campanha?.throttle_por_minuto != null ? String(campanha.throttle_por_minuto) : "");
    setCarregado(true);
  }, [dados, carregado, campanha]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["emails-campanhas"] });
    queryClient.invalidateQueries({ queryKey: ["emails-campanha-resumo", id] });
    queryClient.invalidateQueries({ queryKey: ["emails-campanha-get", id] });
  };

  const salvar = useMutation({
    mutationFn: () =>
      rpcEmails<any>("emails_campanha_editar_preparada", {
        p_patch: {
          id,
          nome,
          assunto,
          preheader: preheader || null,
          agendada_para: campoParaIso(quando),
          throttle_por_minuto: throttle === "" ? null : Number(throttle),
        },
      }),
    onSuccess: (r: any) => {
      const n = Number(r?.fila_atualizada ?? 0);
      toast({
        title: "Campanha atualizada",
        description: `${inteiro(n)} linha(s) da fila foram atualizadas com o novo assunto e horário.`,
      });
      invalidar();
    },
    onError: (e: any) => toast({ title: "Não deu para salvar", description: msgErro(e), variant: "destructive" }),
  });

  const cancelar = useMutation({
    mutationFn: () => rpcEmails<any>("emails_campanha_cancelar", { p_campanha_id: id }),
    onSuccess: (r: any) => {
      toast({
        title: "Campanha cancelada",
        description: `${inteiro(r?.cancelados ?? 0)} envio(s) cancelado(s) e ${inteiro(r?.ja_enviados ?? 0)} já tinham saído.`,
      });
      setConfirmar(false);
      invalidar();
      onVoltar();
    },
    onError: (e: any) => toast({ title: "Não deu para cancelar", description: msgErro(e), variant: "destructive" }),
  });

  const naFila = Number(campanha?.total_enfileirado ?? resumo?.fila ?? 0);
  const slug = dados?.template_slug ?? null;

  return (
    <div className="space-y-6">
      <Cabecalho campanha={campanha} status="preparada" onVoltar={onVoltar} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-4">
          <p className="text-sm font-medium">Ajustes do disparo</p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Assunto</label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Preheader</label>
            <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Data e hora do disparo</label>
              <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
              <p className="text-xs text-muted-foreground">Horário de Brasília.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Envios por minuto</label>
              <Input
                type="number"
                min={1}
                value={throttle}
                onChange={(e) => setThrottle(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar alterações
            </Button>
            <Button
              variant="ghost"
              className="text-danger hover:text-danger"
              onClick={() => setConfirmar(true)}
            >
              Cancelar campanha
            </Button>
          </div>

          <div className="space-y-1 rounded-md border border-dashed p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!slug}
                onClick={() => slug && onAbrirTemplate?.(slug)}
              >
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Editar o template
              </Button>
              <span className="text-xs text-muted-foreground">
                A campanha aponta para o template. Editar o template muda o que ainda não foi enviado, inclusive os que já estão na fila.
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Público e template não podem ser trocados depois que a campanha foi preparada.
            </p>
          </div>
        </Card>

        <Previa slug={slug} />
      </div>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              {inteiro(naFila)} envio(s) estão na fila e não vão sair. Quem já recebeu continua contando nos números.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={(e) => { e.preventDefault(); cancelar.mutate(); }}
            >
              {cancelar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Cancelar campanha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Enviando({ id, resumo, onVoltar }: { id: any; resumo: any; onVoltar: () => void }) {
  const campanha = resumo?.campanha ?? {};
  const { data: dados } = useQuery({
    queryKey: ["emails-campanha-get", id],
    queryFn: () => rpcEmails<any>("emails_campanha_get", { p_campanha_id: id }),
  });
  const { data: vivo, error } = useQuery({
    queryKey: ["emails-campanha-acompanhar", id],
    queryFn: () => rpcEmails<any>("emails_campanha_acompanhar", { p_campanha_id: id }),
    refetchInterval: 30000,
    retry: false,
  });

  const total = Number(vivo?.total ?? campanha?.total_enfileirado ?? 0);
  const enviados = Number(vivo?.enviados ?? resumo?.enviados ?? 0);
  const alertas: string[] = Array.isArray(vivo?.alertas) ? vivo.alertas : [];

  return (
    <div className="space-y-6">
      <Cabecalho campanha={campanha} status="enviando" onVoltar={onVoltar} />

      {alertas.length > 0 && (
        <Card className="space-y-1 border-warning/40 bg-warning/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-warning">
            <AlertTriangle className="h-4 w-4" /> Atenção
          </p>
          {alertas.map((a, i) => <p key={i} className="text-sm">{a}</p>)}
        </Card>
      )}

      {error && (
        <p className="text-sm text-muted-foreground">
          O acompanhamento ao vivo não respondeu agora. Mensagem: {msgErro(error)}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Numero rotulo="Enviados" valor={`${inteiro(enviados)} de ${inteiro(total)}`} />
        <Numero rotulo="Na fila" valor={inteiro(vivo?.fila ?? resumo?.fila)} />
        <Numero rotulo="Erros" valor={inteiro(vivo?.erros ?? resumo?.erros)} />
        <Numero rotulo="Bounces" valor={inteiro(vivo?.bounces)} />
        <Numero rotulo="Reclamações" valor={inteiro(vivo?.reclamacoes ?? vivo?.complaints)} />
      </div>

      <p className="text-xs text-muted-foreground">Os números se atualizam sozinhos a cada 30 segundos.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">Assunto</p>
          <p className="text-sm text-muted-foreground">{dados?.assunto ?? campanha?.assunto}</p>
          <p className="text-sm font-medium">Preheader</p>
          <p className="text-sm text-muted-foreground">{dados?.preheader ?? campanha?.preheader ?? SEM_DADOS}</p>
        </Card>
        <Previa slug={dados?.template_slug} />
      </div>
    </div>
  );
}

function Fechada({ id, resumo, status, onVoltar }: { id: any; resumo: any; status: string; onVoltar: () => void }) {
  const campanha = resumo?.campanha ?? {};
  const taxas = resumo?.taxas ?? {};
  const receita = resumo?.receita ?? {};

  return (
    <div className="space-y-6">
      <Cabecalho campanha={campanha} status={status} onVoltar={onVoltar} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Numero rotulo="Enviados" valor={inteiro(resumo?.enviados)} />
        <Numero rotulo="Erros" valor={inteiro(resumo?.erros)} />
        <Numero rotulo="Aberturas únicas" valor={inteiro(resumo?.aberturas_unicas)} />
        <Numero rotulo="Cliques únicos" valor={inteiro(resumo?.cliques_unicos)} />
        <Numero rotulo="Descadastros" valor={inteiro(resumo?.descadastros)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Numero rotulo="Taxa de abertura única" valor={pct1(taxas.abertura_pct)} />
        <Numero rotulo="Taxa de clique único" valor={pct1(taxas.clique_pct)} />
        <Numero rotulo="Clique sobre abertura" valor={pct1(taxas.clique_sobre_abertura_pct)} />
        <Numero rotulo="Taxa de descadastro" valor={pct1(taxas.descadastro_pct)} />
      </div>

      <Card className="space-y-3 p-4">
        <p className="text-sm font-medium">Receita</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Atribuída</p>
            <p className="font-serif text-xl">{brl(receita.atribuida)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Assistida</p>
            <p className="font-serif text-xl">{brl(receita.assistida)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Ticket médio</p>
            <p className="font-serif text-xl">{brl(receita.ticket_medio)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Por mil enviados</p>
            <p className="font-serif text-xl">{brl(receita.por_mil_enviados)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Janela de atribuição de {inteiro(receita.janela_dias)} dia(s), com {inteiro(receita.pedidos_atribuidos)} pedido(s) atribuído(s).
        </p>
      </Card>

      <AberturaPorDominio id={id} />
    </div>
  );
}

export function CampanhaDetalhe({
  id, onVoltar, onAbrirTemplate,
}: {
  id: any;
  onVoltar: () => void;
  onAbrirTemplate?: (slug: string) => void;
}) {
  const { data: resumo, isLoading, error } = useQuery({
    queryKey: ["emails-campanha-resumo", id],
    queryFn: () => rpcEmails<any>("emails_campanha_resumo", { p_campanha_id: id }),
    retry: false,
  });

  const status = useMemo(
    () => String(resumo?.campanha?.status ?? "").toLowerCase(),
    [resumo],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onVoltar}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para a lista
        </Button>
        <p className="text-sm text-muted-foreground">Carregando a campanha…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onVoltar}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para a lista
        </Button>
        <p className="text-sm text-danger">{msgErro(error)}</p>
      </div>
    );
  }

  if (status === "preparada")
    return <Preparada id={id} resumo={resumo} onVoltar={onVoltar} onAbrirTemplate={onAbrirTemplate} />;
  if (status === "enviando")
    return <Enviando id={id} resumo={resumo} onVoltar={onVoltar} />;
  return <Fechada id={id} resumo={resumo} status={status || "concluida"} onVoltar={onVoltar} />;
}
