import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Archive, Copy, Eye, MousePointerClick, Pause, Pencil, Percent, Play, Plus, Smartphone } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { NotaCirculo } from "@/components/popups/NotaCirculo";
import {
  popupsApi, IDENTIDADE_MC, ROTULO_FORMATO, dataHoraBR, nBR, novoId, pctBR,
  type Popup, type StatusPopup, type Validacao,
} from "@/lib/popups";

const ROTULO_INSTALACAO: Record<string, string> = {
  instalado: "Instalado",
  nao_instalado: "Não instalou",
};

const ROTULO_PLATAFORMA: Record<string, string> = {
  android: "Android",
  ios: "iPhone",
  outro: "Outro",
};

const ROTULO_SITUACAO: Record<string, string> = {
  pedido_em_transito: "Pedido em trânsito",
  pedido_entregue_recente: "Pedido entregue há pouco",
  sem_pedido: "Sem pedido",
  cashback_disponivel: "Tem cashback",
  troca_aberta: "Troca aberta",
};

function chipsPublico(p: Popup): string[] {
  const a = p.regras?.app ?? {};
  const chips: string[] = [];
  if (a.instalacao && a.instalacao !== "todos") chips.push(ROTULO_INSTALACAO[a.instalacao] ?? a.instalacao);
  const plataformas: string[] = a.plataformas ?? [];
  if (plataformas.length && plataformas.length < 3) {
    for (const pl of plataformas) chips.push(ROTULO_PLATAFORMA[pl] ?? pl);
  }
  if (a.identificada === "sim") chips.push("Com CPF salvo");
  if (a.identificada === "nao") chips.push("Sem CPF salvo");
  for (const s of a.situacoes ?? []) chips.push(ROTULO_SITUACAO[s] ?? s);
  return chips.length ? chips : ["Todas no app"];
}

function ChipStatus({ p }: { p: Popup }) {
  if (p.status === "ativo" && p.no_ar_agora)
    return (
      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
        <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-success" />
        Ativo
      </Badge>
    );
  if (p.status === "ativo")
    return <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">Agendado</Badge>;
  if (p.status === "pausado")
    return <Badge variant="outline" className="border-border bg-foreground/10 text-foreground">Pausado</Badge>;
  if (p.status === "arquivado")
    return <Badge variant="outline" className="text-muted-foreground">Arquivado</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Rascunho</Badge>;
}

/* ============ Modelos prontos do app ============ */

type ModeloApp = {
  chave: string;
  nome: string;
  descricao: string;
  montar: () => Popup;
};

function etapa(elementos: any[]) {
  return [{ id: novoId("et"), nome: "Etapa 1", elementos: elementos.map((e) => ({ id: novoId("el"), margem: 12, visivel: "todos", ...e })) }];
}

const MODELOS_APP: ModeloApp[] = [
  {
    chave: "instalar",
    nome: "Convite para instalar",
    descricao: "Para quem usa o app pelo navegador e ainda não instalou.",
    montar: () => ({
      nome: "Convite para instalar",
      destino: "app",
      formato: "modal",
      design: {
        ...IDENTIDADE_MC,
        formato_mobile: "folha",
        etapas: etapa([
          { tipo: "titulo", texto: "Leve a Minha MC no seu celular", tamanho: 28, peso: 700, alinhar: "center" },
          { tipo: "texto", texto: "Acompanhe seus pedidos, seu cashback e suas trocas em um toque, sem procurar link.", tamanho: 15, alinhar: "center" },
          { tipo: "botao", texto: "Instalar app", acao: "link", url: "#mc-app-instalar", largura: "total" },
          { tipo: "link_fechar", texto: "Agora não" },
          { tipo: "assinatura", texto: "Com carinho, Mari 💛", tamanho: 21, alinhar: "center" },
        ]),
      },
      regras: {
        dispositivos: ["mobile"],
        paginas: { incluir: ["*"] },
        frequencia: { tipo: "a_cada_dias", dias: 7 },
        app: { instalacao: "nao_instalado", plataformas: ["android", "ios", "outro"], identificada: "todas", situacoes: [], situacoes_modo: "qualquer" },
      },
    }),
  },
  {
    chave: "avisos",
    nome: "Ativar avisos",
    descricao: "Para quem já instalou e ainda não recebe avisos de entrega.",
    montar: () => ({
      nome: "Ativar avisos",
      destino: "app",
      formato: "modal",
      design: {
        ...IDENTIDADE_MC,
        etapas: etapa([
          { tipo: "titulo", texto: "Quer saber quando seu pedido sair?", tamanho: 28, peso: 700, alinhar: "center" },
          { tipo: "texto", texto: "Ative os avisos e a gente te conta cada passo da entrega.", tamanho: 15, alinhar: "center" },
          { tipo: "botao", texto: "Ativar avisos", acao: "link", url: "#mc-app-ativar_avisos", largura: "total" },
          { tipo: "link_fechar", texto: "Depois" },
          { tipo: "assinatura", texto: "Com carinho, Mari 💛", tamanho: 21, alinhar: "center" },
        ]),
      },
      regras: {
        dispositivos: ["mobile"],
        paginas: { incluir: ["*"] },
        frequencia: { tipo: "a_cada_dias", dias: 7 },
        app: { instalacao: "instalado", plataformas: ["android", "ios", "outro"], identificada: "todas", situacoes: [], situacoes_modo: "qualquer" },
      },
    }),
  },
  {
    chave: "pedido_a_caminho",
    nome: "Pedido a caminho",
    descricao: "Aparece para quem tem entrega em andamento.",
    montar: () => ({
      nome: "Pedido a caminho",
      destino: "app",
      formato: "modal",
      design: {
        ...IDENTIDADE_MC,
        etapas: etapa([
          { tipo: "titulo", texto: "Seu pedido já está a caminho 💛", tamanho: 28, peso: 700, alinhar: "center" },
          { tipo: "botao", texto: "Ver meus pedidos", acao: "link", url: "#mc-app-meus_pedidos", largura: "total" },
          { tipo: "link_fechar", texto: "Agora não" },
          { tipo: "assinatura", texto: "Com carinho, Mari 💛", tamanho: 21, alinhar: "center" },
        ]),
      },
      regras: {
        dispositivos: ["mobile"],
        paginas: { incluir: ["*"] },
        frequencia: { tipo: "por_sessao" },
        app: { instalacao: "todos", plataformas: ["android", "ios", "outro"], identificada: "todas", situacoes: ["pedido_em_transito"], situacoes_modo: "qualquer" },
      },
    }),
  },
];

export default function PopupsApp() {
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [galeria, setGaleria] = useState(false);
  const [criando, setCriando] = useState<string | null>(null);
  const [incluirArquivados, setIncluirArquivados] = useState(false);
  const [errosAtivar, setErrosAtivar] = useState<string[] | null>(null);
  const [confirmarAtivar, setConfirmarAtivar] = useState<Popup | null>(null);

  const { data: lista, isLoading } = useQuery({
    queryKey: ["popups-listar", incluirArquivados],
    queryFn: () => popupsApi.listar(incluirArquivados),
  });

  const itens = useMemo(() => (lista ?? []).filter((p) => p.destino === "app"), [lista]);

  const totais = useMemo(() => {
    const impressoes = itens.reduce((s, p) => s + (Number(p.impressoes_7d) || 0), 0);
    const conversoes = itens.reduce((s, p) => s + (Number(p.conversoes_7d) || 0), 0);
    return {
      noAr: itens.filter((p) => p.status === "ativo" && p.no_ar_agora).length,
      impressoes,
      conversoes,
      taxa: impressoes > 0 ? (conversoes / impressoes) * 100 : null,
    };
  }, [itens]);

  const mudarStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: StatusPopup }) => popupsApi.alterarStatus(id, status),
    onSuccess: (r: { ok: boolean; validacao?: Validacao }, vars) => {
      if (!r?.ok) {
        setErrosAtivar(r?.validacao?.erros ?? ["Não foi possível ativar este popup."]);
        return;
      }
      qc.invalidateQueries({ queryKey: ["popups-listar"] });
      if (vars.status === "ativo") toast.success("Popup ativado. Ele aparece no app em até 5 minutos.");
      if (vars.status === "pausado") toast.success("Popup pausado. O app pode levar até 5 minutos para parar de mostrar.");
      if (vars.status === "arquivado") toast.success("Popup arquivado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicar = useMutation({
    mutationFn: (id: number) => popupsApi.duplicar(id),
    onSuccess: (novo) => {
      qc.invalidateQueries({ queryKey: ["popups-listar"] });
      toast.success("Cópia criada.");
      navegar(`/marketing/popups-app/${novo.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function criar(chave: string, corpo: Popup) {
    setCriando(chave);
    try {
      const novo = await popupsApi.salvar(corpo);
      qc.invalidateQueries({ queryKey: ["popups-listar"] });
      toast.success("Popup criado em rascunho.");
      setGaleria(false);
      navegar(`/marketing/popups-app/${novo.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCriando(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">Popups do App</h1>
          <p className="text-sm text-muted-foreground">
            Aparecem para quem abre o app Minha MC. Não aparecem na loja.
          </p>
        </div>
        <Button onClick={() => setGaleria(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo popup do app
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Popups no ar agora" value={nBR(totais.noAr)} icon={Smartphone} variant="primary" />
        <StatCard title="Impressões 7d" value={nBR(totais.impressoes)} icon={Eye} />
        <StatCard title="Cliques/Conversões 7d" value={nBR(totais.conversoes)} icon={MousePointerClick} />
        <StatCard title="Taxa 7d" value={pctBR(totais.taxa)} icon={Percent} variant="success" />
      </div>

      <div className="flex items-center gap-2">
        <Switch id="arq-app" checked={incluirArquivados} onCheckedChange={setIncluirArquivados} />
        <Label htmlFor="arq-app" className="text-sm text-muted-foreground">Mostrar arquivados</Label>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !itens.length ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum popup do app ainda. Clique em Novo popup do app e escolha um modelo pronto.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Público</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Prioridade</TableHead>
                <TableHead className="text-right">Impressões 7d</TableHead>
                <TableHead className="text-right">Conversões 7d</TableHead>
                <TableHead className="text-right">Taxa 7d</TableHead>
                <TableHead>Atualizado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell><ChipStatus p={p} /></TableCell>
                  <TableCell className="text-xs">{ROTULO_FORMATO[p.formato ?? ""] ?? p.formato}</TableCell>
                  <TableCell>
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {chipsPublico(p).map((c) => (
                        <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell><NotaCirculo nota={p.diagnostico?.nota ?? p.nota} tamanho="sm" /></TableCell>
                  <TableCell className="text-right text-xs">{nBR(p.prioridade)}</TableCell>
                  <TableCell className="text-right text-xs">{nBR(p.impressoes_7d)}</TableCell>
                  <TableCell className="text-right text-xs">{nBR(p.conversoes_7d)}</TableCell>
                  <TableCell className="text-right text-xs">{pctBR(p.taxa_7d)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{dataHoraBR(p.atualizado_em)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => navegar(`/marketing/popups-app/${p.id}`)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Duplicar" onClick={() => duplicar.mutate(Number(p.id))}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      {p.status === "ativo" ? (
                        <Button variant="ghost" size="icon" title="Pausar" onClick={() => mudarStatus.mutate({ id: Number(p.id), status: "pausado" })}>
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" title="Ativar" onClick={() => setConfirmarAtivar(p)}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="Arquivar" onClick={() => mudarStatus.mutate({ id: Number(p.id), status: "arquivado" })}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={galeria} onOpenChange={setGaleria}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Novo popup do app</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {MODELOS_APP.map((m) => (
              <Card key={m.chave}>
                <CardContent className="space-y-3 p-4">
                  <p className="font-serif text-lg font-semibold">{m.nome}</p>
                  <p className="text-xs text-muted-foreground">{m.descricao}</p>
                  <Button className="w-full" disabled={criando !== null} onClick={() => criar(m.chave, m.montar())}>
                    {criando === m.chave ? "Criando..." : "Usar este modelo"}
                  </Button>
                </CardContent>
              </Card>
            ))}
            <Card className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="font-serif text-lg font-semibold">Em branco</p>
              <p className="text-xs text-muted-foreground">Comece do zero, com uma etapa vazia.</p>
              <Button
                variant="outline"
                disabled={criando !== null}
                onClick={() =>
                  criar("branco", {
                    nome: "Novo popup do app",
                    destino: "app",
                    design: { ...IDENTIDADE_MC, etapas: [{ id: "e1", nome: "Etapa 1", elementos: [] }] },
                    regras: { dispositivos: ["mobile"], paginas: { incluir: ["*"] } },
                  })
                }
              >
                {criando === "branco" ? "Criando..." : "Criar em branco"}
              </Button>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!errosAtivar} onOpenChange={(v) => !v && setErrosAtivar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ainda não dá para ativar</DialogTitle></DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-danger">
            {(errosAtivar ?? []).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmarAtivar} onOpenChange={(v) => !v && setConfirmarAtivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar {confirmarAtivar?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Este popup vai aparecer para as clientes no app em até 5 minutos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmarAtivar?.id) mudarStatus.mutate({ id: Number(confirmarAtivar.id), status: "ativo" });
                setConfirmarAtivar(null);
              }}
            >
              Ativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
