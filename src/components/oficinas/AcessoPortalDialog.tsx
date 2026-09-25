import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { chamarRpc } from "@/lib/supabaseRpc";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";

function formatarCelular(v: string | null | undefined) {
  if (!v) return "-";
  let d = v.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

function gerarSenha() {
  const c = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

/** Cria ou atualiza o login (celular + senha) de uma oficina no portal. */
export function AcessoPortalDialog({ oficina }: { oficina: { id: string; nome_oficina: string | null } }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [celular, setCelular] = useState("");
  const [senha, setSenha] = useState(gerarSenha());
  const [salvando, setSalvando] = useState(false);

  const { data, error } = useQuery({
    queryKey: ["oficina-usuarios", oficina.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("oficina_usuarios")
        .select("user_id, celular, oficina_id")
        .eq("oficina_id", oficina.id);
      if (error) throw error;
      return (data ?? []) as { user_id: string; celular: string | null; oficina_id: string }[];
    },
  });

  const salvar = async () => {
    const digitos = celular.replace(/\D/g, "");
    if (digitos.length < 10) { toast.error("Informe o celular com DDD"); return; }
    if (senha.length < 6) { toast.error("A senha precisa ter pelo menos 6 caracteres"); return; }
    setSalvando(true);
    try {
      const r = await invokeEdgeFunction("oficina-criar-acesso", { oficina_id: oficina.id, celular, senha });
      if (!r?.ok) throw new Error(r?.erro ?? "Erro ao criar acesso");
      toast.success(`Acesso liberado. Celular ${formatarCelular(r.celular ?? celular)}, senha ${senha}`, { duration: 15000 });
      setCelular("");
      setSenha(gerarSenha());
      qc.invalidateQueries({ queryKey: ["oficina-usuarios"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar acesso");
    } finally {
      setSalvando(false);
    }
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
          <div className="space-y-4">
            <div className="space-y-2">
              {error ? (
                <p className="text-sm text-muted-foreground">Não foi possível carregar os acessos.</p>
              ) : (data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum celular com acesso a esta oficina.</p>
              ) : (data ?? []).map((v) => (
                <div key={v.user_id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  {formatarCelular(v.celular)}
                  <Button variant="ghost" size="icon" onClick={() => remover(v.user_id)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Celular da oficina</Label>
                <Input type="tel" inputMode="tel" value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-1">
                <Label>Senha</Label>
                <div className="flex gap-2">
                  <Input value={senha} onChange={(e) => setSenha(e.target.value)} />
                  <Button type="button" variant="outline" size="icon" title="Gerar outra" onClick={() => setSenha(gerarSenha())}><RefreshCw className="h-4 w-4" /></Button>
                </div>
              </div>
              <Button onClick={salvar} disabled={salvando} className="w-full">Liberar acesso</Button>
              <p className="text-xs text-muted-foreground">Se o celular já tiver acesso, só a senha é trocada. Passe o celular e a senha para a oficina entrar no portal.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
