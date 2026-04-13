import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { excluirPlanoPorOrdem } from "@/hooks/usePlanoProducao";
import { formatarData } from "@/utils/producao";
import PlanoProducaoCard from "./PlanoProducaoCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  refreshKey?: number;
}

interface PlanoAgrupado {
  ordemId: string;
  nomeProduto: string;
  totalPecas: number;
  pecasPlanejadas: number;
  totalDias: number;
  dataInicio: string;
  dataConclusao: string;
  planos: any[];
  etapasMap: Record<string, any[]>;
}

export default function ListaPlanos({ refreshKey }: Props) {
  const [grupos, setGrupos] = useState<PlanoAgrupado[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrdem, setExpandedOrdem] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPlanos = async () => {
    setLoading(true);
    try {
      const { data: planos } = await supabase
        .from("planos_producao" as any)
        .select("*")
        .order("data_planejada");

      if (!planos || planos.length === 0) {
        setGrupos([]);
        setLoading(false);
        return;
      }

      const planoIds = (planos as any[]).map((p: any) => p.id);
      const { data: etapas } = await supabase
        .from("planos_producao_etapas" as any)
        .select("*")
        .in("plano_producao_id", planoIds);

      // Agrupar etapas por plano_producao_id
      const etapasMap: Record<string, any[]> = {};
      (etapas || []).forEach((e: any) => {
        if (!etapasMap[e.plano_producao_id]) etapasMap[e.plano_producao_id] = [];
        etapasMap[e.plano_producao_id].push(e);
      });

      // Agrupar planos por ordem_producao_id
      const ordemMap = new Map<string, any[]>();
      (planos as any[]).forEach((p: any) => {
        const key = p.ordem_producao_id;
        if (!ordemMap.has(key)) ordemMap.set(key, []);
        ordemMap.get(key)!.push(p);
      });

      // Buscar nomes dos produtos
      const ordemIds = Array.from(ordemMap.keys());
      const { data: ordens } = await supabase
        .from("ordens_producao")
        .select("id, nome_produto, quantidade_pecas_ordem, quantidade")
        .in("id", ordemIds);

      const ordensMap: Record<string, any> = {};
      (ordens || []).forEach((o) => { ordensMap[o.id] = o; });

      const result: PlanoAgrupado[] = Array.from(ordemMap.entries()).map(([ordemId, ps]) => {
        const ordem = ordensMap[ordemId];
        const sorted = ps.sort((a: any, b: any) => a.data_planejada.localeCompare(b.data_planejada));
        return {
          ordemId,
          nomeProduto: ordem?.nome_produto || "Sem nome",
          totalPecas: ordem?.quantidade_pecas_ordem || ordem?.quantidade || 0,
          pecasPlanejadas: ps.reduce((a: number, p: any) => a + p.pecas_planejadas, 0),
          totalDias: ps.length,
          dataInicio: sorted[0]?.data_planejada || "",
          dataConclusao: sorted[sorted.length - 1]?.data_planejada || "",
          planos: sorted,
          etapasMap,
        };
      });

      setGrupos(result);
    } catch {
      toast.error("Erro ao carregar planos.");
    }
    setLoading(false);
  };

  useEffect(() => { fetchPlanos(); }, [refreshKey]);

  const handleExcluir = async (ordemId: string) => {
    setDeleting(ordemId);
    try {
      await excluirPlanoPorOrdem(ordemId);
      toast.success("Plano excluído.");
      fetchPlanos();
    } catch (err: any) {
      toast.error(err.message);
    }
    setDeleting(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum plano de produção cadastrado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {grupos.map((g) => {
        const isExpanded = expandedOrdem === g.ordemId;
        return (
          <Card key={g.ordemId}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{g.nomeProduto}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {g.totalPecas} peças total · {g.pecasPlanejadas} planejadas · {g.totalDias} dias · {formatarData(g.dataInicio)} → {formatarData(g.dataConclusao)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedOrdem(isExpanded ? null : g.ordemId)}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                    {isExpanded ? "Recolher" : "Ver detalhes"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleExcluir(g.ordemId)}
                    disabled={deleting === g.ordemId}
                  >
                    {deleting === g.ordemId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="space-y-2">
                {g.planos.map((p: any) => (
                  <PlanoProducaoCard
                    key={p.id}
                    plano={p}
                    etapas={g.etapasMap[p.id] || []}
                  />
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
