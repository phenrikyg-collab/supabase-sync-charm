import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Package, ChevronDown, ChevronUp, Rocket, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

type Ordem = {
  id: string;
  nome_produto: string | null;
  quantidade_pecas_ordem: number | null;
  status_ordem: string | null;
  data_inicio: string | null;
  data_previsao_termino: string | null;
  data_fim: string | null;
  cor_id: string | null;
  produto_id: string | null;
};

type Produto = { id: string; nome_do_produto: string; tipo_do_produto: string | null; preco_venda: number | null };
type Cor = { id: string; nome_cor: string | null };
type Etapa = { nome_etapa: string; tipo_maquina: string; percentual_ocupacao: number | null; pecas_planejadas: number | null; numero_etapa: number };
type Lancamento = { id: string; nome_peca: string; data_lancamento: string };

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  em_producao: { label: "Em produção", cls: "bg-yellow-500 text-white" },
  concluido: { label: "Concluído", cls: "bg-green-600 text-white" },
  aguardando: { label: "Aguardando", cls: "bg-gray-400 text-white" },
  cancelado: { label: "Cancelado", cls: "bg-red-600 text-white" },
};

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}
function mesRefFromIso(iso: string) {
  const [y, m] = iso.split("-");
  return `${y}-${m}`;
}

export function AbaOrdensProducao() {
  const [ordens, setOrdens] = useState<Ordem[]>([]);
  const [produtos, setProdutos] = useState<Map<string, Produto>>(new Map());
  const [cores, setCores] = useState<Map<string, string>>(new Map());
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, Etapa[]>>({});
  const [loadingEtapas, setLoadingEtapas] = useState<string | null>(null);

  const [modalOrdem, setModalOrdem] = useState<Ordem | null>(null);
  const [novoLanc, setNovoLanc] = useState({ nome_peca: "", data_lancamento: "", colecao: "", preco: "" });
  const [savingLanc, setSavingLanc] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [oRes, pRes, cRes, lRes] = await Promise.all([
        (supabase as any).from("ordens_producao").select("*").order("data_previsao_termino", { ascending: true, nullsFirst: false }),
        (supabase as any).from("produtos").select("id,nome_do_produto,tipo_do_produto,preco_venda"),
        (supabase as any).from("cores").select("id,nome_cor"),
        (supabase as any).from("lancamentos_pecas").select("id,nome_peca,data_lancamento"),
      ]);

      if (oRes.error) throw oRes.error;
      const excluir = new Set(["concluido", "concluído", "cancelado"]);
      const filtradas = ((oRes.data || []) as Ordem[]).filter(
        (o) => !excluir.has((o.status_ordem || "").toLowerCase().trim())
      );
      setOrdens(filtradas);

      if (!pRes.error) {
        const pm = new Map<string, Produto>();
        (pRes.data || []).forEach((p: Produto) => pm.set(p.id, p));
        setProdutos(pm);
      }
      if (!cRes.error) {
        const cm = new Map<string, string>();
        (cRes.data || []).forEach((c: Cor) => cm.set(c.id, c.nome_cor || ""));
        setCores(cm);
      }
      if (!lRes.error) setLancamentos((lRes.data || []) as Lancamento[]);
    } catch (e: any) {
      toast.error("Erro ao carregar ordens", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = ordens.filter((o) => {
    if (search && !(o.nome_produto || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleEtapas = async (ordemId: string) => {
    if (expanded[ordemId]) {
      setExpanded((p) => { const n = { ...p }; delete n[ordemId]; return n; });
      return;
    }
    setLoadingEtapas(ordemId);
    try {
      const { data: planos, error: pErr } = await (supabase as any)
        .from("planos_producao").select("id").eq("ordem_producao_id", ordemId);
      if (pErr) throw pErr;
      const planoIds = (planos || []).map((p: any) => p.id);
      if (planoIds.length === 0) { setExpanded((p) => ({ ...p, [ordemId]: [] })); return; }
      const { data: etapas, error: eErr } = await (supabase as any)
        .from("planos_producao_etapas")
        .select("nome_etapa,tipo_maquina,percentual_ocupacao,pecas_planejadas,numero_etapa")
        .in("plano_producao_id", planoIds)
        .order("numero_etapa", { ascending: true });
      if (eErr) throw eErr;
      setExpanded((p) => ({ ...p, [ordemId]: (etapas || []) as Etapa[] }));
    } catch (e: any) {
      toast.error("Erro ao carregar etapas", { description: e.message });
    } finally {
      setLoadingEtapas(null);
    }
  };

  const ordemTemLancamento = (o: Ordem) => {
    if (!o.data_previsao_termino) return false;
    const target = new Date(o.data_previsao_termino).getTime();
    return lancamentos.some((l) => {
      const dl = new Date(l.data_lancamento).getTime();
      return Math.abs(dl - target) <= 15 * 24 * 60 * 60 * 1000 && (l.nome_peca === o.nome_produto);
    });
  };

  const calcProgresso = (o: Ordem) => {
    if (!o.data_inicio || !o.data_previsao_termino) return 0;
    const start = new Date(o.data_inicio).getTime();
    const end = new Date(o.data_previsao_termino).getTime();
    const now = Date.now();
    if (end <= start) return 100;
    const pct = ((now - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const openModal = (o: Ordem) => {
    const prod = o.produto_id ? produtos.get(o.produto_id) : null;
    setNovoLanc({
      nome_peca: o.nome_produto || prod?.nome_do_produto || "",
      data_lancamento: o.data_previsao_termino || "",
      colecao: "",
      preco: prod?.preco_venda?.toString() || "",
    });
    setModalOrdem(o);
  };

  const salvarLancamento = async () => {
    if (!novoLanc.data_lancamento) { toast.error("Informe a data de lançamento"); return; }
    setSavingLanc(true);
    try {
      const { error: lErr } = await (supabase as any).from("lancamentos_pecas").insert({
        nome_peca: novoLanc.nome_peca,
        data_lancamento: novoLanc.data_lancamento,
        colecao: novoLanc.colecao || null,
        preco: novoLanc.preco ? Number(novoLanc.preco) : null,
        status: "planejado",
      });
      if (lErr) throw lErr;

      const mr = mesRefFromIso(novoLanc.data_lancamento);
      await (supabase as any).from("calendario_comercial").insert({
        data: novoLanc.data_lancamento,
        titulo: `Lançamento: ${novoLanc.nome_peca}`,
        tipo: "lancamento",
        status: "rascunho",
        mes_referencia: mr,
      });

      toast.success("Lançamento criado!", { description: "Checklist gerado automaticamente." });
      setModalOrdem(null);
      fetchAll();
    } catch (e: any) {
      toast.error("Erro ao criar lançamento", { description: e.message });
    } finally {
      setSavingLanc(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-serif text-lg">Ordens em Aberto</h2>
      </div>
      <Card className="p-4 flex flex-wrap gap-3 items-center">
        <Input placeholder="Buscar por produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma ordem encontrada.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((o) => {
            const prod = o.produto_id ? produtos.get(o.produto_id) : null;
            const corNome = o.cor_id ? (cores.get(o.cor_id) || o.cor_id.substring(0, 6)) : "—";
            const status = STATUS_LABELS[o.status_ordem || ""] || { label: o.status_ordem || "—", cls: "bg-gray-400 text-white" };
            const progresso = calcProgresso(o);
            const temLanc = ordemTemLancamento(o);
            const podeLancar = ["em_producao", "concluido"].includes(o.status_ordem || "");
            const etapas = expanded[o.id];

            return (
              <Card key={o.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif font-semibold text-foreground truncate">{o.nome_produto || "Sem nome"}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">{corNome}</Badge>
                      {prod?.tipo_do_produto && <Badge variant="secondary" className="text-xs">{prod.tipo_do_produto}</Badge>}
                    </div>
                  </div>
                  <Badge className={status.cls}>{status.label}</Badge>
                </div>

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {o.quantidade_pecas_ordem || 0} peças</span>
                </div>

                <div className="text-xs text-muted-foreground">
                  {fmtDate(o.data_inicio)} → {fmtDate(o.data_previsao_termino)}
                </div>

                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full transition-all" style={{ width: `${progresso}%` }} />
                </div>

                {o.data_fim && (
                  <div className="text-xs text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Concluído em {fmtDate(o.data_fim)}
                  </div>
                )}

                {temLanc ? (
                  <Badge className="bg-green-600 text-white">Lançamento definido</Badge>
                ) : podeLancar && (
                  <Badge className="bg-orange-500 text-white gap-1"><AlertTriangle className="h-3 w-3" /> Sem lançamento definido</Badge>
                )}

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button size="sm" variant="ghost" onClick={() => toggleEtapas(o.id)} className="gap-1">
                    {loadingEtapas === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : etapas ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Ver etapas
                  </Button>
                  {podeLancar && (
                    <Button size="sm" onClick={() => openModal(o)} className="gap-1 ml-auto">
                      <Rocket className="h-3 w-3" /> Definir Lançamento
                    </Button>
                  )}
                </div>

                {etapas && (
                  <div className="space-y-2 pt-2 border-t">
                    {etapas.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem etapas cadastradas.</p>
                    ) : etapas.map((e, i) => (
                      <div key={i} className="text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{e.numero_etapa}. {e.nome_etapa}</span>
                          <Badge variant="outline" className="text-[10px]">{e.tipo_maquina}</Badge>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="bg-primary h-full" style={{ width: `${Math.min(100, e.percentual_ocupacao || 0)}%` }} />
                        </div>
                        <div className="text-muted-foreground">{e.pecas_planejadas || 0} peças</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!modalOrdem} onOpenChange={(o) => !o && setModalOrdem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Definir Lançamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da peça</Label>
              <Input value={novoLanc.nome_peca} onChange={(e) => setNovoLanc({ ...novoLanc, nome_peca: e.target.value })} />
            </div>
            <div>
              <Label>Data de lançamento *</Label>
              <Input type="date" value={novoLanc.data_lancamento} onChange={(e) => setNovoLanc({ ...novoLanc, data_lancamento: e.target.value })} />
            </div>
            <div>
              <Label>Coleção</Label>
              <Input value={novoLanc.colecao} onChange={(e) => setNovoLanc({ ...novoLanc, colecao: e.target.value })} />
            </div>
            <div>
              <Label>Preço</Label>
              <Input type="number" step="0.01" value={novoLanc.preco} onChange={(e) => setNovoLanc({ ...novoLanc, preco: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOrdem(null)}>Cancelar</Button>
            <Button onClick={salvarLancamento} disabled={savingLanc}>
              {savingLanc && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
