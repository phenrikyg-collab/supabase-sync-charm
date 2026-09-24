import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chamarRpc } from "@/lib/supabaseRpc";
import { rpcAusente } from "@/lib/oficinaFluxo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound, X } from "lucide-react";
import { toast } from "sonner";

/** Liga o login (e-mail já cadastrado em Usuários) de uma oficina ao portal. */
export function AcessoPortalDialog({ oficina }: { oficina: { id: string; nome_oficina: string | null } }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data, error } = useQuery({
    queryKey: ["oficina-usuarios"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await chamarRpc<{ user_id: string; email: string; oficina_id: string }[]>("oficina_usuarios_listar");
      if (error) throw error;
      return data ?? [];
    },
  });
  const pendente = error && rpcAusente(error as any);
  const vinculados = (data ?? []).filter((v) => v.oficina_id === oficina.id);

  const vincular = async () => {
    if (!email.trim()) return;
    setSalvando(true);
    const { error } = await chamarRpc("oficina_vincular_usuario", { p_email: email.trim(), p_oficina_id: oficina.id });
    setSalvando(false);
    if (error) { toast.error(error.message ?? "Erro ao vincular"); return; }
    toast.success("Acesso liberado. A oficina entra com esse e-mail e cai direto no portal.");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["oficina-usuarios"] });
  };

  const remover = async (userId: string) => {
    const { error } = await chamarRpc("oficina_desvincular_usuario", { p_user_id: userId });
    if (error) { toast.error(error.message ?? "Erro ao remover"); return; }
    qc.invalidateQueries({ queryKey: ["oficina-usuarios"] });
  };

  return (
    <>
      <Button variant="ghost" size="icon" title="Acesso ao portal" onClick={() => setOpen(true)}><KeyRound className="h-4 w-4" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Acesso ao portal - {oficina.nome_oficina}</DialogTitle></DialogHeader>
          {pendente ? (
            <p className="text-sm text-muted-foreground">O portal ainda não foi configurado no banco. Rode o SQL do portal das oficinas e tente de novo.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {vinculados.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum login ligado a esta oficina.</p>
                ) : vinculados.map((v) => (
                  <div key={v.user_id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    {v.email}
                    <Button variant="ghost" size="icon" onClick={() => remover(v.user_id)}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <Label>E-mail do login da oficina</Label>
                <div className="flex gap-2">
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="oficina@exemplo.com" />
                  <Button onClick={vincular} disabled={salvando}>Ligar</Button>
                </div>
                <p className="text-xs text-muted-foreground">Crie o login antes em Usuários. Depois de ligado, ele só vê o portal desta oficina.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
