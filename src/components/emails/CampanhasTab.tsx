import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, inteiro, pct1, rpcEmails } from "@/lib/emails";
import { ControlesPrevia, IframePrevia, usePreviaTemplate } from "./PreviaTemplate";


const CLASSE_STATUS: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  preparada: "bg-primary/15 text-primary border-primary/30",
  enviando: "bg-warning/15 text-warning border-warning/30 animate-pulse",
  concluida: "bg-success/15 text-success border-success/30",
  concluída: "bg-success/15 text-success border-success/30",
  cancelada: "bg-muted text-muted-foreground line-through",
};

function NovaCampanha({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [passo, setPasso] = useState(1);
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [preheader, setPreheader] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [html, setHtml] = useState("");
  const [segmento, setSegmento] = useState("");
  const [mobile, setMobile] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["emails-templates", "campanha"],
    queryFn: async () => (await rpcEmails<any>("emails_templates_listar", { p_tipo: "campanha" })) ?? [],
    enabled: aberto,
  });

  const { data: painel } = useQuery({
    queryKey: ["emails-painel-resumo", 30],
    queryFn: () => rpcEmails<any>("emails_painel_resumo", { p_dias: 30 }),
    enabled: aberto,
  });

  const segmentos: any[] = painel?.segmentos ?? painel?.config?.segmentos ?? [];

  const { data: simulacao, isFetching: simulando } = useQuery({
    queryKey: ["emails-simular", segmento],
    queryFn: () => rpcEmails<any>("emails_campanha_simular", { p_slug_segmento: segmento }),
    enabled: aberto && !!segmento,
  });

  const templateEscolhido = (templates as any[]).find((t: any) => String(t.id) === templateId);
  const { data: previa } = usePreviaTemplate(templateEscolhido?.slug);

  const bloqueados =
    simulacao?.bloqueados_teto ??
    (simulacao ? Math.max(0, Number(simulacao.alvo_total ?? 0) - Number(simulacao.passam_teto ?? 0)) : 0);

  const preparar = useMutation({
    mutationFn: async () => {
      let idTemplate = templateId ? Number(templateId) : null;
      if (!idTemplate && html.trim()) {
        const novoTemplate = await rpcEmails<any>("emails_template_salvar", {
          p_patch: { nome: `${nome} (template da campanha)`, tipo: "campanha", assunto, preheader, html: html.trim() },
        });
        idTemplate = Number(novoTemplate?.id ?? novoTemplate);
      }
      const salvo = await rpcEmails<any>("emails_campanha_salvar", {
        p_patch: {
          nome, assunto, preheader,
          template_id: idTemplate,
          segmento_slug: segmento,
        },
      });
      const id = salvo?.id ?? salvo?.campanha_id ?? salvo;
      await rpcEmails("emails_campanha_preparar", { p_id: id });
    },
    onSuccess: () => {
      toast({ title: "Campanha preparada", description: "Ela entrou na fila e o motor envia dentro da janela de horário." });
      queryClient.invalidateQueries({ queryKey: ["emails-painel-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["emails-templates"] });
      onFechar();
      setPasso(1);
    },
    onError: (e: any) => {
      const bruto = String(e?.message ?? "");
      const rascunho = /rascunho/i.test(bruto) || /status/i.test(bruto);
      const segmentoRuim = /segmento/i.test(bruto);
      const descricao = rascunho
        ? "Esta campanha já saiu do rascunho e não pode mais ser editada."
        : segmentoRuim
        ? "O segmento escolhido não existe mais. Selecione outro no passo 2."
        : bruto;
      toast({ title: "Não deu para preparar", description: descricao, variant: "destructive" });
    },
  });

  const podeAvancar =
    passo === 1 ? !!nome.trim() && !!assunto.trim() && (!!templateId || !!html.trim()) : passo === 2 ? !!segmento : true;


  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Nova campanha · passo {passo} de 3</DialogTitle>
        </DialogHeader>

        {passo === 1 && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
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
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Template</label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                  <SelectContent>
                    {(templates as any[]).map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A campanha aponta para o template. Editar o template muda o que ainda não foi enviado.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ou cole o HTML</label>
                <Textarea rows={6} className="font-mono text-xs" value={html} onChange={(e) => setHtml(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  O HTML colado vira um template novo do tipo campanha, e a campanha aponta para ele.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Prévia renderizada</p>
                <ControlesPrevia mobile={mobile} onMobile={setMobile} />
              </div>
              <IframePrevia
                titulo="Prévia da campanha"
                mobile={mobile}
                altura={420}
                html={previa?.html}
              />
            </div>

          </div>
        )}

        {passo === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Segmento</label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger>
                <SelectContent>
                  {segmentos.map((s: any) => (
                    <SelectItem key={s.slug ?? s} value={String(s.slug ?? s)}>{s.nome ?? s.slug ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {simulando && <p className="text-sm text-muted-foreground">Simulando o público…</p>}

            {simulacao && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Card className="p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Alvo total</p>
                    <p className="font-serif text-2xl">{inteiro(simulacao.alvo_total)}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Passam no teto</p>
                    <p className="font-serif text-2xl">{inteiro(simulacao.passam_teto)}</p>
                  </Card>
                  <Card className="border-warning/40 bg-warning/5 p-4">
                    <p className="text-xs uppercase tracking-wider text-warning">Bloqueados pelo teto</p>
                    <p className="font-serif text-2xl text-warning">{inteiro(bloqueados)}</p>
                    <p className="text-xs text-muted-foreground">
                      {inteiro(bloqueados)} contatos não vão receber porque já atingiram o limite de e-mails do
                      segmento deles neste período.
                    </p>
                  </Card>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ["Por segmento RFM", simulacao.por_rfm],
                    ["Por origem", simulacao.por_origem],
                  ].map(([titulo, obj]: any) => (
                    <Card key={titulo} className="p-4">
                      <p className="mb-2 text-sm font-medium">{titulo}</p>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {Object.entries(obj ?? {}).map(([k, v]: any) => (
                          <li key={k} className="flex justify-between"><span>{k}</span><span>{inteiro(v)}</span></li>
                        ))}
                        {Object.keys(obj ?? {}).length === 0 && <li>Sem quebra disponível.</li>}
                      </ul>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {passo === 3 && (
          <div className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">Assunto:</span> {assunto}</p>
            <p><span className="text-muted-foreground">Segmento:</span> {segmento}</p>
            <p><span className="text-muted-foreground">Vai para a fila:</span>{" "}
              <strong>{inteiro(simulacao?.passam_teto ?? 0)}</strong> contatos</p>
            <p className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              Preparar não dispara. A campanha entra na fila e o motor envia dentro da janela de horário configurada.
            </p>
          </div>
        )}

        <DialogFooter>
          {passo > 1 && (
            <Button variant="outline" onClick={() => setPasso(passo - 1)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
          )}
          {passo < 3 && (
            <Button disabled={!podeAvancar} onClick={() => setPasso(passo + 1)}>Continuar</Button>
          )}
          {passo === 3 && (
            <Button disabled={preparar.isPending} onClick={() => preparar.mutate()}>
              {preparar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Preparar envio
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResumoCampanha({ id, onVoltar }: { id: any; onVoltar: () => void }) {
  const { data: resumo, isLoading } = useQuery({
    queryKey: ["emails-campanha-resumo", id],
    queryFn: () => rpcEmails<any>("emails_campanha_resumo", { p_id: id }),
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onVoltar}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para a lista
      </Button>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando relatório…</p>}
      {resumo && (
        <>
          <h3 className="font-serif text-xl">{resumo.nome}</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Enviados", inteiro(resumo.enviados)],
              ["Erros", inteiro(resumo.erros)],
              ["Aberturas únicas", inteiro(resumo.aberturas_unicas)],
              ["Cliques únicos", inteiro(resumo.cliques_unicos)],
              ["Descadastros", inteiro(resumo.descadastros)],
            ].map(([r, v]) => (
              <Card key={r} className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{r}</p>
                <p className="font-serif text-2xl">{v}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function CampanhasTab({ dias }: { dias: number }) {
  const [nova, setNova] = useState(false);
  const [aberta, setAberta] = useState<any | null>(null);

  const { data: painel, isLoading } = useQuery({
    queryKey: ["emails-painel-resumo", dias],
    queryFn: () => rpcEmails<any>("emails_painel_resumo", { p_dias: dias }),
  });

  const campanhas: any[] = painel?.campanhas ?? [];

  if (aberta) return <ResumoCampanha id={aberta} onVoltar={() => setAberta(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNova(true)}><Plus className="mr-2 h-4 w-4" /> Nova campanha</Button>
      </div>

      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Alvo</TableHead>
              <TableHead className="text-right">Enfileirados</TableHead>
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead className="text-right">Abertura</TableHead>
              <TableHead className="text-right">CTOR</TableHead>
              <TableHead className="text-right">Receita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && campanhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma campanha criada ainda. Comece pelo botão "Nova campanha".
                </TableCell>
              </TableRow>
            )}
            {campanhas.map((c: any) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => setAberta(c.id)}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.segmento ?? c.segmento_slug}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(CLASSE_STATUS[(c.status ?? "").toLowerCase()] ?? "")}>
                    {c.status ?? "rascunho"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{inteiro(c.alvo)}</TableCell>
                <TableCell className="text-right">{inteiro(c.enfileirados)}</TableCell>
                <TableCell className="text-right">{inteiro(c.enviados)}</TableCell>
                <TableCell className="text-right">{pct1(c.taxa_abertura_pct)}</TableCell>
                <TableCell className="text-right">{pct1(c.ctor_pct)}</TableCell>
                <TableCell className="text-right">{brl(c.receita_atribuida)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <NovaCampanha aberto={nova} onFechar={() => setNova(false)} />
    </div>
  );
}
