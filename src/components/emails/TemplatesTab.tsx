import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowLeft, Plus, Send, XCircle } from "lucide-react";
import { dataBr, rpcEmails } from "@/lib/emails";
import { ControlesPrevia, IframePrevia, useConferirTemplate, usePreviaTemplate, useVariaveisDisponiveis } from "./PreviaTemplate";

type Conferencia = { tipo: "erro" | "aviso"; texto: string };

const AJUDA_ACENTO =
  "Corpo do e-mail: entidade HTML (voc&ecirc;). Assunto: acento de verdade (você). Cabeçalho de e-mail não decodifica entidade.";

const AVISO_TESTE =
  "Não clique no link de descadastro do e-mail de teste. O e-mail chega para você, mas o token é da destinatária real.";

/** Lê o bloco de conferência que vem pronto do banco. */
export function lerChecagem(checagem: any): Conferencia[] {
  const itens: Conferencia[] = [];
  if (!checagem) return itens;

  if (checagem.travessao)
    itens.push({ tipo: "erro", texto: "Travessão não é usado nos e-mails da UMC. Troque por vírgula ou dois-pontos." });
  if (checagem.entidade_no_assunto)
    itens.push({
      tipo: "erro",
      texto:
        "O assunto tem entidade HTML. Cabeçalho de e-mail não decodifica entidade, então &ccedil; chegaria assim na caixa da cliente. No assunto, escreva o acento de verdade.",
    });
  const faltando: string[] = Array.isArray(checagem.acentos_faltando) ? checagem.acentos_faltando : [];
  if (faltando.length > 0)
    itens.push({
      tipo: "erro",
      texto: `Palavras sem acento no corpo: ${faltando.join(", ")}. No corpo do e-mail, use entidade: voc&ecirc;, pe&ccedil;a, dispon&iacute;vel.`,
    });

  if (checagem.tem_descadastro === false)
    itens.push({ tipo: "aviso", texto: "Falta o link de descadastro. O motor prega um rodapé automático, mas é melhor o template ter o dele." });
  if (checagem.botao_com_padding_no_a)
    itens.push({ tipo: "aviso", texto: "Botão com padding ou display no <a>. O Gmail remove e o botão vira link azul. A forma do botão tem que estar no <td>." });
  if (checagem.fundo_escuro_com_texto_claro)
    itens.push({ tipo: "aviso", texto: "Fundo escuro com texto claro. O Gmail remapeia cor e o texto some." });
  if (checagem.tem_regra_mobile === false)
    itens.push({ tipo: "aviso", texto: "Sem as regras de mobile no <style>. O card não vai empilhar no celular." });
  if (checagem.card_sem_classe)
    itens.push({ tipo: "aviso", texto: "Tem card de produto sem a classe mc-card. Esse card não empilha no celular." });

  return itens;
}

function Editor({ template, onVoltar }: { template: any; onVoltar: () => void }) {
  const queryClient = useQueryClient();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [nome, setNome] = useState(template?.nome ?? "");
  const [assunto, setAssunto] = useState(template?.assunto ?? "");
  const [preheader, setPreheader] = useState(template?.preheader ?? "");
  const [tipo, setTipo] = useState(template?.tipo ?? "campanha");
  const [modo, setModo] = useState<ModoTemplate>("miolo");
  const [texto, setTexto] = useState("");
  const [carregado, setCarregado] = useState(!template?.slug);
  const [mobile, setMobile] = useState(false);
  const [semCupom, setSemCupom] = useState(false);

  const { data: salvo } = usePreviaTemplate(template?.slug);

  // Abre o template no modo em que ele foi escrito, com o conteúdo daquele modo.
  useEffect(() => {
    if (!salvo || carregado) return;
    const modoSalvo: ModoTemplate = salvo.modo === "miolo" ? "miolo" : "completo";
    setModo(modoSalvo);
    setTexto(modoSalvo === "miolo" ? String(salvo.miolo ?? "") : String(salvo.html ?? ""));
    if (salvo.preheader != null) setPreheader(salvo.preheader);
    setCarregado(true);
  }, [salvo, carregado]);

  const { data: previa } = useConferirTemplate(texto, assunto, modo, preheader || null);
  const { data: variaveis = [] } = useVariaveisDisponiveis();

  const conferencias = lerChecagem(previa?.checagem);
  const bloqueado = conferencias.some((c) => c.tipo === "erro");

  const trocarModo = (novo: ModoTemplate) => {
    if (novo === modo) return;
    if (texto.trim() && !window.confirm("Trocar o modo troca o que está no editor. Quer continuar?")) return;
    setTexto("");
    setModo(novo);
  };

  const inserirTag = (tag: string) => {
    const area = areaRef.current;
    if (!area) { setTexto((h) => h + tag); return; }
    const ini = area.selectionStart ?? texto.length;
    const fim = area.selectionEnd ?? texto.length;
    const novo = texto.slice(0, ini) + tag + texto.slice(fim);
    setTexto(novo);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(ini + tag.length, ini + tag.length);
    });
  };

  const salvarTemplate = useMutation({
    mutationFn: () =>
      rpcEmails("emails_template_salvar", {
        p_patch: {
          id: template?.id ?? null,
          nome, assunto, preheader, tipo, modo,
          ...(modo === "miolo" ? { miolo: texto } : { html: texto }),
        },
      }),
    onSuccess: () => {
      toast({ title: "Template salvo" });
      queryClient.invalidateQueries({ queryKey: ["emails-templates"] });
      queryClient.invalidateQueries({ queryKey: ["emails-template-previa"] });
      onVoltar();
    },
    onError: (e: any) => toast({ title: "Não deu para salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onVoltar}><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Button>
        <Button className="ml-auto" disabled={bloqueado || salvar.isPending} onClick={() => salvar.mutate()}>
          Salvar template
        </Button>
      </div>

      <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">{AJUDA_ACENTO}</p>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.2fr_260px]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome</label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="campanha">Campanha</SelectItem>
                  <SelectItem value="automacao">Automação</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <label className="text-sm font-medium">HTML</label>
            <Textarea
              ref={areaRef}
              rows={18}
              className="font-mono text-xs"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
          </div>

          <Card className="space-y-2 p-4">
            <p className="text-sm font-medium">Conferência antes de salvar</p>
            {!previa && <p className="text-xs text-muted-foreground">Escreva o HTML para a conferência aparecer.</p>}
            {previa && conferencias.length === 0 && (
              <p className="text-xs text-success">Tudo certo com as regras de Gmail e Tray.</p>
            )}
            {conferencias.map((c, i) => (
              <div key={i} className="flex gap-2 text-xs">
                {c.tipo === "erro"
                  ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                  : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />}
                <span className={c.tipo === "erro" ? "text-danger" : "text-muted-foreground"}>{c.texto}</span>
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Prévia renderizada</p>
            <ControlesPrevia mobile={mobile} onMobile={setMobile} semCupom={semCupom} onSemCupom={setSemCupom} />
          </div>
          <IframePrevia
            titulo="Prévia do template"
            mobile={mobile}
            altura={640}
            html={semCupom ? previa?.html_sem_cupom : previa?.html}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Marcações</p>
          <p className="text-xs text-muted-foreground">Clique para inserir na posição do cursor.</p>
          <div className="space-y-2">
            {(variaveis as any[]).map((v: any) => (
              <button
                key={v.tag}
                type="button"
                onClick={() => inserirTag(v.tag)}
                className="w-full rounded-lg border p-2 text-left transition-colors hover:bg-muted"
              >
                <p className="font-mono text-xs">{v.tag}</p>
                {v.exemplo != null && <p className="truncate text-xs text-muted-foreground">{String(v.exemplo)}</p>}
                {v.nota && <p className="text-[11px] text-muted-foreground">{v.nota}</p>}
              </button>
            ))}
            {(variaveis as any[]).length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma marcação disponível.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CartaoTemplate({ t, onAbrir, onTeste, testando }: any) {
  const { data: previa } = usePreviaTemplate(t.slug);
  return (
    <Card className="overflow-hidden">
      <iframe
        title={`Prévia de ${t.nome}`}
        sandbox=""
        srcDoc={previa?.html ?? "<p style='font-family:sans-serif;color:#888;padding:12px'>Carregando prévia…</p>"}
        className="pointer-events-none h-40 w-full border-b bg-white"
      />
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium">{t.nome}</p>
          <Badge variant="outline" className="text-[10px]">{t.tipo === "automacao" ? "automação" : "campanha"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Atualizado em {dataBr(t.updated_at ?? t.atualizado_em)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onAbrir}>Abrir</Button>
          <Button size="sm" variant="ghost" disabled={testando} onClick={onTeste}>
            <Send className="mr-1 h-3.5 w-3.5" /> Enviar teste para mim
          </Button>
        </div>
        <p className="text-[11px] text-warning">{AVISO_TESTE}</p>
      </div>
    </Card>
  );
}

export function TemplatesTab({ slugInicial }: { slugInicial?: string | null } = {}) {
  const [editando, setEditando] = useState<any | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["emails-templates", "todos"],
    queryFn: async () => (await rpcEmails<any>("emails_templates_listar", { p_tipo: null })) ?? [],
  });

  const enviarTeste = useMutation({
    mutationFn: (t: any) => rpcEmails("emails_template_salvar", { p_patch: { id: t.id, enviar_teste: true } }),
    onSuccess: () => toast({ title: "Teste enviado", description: "Confira a caixa de entrada de teste." }),
    onError: (e: any) => toast({ title: "Não deu para enviar o teste", description: e.message, variant: "destructive" }),
  });

  const lista = Array.isArray(templates) ? templates : [];
  const alvo = slugInicial ? lista.find((t: any) => t.slug === slugInicial) : null;
  const aberto = editando ?? alvo;

  if (aberto) return <Editor template={aberto.id ? aberto : null} onVoltar={() => setEditando(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditando({})}><Plus className="mr-2 h-4 w-4" /> Novo template</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando templates…</p>}
      {!isLoading && lista.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhum template ainda. Crie o primeiro para usar em campanhas e automações.
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((t: any) => (
          <CartaoTemplate
            key={t.id}
            t={t}
            testando={enviarTeste.isPending}
            onAbrir={() => setEditando(t)}
            onTeste={() => enviarTeste.mutate(t)}
          />
        ))}
      </div>
    </div>
  );
}
