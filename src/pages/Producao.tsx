import { useResumoProducao, useUpdateOrdemProducao } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { motion } from "framer-motion";
import { toast } from "sonner";

const COLUNAS = [
  { key: "corte", label: "Corte", match: ["corte"] },
  { key: "costura", label: "Costura", match: ["costura"] },
  { key: "revisao", label: "Revisão", match: ["revisao", "revisão"] },
  { key: "finalizado", label: "Finalizado", match: ["finalizado"] },
];

export default function Producao() {
  const { data: producao, isLoading } = useResumoProducao();
  const updateMut = useUpdateOrdemProducao();

  const moveToNext = async (id: string, currentStatus: string) => {
    const idx = COLUNAS.findIndex((c) => c.match.includes(currentStatus.toLowerCase()));
    if (idx < 0 || idx >= COLUNAS.length - 1) return;
    const nextStatus = COLUNAS[idx + 1].label;
    try {
      await updateMut.mutateAsync({ id, status_ordem: nextStatus });
      toast.success(`Movido para ${nextStatus}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Produção — Kanban</h1>
        <p className="text-sm text-muted-foreground mt-1">Arraste ou clique para avançar as ordens</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUNAS.map((col) => {
            const items = producao?.filter((p) => col.match.includes(p.status_ordem?.toLowerCase() ?? "")) ?? [];
            return (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif font-bold text-foreground">{col.label}</h3>
                  <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{items.length}</span>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {items.map((item, i) => (
                    <motion.div
                      key={item.id ?? i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Card
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => item.id && moveToNext(item.id, item.status_ordem ?? "")}
                      >
                        <CardContent className="pt-4 pb-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-card-foreground">{item.nome_produto}</span>
                            {item.cor_hex && (
                              <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: item.cor_hex }} />
                            )}
                          </div>
                          {item.nome_cor && (
                            <p className="text-xs text-muted-foreground">{item.nome_cor}</p>
                          )}
                          {item.grade_resumo && (
                            <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">{item.grade_resumo}</p>
                          )}
                          {item.nome_oficina && (
                            <p className="text-xs text-muted-foreground">Oficina: {item.nome_oficina}</p>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
