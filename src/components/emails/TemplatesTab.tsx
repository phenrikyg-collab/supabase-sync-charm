import { useMemo, useState } from "react";
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

type Conferencia = { tipo: "erro" | "aviso"; texto: string };

/** Lista de conferência do HTML, seguindo as regras de Gmail e Tray da UMC. */
export function conferirHtml(html: string): Conferencia[] {
  const itens: Conferencia[] = [];
  if (/[\u2013\u2014\u2212]/.test(html)) {
    itens.push({ tipo: "erro", texto: "Travessão não é usado nos e-mails da UMC. Troque por vírgula ou dois-pontos." });
  }
  const fundoEscuro = /background(-color)?\s*:\s*#(0|1|2|3)[0-9a-f]{5}/i.test(html);
  const textoClaro = /color\s*:\s*#(f|e|d)[0-9a-f]{5}/i.test(html) || /color\s*:\s*white/i.test(html);
  if (fundoEscuro && textoClaro) {
    itens.push({ tipo: "aviso", texto: "Há fundo escuro com texto claro. O Gmail remapeia as cores e o texto some." });
  }
  const linksComEstilo = html.match(/<a[^>]*style=["'][^"']*(padding|display)\s*:/gi);
  if (linksComEstilo) {
    itens.push({ tipo: "aviso", texto: "Um link de botão tem padding ou display no style. O Gmail remove e o botão vira link azul: a forma do botão precisa estar no <td>." });
  }
  if (!/descadastr|unsubscribe|cancelar inscri/i.test(html)) {
    itens.push({ tipo: "aviso", texto: "Não encontrei o link de descadastro. O motor adiciona um rodapé automático, mas é melhor o template ter o dele." });
  }
  return itens;
}

function Editor({ template, onVoltar }: { template: any; onVoltar: () => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(template?.nome ?? "");
  const [assunto, setAssunto] = useState(template?.assunto ?? "");
  const [preheader, setPreheader] = useState(template?.preheader ?? "");
  const [tipo, setTipo] = useState(template?.tipo ?? "campanha");
  const [html, setHtml] = useState(template?.html ?? template?.html_renderizado ?? "");

  const conferencias = useMemo(() => conferirHtml(html), [html]);
  const bloqueado = conferencias.some((c) => c.tipo === "erro");

  const salvar = useMutation({
    mutationFn: () =>
      rpcEmails("emails_template_salvar", {
        p_patch: { id: template?.id ?? null, nome, assunto, preheader, tipo, html },
      }),
    onSuccess: () => {
      toast({ title: "Template salvo" });
      queryClient.invalidateQueries({ queryKey: ["emails-templates"] });
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

      <div className="grid gap-4 lg:grid-cols-2">
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
            <Textarea rows={18} className="font-mono text-xs" value={html} onChange={(e) => setHtml(e.target.value)} />
          </div>

          <Card className="space-y-2 p-4">
            <p className="text-sm font-medium">Conferência antes de salvar</p>
            {conferencias.length === 0 && (
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
          <p className="text-sm font-medium">Prévia ao vivo</p>
          <iframe
            title="Prévia do template"
            sandbox=""
            srcDoc={html || "<p style='font-family:sans-serif;color:#888'>Escreva o HTML ao lado.</p>"}
            className="h-[640px] w-full rounded-lg border bg-white"
          />
        </div>
      </div>
    </div>
  );
}

export function TemplatesTab() {
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

  if (editando) return <Editor template={editando.id ? editando : null} onVoltar={() => setEditando(null)} />;

  const lista = Array.isArray(templates) ? templates : [];

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
          <Card key={t.id} className="overflow-hidden">
            <iframe
              title={`Prévia de ${t.nome}`}
              sandbox=""
              srcDoc={t.html ?? t.html_renderizado ?? ""}
              className="pointer-events-none h-40 w-full border-b bg-white"
            />
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{t.nome}</p>
                <Badge variant="outline" className="text-[10px]">{t.tipo === "automacao" ? "automação" : "campanha"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Atualizado em {dataBr(t.updated_at ?? t.atualizado_em)}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditando(t)}>Abrir</Button>
                <Button size="sm" variant="ghost" disabled={enviarTeste.isPending} onClick={() => enviarTeste.mutate(t)}>
                  <Send className="mr-1 h-3.5 w-3.5" /> Enviar teste para mim
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
