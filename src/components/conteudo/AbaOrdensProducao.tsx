import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

type Ordem = {
  id: string;
  nome_produto: string | null;
  quantidade_pecas_ordem: number | null;
  quantidade: number | null;
  status_ordem: string | null;
  data_previsao_termino: string | null;
  data_fim: string | null;
  ordem_corte_id: string | null;
  oficina_id: string | null;
};

const OFICINA_COLORS = [
  { bg: "hsl(var(--primary) / 0.12)", border: "hsl(var(--primary) / 0.4)", text: "hsl(var(--primary))" },
  { bg: "hsl(var(--success) / 0.12)", border: "hsl(var(--success) / 0.4)", text: "hsl(var(--success))" },
  { bg: "hsl(var(--warning) / 0.12)", border: "hsl(var(--warning) / 0.4)", text: "hsl(var(--warning))" },
  { bg: "hsl(280 60% 50% / 0.12)", border: "hsl(280 60% 50% / 0.4)", text: "hsl(280 60% 50%)" },
  { bg: "hsl(200 70% 50% / 0.12)", border: "hsl(200 70% 50% / 0.4)", text: "hsl(200 70% 50%)" },
  { bg: "hsl(340 65% 50% / 0.12)", border: "hsl(340 65% 50% / 0.4)", text: "hsl(340 65% 50%)" },
];

const COLUNAS = [
  { key: "corte", label: "Corte", match: ["corte"], headerBg: "bg-primary/10", headerText: "text-primary", headerBorder: "border-primary/20" },
  { key: "costura", label: "Costura", match: ["costura"], headerBg: "bg-warning/10", headerText: "text-warning", headerBorder: "border-warning/20" },
  { key: "revisao", label: "Revisão", match: ["revisao", "revisão"], headerBg: "bg-[hsl(200_70%_50%/0.1)]", headerText: "text-[hsl(200,70%,50%)]", headerBorder: "border-[hsl(200_70%_50%/0.2)]" },
  { key: "conserto", label: "Em Conserto", match: ["em conserto"], headerBg: "bg-danger/10", headerText: "text-danger", headerBorder: "border-danger/20" },
];

const STATUS_EXCLUIDOS = new Set(["finalizado", "concluido", "concluído", "cancelado"]);

function fmtBR(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

export function AbaOrdensProducao() {
  const [ordens, setOrdens] = useState<any[]>([]);
  const [oficinas, setOficinas] = useState<Map<string, any>>(new Map());
  const [cores, setCores] = useState<Map<string, any>>(new Map());
  const [ocMap, setOcMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [oRes, ofRes, cRes, ocRes] = await Promise.all([
          (supabase as any).from("ordens_producao").select("*").order("data_previsao_termino", { ascending: true, nullsFirst: false }),
          (supabase as any).from("oficinas").select("id,nome_oficina,is_interna"),
          (supabase as any).from("cores").select("id,nome_cor,cor_hex"),
          (supabase as any).from("ordens_corte").select("id,numero_oc"),
        ]);
        if (oRes.error) throw oRes.error;

        const ofMap = new Map<string, any>();
        (ofRes.data || []).forEach((o: any) => ofMap.set(o.id, o));
        setOficinas(ofMap);

        const cMap = new Map<string, any>();
        (cRes.data || []).forEach((c: any) => cMap.set(c.id, c));
        setCores(cMap);

        const ocs = new Map<string, any>();
        (ocRes.data || []).forEach((oc: any) => ocs.set(oc.id, oc));
        setOcMap(ocs);

        // Filter out finalizados/cancelados
        const filtradas = ((oRes.data || []) as Ordem[]).filter(
          (o) => !STATUS_EXCLUIDOS.has((o.status_ordem || "").toLowerCase().trim())
        );

        // Enrich with grade info
        const ocIds = Array.from(new Set(filtradas.map((o) => o.ordem_corte_id).filter(Boolean))) as string[];
        let gradeByOc = new Map<string, any[]>();
        if (ocIds.length) {
          const { data } = await (supabase as any).from("ordens_corte_grade").select("*").in("ordem_corte_id", ocIds);
          (data || []).forEach((g: any) => {
            const list = gradeByOc.get(g.ordem_corte_id) ?? [];
            list.push(g);
            gradeByOc.set(g.ordem_corte_id, list);
          });
        }
        setOrdens(filtradas.map((o) => ({ ...o, gradeInfo: o.ordem_corte_id ? gradeByOc.get(o.ordem_corte_id) ?? [] : [] })));
      } catch (e: any) {
        toast.error("Erro ao carregar ordens", { description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const oficinaColorMap = useMemo(() => {
    const m = new Map<string, typeof OFICINA_COLORS[number]>();
    Array.from(oficinas.values()).forEach((o, i) => m.set(o.id, OFICINA_COLORS[i % OFICINA_COLORS.length]));
    return m;
  }, [oficinas]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-serif text-lg">Ordens em Aberto</h2>
        <span className="text-xs text-muted-foreground">{ordens.length} ordens</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUNAS.map((col) => {
            const items = ordens.filter((o) => col.match.includes((o.status_ordem || "").toLowerCase().trim()));
            return (
              <div key={col.key} className="space-y-3">
                <div className={`flex items-center justify-between rounded-lg px-3 py-2 border ${col.headerBg} ${col.headerBorder}`}>
                  <h3 className={`font-serif font-bold ${col.headerText}`}>{col.label}</h3>
                  <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${col.headerText} ${col.headerBg}`}>{items.length}</span>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {items.map((item, i) => {
                    const ofColor = item.oficina_id ? oficinaColorMap.get(item.oficina_id) : null;
                    const oficinaNome = item.oficina_id ? oficinas.get(item.oficina_id)?.nome_oficina : null;
                    const gradeItems: any[] = item.gradeInfo ?? [];

                    const gradeByColor = new Map<string, { cor: any; grades: { tamanho: string; quantidade: number }[] }>();
                    gradeItems.forEach((g: any) => {
                      const key = g.cor_id ?? "sem-cor";
                      if (!gradeByColor.has(key)) gradeByColor.set(key, { cor: cores.get(g.cor_id) ?? null, grades: [] });
                      gradeByColor.get(key)!.grades.push({ tamanho: g.tamanho, quantidade: g.quantidade });
                    });

                    return (
                      <motion.div key={item.id ?? i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
                        <Card
                          className="border-l-4"
                          style={{
                            backgroundColor: ofColor?.bg,
                            borderLeftColor: ofColor?.border ?? "hsl(var(--border))",
                            borderTopColor: ofColor?.border,
                            borderRightColor: ofColor?.border,
                            borderBottomColor: ofColor?.border,
                          }}
                        >
                          <CardContent className="pt-4 pb-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm text-card-foreground">{item.nome_produto ?? "—"}</span>
                              {item.ordem_corte_id && ocMap.get(item.ordem_corte_id) && (
                                <span className="text-[10px] font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  {ocMap.get(item.ordem_corte_id).numero_oc}
                                </span>
                              )}
                            </div>

                            {gradeByColor.size > 0 && (
                              <div className="space-y-1.5">
                                {Array.from(gradeByColor.entries()).map(([key, { cor, grades }]) => (
                                  <div key={key} className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: cor?.cor_hex ?? "#ccc" }} />
                                      <span className="text-xs font-medium text-card-foreground">{cor?.nome_cor ?? "—"}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 pl-4">
                                      {grades.map((g, j) => (
                                        <span key={j} className="text-[10px] bg-card/80 border border-border/50 px-1.5 py-0.5 rounded text-muted-foreground">
                                          {g.tamanho}: {g.quantidade}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">{item.quantidade_pecas_ordem ?? item.quantidade ?? 0} peças</span>
                              {oficinaNome && (
                                <span className="text-xs font-semibold" style={ofColor ? { color: ofColor.text } : undefined}>● {oficinaNome}</span>
                              )}
                            </div>
                            {item.data_previsao_termino && (
                              <div className="text-[10px] text-muted-foreground">Prev: {fmtBR(item.data_previsao_termino)}</div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
