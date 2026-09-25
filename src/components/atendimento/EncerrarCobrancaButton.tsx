import { useState, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { chamarRpc } from "@/lib/supabaseRpc";
import { useAuth } from "@/contexts/AuthContext";

type RespostaEncerramento = { ok?: boolean; erro?: string };

export function invalidarCobrancasConversa(queryClient: QueryClient, conversaId: string | number) {
  const id = String(conversaId);
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["cobrancas-abertas", id] }),
    queryClient.invalidateQueries({ queryKey: ["inter-cobrancas-conversa", id] }),
    queryClient.invalidateQueries({ queryKey: ["pagamentos-links-conversa", id] }),
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversa"] }),
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] }),
  ]);
}

export function EncerrarCobrancaButton({
  id,
  valor,
  rpc,
  conversaId,
  gatilho,
}: {
  id: string | number;
  valor: string;
  rpc: "banco_inter_cobranca_encerrar" | "pagamentos_link_encerrar";
  conversaId: string | number;
  gatilho?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  const encerrar = async () => {
    setEncerrando(true);
    try {
      const { data, error } = await chamarRpc<RespostaEncerramento>(rpc, {
        p_id: id,
        p_motivo: "Cancelado no Atendimento",
        p_por: user?.email ?? null,
      });
      if (error) throw new Error(error.message || "Não foi possível cancelar a cobrança");
      if (!data?.ok) throw new Error(data?.erro || "Não foi possível cancelar a cobrança");
      await invalidarCobrancasConversa(queryClient, conversaId);
      setAberto(false);
      toast({ title: "Cobrança cancelada" });
    } catch (erro) {
      toast({
        title: "Não foi possível cancelar",
        description: erro instanceof Error ? erro.message : String(erro),
        variant: "destructive",
      });
    } finally {
      setEncerrando(false);
    }
  };

  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <AlertDialogTrigger asChild>
        {gatilho ?? (
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" title="Cancelar cobrança">
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Cancelar cobrança</span>
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar esta cobrança de {valor}?</AlertDialogTitle>
          <AlertDialogDescription>A cliente não recebe nenhuma mensagem.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={encerrando}>Voltar</AlertDialogCancel>
          <AlertDialogAction disabled={encerrando} onClick={(evento) => { evento.preventDefault(); void encerrar(); }}>
            {encerrando ? "Cancelando..." : "Cancelar cobrança"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
