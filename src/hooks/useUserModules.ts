import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppModule = "comercial" | "financeiro" | "producao";

export function useUserModules() {
  const { user } = useAuth();

  const { data: modules, isLoading } = useQuery({
    queryKey: ["user-modules", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_modules")
        .select("module")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.module as AppModule);
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  return {
    modules: modules ?? [],
    hasModule: (mod: AppModule) => modules?.includes(mod) ?? false,
    isLoading,
  };
}
