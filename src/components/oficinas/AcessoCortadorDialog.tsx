import { useState } from "react";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Scissors } from "lucide-react";
import { toast } from "sonner";

function gerarSenha() {
  const c = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

/** Cria ou atualiza o login (celular + senha) de um cortador no Portal do Corte. */
export function AcessoCortadorDialog() {
  const [open, setOpen] = useState(false);
  const [celular, setCelular] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState(gerarSenha());
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (celular.replace(/\D/g, "").length < 10) { toast.error("Informe o celular com DDD"); return; }
    if (senha.length < 6) { toast.error("A senha precisa ter pelo menos 6 caracteres"); return; }
    setSalvando(true);
    try {
      const r = await invokeEdgeFunction("cortador-criar-acesso", { celular, senha, ...(nome.trim() ? { nome: nome.trim() } : {}) });
      if (!r?.ok) throw new Error(r?.erro ?? "Erro ao criar acesso");
      toast.success(`Acesso liberado. Celular ${r.celular ?? celular}, senha ${senha}. Entrar em ${window.location.origin}/portal-cortador`, { duration: 20000 });
      setCelular(""); setNome(""); setSenha(gerarSenha());
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar acesso");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}><Scissors className="h-4 w-4" /> Acesso do cortador</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Acesso ao Portal do Corte</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nome (opcional)</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div className="space-y-1"><Label>Celular</Label><Input type="tel" inputMode="tel" placeholder="(11) 99999-9999" value={celular} onChange={(e) => setCelular(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Senha</Label>
              <div className="flex gap-2">
                <Input value={senha} onChange={(e) => setSenha(e.target.value)} />
                <Button variant="outline" size="icon" title="Gerar outra" onClick={() => setSenha(gerarSenha())}><RefreshCw className="h-4 w-4" /></Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Se o celular já tiver acesso, só a senha muda.</p>
            <Button className="w-full" onClick={salvar} disabled={salvando}>Liberar acesso</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
