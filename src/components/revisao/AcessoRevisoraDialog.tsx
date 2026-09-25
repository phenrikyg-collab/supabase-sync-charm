import { useState } from "react";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";

function gerarSenha() {
  const c = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

/** Cria ou atualiza o login (celular + senha) de uma revisora no Portal da Revisora. */
export function AcessoRevisoraDialog({ revisoras }: { revisoras: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false);
  const [revisoraId, setRevisoraId] = useState("");
  const [celular, setCelular] = useState("");
  const [senha, setSenha] = useState(gerarSenha());
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!revisoraId) { toast.error("Escolha a revisora"); return; }
    if (celular.replace(/\D/g, "").length < 10) { toast.error("Informe o celular com DDD"); return; }
    if (senha.length < 6) { toast.error("A senha precisa ter pelo menos 6 caracteres"); return; }
    setSalvando(true);
    try {
      const r = await invokeEdgeFunction("revisora-criar-acesso", { revisora_id: revisoraId, celular, senha });
      if (!r?.ok) throw new Error(r?.erro ?? "Erro ao criar acesso");
      toast.success(`Acesso liberado. Celular ${r.celular ?? celular}, senha ${senha}. Entrar em ${window.location.origin}/portal-revisora`, { duration: 20000 });
      setCelular(""); setSenha(gerarSenha()); setRevisoraId("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar acesso");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}><KeyRound className="h-4 w-4" /> Acesso da revisora</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Acesso ao Portal da Revisora</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Revisora</Label>
              <Select value={revisoraId} onValueChange={setRevisoraId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{revisoras.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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
