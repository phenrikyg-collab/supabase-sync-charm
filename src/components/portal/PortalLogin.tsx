import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** E-mail interno (invisível) usado no login por celular: só dígitos, prefixo 55 quando tem DDD sem país. */
export function emailSinteticoCelular(celular: string, dominio: "oficina" | "cortador" | "revisora") {
  let d = celular.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return `${d}@${dominio}.mp.local`;
}

export function PortalLogin({ dominio, titulo }: { dominio: "oficina" | "cortador" | "revisora"; titulo: string }) {
  const { signIn } = useAuth();
  const [celular, setCelular] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (celular.replace(/\D/g, "").length < 10) { toast.error("Informe o celular com DDD"); return; }
    setLoading(true);
    const { error } = await signIn(emailSinteticoCelular(celular, dominio), senha);
    setLoading(false);
    if (error) toast.error(/invalid/i.test(error.message) ? "Celular ou senha incorretos" : error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="pt-8 pb-6 px-6 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-serif font-bold text-foreground">{titulo}</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Moda Gestão</p>
          </div>
          <form onSubmit={entrar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="celular">Celular</Label>
              <Input id="celular" type="tel" inputMode="tel" autoComplete="tel" value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="(11) 99999-9999" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function brlPortal(v: number | null | undefined) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dataBR(v: string | null | undefined) {
  if (!v) return "-";
  const s = String(v).slice(0, 10);
  const [a, m, d] = s.split("-");
  return d ? `${d}/${m}/${a}` : "-";
}
