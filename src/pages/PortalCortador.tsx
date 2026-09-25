import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, LogOut, RefreshCw, Scissors, X } from "lucide-react";
import { toast } from "sonner";
import { PortalLogin, dataBR } from "@/components/portal/PortalLogin";

type Oc = {
  ordem_corte_id: string; numero_oc: string; metragem_risco: number | null; grade_tamanhos: string[] | null;
  previsao_pronto: string | null; observacao: string | null;
  produtos: { produto_id: string; nome_produto: string }[] | null;
  grade: { produto_id: string; cor_id: string | null; cor_nome: string | null; tamanho: string; quantidade_por_folha: number }[] | null;
};
type Rolo = { rolo_id: string; codigo_rolo: string | null; tecido_id: string | null; cor_nome: string | null; cor_hex: string | null; metragem_disponivel: number; lote: string | null };
type Cortada = { numero_oc: string; quantidade_folhas: number | null; metragem_total_utilizada: number | null; data?: string | null; [k: string]: any };

const num = (v: any) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function gruposGrade(oc: Oc) {
  const g = new Map<string, { titulo: string; itens: { tamanho: string; q: number }[] }>();
  for (const l of oc.grade ?? []) {
    const nome = oc.produtos?.find((p) => p.produto_id === l.produto_id)?.nome_produto ?? "Modelo";
    const k = `${l.produto_id}|${l.cor_id ?? ""}`;
    if (!g.has(k)) g.set(k, { titulo: `${nome}${l.cor_nome ? ` - ${l.cor_nome}` : ""}`, itens: [] });
    g.get(k)!.itens.push({ tamanho: l.tamanho, q: Number(l.quantidade_por_folha) || 0 });
  }
  const ordem = oc.grade_tamanhos ?? [];
  return [...g.values()].map((x) => ({ ...x, itens: x.itens.sort((a, b) => ordem.indexOf(a.tamanho) - ordem.indexOf(b.tamanho)) }));
}

function RegistrarCorte({ oc, onVoltar }: { oc: Oc; onVoltar: () => void }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [folhas, setFolhas] = useState("");
  const [usados, setUsados] = useState<{ rolo: Rolo; metros: string }[]>([]);
  const [enviando, setEnviando] = useState(false);

  const { data: rolos, isFetching } = useQuery({
    queryKey: ["cortador-rolos", busca],
    queryFn: async () => {
      const { data, error } = await chamarRpc<Rolo[]>("cortador_rolos_disponiveis", { p_busca: busca.trim() || null });
      if (error) throw error;
      return (data ?? []) as Rolo[];
    },
  });

  const pecasFolha = (oc.grade ?? []).reduce((s, l) => s + (Number(l.quantidade_por_folha) || 0), 0);
  const nFolhas = parseInt(folhas) || 0;
  const totalMetros = usados.reduce((s, u) => s + (parseFloat(u.metros.replace(",", ".")) || 0), 0);

  const registrar = async () => {
    if (nFolhas <= 0) { toast.error("Informe quantas folhas foram cortadas"); return; }
    if (usados.length === 0) { toast.error("Escolha pelo menos um rolo"); return; }
    const rolosP = [];
    for (const u of usados) {
      const m = parseFloat(u.metros.replace(",", "."));
      if (!(m > 0)) { toast.error(`Informe os metros usados do rolo ${u.rolo.codigo_rolo ?? ""}`); return; }
      if (m > Number(u.rolo.metragem_disponivel)) { toast.error(`O rolo ${u.rolo.codigo_rolo ?? ""} só tem ${num(u.rolo.metragem_disponivel)} m`); return; }
      rolosP.push({ rolo_id: u.rolo.rolo_id, metragem_utilizada: m });
    }
    setEnviando(true);
    const { data, error } = await chamarRpc<any>("cortar_ordem_corte", { p: { ordem_corte_id: oc.ordem_corte_id, quantidade_folhas: nFolhas, rolos: rolosP } });
    setEnviando(false);
    if (error) {
      const msg = String(error.message ?? "");
      toast.error(msg.includes("ordem_ja_cortada") ? "Esta ordem já foi cortada" : msg || "Erro ao registrar corte");
      return;
    }
    toast.success(`Corte da ${oc.numero_oc} registrado. ${data?.ops_criadas ?? 0} ordem(ns) de produção criada(s).`);
    qc.invalidateQueries({ queryKey: ["cortador-planejadas"] });
    qc.invalidateQueries({ queryKey: ["cortador-cortadas"] });
    qc.invalidateQueries({ queryKey: ["cortador-rolos"] });
    onVoltar();
  };

  const escolhidos = new Set(usados.map((u) => u.rolo.rolo_id));

  return (
    <div className="space-y-4 pb-28">
      <Button variant="ghost" size="sm" onClick={onVoltar} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
      <Card><CardContent className="space-y-2 pt-4">
        <p className="font-serif text-xl font-semibold text-foreground">{oc.numero_oc}</p>
        {gruposGrade(oc).map((g) => (
          <p key={g.titulo} className="text-sm"><span className="font-medium">{g.titulo}: </span>{g.itens.map((i) => `${i.tamanho}: ${i.q}`).join(", ")} por folha</p>
        ))}
        {oc.metragem_risco != null && <p className="text-xs text-muted-foreground">Risco: {num(oc.metragem_risco)} m</p>}
      </CardContent></Card>

      <div className="space-y-2">
        <Label htmlFor="folhas">Folhas cortadas</Label>
        <Input id="folhas" type="number" inputMode="numeric" min={1} step={1} value={folhas} onChange={(e) => setFolhas(e.target.value.replace(/\D/g, ""))} />
        {nFolhas > 0 && <p className="text-xs text-muted-foreground">{nFolhas * pecasFolha} peças no total</p>}
      </div>

      {usados.length > 0 && (
        <div className="space-y-2">
          <Label>Rolos usados</Label>
          {usados.map((u, i) => (
            <div key={u.rolo.rolo_id} className="flex items-center gap-2 rounded-md border border-border p-2">
              <span className="h-4 w-4 shrink-0 rounded-full border border-border" style={{ background: u.rolo.cor_hex ?? undefined }} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{u.rolo.codigo_rolo ?? "-"} {u.rolo.cor_nome ? `- ${u.rolo.cor_nome}` : ""}</p>
                <p className="text-xs text-muted-foreground">Disponível {num(u.rolo.metragem_disponivel)} m</p>
              </div>
              <Input className="w-24" inputMode="decimal" placeholder="metros" value={u.metros}
                onChange={(e) => setUsados((l) => l.map((x, j) => j === i ? { ...x, metros: e.target.value } : x))} />
              <Button variant="ghost" size="icon" onClick={() => setUsados((l) => l.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="busca">Adicionar rolo</Label>
        <Input id="busca" placeholder="Código do rolo ou cor" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {isFetching && <Loader2 className="mx-auto h-4 w-4 animate-spin text-primary" />}
          {(rolos ?? []).filter((r) => !escolhidos.has(r.rolo_id)).slice(0, 40).map((r) => (
            <button key={r.rolo_id} type="button" onClick={() => setUsados((l) => [...l, { rolo: r, metros: "" }])}
              className="flex w-full items-center gap-2 rounded-md border border-border p-2 text-left text-sm hover:bg-muted">
              <span className="h-4 w-4 shrink-0 rounded-full border border-border" style={{ background: r.cor_hex ?? undefined }} />
              <span className="min-w-0 flex-1 truncate">{r.codigo_rolo ?? "-"} {r.cor_nome ? `- ${r.cor_nome}` : ""}{r.lote ? ` (lote ${r.lote})` : ""}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{num(r.metragem_disponivel)} m</span>
            </button>
          ))}
          {!isFetching && (rolos ?? []).length === 0 && <p className="text-center text-xs text-muted-foreground">Nenhum rolo encontrado</p>}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card p-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{num(totalMetros)} m em {usados.length} rolo(s)</span>
          <Button onClick={registrar} disabled={enviando} className="gap-2">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />} Registrar corte
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PortalCortador() {
  const { user, loading, signOut } = useAuth();
  const [aberta, setAberta] = useState<Oc | null>(null);

  const planejadas = useQuery({
    queryKey: ["cortador-planejadas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await chamarRpc<Oc[]>("cortador_ordens_planejadas", {});
      if (error) throw error;
      return (data ?? []) as Oc[];
    },
  });
  const cortadas = useQuery({
    queryKey: ["cortador-cortadas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await chamarRpc<Cortada[]>("cortador_ordens_cortadas", { p_limite: 30 });
      if (error) throw error;
      return (data ?? []) as Cortada[];
    },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <PortalLogin dominio="cortador" titulo="Portal do Corte" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <h1 className="font-serif text-xl font-bold text-foreground">Corte</h1>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" title="Recarregar" onClick={() => { planejadas.refetch(); cortadas.refetch(); }}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" title="Sair" onClick={() => signOut()}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-4">
        {aberta ? <RegistrarCorte oc={aberta} onVoltar={() => setAberta(null)} /> : (
          <Tabs defaultValue="cortar">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cortar">Pra cortar</TabsTrigger>
              <TabsTrigger value="cortei">Já cortei</TabsTrigger>
            </TabsList>
            <TabsContent value="cortar" className="space-y-3">
              {planejadas.isLoading ? <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-primary" />
                : planejadas.error ? <p className="py-8 text-center text-sm text-destructive">{(planejadas.error as any).message}</p>
                : (planejadas.data ?? []).length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma ordem para cortar.</p>
                : planejadas.data!.map((oc) => (
                  <Card key={oc.ordem_corte_id} className="cursor-pointer hover:border-primary" onClick={() => setAberta(oc)}>
                    <CardContent className="space-y-1 pt-4">
                      <div className="flex items-center justify-between">
                        <p className="font-serif text-lg font-semibold text-foreground">{oc.numero_oc}</p>
                        {oc.previsao_pronto && <span className="text-xs text-muted-foreground">Pronto até {dataBR(oc.previsao_pronto)}</span>}
                      </div>
                      {gruposGrade(oc).map((g) => (
                        <p key={g.titulo} className="text-sm"><span className="font-medium">{g.titulo}: </span>{g.itens.map((i) => `${i.tamanho}: ${i.q}`).join(", ")} por folha</p>
                      ))}
                      {oc.observacao && <p className="text-xs text-muted-foreground">{oc.observacao}</p>}
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>
            <TabsContent value="cortei" className="space-y-2">
              {cortadas.isLoading ? <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-primary" />
                : (cortadas.data ?? []).length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum corte registrado ainda.</p>
                : cortadas.data!.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{c.numero_oc}</p>
                      <p className="text-xs text-muted-foreground">{c.quantidade_folhas ?? "-"} folhas, {num(c.metragem_total_utilizada)} m</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{dataBR(c.data ?? c.data_corte ?? c.created_at)}</span>
                  </div>
                ))}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
