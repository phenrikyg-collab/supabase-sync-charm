import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { erroRh } from "./useRhAuth";

/** Competência do mês corrente no formato usado pela folha (YYYY-MM-01). */
export function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Qualquer alteração de valor (vale, falta, salário, diária de VT) muda o
 * líquido do fechamento — o holerite do dia 5 precisa ser regerado, senão o
 * PIX sai com valor antigo.
 */
export function useRegerarFechamento() {
  const { toast } = useToast();

  const regerar = async (competencia: string) => {
    const { error } = await supabase.rpc("rh_holerites_gerar", {
      p_competencia: competencia,
      p_tipo: "fechamento",
    } as any);
    if (error)
      toast({
        title: "Erro ao regerar holerite",
        description: erroRh(error).mensagem,
        variant: "destructive",
      });
    else toast({ title: "Holerite de fechamento regerado" });
  };

  const avisarRegeracao = (
    competencia: string,
    titulo: string,
    descricao?: string,
  ) =>
    toast({
      title: titulo,
      description:
        descricao ??
        "A alteração só entra no líquido depois de regerar o holerite de fechamento.",
      action: (
        <ToastAction
          altText="Regerar holerite de fechamento"
          onClick={() => regerar(competencia)}
        >
          Regerar holerite
        </ToastAction>
      ),
    });

  return { regerar, avisarRegeracao };
}
