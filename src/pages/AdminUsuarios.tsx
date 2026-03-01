import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminUsuarios() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    // Use admin invite or signUp to create users
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    setLoading(false);
    if (error) {
      toast({ title: "Erro ao criar usuário", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Usuário criado", description: `Acesso criado para ${email}` });
      setEmail("");
      setPassword("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-3xl font-serif font-bold text-foreground">
          Gerenciar <span className="text-primary">Usuários</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Criar novos acessos ao sistema</p>
      </div>

      <Card className="max-w-md">
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-serif font-bold text-foreground">Novo Usuário</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">E-mail</Label>
              <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@email.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Senha</Label>
              <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Criar Usuário
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
