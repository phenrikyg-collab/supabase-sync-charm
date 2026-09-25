import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogIn, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/** Monta o e-mail interno usado pelo login de oficina (celular + senha). */
export function emailSinteticoOficina(celular: string) {
  let d = celular.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return `${d}@oficina.mp.local`;
}

export default function Login() {
  const [modo, setModo] = useState<"equipe" | "oficina">("equipe");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modo === "oficina" && celular.replace(/\D/g, "").length < 10) {
      toast({ title: "Informe o celular com DDD", variant: "destructive" });
      return;
    }
    setLoading(true);
    const login = modo === "oficina" ? emailSinteticoOficina(celular) : email;
    const { error } = await signIn(login, password);
    setLoading(false);
    if (error) {
      const msg = modo === "oficina" && /invalid/i.test(error.message) ? "Celular ou senha incorretos" : error.message;
      toast({ title: "Erro ao entrar", description: msg, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="pt-8 pb-6 px-6 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-serif font-bold text-foreground">Moda Gestão</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sistema de Confecção</p>
          </div>
          <Tabs value={modo} onValueChange={(v) => setModo(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="equipe">Equipe</TabsTrigger>
              <TabsTrigger value="oficina">Oficina</TabsTrigger>
            </TabsList>
          </Tabs>
          <form onSubmit={handleSubmit} className="space-y-4">
            {modo === "equipe" ? (
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="celular">Celular</Label>
                <Input id="celular" type="tel" inputMode="tel" autoComplete="tel" value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="(11) 99999-9999" required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
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
