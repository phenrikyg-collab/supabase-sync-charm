import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LogIn, Loader2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password);
      setLoading(false);
      if (error) {
        toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Conta criada com sucesso!", description: "Você já pode fazer login." });
        setIsSignUp(false);
      }
    } else {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSignUp ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {isSignUp ? "Cadastrar" : "Entrar"}
            </Button>
          </form>
          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
            >
              {isSignUp ? "Já tenho conta, fazer login" : "Criar nova conta"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
