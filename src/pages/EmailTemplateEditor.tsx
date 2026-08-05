import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import EmailEditor, { EditorRef } from "react-email-editor";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

export default function EmailTemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const emailEditorRef = useRef<EditorRef>(null);
  const novo = !id || id === "novo";

  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editorPronto, setEditorPronto] = useState(false);

  const { data: templateExistente } = useQuery({
    queryKey: ["email-template", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("templates_listar" as any);
      if (error) throw error;
      return ((data ?? []) as any[]).find((t) => String(t.id) === String(id)) ?? null;
    },
    enabled: !novo,
  });

  useEffect(() => {
    if (templateExistente?.nome) setNome(templateExistente.nome);
  }, [templateExistente?.nome]);

  useEffect(() => {
    if (editorPronto && templateExistente?.design_json) {
      const design =
        typeof templateExistente.design_json === "string"
          ? JSON.parse(templateExistente.design_json)
          : templateExistente.design_json;
      emailEditorRef.current?.editor?.loadDesign(design);
    }
  }, [editorPronto, templateExistente]);

  const handleSalvar = () => {
    if (!nome.trim()) {
      toast({ title: "Informe o nome do template", variant: "destructive" });
      return;
    }
    const editor = emailEditorRef.current?.editor;
    if (!editor) return;
    setSalvando(true);
    editor.exportHtml(async (data: any) => {
      const { design, html } = data;
      const { error } = await supabase.rpc("templates_salvar" as any, {
        p_id: novo ? null : id,
        p_nome: nome,
        p_design_json: design,
        p_html_renderizado: html,
      });
      setSalvando(false);
      if (error) {
        toast({ title: "Erro ao salvar template", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Template salvo" });
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      navigate("/email-marketing");
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/email-marketing")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Input
          className="max-w-xs"
          placeholder="Nome do template"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Variáveis:</span>
          <Badge variant="secondary" className="font-mono">{"{{nome}}"}</Badge>
          <Badge variant="secondary" className="font-mono">{"{{primeiro_nome}}"}</Badge>
        </div>
        <Button className="ml-auto" onClick={handleSalvar} disabled={salvando}>
          {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar template
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <EmailEditor
          ref={emailEditorRef}
          onReady={() => setEditorPronto(true)}
          minHeight="100%"
          options={{ locale: "pt-BR" }}
        />
      </div>
    </div>
  );
}
