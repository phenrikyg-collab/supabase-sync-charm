import { useOrdensCorte } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OrdemCorteEnriched {
  id: string;
  numero_oc: string;
  status: string | null;
  grade_tamanhos: string[];
  metragem_risco: number;
  quantidade_folhas: number | null;
  created_at: string | null;
  produtos: { nome_produto: string | null }[];
  grade: { tamanho: string; quantidade: number; cor_id: string | null }[];
}

export default function OrdensCorte() {
  const { data: ordens, isLoading } = useOrdensCorte();
  const navigate = useNavigate();
  const [enriched, setEnriched] = useState<OrdemCorteEnriched[]>([]);

  useEffect(() => {
    if (!ordens?.length) return;
    const ids = ordens.map((o) => o.id);

    Promise.all([
      supabase.from("ordens_corte_produtos").select("*").in("ordem_corte_id", ids),
      supabase.from("ordens_corte_grade").select("*").in("ordem_corte_id", ids),
    ]).then(([prodRes, gradeRes]) => {
      const prodByOrdem = new Map<string, any[]>();
      (prodRes.data ?? []).forEach((p: any) => {
        const list = prodByOrdem.get(p.ordem_corte_id) ?? [];
        list.push(p);
        prodByOrdem.set(p.ordem_corte_id, list);
      });

      const gradeByOrdem = new Map<string, any[]>();
      (gradeRes.data ?? []).forEach((g: any) => {
        const list = gradeByOrdem.get(g.ordem_corte_id) ?? [];
        list.push(g);
        gradeByOrdem.set(g.ordem_corte_id, list);
      });

      setEnriched(
        ordens.map((o) => ({
          ...o,
          produtos: prodByOrdem.get(o.id) ?? [],
          grade: gradeByOrdem.get(o.id) ?? [],
        }))
      );
    });
  }, [ordens]);

  const totalPecas = (grade: { quantidade: number }[]) => grade.reduce((a, g) => a + g.quantidade, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Ordens de Corte</h1>
          <p className="text-sm text-muted-foreground mt-1">{enriched.length} ordens</p>
        </div>
        <Button onClick={() => navigate("/ordens-corte/nova")} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Ordem
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          enriched.map((o, i) => (
            <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-lg text-card-foreground">{o.numero_oc}</span>
                    <StatusBadge status={o.status ?? "planejada"} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {o.produtos.map((p) => p.nome_produto).join(", ") || "—"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {o.grade.map((g, j) => (
                      <span key={j} className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">
                        {g.tamanho}: {g.quantidade}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total de Peças</span>
                    <span className="font-bold text-card-foreground">{totalPecas(o.grade)}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
