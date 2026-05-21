import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, ArrowRight, CalendarPlus, Check, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


type Calendario = {
  id: string;
  data: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  status: string;
  mes_referencia: string;
  conteudos_gerados?: Conteudo[];
};

type Conteudo = {
  id: string;
  calendario_id: string;
  canal: string;
  copy_principal: string | null;
  copy_legenda: string | null;
  copy_cta: string | null;
  hashtags: string | null;
  horario_sugerido: string | null;
  assunto_email: string | null;
  tipo_campanha?: string | null;
  status: string | null;
  feedback_usuario: string | null;
};

const TIPO_COLORS: Record<string, string> = {
  comemorativa: "bg-purple-600 text-white",
  campanha: "bg-orange-500 text-white",
  lancamento: "bg-green-600 text-white",
  conteudo: "bg-blue-600 text-white",
};

const STATUS_DOT: Record<string, string> = {
  rascunho: "bg-gray-400",
  aprovado: "bg-green-500",
  publicado: "bg-blue-500",
  rejeitado: "bg-red-500",
};

const CANAIS_OPTIONS = [
  { key: "instagram_reels", label: "Instagram Reels" },
  { key: "instagram_feed", label: "Instagram Carrossel" },
  { key: "email", label: "E-mail" },
  { key: "whatsapp_vip", label: "WhatsApp VIP" },
];

const TIPO_CAMPANHA_DICAS: Record<string, string> = {
  oferta: "Destaque o produto em campanha, crie urgência com estoque limitado e inclua link direto.",
  segunda_compra: "Mencione a compra anterior, ofereça algo complementar ou exclusivo para quem já é cliente.",
  reativacao: "Reconecte com saudade, mostre novidades e ofereça um benefício especial para voltar.",
  manutencao: "Compartilhe conteúdo de valor, bastidores ou novidades sem pressão de venda.",
};

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function formatDDMM(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function formatLongDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const txt = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
const FUNIL_BARS: Record<number, string> = {
  0: "bg-slate-400",       // domingo
  1: "bg-sky-300",         // descoberta seg
  2: "bg-sky-300",         // descoberta ter
  3: "bg-purple-400",      // conscientizacao qua
  4: "bg-purple-400",      // conscientizacao qui
  5: "bg-emerald-400",     // conversao sex
  6: "bg-orange-400",      // sabado
};
const CANAL_ICONS: Record<string, string> = {
  instagram_reels: "🎬",
  instagram_feed: "📷",
  instagram_story: "📱",
  email: "✉️",
  whatsapp_vip: "💬",
};
const CANAL_LABELS: Record<string, string> = {
  instagram_reels: "🎬 Reels",
  instagram_feed: "📷 Carrossel",
  instagram_story: "📱 Stories",
  email: "✉️ E-mail",
  whatsapp_vip: "💬 WhatsApp VIP",
};

export function AbaCalendario() {
  const navigate = useNavigate();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0-11
  const [datas, setDatas] = useState<Calendario[]>([]);
  const [loading, setLoading] = useState(false);
  const [novaDataOpen, setNovaDataOpen] = useState(false);
  const [editing, setEditing] = useState<Calendario | null>(null);
  const [novaDataInitial, setNovaDataInitial] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Calendario | null>(null);

  const mesRef = `${ano}-${pad(mes + 1)}`;

  const fetchDatas = useCallback(async () => {
    setLoading(true);
    try {
      const mesStr = pad(mes + 1);
      const dataInicio = `${ano}-${mesStr}-01`;
      const ultimoDia = new Date(ano, mes + 1, 0).getDate();
      const dataFim = `${ano}-${mesStr}-${pad(ultimoDia)}`;

      // Fetch calendar entries (no relational join — avoids PostgREST schema cache bugs)
      const { data: cals, error: errCal } = await (supabase as any)
        .from("calendario_comercial")
        .select("id, data, titulo, tipo, status, descricao, canal, mes_referencia, criado_por_ia")
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .order("data", { ascending: true })
        .limit(2000);
      if (errCal) throw errCal;

      const calList = (cals || []) as any[];
      const ids = calList.map((c) => c.id);

      // Fetch conteudos in separate query, map client-side
      const conteudosByCal: Record<string, any[]> = {};
      if (ids.length > 0) {
        const { data: cts, error: errCts } = await (supabase as any)
          .from("conteudos_gerados")
          .select("id, calendario_id, canal, copy_principal, copy_legenda, copy_cta, hashtags, assunto_email, horario_sugerido, status, feedback_usuario, tipo_campanha")
          .in("calendario_id", ids)
          .limit(5000);
        if (errCts) throw errCts;
        (cts || []).forEach((c: any) => {
          const k = c.calendario_id;
          if (!conteudosByCal[k]) conteudosByCal[k] = [];
          conteudosByCal[k].push(c);
        });
      }

      const merged = calList.map((c) => ({
        ...c,
        data: typeof c.data === "string" ? c.data.slice(0, 10) : c.data,
        conteudos_gerados: conteudosByCal[c.id] || [],
      }));
      setDatas(merged as Calendario[]);
    } catch (e: any) {
      toast.error("Erro ao carregar calendário", { description: e.message });
      setDatas([]);
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => { fetchDatas(); }, [fetchDatas]);

  const selected = useMemo(() => datas.find((d) => d.id === selectedId) || null, [datas, selectedId]);
  const conteudos = useMemo(() => (selected?.conteudos_gerados || []) as Conteudo[], [selected]);

  // Calendário é somente leitura. Geração de conteúdo acontece via Plano Comercial / Edge Function.



  const openDate = (d: Calendario) => setSelectedId(d.id);

  const updateConteudoField = async (id: string, field: string, value: any) => {
    try {
      const { error } = await (supabase as any)
        .from("conteudos_gerados")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await fetchDatas();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    }
  };

  const aprovarConteudo = async (cid: string) => {
    if (!selected) return;
    await updateConteudoField(cid, "status", "aprovado");
    await (supabase as any).from("calendario_comercial").update({ status: "aprovado" }).eq("id", selected.id);
    toast.success("Aprovado");
    fetchDatas();
  };

  const publicarConteudo = async (cid: string) => {
    await updateConteudoField(cid, "status", "publicado");
    toast.success("Publicado");
  };

  const handleDelete = async (cal: Calendario) => {
    try {
      await (supabase as any).from("conteudos_gerados").delete().eq("calendario_id", cal.id);
      const { error } = await (supabase as any).from("calendario_comercial").delete().eq("id", cal.id);
      if (error) throw error;
      toast.success("Data excluída");
      setConfirmDelete(null);
      if (selectedId === cal.id) setSelectedId(null);
      fetchDatas();
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e.message });
    }
  };

  const openEdit = (cal: Calendario) => {
    setEditing(cal);
    setNovaDataOpen(true);
  };

  const openNova = (iso?: string) => {
    setEditing(null);
    setNovaDataInitial(iso || "");
    setNovaDataOpen(true);
  };

  const rejeitarConteudo = async (cid: string) => {
    await updateConteudoField(cid, "status", "rejeitado");
    toast("Rejeitado");
  };

  // Geração/regeneração de conteúdo é responsabilidade do Plano Comercial.


  const cells = useMemo(() => {
    const first = new Date(ano, mes, 1);
    const offset = first.getDay();
    const daysInMonth = new Date(ano, mes + 1, 0).getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const arr: ({ day: number; iso: string; dow: number } | null)[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - offset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) arr.push(null);
      else arr.push({ day: dayNum, iso: `${ano}-${pad(mes + 1)}-${pad(dayNum)}`, dow: i % 7 });
    }
    return arr;
  }, [ano, mes]);

  const byDate = useMemo(() => {
    const m = new Map<string, Calendario[]>();
    datas.forEach((d) => {
      const list = m.get(d.data) || [];
      list.push(d);
      m.set(d.data, list);
    });
    return m;
  }, [datas]);

  const counts = useMemo(() => {
    return {
      rascunho: datas.filter((d) => d.status === "rascunho").length,
      aprovado: datas.filter((d) => d.status === "aprovado").length,
      publicado: datas.filter((d) => d.status === "publicado").length,
    };
  }, [datas]);

  const prevMonth = () => {
    if (mes === 0) { setMes(11); setAno(ano - 1); } else setMes(mes - 1);
  };
  const nextMonth = () => {
    if (mes === 11) { setMes(0); setAno(ano + 1); } else setMes(mes + 1);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-serif text-lg min-w-[180px] text-center">
            {MESES[mes]} {ano}
          </div>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="bg-gray-200 text-gray-800">Rascunho: {counts.rascunho}</Badge>
          <Badge className="bg-green-600 text-white hover:bg-green-700">Aprovado: {counts.aprovado}</Badge>
          <Badge className="bg-blue-600 text-white hover:bg-blue-700">Publicado: {counts.publicado}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/plano-comercial")} className="gap-2">
            Ver Plano Comercial <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => openNova()} className="gap-2">
            <Plus className="h-4 w-4" /> Nova data
          </Button>
        </div>
      </Card>

      {!loading && datas.length === 0 && (
        <Card className="p-8 text-center space-y-3 border-dashed">
          <CalendarPlus className="h-10 w-10 mx-auto text-muted-foreground" />
          <div className="font-serif text-lg">Nenhum conteúdo gerado para este mês</div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Para gerar o calendário, acesse o Plano Comercial e defina a meta do mês.
          </p>
          <Button onClick={() => navigate("/plano-comercial")} className="gap-2">
            Ir para Plano Comercial <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      )}




      {/* Calendário */}
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} className="h-32 bg-muted/20 rounded" />;
              const items = byDate.get(cell.iso) || [];
              const hasContent = items.length > 0;
              const funilBar = FUNIL_BARS[cell.dow] || "bg-muted";
              return (
                <button
                  key={i}
                  onClick={() => hasContent ? openDate(items[0]) : openNova(cell.iso)}
                  className={`h-32 rounded border p-1.5 pb-2 text-left relative transition-colors flex flex-col group overflow-hidden ${
                    hasContent
                      ? "bg-white hover:bg-accent/30 cursor-pointer border-border"
                      : "hover:bg-muted/30 cursor-pointer border-dashed border-muted-foreground/20"
                  }`}
                  style={!hasContent ? { backgroundColor: "#F8F9FA" } : undefined}

                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{cell.day}</span>
                    {items[0] && (
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[items[0].status] || "bg-gray-300"}`} />
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5 overflow-y-auto flex-1 pr-0.5">
                    {items.map((it) => {
                      const canais = Array.from(new Set((it.conteudos_gerados || []).map((c: any) => c.canal).filter(Boolean)));
                      const icons = canais.map((c) => CANAL_ICONS[c]).filter(Boolean).slice(0, 3).join("");
                      const tit = (it.titulo || "").length > 18 ? (it.titulo || "").slice(0, 18) + "…" : it.titulo;
                      return (
                        <Badge
                          key={it.id}
                          onClick={(e) => { e.stopPropagation(); openDate(it); }}
                          className={`text-[9px] px-1 py-0 ${TIPO_COLORS[it.tipo] || "bg-gray-500 text-white"} block truncate w-full text-left cursor-pointer`}
                        >
                          {icons && <span className="mr-0.5">{icons}</span>}{tit}
                        </Badge>
                      );
                    })}
                  </div>
                  <span className={`absolute bottom-0 left-0 right-0 h-1 ${funilBar}`} />
                </button>
              );
            })}
          </div>
        )}
      </Card>


      {/* Nova data / Editar */}
      <NovaDataDialog
        open={novaDataOpen}
        onOpenChange={(o) => { setNovaDataOpen(o); if (!o) { setEditing(null); setNovaDataInitial(""); } }}
        onSaved={() => { fetchDatas(); if (editing && selectedId === editing.id) setSelectedId(null); }}
        editing={editing}
        initialDate={novaDataInitial}
      />

      {/* Drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <SheetTitle className="font-serif flex items-center gap-2 flex-wrap">
                      {selected.titulo}
                      <Badge className={TIPO_COLORS[selected.tipo]}>{selected.tipo}</Badge>
                    </SheetTitle>
                    <SheetDescription className="mt-1">
                      {formatLongDate(selected.data)} {selected.descricao ? `• ${selected.descricao}` : ""}
                    </SheetDescription>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(selected)} className="gap-1">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmDelete(selected)} className="gap-1 text-red-600 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              {(() => {
                const canaisOrder = ["instagram_reels", "instagram_feed", "instagram_story", "email", "whatsapp_vip"];
                const present = canaisOrder.filter((k) => conteudos.some((c) => c.canal === k));
                if (present.length === 0) {
                  return <p className="text-sm text-muted-foreground mt-6">Nenhum conteúdo gerado para esta data ainda.</p>;
                }
                return (
                  <Tabs defaultValue={present[0]} className="mt-6">
                    <TabsList className="w-full flex flex-wrap h-auto">
                      {present.map((k) => (
                        <TabsTrigger key={k} value={k} className="text-xs flex-1">{CANAL_LABELS[k]}</TabsTrigger>
                      ))}
                    </TabsList>
                    {present.map((canal) => {
                      const list = conteudos.filter((c) => c.canal === canal);
                      return (
                        <TabsContent key={canal} value={canal} className="space-y-4 mt-4">
                          {list.map((ct) => {
                            const isLiveRoteiro = canal === "instagram_story" && (ct.copy_principal || "").startsWith("ROTEIRO LIVE");
                            return (
                              <Card key={ct.id} className={`p-3 ${isLiveRoteiro ? "bg-red-50 border-red-300" : ""}`}>
                                {isLiveRoteiro && (
                                  <div className="font-bold text-red-700 mb-2">🔴 ROTEIRO DA LIVE</div>
                                )}
                                <ConteudoEditor
                                  conteudo={ct}
                                  onSave={updateConteudoField}
                                  onAprovar={() => aprovarConteudo(ct.id)}
                                  onRejeitar={() => rejeitarConteudo(ct.id)}
                                  onPublicar={() => publicarConteudo(ct.id)}
                                />


                              </Card>
                            );
                          })}
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                );
              })()}
            </>
          )}
        </SheetContent>
      </Sheet>


      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Excluir esta data?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai apagar "{confirmDelete?.titulo}" e todos os conteúdos vinculados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && handleDelete(confirmDelete)} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <AlertDialog open={!!confirmRegen} onOpenChange={(o) => !o && setConfirmRegen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Regenerar este canal?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? O conteúdo atual será substituído pelo novo gerado pela IA.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); regenerarCanal(); }} disabled={regenLoading}>
              {regenLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NovaDataDialog({ open, onOpenChange, onSaved, editing, initialDate }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void; editing: Calendario | null; initialDate: string }) {
  const [data, setData] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("comemorativa");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setData(editing.data);
      setTitulo(editing.titulo);
      // Apenas tipos manuais editáveis: comemorativa / lancamento. Outros mantém o valor original.
      setTipo(editing.tipo);
      setDescricao(editing.descricao || "");
    } else {
      setData(initialDate || "");
      setTitulo(""); setTipo("comemorativa"); setDescricao("");
    }
  }, [open, editing, initialDate]);

  const reset = () => { setData(""); setTitulo(""); setTipo("comemorativa"); setDescricao(""); };

  const save = async () => {
    if (!data || !titulo || !tipo) { toast.error("Preencha data, título e tipo"); return; }
    setSaving(true);
    try {
      const mesRef = data.substring(0, 7);
      const payload: any = {
        data,
        titulo,
        tipo,
        descricao: descricao || null,
        mes_referencia: mesRef,
      };
      if (editing) {
        const { error } = await (supabase as any).from("calendario_comercial").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Data atualizada!");
      } else {
        const insertPayload = { ...payload, status: "aprovado", criado_por_ia: false };
        const { error } = await (supabase as any).from("calendario_comercial").insert(insertPayload);
        if (error) {
          const r2 = await (supabase as any).from("calendario_comercial").insert({ ...payload, status: "aprovado" });
          if (r2.error) throw r2.error;
        }
        toast.success("Data adicionada!");
      }
      reset();
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif">{editing ? "Editar data" : "Nova data"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Data *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comemorativa">Comemorativa — Datas especiais e feriados</SelectItem>
                <SelectItem value="lancamento">Lançamento — Lançamento ou reposição de peça</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Conteúdo de marketing é gerado automaticamente pelo Plano Comercial.
            </p>
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ConteudoEditor({
  conteudo, onSave, onAprovar, onRejeitar, onPublicar,
}: {
  conteudo: Conteudo;
  onSave: (id: string, field: string, value: any) => Promise<void>;
  onAprovar: () => void;
  onRejeitar: () => void;
  onPublicar?: () => void;
}) {
  const [local, setLocal] = useState(conteudo);
  useEffect(() => setLocal(conteudo), [conteudo.id]);

  const blur = (field: keyof Conteudo) => {
    if ((local as any)[field] !== (conteudo as any)[field]) {
      onSave(conteudo.id, field as string, (local as any)[field]);
    }
  };

  const rawCanal = (conteudo as any).canal;
  const canal: string = Array.isArray(rawCanal) ? rawCanal[0] : rawCanal;
  const isInstagram = canal === "instagram_feed" || canal === "instagram_reels";
  const isEmail = canal === "email";
  const isWhats = canal === "whatsapp_vip";

  return (
    <div className="space-y-3">
      {isEmail && (
        <div>
          <Label className="text-xs">Assunto</Label>
          <Input value={local.assunto_email || ""} onChange={(e) => setLocal({ ...local, assunto_email: e.target.value })} onBlur={() => blur("assunto_email")} />
        </div>
      )}

      {isWhats && (
        <div>
          <Label className="text-xs">Tipo de campanha</Label>
          <Select
            value={local.tipo_campanha || ""}
            onValueChange={(v) => {
              setLocal({ ...local, tipo_campanha: v });
              onSave(conteudo.id, "tipo_campanha", v);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="oferta">Oferta — produto com urgência (Sábados)</SelectItem>
              <SelectItem value="segunda_compra">Segunda compra — recompra incentivada</SelectItem>
              <SelectItem value="reativacao">Reativação — clientes inativos 60+ dias</SelectItem>
              <SelectItem value="manutencao">Manutenção — base ativa, conteúdo de valor</SelectItem>
            </SelectContent>
          </Select>
          {local.tipo_campanha && TIPO_CAMPANHA_DICAS[local.tipo_campanha] && (
            <p className="text-xs text-muted-foreground mt-1.5 p-2 bg-muted/40 rounded border-l-2 border-primary">
              💡 {TIPO_CAMPANHA_DICAS[local.tipo_campanha]}
            </p>
          )}
        </div>
      )}

      <div>
        <Label className="text-xs">Copy Principal</Label>
        <Textarea rows={4} value={local.copy_principal || ""} onChange={(e) => setLocal({ ...local, copy_principal: e.target.value })} onBlur={() => blur("copy_principal")} />
      </div>

      {isInstagram && (
        <>
          <div>
            <Label className="text-xs">Legenda</Label>
            <Textarea rows={3} value={local.copy_legenda || ""} onChange={(e) => setLocal({ ...local, copy_legenda: e.target.value })} onBlur={() => blur("copy_legenda")} />
          </div>
          <div>
            <Label className="text-xs">CTA</Label>
            <Input value={local.copy_cta || ""} onChange={(e) => setLocal({ ...local, copy_cta: e.target.value })} onBlur={() => blur("copy_cta")} />
          </div>
          <div>
            <Label className="text-xs">Hashtags</Label>
            <Textarea rows={2} value={Array.isArray(local.hashtags) ? (local.hashtags as any).join(" ") : (local.hashtags || "")} onChange={(e) => setLocal({ ...local, hashtags: e.target.value })} onBlur={() => blur("hashtags")} placeholder="#tag1 #tag2" />
            <div className="flex flex-wrap gap-1 mt-1">
              {(Array.isArray(local.hashtags) ? (local.hashtags as any).join(" ") : (local.hashtags || "")).split(/\s+/).filter(Boolean).map((t: string, i: number) => (
                <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Horário Sugerido</Label>
            <Input value={local.horario_sugerido || ""} onChange={(e) => setLocal({ ...local, horario_sugerido: e.target.value })} onBlur={() => blur("horario_sugerido")} placeholder="HH:MM" />
          </div>
        </>
      )}

      {isEmail && (
        <div>
          <Label className="text-xs">CTA</Label>
          <Input value={local.copy_cta || ""} onChange={(e) => setLocal({ ...local, copy_cta: e.target.value })} onBlur={() => blur("copy_cta")} />
        </div>
      )}

      <div>
        <Label className="text-xs">Feedback</Label>
        <Textarea rows={2} value={local.feedback_usuario || ""} onChange={(e) => setLocal({ ...local, feedback_usuario: e.target.value })} onBlur={() => blur("feedback_usuario")} />
      </div>

      <div className="flex items-center gap-2 pt-2 flex-wrap">
        <Button onClick={onAprovar} size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white">
          <Check className="h-4 w-4" /> Aprovar
        </Button>
        {onPublicar && (
          <Button onClick={onPublicar} size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
            Publicar
          </Button>
        )}
        <Button onClick={onRejeitar} size="sm" variant="outline" className="gap-1">
          <X className="h-4 w-4" /> Rejeitar
        </Button>
        {local.status && <Badge variant="secondary" className="ml-auto">{local.status}</Badge>}
      </div>
    </div>
  );
}
