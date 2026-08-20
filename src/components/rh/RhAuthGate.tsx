import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Lock } from "lucide-react";
import { useRhAuth } from "./useRhAuth";

/** Protege a aba Funcionários com login Supabase (e-mail/senha). Sem cadastro. */
export function RhAuthGate({ children }: { children: React.ReactNode }) {
  const { session, carregandoSessao, operador, semAcesso, sair } = useRhAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEntrando(false);
    if (error) setErro("E-mail ou senha inválidos.");
  };

  if (carregandoSessao) return <Skeleton className="h-64" />;

  if (!session) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-base font-serif flex items-center gap-2">
            <Lock className="h-4 w-4" /> Acesso restrito
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Entre com sua conta para ver os dados dos funcionários.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={entrar}>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Senha</Label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
            </div>
            {erro && <p className="text-xs text-destructive">{erro}</p>}
            <Button type="submit" className="w-full" disabled={!email || !senha || entrando}>
              {entrando ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {operador?.nome ? `${operador.nome} · ` : ""}{session.user.email}
        </p>
        <Button size="sm" variant="ghost" onClick={sair}>
          <LogOut className="h-3.5 w-3.5 mr-2" /> Sair
        </Button>
      </div>

      {semAcesso ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{semAcesso}</CardContent></Card>
      ) : (
        children
      )}
    </div>
  );
}
