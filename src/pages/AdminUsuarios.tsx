import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function AdminUsuarios() {
  const { isAdmin, isLoading } = useUserRole();

  if (isLoading) return null;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-sm">
          <CardContent className="pt-6 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="font-serif font-bold text-foreground text-lg">Acesso Restrito</h2>
            <p className="text-sm text-muted-foreground">Apenas administradores podem acessar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminUsuariosContent />;
}

import { useState, useEffect } from "react";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Loader2, ShoppingBag, Banknote, Wrench, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { AppModule } from "@/hooks/useUserModules";

const MODULE_OPTIONS: { key: AppModule; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "comercial", label: "Comercial", icon: ShoppingBag },
  { key: "producao", label: "Produção", icon: Wrench },
  { key: "financeiro", label: "Financeiro", icon: Banknote },
];

interface UserWithModules {
  id: string;
  email: string;
  modules: AppModule[];
}

function AdminUsuariosContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedModules, setSelectedModules] = useState<AppModule[]>(["comercial", "producao", "financeiro"]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserWithModules[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      // Get all user_modules
      const { data: modulesData } = await supabase.from("user_modules").select("user_id, module");
      // Get all user_roles to find user IDs
      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");

      // Build unique user IDs from modules + roles
      const userIds = new Set<string>();
      modulesData?.forEach((m: any) => userIds.add(m.user_id));
      rolesData?.forEach((r: any) => userIds.add(r.user_id));

      // We can't directly query auth.users from client, so we show user_id
      // Group modules by user
      const userMap = new Map<string, AppModule[]>();
      modulesData?.forEach((m: any) => {
        const list = userMap.get(m.user_id) || [];
        list.push(m.module as AppModule);
        userMap.set(m.user_id, list);
      });

      const result: UserWithModules[] = Array.from(userIds).map((uid) => ({
        id: uid,
        email: uid.substring(0, 8) + "...",
        modules: userMap.get(uid) || [],
      }));

      setUsers(result);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      toast({ title: "Erro ao criar usuário", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Assign modules to new user
    const newUserId = signUpData.user?.id;
    if (newUserId && selectedModules.length > 0) {
      const inserts = selectedModules.map((mod) => ({
        user_id: newUserId,
        module: mod,
      }));
      await supabase.from("user_modules").insert(inserts);
    }

    toast({ title: "Usuário criado", description: `Acesso criado para ${email}` });
    setEmail("");
    setPassword("");
    setSelectedModules(["comercial", "producao", "financeiro"]);
    setLoading(false);
    fetchUsers();
    queryClient.invalidateQueries({ queryKey: ["user-modules"] });
  };

  const toggleNewModule = (mod: AppModule) => {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const toggleUserModule = (userId: string, mod: AppModule) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              modules: u.modules.includes(mod)
                ? u.modules.filter((m) => m !== mod)
                : [...u.modules, mod],
            }
          : u
      )
    );
  };

  const saveUserModules = async (user: UserWithModules) => {
    setSavingUserId(user.id);
    try {
      // Delete existing modules
      await supabase.from("user_modules").delete().eq("user_id", user.id);

      // Insert new modules
      if (user.modules.length > 0) {
        const inserts = user.modules.map((mod) => ({
          user_id: user.id,
          module: mod,
        }));
        await supabase.from("user_modules").insert(inserts);
      }

      toast({ title: "Módulos atualizados", description: "Permissões salvas com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["user-modules"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-3xl font-serif font-bold text-foreground">
          Gerenciar <span className="text-primary">Usuários</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Criar acessos e gerenciar módulos por usuário</p>
      </div>

      {/* Create User */}
      <Card className="max-w-lg">
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-serif font-bold text-foreground">Novo Usuário</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-email">E-mail</Label>
                <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@email.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Senha</Label>
                <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Módulos de acesso</Label>
              <div className="flex flex-wrap gap-3">
                {MODULE_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedModules.includes(opt.key)
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <Checkbox
                      checked={selectedModules.includes(opt.key)}
                      onCheckedChange={() => toggleNewModule(opt.key)}
                    />
                    <opt.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Criar Usuário
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-serif font-bold text-foreground mb-4">Usuários e Módulos</h2>
          {loadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado com módulos atribuídos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  {MODULE_OPTIONS.map((opt) => (
                    <TableHead key={opt.key} className="text-center">{opt.label}</TableHead>
                  ))}
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{u.email}</TableCell>
                    {MODULE_OPTIONS.map((opt) => (
                      <TableCell key={opt.key} className="text-center">
                        <Checkbox
                          checked={u.modules.includes(opt.key)}
                          onCheckedChange={() => toggleUserModule(u.id, opt.key)}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveUserModules(u)}
                        disabled={savingUserId === u.id}
                      >
                        {savingUserId === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
