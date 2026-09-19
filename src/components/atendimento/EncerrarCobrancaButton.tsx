import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

type RespostaEncerramento = { ok?: boolean; erro?: string };

export function EncerrarCobrancaButton({
  id,
  valor,
  rpc,
  conversaId,
}: {
  id: string | number;
  valor: string;
  rpc: "banco_inter_cobranca_encerrar" | "pagamentos_link_encerrar";
  conversaId: string | number;
}) {
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  const encerrar = async () => {
    setEncerrando(true);
    try {
      const { data, error } = await chamarRpc<RespostaEncerramento>(rpc, {
        p_id: id,
        p_motivo: "Encerrada manualmente no Atendimento",
      });
      if (error) throw new Error(error.message || "Não foi possível encerrar a cobrança");
      if (!data?.ok) throw new Error(data?.erro || "Não foi possível encerrar a cobrança");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inter-cobrancas-conversa", String(conversaId)] }),
        queryClient.invalidateQueries({ queryKey: ["pagamentos-links-conversa", String(conversaId)] }),
      ]);
      setAberto(false);
      toast({ title: "Cobrança encerrada" });
    } catch (erro) {
      toast({
        title: "Não foi possível encerrar",
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
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" title="Encerrar cobrança">
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Encerrar cobrança</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Encerrar esta cobrança de {valor}?</AlertDialogTitle>
          <AlertDialogDescription>
            Ela some da conversa. Isso não cancela nada no banco nem no gateway.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={encerrando}>Voltar</AlertDialogCancel>
          <AlertDialogAction disabled={encerrando} onClick={(evento) => { evento.preventDefault(); void encerrar(); }}>
            {encerrando ? "Encerrando..." : "Encerrar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}