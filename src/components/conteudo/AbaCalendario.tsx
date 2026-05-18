import { useEffect, useMemo, useState, useCallback } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, ChevronLeft, ChevronRight, Check, X, Plus, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";

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

export function AbaCalendario() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0-11
  const [datas, setDatas] = useState<Calendario[]>([]);
  const [loading, setLoading] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [confirmGerar, setConfirmGerar] = useState(false);
  const [novaDataOpen, setNovaDataOpen] = useState(false);
  const [editing, setEditing] = useState<Calendario | null>(null);
  const [novaDataInitial, setNovaDataInitial] = useState<string>("");
  const [selected, setSelected] = useState<Calendario | null>(null);
  const [conteudos, setConteudos] = useState<Conteudo[]>([]);
  const [loadingConteudos, setLoadingConteudos] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Calendario | null>(null);

  const mesRef = `${ano}-${pad(mes + 1)}`;

  const fetchDatas = useCallback(async () => {
    setLoading(true);
    try {
      const mesStr = pad(mes + 1);
      const mesReferencia = `${ano}-${mesStr}`;
      const dataInicio = `${mesReferencia}-01`;
      const ultimoDia = new Date(ano, mes + 1, 0).getDate();
      const dataFim = `${mesReferencia}-${pad(ultimoDia)}`;

      const { data, error } = await (supabase as any)
        .from("calendario_comercial")
        .select("*, conteudos_gerados(*)")
        .or(`mes_referencia.eq.${mesReferencia},and(data.gte.${dataInicio},data.lte.${dataFim})`)
        .order("data", { ascending: true });
      if (error) throw error;
      setDatas((data || []) as Calendario[]);
    } catch (e: any) {
      toast.error("Erro ao carregar calendário", { description: e.message });
      setDatas([]);
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => { fetchDatas(); }, [fetchDatas]);

  const handleGerar = async () => {
    setConfirmGerar(false);
    setGerando(true);
    try {
      const res = await invokeEdgeFunction("generate-content-calendar", { mes_referencia: mesRef }) as any;
      toast.success(`Calendário gerado!`, { description: `${res.total_datas} datas e ${res.total_conteudos} peças de conteúdo.` });
      await fetchDatas();
    } catch (e: any) {
      toast.error("Erro ao gerar calendário", { description: e.message });
    } finally {
      setGerando(false);
    }
  };

  const fetchConteudos = useCallback(async (calId: string) => {
    setLoadingConteudos(true);
    try {
      const { data, error } = await (supabase as any)
        .from("conteudos_gerados")
        .select("*")
        .eq("calendario_id", calId);
      if (error) throw error;
      setConteudos((data || []) as Conteudo[]);
    } catch (e: any) {
      toast.error("Erro ao carregar conteúdos", { description: e.message });
      setConteudos([]);
    } finally {
      setLoadingConteudos(false);
    }
  }, []);

  const openDate = (d: Calendario) => {
    setSelected(d);
    fetchConteudos(d.id);
  };

  const updateConteudoField = async (id: string, field: string, value: any) => {
    try {
      const { error } = await (supabase as any)
        .from("conteudos_gerados")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    }
  };

  const aprovarConteudo = async (cid: string) => {
    if (!selected) return;
    await updateConteudoField(cid, "status", "aprovado");
    await (supabase as any).from("calendario_comercial").update({ status: "aprovado" }).eq("id", selected.id);
    toast.success("Aprovado");
    fetchConteudos(selected.id);
    fetchDatas();
  };

  const handleDelete = async (cal: Calendario) => {
    try {
      await (supabase as any).from("conteudos_gerados").delete().eq("calendario_id", cal.id);
      const { error } = await (supabase as any).from("calendario_comercial").delete().eq("id", cal.id);
      if (error) throw error;
      toast.success("Data excluída");
      setConfirmDelete(null);
      if (selected?.id === cal.id) setSelected(null);
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
    if (selected) fetchConteudos(selected.id);
  };

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
          <Button variant="outline" onClick={() => setNovaDataOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nova data
          </Button>
          <Button onClick={() => setConfirmGerar(true)} disabled={gerando} className="gap-2">
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {gerando ? "Gerando..." : "Gerar Calendário com IA"}
          </Button>
        </div>
      </Card>

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
              if (!cell) return <div key={i} className="h-24 bg-muted/20 rounded" />;
              const items = byDate.get(cell.iso) || [];
              const hasContent = items.length > 0;
              const isSat = cell.dow === 6;
              const isSun = cell.dow === 0;
              return (
                <button
                  key={i}
                  onClick={() => hasContent ? openDate(items[0]) : openNova(cell.iso)}
                  className={`h-24 rounded border p-1.5 text-left relative transition-colors flex flex-col group ${
                    hasContent ? "bg-card hover:bg-accent/30 cursor-pointer border-border" : "bg-muted/10 hover:bg-muted/30 cursor-pointer border-dashed border-muted-foreground/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{cell.day}</span>
                    {items[0] && (
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[items[0].status] || "bg-gray-300"}`} />
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5 overflow-hidden flex-1">
                    {items.slice(0, 2).map((it) => (
                      <Badge key={it.id} className={`text-[9px] px-1 py-0 ${TIPO_COLORS[it.tipo] || "bg-gray-500 text-white"} block truncate w-full text-left`}>
                        {it.titulo}
                      </Badge>
                    ))}
                    {items.length > 2 && <span className="text-[9px] text-muted-foreground">+{items.length - 2}</span>}
                  </div>
                  {isSat && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-orange-500 text-white self-start">Oferta</span>
                  )}
                  {isSun && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500 text-white self-start">Relacionamento</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Confirmação Gerar IA */}
      <Dialog open={confirmGerar} onOpenChange={setConfirmGerar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Gerar calendário para {MESES[mes]}/{ano}</DialogTitle>
            <DialogDescription>A IA irá gerar conteúdo estratégico baseado em:</DialogDescription>
          </DialogHeader>
          <ul className="text-sm space-y-1.5 py-2">
            <li>✓ Produtos em campanha ativa</li>
            <li>✓ Produtos mais vendidos</li>
            <li>✓ Produtos com estoque parado</li>
            <li>✓ Datas comemorativas do mês</li>
            <li>✓ Histórico de conteúdo publicado</li>
          </ul>
          <p className="text-xs text-muted-foreground border-t pt-3">
            Padrão: 1 Reels + 1 Carrossel por data • Sábados: campanha de oferta • Domingos: reativação/relacionamento
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmGerar(false)}>Cancelar</Button>
            <Button onClick={handleGerar} className="gap-2"><Sparkles className="h-4 w-4" /> Gerar agora</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova data manual */}
      <NovaDataDialog
        open={novaDataOpen}
        onOpenChange={setNovaDataOpen}
        onCreated={fetchDatas}
      />

      {/* Drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-serif flex items-center gap-2">
                  {selected.titulo}
                  <Badge className={TIPO_COLORS[selected.tipo]}>{selected.tipo}</Badge>
                </SheetTitle>
                <SheetDescription>
                  {formatDDMM(selected.data)} • {selected.descricao}
                </SheetDescription>
              </SheetHeader>

              {loadingConteudos ? (
                <div className="mt-6 space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : (
                <Tabs defaultValue="instagram" className="mt-6">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="instagram" className="text-xs">Instagram</TabsTrigger>
                    <TabsTrigger value="email" className="text-xs">E-mail</TabsTrigger>
                    <TabsTrigger value="whatsapp_vip" className="text-xs">WhatsApp VIP</TabsTrigger>
                  </TabsList>

                  <TabsContent value="instagram" className="mt-4">
                    <Tabs defaultValue="reels">
                      <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="reels" className="text-xs">Reels</TabsTrigger>
                        <TabsTrigger value="carrossel" className="text-xs">Carrossel</TabsTrigger>
                      </TabsList>
                      {[
                        { sub: "reels", canal: "instagram_reels" },
                        { sub: "carrossel", canal: "instagram_feed" },
                      ].map(({ sub, canal }) => {
                        const ct = conteudos.find((c) => c.canal === canal);
                        return (
                          <TabsContent key={sub} value={sub} className="space-y-3 mt-4">
                            {!ct ? (
                              <p className="text-sm text-muted-foreground">Sem conteúdo para este canal.</p>
                            ) : (
                              <ConteudoEditor
                                conteudo={ct}
                                onSave={updateConteudoField}
                                onAprovar={() => aprovarConteudo(ct.id)}
                                onRejeitar={() => rejeitarConteudo(ct.id)}
                              />
                            )}
                          </TabsContent>
                        );
                      })}
                    </Tabs>
                  </TabsContent>

                  {["email", "whatsapp_vip"].map((canal) => {
                    const ct = conteudos.find((c) => c.canal === canal);
                    return (
                      <TabsContent key={canal} value={canal} className="space-y-3 mt-4">
                        {!ct ? (
                          <p className="text-sm text-muted-foreground">Sem conteúdo para este canal.</p>
                        ) : (
                          <ConteudoEditor
                            conteudo={ct}
                            onSave={updateConteudoField}
                            onAprovar={() => aprovarConteudo(ct.id)}
                            onRejeitar={() => rejeitarConteudo(ct.id)}
                          />
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NovaDataDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [data, setData] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("conteudo");
  const [descricao, setDescricao] = useState("");
  const [canais, setCanais] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => { setData(""); setTitulo(""); setTipo("conteudo"); setDescricao(""); setCanais([]); };

  const toggleCanal = (c: string) => {
    setCanais((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

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
        status: "rascunho",
        mes_referencia: mesRef,
      };
      // Optional fields — may not exist on schema; try and fallback
      const tryFull = { ...payload, canal: canais, criado_por_ia: false };
      let { error } = await (supabase as any).from("calendario_comercial").insert(tryFull);
      if (error) {
        // Retry without optional columns
        const r2 = await (supabase as any).from("calendario_comercial").insert(payload);
        if (r2.error) throw r2.error;
      }
      toast.success("Data adicionada!");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif">Nova data</DialogTitle></DialogHeader>
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
                <SelectItem value="comemorativa">Comemorativa</SelectItem>
                <SelectItem value="campanha">Campanha</SelectItem>
                <SelectItem value="lancamento">Lançamento</SelectItem>
                <SelectItem value="conteudo">Conteúdo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Canais</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {CANAIS_OPTIONS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={canais.includes(c.key)} onCheckedChange={() => toggleCanal(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
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
  conteudo, onSave, onAprovar, onRejeitar,
}: {
  conteudo: Conteudo;
  onSave: (id: string, field: string, value: any) => Promise<void>;
  onAprovar: () => void;
  onRejeitar: () => void;
}) {
  const [local, setLocal] = useState(conteudo);
  useEffect(() => setLocal(conteudo), [conteudo.id]);

  const blur = (field: keyof Conteudo) => {
    if ((local as any)[field] !== (conteudo as any)[field]) {
      onSave(conteudo.id, field as string, (local as any)[field]);
    }
  };

  const canal = conteudo.canal;
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
            <Textarea rows={2} value={local.hashtags || ""} onChange={(e) => setLocal({ ...local, hashtags: e.target.value })} onBlur={() => blur("hashtags")} placeholder="#tag1 #tag2" />
            <div className="flex flex-wrap gap-1 mt-1">
              {(local.hashtags || "").split(/\s+/).filter(Boolean).map((t, i) => (
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

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={onAprovar} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
          <Check className="h-4 w-4" /> Aprovar
        </Button>
        <Button onClick={onRejeitar} variant="outline" className="gap-1">
          <X className="h-4 w-4" /> Rejeitar
        </Button>
        {local.status && <Badge variant="secondary" className="ml-auto">{local.status}</Badge>}
      </div>
    </div>
  );
}
