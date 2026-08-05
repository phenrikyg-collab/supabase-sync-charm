import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Mail } from "lucide-react";

export type Template = {
  id: number | string;
  nome: string;
  design_json?: any;
  html_renderizado?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function TemplatesTab() {
  const navigate = useNavigate();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("templates_listar" as any);
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => navigate("/email-marketing/templates/novo")}>
          <Plus className="h-4 w-4 mr-2" /> Novo template
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando templates…</p>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum template criado ainda.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <div className="h-32 bg-muted flex items-center justify-center border-b">
                <Mail className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <div className="p-4 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.nome}</p>
                  {t.updated_at && (
                    <p className="text-xs text-muted-foreground">
                      Atualizado em {new Date(t.updated_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline"
                  onClick={() => navigate(`/email-marketing/templates/${t.id}`)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
