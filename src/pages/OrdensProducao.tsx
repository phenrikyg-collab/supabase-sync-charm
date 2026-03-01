import { useState, useEffect } from "react";
import { useOrdensProducao, useOficinas, useProdutos, useCores, useOrdensCorte, useCreateOrdemProducao, useResumoProducao, useUpdateOrdemProducao, useAllConsertos, useCreateConserto, useUpdateConserto } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, List, Columns3, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

// Color palette for oficinas (deterministic by index)
const OFICINA_COLORS = [
  { bg: "hsl(var(--primary) / 0.12)", border: "hsl(var(--primary) / 0.4)", text: "hsl(var(--primary))" },
  { bg: "hsl(var(--success) / 0.12)", border: "hsl(var(--success) / 0.4)", text: "hsl(var(--success))" },
  { bg: "hsl(var(--warning) / 0.12)", border: "hsl(var(--warning) / 0.4)", text: "hsl(var(--warning))" },
  { bg: "hsl(280 60% 50% / 0.12)", border: "hsl(280 60% 50% / 0.4)", text: "hsl(280 60% 50%)" },
  { bg: "hsl(200 70% 50% / 0.12)", border: "hsl(200 70% 50% / 0.4)", text: "hsl(200 70% 50%)" },
  { bg: "hsl(340 65% 50% / 0.12)", border: "hsl(340 65% 50% / 0.4)", text: "hsl(340 65% 50%)" },
];

const COLUNAS_KANBAN = [
  { key: "corte", label: "Corte", match: ["corte"], headerBg: "bg-primary/10", headerText: "text-primary", headerBorder: "border-primary/20" },
  { key: "costura", label: "Costura", match: ["costura"], headerBg: "bg-warning/10", headerText: "text-warning", headerBorder: "border-warning/20" },
  { key: "revisao", label: "Revisão", match: ["revisao", "revisão"], headerBg: "bg-[hsl(200_70%_50%/0.1)]", headerText: "text-[hsl(200,70%,50%)]", headerBorder: "border-[hsl(200_70%_50%/0.2)]" },
  { key: "conserto", label: "Em Conserto", match: ["em conserto"], headerBg: "bg-danger/10", headerText: "text-danger", headerBorder: "border-danger/20" },
  { key: "finalizado", label: "Finalizado", match: ["finalizado"], headerBg: "bg-success/10", headerText: "text-success", headerBorder: "border-success/20" },
];

const TAMANHOS = ["PP", "P", "M", "G", "GG", "EG"];

export default function OrdensProducao() {
  const { data: ordens, isLoading } = useOrdensProducao();
  const { data: oficinas } = useOficinas();
  const { data: produtos } = useProdutos();
  const { data: cores } = useCores();
  const { data: ordensCorte } = useOrdensCorte();
  const { data: producao } = useResumoProducao();
  const { data: consertos } = useAllConsertos();
  const createMut = useCreateOrdemProducao();
  const updateMut = useUpdateOrdemProducao();
  const createConsertoMut = useCreateConserto();

  const [open, setOpen] = useState(false);
  const [ocId, setOcId] = useState("");
  const [oficinaId, setOficinaId] = useState("");
  const [quantidade, setQuantidade] = useState(0);
  const [ocInfo, setOcInfo] = useState<{ produto: string; cor: string; grade: string } | null>(null);

  // Conserto dialog
  const [consertoOpen, setConsertoOpen] = useState(false);
  const [consertoOrdemId, setConsertoOrdemId] = useState("");
  const [consertoCorId, setConsertoCorId] = useState("");
  const [consertoTamanho, setConsertoTamanho] = useState("");
  const [consertoQtd, setConsertoQtd] = useState(1);
  const [consertoOficinaId, setConsertoOficinaId] = useState("");
  const [consertoObs, setConsertoObs] = useState("");

  // Enriched ordens with grade info
  const [ordensEnriched, setOrdensEnriched] = useState<any[]>([]);

  const oficinaMap = Object.fromEntries((oficinas ?? []).map((o) => [o.id, o]));
  const corMap = Object.fromEntries((cores ?? []).map((c) => [c.id, c]));
  const oficinaColorMap = Object.fromEntries(
    (oficinas ?? []).map((o, i) => [o.id, OFICINA_COLORS[i % OFICINA_COLORS.length]])
  );

  const ocsDisponiveis = ordensCorte?.filter((oc) => oc.status === "Planejada") ?? [];

  // Fetch grade info for each ordem de produção
  useEffect(() => {
    if (!ordens?.length) { setOrdensEnriched([]); return; }
    const ocIds = ordens.map((o) => o.ordem_corte_id).filter(Boolean) as string[];
    if (ocIds.length === 0) { setOrdensEnriched(ordens.map((o) => ({ ...o, gradeInfo: [] }))); return; }

    supabase.from("ordens_corte_grade").select("*").in("ordem_corte_id", ocIds).then(({ data }) => {
      const gradeByOc = new Map<string, any[]>();
      (data ?? []).forEach((g: any) => {
        const list = gradeByOc.get(g.ordem_corte_id) ?? [];
        list.push(g);
        gradeByOc.set(g.ordem_corte_id, list);
      });
      setOrdensEnriched(ordens.map((o) => ({
        ...o,
        gradeInfo: o.ordem_corte_id ? (gradeByOc.get(o.ordem_corte_id) ?? []) : [],
      })));
    });
  }, [ordens]);

  useEffect(() => {
    if (!ocId) { setOcInfo(null); return; }
    Promise.all([
      supabase.from("ordens_corte_produtos").select("*").eq("ordem_corte_id", ocId),
      supabase.from("ordens_corte_grade").select("*").eq("ordem_corte_id", ocId),
    ]).then(([prodRes, gradeRes]) => {
      const prods = prodRes.data ?? [];
      const grades = gradeRes.data ?? [];
      const totalPecas = grades.reduce((a: number, g: any) => a + (g.quantidade ?? 0), 0);
      setQuantidade(totalPecas);
      const corId = grades[0]?.cor_id;
      setOcInfo({
        produto: prods.map((p: any) => p.nome_produto).join(", ") || "—",
        cor: corId && corMap[corId] ? corMap[corId].nome_cor ?? "—" : "—",
        grade: grades.map((g: any) => `${g.tamanho}: ${g.quantidade}`).join(", "),
      });
    });
  }, [ocId]);

  const handleCreate = async () => {
    if (!ocId || !oficinaId) { toast.error("Selecione OC e Oficina"); return; }
    try {
      const prodRes = await supabase.from("ordens_corte_produtos").select("*").eq("ordem_corte_id", ocId).limit(1);
      const prod = prodRes.data?.[0];

      await createMut.mutateAsync({
        ordem_corte_id: ocId,
        produto_id: prod?.produto_id ?? null,
        nome_produto: prod?.nome_produto ?? "",
        oficina_id: oficinaId,
        quantidade,
        quantidade_pecas_ordem: quantidade,
        status_ordem: "Corte",
        data_inicio: new Date().toISOString().split("T")[0],
      });
      toast.success("Ordem de produção criada!");
      setOpen(false);
      setOcId(""); setOficinaId("");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateConserto = async () => {
    if (!consertoOrdemId || !consertoTamanho) { toast.error("Preencha os campos obrigatórios"); return; }
    try {
      await createConsertoMut.mutateAsync({
        ordem_producao_id: consertoOrdemId,
        cor_id: consertoCorId || null,
        tamanho: consertoTamanho,
        quantidade: consertoQtd,
        oficina_id: consertoOficinaId || null,
        observacao: consertoObs || null,
        status: "Em Conserto",
      });
      toast.success("Conserto registrado!");
      setConsertoOpen(false);
      setConsertoOrdemId(""); setConsertoCorId(""); setConsertoTamanho(""); setConsertoQtd(1); setConsertoOficinaId(""); setConsertoObs("");
    } catch (e: any) { toast.error(e.message); }
  };

  const openConsertoDialog = (ordemId: string) => {
    setConsertoOrdemId(ordemId);
    setConsertoOpen(true);
  };

  const moveToNext = async (id: string, currentStatus: string) => {
    const idx = COLUNAS_KANBAN.findIndex((c) => c.match.includes(currentStatus.toLowerCase()));
    if (idx < 0 || idx >= COLUNAS_KANBAN.length - 1) return;
    const nextStatus = COLUNAS_KANBAN[idx + 1].label;
    try {
      await updateMut.mutateAsync({ id, status_ordem: nextStatus });
      toast.success(`Movido para ${nextStatus}`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            Ordens de <span className="text-primary">Produção</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{ordens?.length ?? 0} ordens</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Nova Ordem</Button>
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista" className="gap-1.5"><List className="h-4 w-4" /> Lista</TabsTrigger>
          <TabsTrigger value="kanban" className="gap-1.5"><Columns3 className="h-4 w-4" /> Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Cores</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Oficina</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Início</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordensEnriched.map((o: any) => {
                      const gradeItems = o.gradeInfo ?? [];
                      // Group grade by color
                      const coresByGrade = new Map<string, any[]>();
                      gradeItems.forEach((g: any) => {
                        const key = g.cor_id ?? "sem-cor";
                        const list = coresByGrade.get(key) ?? [];
                        list.push(g);
                        coresByGrade.set(key, list);
                      });

                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{o.nome_produto ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {Array.from(coresByGrade.keys()).map((corId) => {
                                const cor = corId !== "sem-cor" && corMap[corId] ? corMap[corId] : null;
                                return (
                                  <div key={corId} className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: cor?.cor_hex ?? "#ccc" }} />
                                    <span className="text-xs text-muted-foreground">{cor?.nome_cor ?? "—"}</span>
                                  </div>
                                );
                              })}
                              {coresByGrade.size === 0 && (
                                o.cor_id && corMap[o.cor_id] ? (
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: corMap[o.cor_id].cor_hex ?? "#ccc" }} />
                                    <span className="text-xs">{corMap[o.cor_id].nome_cor}</span>
                                  </div>
                                ) : "—"
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {gradeItems.map((g: any, j: number) => (
                                <span key={j} className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  {g.tamanho}: {g.quantidade}
                                </span>
                              ))}
                              {gradeItems.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                            </div>
                          </TableCell>
                          <TableCell>{o.oficina_id ? oficinaMap[o.oficina_id]?.nome_oficina ?? "—" : "—"}</TableCell>
                          <TableCell className="text-right">{o.quantidade ?? o.quantidade_pecas_ordem ?? 0}</TableCell>
                          <TableCell><StatusBadge status={o.status_ordem ?? ""} /></TableCell>
                          <TableCell className="text-muted-foreground">{o.data_inicio ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {COLUNAS_KANBAN.map((col) => {
              // For "Em Conserto" column, show consertos grouped by ordem
              const isConsertoCol = col.key === "conserto";
              const items = isConsertoCol ? [] : ordensEnriched.filter((o: any) => col.match.includes(o.status_ordem?.toLowerCase() ?? ""));
              
              // Group consertos by ordem_producao_id for the Em Conserto column
              const consertosByOrdem = new Map<string, any[]>();
              if (isConsertoCol && consertos?.length) {
                consertos.filter((c) => c.status === "Em Conserto").forEach((c) => {
                  const list = consertosByOrdem.get(c.ordem_producao_id) ?? [];
                  list.push(c);
                  consertosByOrdem.set(c.ordem_producao_id, list);
                });
              }

              return (
                <div key={col.key} className="space-y-3">
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 border ${col.headerBg} ${col.headerBorder}`}>
                    <h3 className={`font-serif font-bold ${col.headerText}`}>{col.label}</h3>
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${col.headerText} ${col.headerBg}`}>
                      {isConsertoCol ? consertosByOrdem.size : items.length}
                    </span>
                  </div>
                  <div className="space-y-3 min-h-[200px]">
                    {isConsertoCol ? (
                      // Render conserto cards
                      Array.from(consertosByOrdem.entries()).map(([ordemId, consertoList], i) => {
                        const ordem = ordensEnriched.find((o: any) => o.id === ordemId);
                        return (
                          <motion.div key={ordemId} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
                            <Card className="border-l-4" style={{ borderLeftColor: "hsl(var(--danger))", backgroundColor: "hsl(var(--danger) / 0.05)" }}>
                              <CardContent className="pt-4 pb-3 space-y-2">
                                <span className="font-medium text-sm text-card-foreground">{ordem?.nome_produto ?? "—"}</span>
                                <div className="space-y-1">
                                  {consertoList.map((c: any, j: number) => {
                                    const cor = c.cor_id ? corMap[c.cor_id] : null;
                                    const oficina = c.oficina_id ? oficinaMap[c.oficina_id] : null;
                                    return (
                                      <div key={c.id ?? j} className="flex items-center gap-1.5 text-xs">
                                        {cor && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cor.cor_hex ?? "#ccc" }} />}
                                        <span className="text-muted-foreground">{cor?.nome_cor ?? "—"}</span>
                                        <span className="bg-danger/10 text-danger px-1.5 py-0.5 rounded text-[10px] font-medium">{c.tamanho}: {c.quantidade}</span>
                                        {oficina && <span className="text-[10px] text-muted-foreground">({oficina.nome_oficina})</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                                {consertoList[0]?.observacao && (
                                  <p className="text-[10px] text-muted-foreground italic">{consertoList[0].observacao}</p>
                                )}
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })
                    ) : (
                      // Render normal ordem cards
                      items.map((item: any, i: number) => {
                        const ofColor = item.oficina_id ? oficinaColorMap[item.oficina_id] : null;
                        const oficinaNome = item.oficina_id ? oficinaMap[item.oficina_id]?.nome_oficina : null;
                        const gradeItems: any[] = item.gradeInfo ?? [];
                        const isRevisao = col.key === "revisao";
                        
                        const gradeByColor = new Map<string, { cor: any; grades: { tamanho: string; quantidade: number }[] }>();
                        gradeItems.forEach((g: any) => {
                          const key = g.cor_id ?? "sem-cor";
                          if (!gradeByColor.has(key)) {
                            gradeByColor.set(key, { cor: corMap[g.cor_id] ?? null, grades: [] });
                          }
                          gradeByColor.get(key)!.grades.push({ tamanho: g.tamanho, quantidade: g.quantidade });
                        });

                        return (
                          <motion.div
                            key={item.id ?? i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.03 }}
                          >
                            <Card
                              className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                              style={{
                                backgroundColor: ofColor?.bg ?? undefined,
                                borderLeftColor: ofColor?.border ?? "hsl(var(--border))",
                                borderTopColor: ofColor?.border ?? undefined,
                                borderRightColor: ofColor?.border ?? undefined,
                                borderBottomColor: ofColor?.border ?? undefined,
                              }}
                              onClick={() => item.id && moveToNext(item.id, item.status_ordem ?? "")}
                            >
                              <CardContent className="pt-4 pb-3 space-y-2">
                                <span className="font-medium text-sm text-card-foreground">{item.nome_produto ?? "—"}</span>
                                
                                {gradeByColor.size > 0 ? (
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
                                ) : item.grade_resumo ? (
                                  <p className="text-xs text-muted-foreground bg-card/60 rounded px-2 py-1">{item.grade_resumo}</p>
                                ) : null}

                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">
                                    {item.quantidade ?? item.quantidade_pecas_ordem ?? 0} peças
                                  </span>
                                  {oficinaNome && (
                                    <span className="text-xs font-semibold" style={ofColor ? { color: ofColor.text } : undefined}>
                                      ● {oficinaNome}
                                    </span>
                                  )}
                                </div>

                                {/* Botão de conserto na Revisão */}
                                {isRevisao && (
                                  <Button
                                    variant="outline" size="sm"
                                    className="w-full gap-1.5 text-danger border-danger/30 hover:bg-danger/10 mt-1"
                                    onClick={(e) => { e.stopPropagation(); openConsertoDialog(item.id); }}
                                  >
                                    <Wrench className="h-3.5 w-3.5" /> Enviar para Conserto
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Ordem de Produção</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ordem de Corte</Label>
              <Select value={ocId} onValueChange={setOcId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma OC..." /></SelectTrigger>
                <SelectContent>
                  {ocsDisponiveis.map((oc) => (
                    <SelectItem key={oc.id} value={oc.id}>{oc.numero_oc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {ocInfo && (
              <div className="p-3 bg-muted/50 rounded-lg border border-border space-y-1 text-sm">
                <p><span className="text-muted-foreground">Produto:</span> {ocInfo.produto}</p>
                <p><span className="text-muted-foreground">Cor:</span> {ocInfo.cor}</p>
                <p><span className="text-muted-foreground">Grade:</span> {ocInfo.grade}</p>
                <p><span className="text-muted-foreground">Total Peças:</span> {quantidade}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Oficina de Costura</Label>
              <Select value={oficinaId} onValueChange={setOficinaId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {oficinas?.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nome_oficina}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade de Peças</Label>
              <Input type="number" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
