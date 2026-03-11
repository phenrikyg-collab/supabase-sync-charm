import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";

const supabase = supabaseClient as any;
import type { Colaborador, EscalaLimpeza, AvisoMural } from "@/types/database";

// Colaboradores
export const useColaboradores = () =>
  useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("*").eq("ativo", true).order("nome");
      if (error) throw error;
      return data as Colaborador[];
    },
  });

export const useCreateColaborador = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Partial<Colaborador>) => {
      const { data, error } = await supabase.from("colaboradores").insert(c).select().single();
      if (error) throw error;
      return data as Colaborador;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colaboradores"] }),
  });
};

export const useUpdateColaborador = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Colaborador> & { id: string }) => {
      const { data, error } = await supabase.from("colaboradores").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colaboradores"] }),
  });
};

export const useDeleteColaborador = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colaboradores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colaboradores"] }),
  });
};

// Escala de Limpeza
export const useEscalaLimpeza = (mes?: string) =>
  useQuery({
    queryKey: ["escala-limpeza", mes],
    queryFn: async () => {
      let query = supabase.from("escala_limpeza").select("*, colaboradores(nome)").order("data");
      if (mes) {
        const start = `${mes}-01`;
        const end = `${mes}-31`;
        query = query.gte("data", start).lte("data", end);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as (EscalaLimpeza & { colaboradores: { nome: string } | null })[];
    },
  });

export const useCreateEscalaLimpeza = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: Partial<EscalaLimpeza>) => {
      const { data, error } = await supabase.from("escala_limpeza").insert(e).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["escala-limpeza"] }),
  });
};

export const useDeleteEscalaLimpeza = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("escala_limpeza").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["escala-limpeza"] }),
  });
};

// Avisos Mural
export const useAvisosMural = () =>
  useQuery({
    queryKey: ["avisos-mural"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avisos_mural")
        .select("*")
        .eq("ativo", true)
        .order("prioridade", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AvisoMural[];
    },
  });

export const useCreateAviso = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Partial<AvisoMural>) => {
      const { data, error } = await supabase.from("avisos_mural").insert(a).select().single();
      if (error) throw error;
      return data as AvisoMural;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["avisos-mural"] }),
  });
};

export const useUpdateAviso = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AvisoMural> & { id: string }) => {
      const { data, error } = await supabase.from("avisos_mural").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["avisos-mural"] }),
  });
};

export const useDeleteAviso = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("avisos_mural").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["avisos-mural"] }),
  });
};
