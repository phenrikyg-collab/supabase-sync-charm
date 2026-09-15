import { useEffect, useMemo, useState } from "react";
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
import { AlertTriangle, ArrowLeft, Loader2, Plus, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, inteiro, pct1, rpcEmails } from "@/lib/emails";
import type { ModoTemplate } from "./PreviaTemplate";
import { ControlesPrevia, IframePrevia, useConferirTemplate, usePreviaTemplate } from "./PreviaTemplate";
import { lerChecagem } from "./TemplatesTab";
import {
  ConstrutorPublico, contarCondicoes, descreverFiltro, filtroVazio,
  mensagemErroPublico, SeloPublicoVivo, textoConsulta, usePublicoCampos, type No,
} from "./ConstrutorPublico";


const CLASSE_STATUS: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  preparada: "bg-primary/15 text-primary border-primary/30",
  enviando: "bg-warning/15 text-warning border-warning/30 animate-pulse",
  concluida: "bg-success/15 text-success border-success/30",
  concluída: "bg-success/15 text-success border-success/30",
  cancelada: "bg-muted text-muted-foreground line-through",
};

function Alternador<T extends string>({
  valor, opcoes, onChange,
}: { valor: T; opcoes: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border">
      {opcoes.map(([v, rotulo]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "px-3 py-1.5 text-xs transition-colors",
            valor === v ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

function NovaCampanha({
  aberto, onFechar, campanhaId, onNaoEditavel,
}: {
  aberto: boolean;
  onFechar: () => void;
  campanhaId?: any;
  onNaoEditavel?: (id: any) => void;
}) {
  const queryClient = useQueryClient();
  const [passo, setPasso] = useState(1);
  const [carregada, setCarregada] = useState(false);
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [preheader, setPreheader] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [modoHtml, setModoHtml] = useState<ModoTemplate>("miolo");
  const [html, setHtml] = useState("");
  const [modoPublico, setModoPublico] = useState<"segmento" | "filtro">("segmento");
  const [segmento, setSegmento] = useState("");
  const [filtro, setFiltro] = useState<No>(filtroVazio());
  const [filtroLento, setFiltroLento] = useState<No | null>(null);
  const [mobile, setMobile] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["emails-templates", "campanha"],
    queryFn: async () => (await rpcEmails<any>("emails_templates_listar", { p_tipo: "campanha" })) ?? [],
    enabled: aberto,
  });

  const { data: segmentos = [] } = useQuery({
    queryKey: ["emails-segmentos"],
    queryFn: async () => (await rpcEmails<any[]>("emails_segmentos_listar")) ?? [],
    enabled: aberto,
  });

  const { data: campos = [] } = usePublicoCampos(aberto);

  // Carrega a campanha em rascunho para continuar de onde parou.
  const { data: salva } = useQuery({
    queryKey: ["emails-campanha-get", campanhaId],
    queryFn: () => rpcEmails<any>("emails_campanha_get", { p_campanha_id: campanhaId }),
    enabled: aberto && campanhaId != null,
  });

  useEffect(() => {
    if (!aberto) { setCarregada(false); return; }
    if (!salva || carregada) return;
    if (salva.editavel === false) { onNaoEditavel?.(salva.id); return; }
    setNome(String(salva.nome ?? ""));
    setAssunto(String(salva.assunto ?? ""));
    setPreheader(String(salva.preheader ?? ""));
    setTemplateId(salva.template_id != null ? String(salva.template_id) : "");
    const porFiltroSalvo = salva.modo_publico === "filtro" || (!salva.segmento_slug && !!salva.publico_filtro);
    setModoPublico(porFiltroSalvo ? "filtro" : "segmento");
    setSegmento(String(salva.segmento_slug ?? ""));
    if (salva.publico_filtro) setFiltro(salva.publico_filtro as No);
    setCarregada(true);
  }, [aberto, salva, carregada, onNaoEditavel]);

  const totalCondicoes = contarCondicoes(filtro);

  // Debounce da simulação do filtro montado.
  useEffect(() => {
    const t = setTimeout(() => setFiltroLento(filtro), 600);
    return () => clearTimeout(t);
  }, [filtro]);

  const porFiltro = modoPublico === "filtro";
  const {
    data: simulacao, isFetching: simulando, error: erroSimulacao, dataUpdatedAt: simuladoEm,
  } = useQuery({
    queryKey: ["emails-simular", porFiltro ? filtroLento : segmento],
    queryFn: () =>
      porFiltro
        ? rpcEmails<any>("emails_campanha_simular", { p_filtro: filtroLento })
        : rpcEmails<any>("emails_campanha_simular", { p_slug: segmento }),
    enabled: aberto && (porFiltro ? totalCondicoes > 0 && !!filtroLento : !!segmento),
    retry: false,
  });

  const segmentoEscolhido = (segmentos as any[]).find((s) => String(s.slug) === segmento);
  const templateEscolhido = (templates as any[]).find((t: any) => String(t.id) === templateId);
  const { data: previaTemplate } = usePreviaTemplate(templateEscolhido?.slug);
  // Sem template escolhido, a prévia vem do HTML colado, conferido pelo banco.
  const { data: previaColada } = useConferirTemplate(
    templateEscolhido ? "" : html, assunto, modoHtml, preheader || null, 600,
  );
  const previa = templateEscolhido ? previaTemplate : previaColada;
  const conferencias = templateEscolhido ? [] : lerChecagem(previaColada?.checagem);
  const htmlBloqueado = conferencias.some((c) => c.tipo === "erro");

  const bloqueados =
    simulacao?.bloqueados_teto ??
    (simulacao ? Math.max(0, Number(simulacao.alvo_total ?? 0) - Number(simulacao.passam_teto ?? 0)) : 0);

  const trocarModoHtml = (novo: ModoTemplate) => {
    if (novo === modoHtml) return;
    if (html.trim() && !window.confirm("Trocar o modo troca o que está no editor. Quer continuar?")) return;
    setHtml("");
    setModoHtml(novo);
  };

  const preparar = useMutation({
    mutationFn: async () => {
      let idTemplate = templateId ? Number(templateId) : null;
      if (!idTemplate && html.trim()) {
        const novoTemplate = await rpcEmails<any>("emails_template_salvar", {
          p_patch: {
            nome: `${nome} (template da campanha)`,
            tipo: "campanha",
            assunto, preheader,
            modo: modoHtml,
            ...(modoHtml === "miolo" ? { miolo: html.trim() } : { html: html.trim() }),
          },
        });
        idTemplate = Number(novoTemplate?.id ?? novoTemplate);
      }
      const salvo = await rpcEmails<any>("emails_campanha_salvar", {
        p_patch: {
          ...(campanhaId != null ? { id: campanhaId } : {}),
          nome, assunto, preheader,
          template_id: idTemplate,
          ...(porFiltro ? { publico_filtro: filtro } : { segmento_slug: segmento }),
        },
      });
      const id = salvo?.id ?? salvo?.campanha_id ?? salvo;
      await rpcEmails("emails_campanha_preparar", { p_campanha_id: id });
    },
    onSuccess: () => {
      toast({ title: "Campanha preparada", description: "Ela entrou na fila e o motor envia dentro da janela de horário." });
      queryClient.invalidateQueries({ queryKey: ["emails-campanhas"] });
      queryClient.invalidateQueries({ queryKey: ["emails-painel-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["emails-templates"] });
      onFechar();
      setPasso(1);
    },
    onError: (e: any) => {
      const bruto = String(e?.message ?? "");
      const rascunho = /rascunho/i.test(bruto) || /status/i.test(bruto);
      const legivel = mensagemErroPublico(bruto);
      const descricao = legivel !== bruto
        ? legivel
        : rascunho
        ? "Esta campanha já saiu do rascunho e não pode mais ser editada."
        : /segmento/i.test(bruto)
        ? "O segmento escolhido não existe mais. Selecione outro no passo 2."
        : bruto;
      toast({ title: "Não deu para preparar", description: descricao, variant: "destructive" });
    },
  });

  const publicoPronto = porFiltro ? totalCondicoes > 0 && !!simulacao : !!segmento;

  const pendencias: string[] = [];
  if (passo === 1) {
    if (!nome.trim()) pendencias.push("Falta: nome");
    if (!assunto.trim()) pendencias.push("Falta: assunto");
    if (!templateId && !html.trim()) pendencias.push("Falta: template ou HTML");
    if (htmlBloqueado) pendencias.push("Corrija a conferência do HTML");
  } else if (passo === 2 && !publicoPronto) {
    pendencias.push(porFiltro ? "Monte ao menos uma condição" : "Escolha um segmento");
  }

  const podeAvancar = pendencias.length === 0;

  const textoErroSimulacao = erroSimulacao ? mensagemErroPublico(String((erroSimulacao as any)?.message ?? "")) : null;

  const cardsSimulacao = useMemo(() => {
    if (!simulacao) return [];
    return [
      { rotulo: "Alvo total", valor: inteiro(simulacao.alvo_total ?? simulacao.alvo ?? simulacao.total) },
      { rotulo: "Clientes", valor: inteiro(simulacao.clientes) },
      { rotulo: "Leads sem compra", valor: inteiro(simulacao.sem_compra) },
      { rotulo: "Passam no teto", valor: inteiro(simulacao.passam_teto ?? simulacao.passam_no_teto) },
    ];
  }, [simulacao]);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {campanhaId != null ? "Continuar campanha" : "Nova campanha"} · passo {passo} de 3
          </DialogTitle>
        </DialogHeader>

        {passo === 1 && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nome *</label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Assunto *</label>
                <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Preheader (opcional)</label>
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-medium">
                    {modoHtml === "miolo" ? "Ou cole o conteúdo do e-mail" : "Ou cole o HTML"}
                  </label>
                  <Alternador
                    valor={modoHtml}
                    opcoes={[["completo", "HTML completo"], ["miolo", "Só o miolo"]] as const}
                    onChange={trocarModoHtml}
                  />
                </div>
                <Textarea rows={6} className="font-mono text-xs" value={html} onChange={(e) => setHtml(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  {modoHtml === "miolo"
                    ? "Cole só o conteúdo. O logo, as regras de celular e o rodapé com descadastro entram sozinhos."
                    : "O HTML colado vira um template novo do tipo campanha, e a campanha aponta para ele."}
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
            <Alternador<"segmento" | "filtro">
              valor={modoPublico}
              opcoes={[["segmento", "Segmento salvo"], ["filtro", "Montar filtro"]] as const}
              onChange={setModoPublico}
            />

            {modoPublico === "segmento" ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Segmento</label>
                <Select value={segmento} onValueChange={setSegmento}>
                  <SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger>
                  <SelectContent>
                    {(segmentos as any[]).map((s: any) => (
                      <SelectItem key={s.slug} value={String(s.slug)}>{s.nome ?? s.slug}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(segmentos as any[]).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum segmento salvo ainda. Use "Montar filtro" para escolher o público na mão.
                  </p>
                )}
                {segmentoEscolhido && (
                  <Card className="space-y-1 p-3">
                    {segmentoEscolhido.descricao && (
                      <p className="text-xs text-muted-foreground">{segmentoEscolhido.descricao}</p>
                    )}
                    <p className="text-xs">
                      <span className="text-muted-foreground">Quem entra: </span>
                      {descreverFiltro(segmentoEscolhido.filtro, campos as any[])}
                    </p>
                  </Card>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <ConstrutorPublico filtro={filtro} campos={campos as any[]} onChange={setFiltro} />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" disabled title="em breve">
                    Salvar como segmento
                  </Button>
                  <span className="text-xs text-muted-foreground">em breve</span>
                  {totalCondicoes > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setFiltro(filtroVazio())}>
                      Limpar filtro
                    </Button>
                  )}
                </div>
                {totalCondicoes > 0 && (
                  <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                    <SeloPublicoVivo filtro={filtroLento} enabled={aberto} />
                    <p className="text-xs text-muted-foreground">
                      {descreverFiltro(filtro, campos as any[])}
                    </p>
                  </div>
                )}
              </div>
            )}

            {simulando && <p className="text-sm text-muted-foreground">Simulando o público…</p>}

            {textoErroSimulacao && (
              <Card className="space-y-2 border-danger/40 bg-danger/5 p-3">
                <p className="text-sm text-danger">{textoErroSimulacao}</p>
                <Button size="sm" variant="outline" onClick={() => setFiltro(filtroVazio())}>
                  Limpar e recomeçar
                </Button>
              </Card>
            )}

            {simulacao && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {cardsSimulacao.map((c) => (
                    <Card key={c.rotulo} className="p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.rotulo}</p>
                      <p className="font-serif text-2xl">{c.valor}</p>
                    </Card>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Este público se refaz a cada consulta. {textoConsulta(simuladoEm)}.
                </p>
                <Card className="border-warning/40 bg-warning/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-warning">Bloqueados pelo teto</p>
                  <p className="font-serif text-2xl text-warning">{inteiro(bloqueados)}</p>
                  <p className="text-xs text-muted-foreground">
                    {inteiro(bloqueados)} contatos não vão receber porque já atingiram o limite de e-mails do
                    segmento deles neste período.
                  </p>
                </Card>
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
            <p>
              <span className="text-muted-foreground">Público:</span>{" "}
              {porFiltro ? descreverFiltro(filtro, campos as any[]) : (segmentoEscolhido?.nome ?? segmento)}
            </p>
            {porFiltro && <SeloPublicoVivo filtro={filtroLento} enabled={aberto} />}
            <p><span className="text-muted-foreground">Vai para a fila:</span>{" "}
              <strong>{inteiro(simulacao?.passam_teto ?? simulacao?.passam_no_teto ?? 0)}</strong> contatos{" "}
              <span className="text-xs text-muted-foreground">({textoConsulta(simuladoEm)})</span></p>
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
    queryFn: () => rpcEmails<any>("emails_campanha_resumo", { p_campanha_id: id }),
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

  const { data: campanhas = [], isLoading } = useQuery({
    queryKey: ["emails-campanhas", dias],
    queryFn: async () => (await rpcEmails<any[]>("emails_campanhas_listar", { p_dias: dias })) ?? [],
  });

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
