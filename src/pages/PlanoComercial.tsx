import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function PlanoComercial() {
  const [mes, setMes] = useState("2026-07");
  const [plano, setPlano] = useState<any>(null);
  const [acoes, setAcoes] = useState<any[]>([]);
  const [distribuicao, setDistribuicao] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const fetchRef = useRef(false);

  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    carregarDados("2026-07");
  }, []);

  const carregarDados = async (mesRef: string) => {
    setLoading(true);
    setErro(null);

    try {
      const { data: planoData, error: planoErro } = await supabase
        .from("planos_comerciais" as any)
        .select("*")
        .eq("mes_referencia", mesRef)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (planoErro) throw new Error("Erro plano: " + planoErro.message);
      setPlano(planoData);

      const { data: acoesData, error: acoesErro } = await supabase
        .from("acoes_comerciais" as any)
        .select("*")
        .eq("mes_referencia", mesRef)
        .order("semana", { ascending: true });
      if (acoesErro) throw new Error("Erro acoes: " + acoesErro.message);
      setAcoes(acoesData || []);

      const { data: padrao, error: padraoErro } = await supabase
        .from("vw_padroes_pedidos" as any)
        .select("semana_do_mes, receita_total, total_pedidos");

      if (!padraoErro && padrao) {
        const resumo: Record<number, number> = {};
        (padrao as any[]).forEach((r: any) => {
          const s = Number(r.semana_do_mes);
          resumo[s] = (resumo[s] || 0) + Number(r.receita_total);
        });
        const total = Object.values(resumo).reduce((s, v) => s + v, 0);
        const dist = Object.entries(resumo)
          .map(([s, v]) => ({
            semana: parseInt(s),
            percentual: total ? Math.round((v / total) * 100) : 0,
            meta_receita:
              planoData && total
                ? Math.round(((planoData as any).meta_receita * v) / total)
                : 0,
          }))
          .sort((a, b) => a.semana - b.semana);
        setDistribuicao(dist);
      }

      const { data: kpisData } = await supabase
        .from("vw_kpis_trafego" as any)
        .select("*")
        .order("mes_referencia", { ascending: false })
        .limit(6);
      setKpis((kpisData as any[]) || []);
    } catch (e: any) {
      setErro(e.message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Carregando...</div>;
  if (erro)
    return (
      <div className="p-8 text-destructive">
        <h2 className="font-bold mb-2">Erro</h2>
        <pre className="whitespace-pre-wrap">{erro}</pre>
      </div>
    );

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Plano Comercial (diagnóstico)</h1>
      <div>Mês: {mes}</div>
      <div>
        Plano:{" "}
        {plano
          ? (plano.resumo_ia?.substring(0, 100) || "(sem resumo_ia)")
          : "Nenhum plano encontrado"}
      </div>
      <div>Ações: {acoes.length}</div>
      <div>Semanas: {distribuicao.length}</div>
      <div>KPIs: {kpis.length}</div>
      <pre className="bg-muted p-4 rounded text-xs overflow-auto">
        {JSON.stringify(
          {
            plano: !!plano,
            plano_id: plano?.id,
            acoes: acoes.length,
            dist: distribuicao,
            kpis: kpis.length,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
