import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserRole() {
  const { user } = useAuth();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.role as string);
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  return {
    roles: roles ?? [],
    isAdmin: roles?.includes("admin") ?? false,
    /** Usuário de oficina externa (sem admin): só acessa o portal. */
    isOficina: (roles?.includes("oficina") && !roles?.includes("admin")) ?? false,
    /** Login de cortador (celular + senha): só acessa o Portal do Corte. */
    isCortador: (!!user?.email?.endsWith("@cortador.mp.local") && !roles?.includes("admin")),
    isLoading,
  };
}
