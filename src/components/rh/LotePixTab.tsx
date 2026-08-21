import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRhAuth, erroRh } from "./useRhAuth";


import { RefreshCw, Info, Archive, ArchiveRestore } from "lucide-react";
import { brl, dataBR, hojeISO, competenciaLabel, LOTE_STATUS, ITEM_STATUS, TIPO_LABEL } from "@/lib/rh";
import { useFolhaMes } from "./useFolha";
import { cn } from "@/lib/utils";

class LoteErrorBoundary extends Component<{ children: ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null };
  static getDerivedStateFromError(erro: Error) { return { erro }; }
  componentDidCatch(erro: Error, info: any) { console.error("[LotePixTab] erro de render", erro, info); }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-sm font-medium">Não foi possível exibir o lote.</p>
          <p className="text-xs text-muted-foreground">{this.state.erro.message}</p>
          <Button size="sm" onClick={() => this.setState({ erro: null })}>Recarregar</Button>
        </CardContent>
      </Card>
    );
  }
}

export function LotePixTab(props: { competencia: string }) {
  return (
    <LoteErrorBoundary>
      <LotePixConteudo {...props} />
    </LoteErrorBoundary>
  );
}

function LotePixConteudo({ competencia }: { competencia: string }) {
  const { data: folha, isLoading } = useFolhaMes(competencia);
  const { toast } = useToast();
  const { session } = useRhAuth();
  const emailUsuario = session?.user?.email ?? "";

  const qc = useQueryClient();
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [gerando, setGerando] = useState(false);


  const pendentes = useMemo(() => {
    const linhas: any[] = [];
    (folha?.funcionarios ?? []).forEach((f) => {
      Object.entries(f.pagamentos ?? {}).forEach(([tipo, p]: any) => {
        if (!p || tipo === "va" || (p.status ?? "pendente") !== "pendente") return;
        linhas.push({
          id: p.id, tipo, nome: f.nome,
          descricao: p.descricao ?? TIPO_LABEL[tipo] ?? tipo,
          vencimento: p.vencimento,
          chave: `${f.tipo_chave_pix ?? "—"} · ${f.chave_pix ?? "—"}`,
          valor: p.valor_liquido ?? p.valor ?? p.valor_bruto ?? 0,
        });
      });
    });
    return linhas.sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
  }, [folha]);

  const saldoSemHolerite = useMemo(
    () =>
      (folha?.funcionarios ?? []).some((f: any) => {
        const s = f.pagamentos?.saldo;
        return s && (s.status ?? "pendente") === "pendente" && s.valor_liquido == null;
      }),
    [folha]
  );

  useEffect(() => {
    const iniciais: Record<string, boolean> = {};
    pendentes.forEach((l) => { if (l.vencimento && l.vencimento.slice(0, 10) <= hojeISO()) iniciais[l.id] = true; });
    setSel(iniciais);
  }, [pendentes.length, competencia]);

  const selecionados = pendentes.filter((l) => sel[l.id]);
  const totalSel = selecionados.reduce((s, l) => s + Number(l.valor || 0), 0);

  const gerarLote = async () => {
    setGerando(true);
    const { error } = await supabase.rpc("rh_folha_lote_gerar", {
      p_ids: selecionados.map((l) => l.id),
      p_descricao: `Folha ${competenciaLabel(competencia)}`,
      p_criado_por: emailUsuario || "—",
    });
    setGerando(false);
    if (error) return toast({ title: "Erro ao gerar lote", description: erroRh(error).mensagem, variant: "destructive" });
    toast({ title: "Lote(s) criado(s) em rascunho" });

    setSel({});
    qc.invalidateQueries({ queryKey: ["rh-folha-mes"] });
    qc.invalidateQueries({ queryKey: ["rh-lotes"] });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-serif">Pagamentos pendentes</CardTitle>
          <p className="text-xs text-muted-foreground">VA não entra no lote — o pedido é feito na plataforma Ticket.</p>
          {saldoSemHolerite && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Gere os holerites de fechamento antes do lote do dia 5 — o valor do saldo é o líquido do holerite.
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : !pendentes.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum pagamento pendente nesta competência.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="w-8 py-2"></th>
                      <th className="text-left px-3">Funcionário</th>
                      <th className="text-left px-3">Descrição</th>
                      <th className="text-left px-3">Vencimento</th>
                      <th className="text-left px-3">Chave PIX</th>
                      <th className="text-right px-3">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendentes.map((l) => (
                      <tr key={l.id} className="border-b">
                        <td className="py-2">
                          <Checkbox checked={!!sel[l.id]} onCheckedChange={(v) => setSel((s) => ({ ...s, [l.id]: !!v }))} />
                        </td>
                        <td className="px-3">{l.nome}</td>
                        <td className="px-3">{l.descricao}</td>
                        <td className={cn("px-3", l.vencimento?.slice(0, 10) <= hojeISO() && "text-red-600")}>{dataBR(l.vencimento)}</td>
                        <td className="px-3 text-xs text-muted-foreground">{l.chave}</td>
                        <td className="px-3 text-right tabular-nums">{brl(l.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
                <p className="text-sm">{selecionados.length} selecionados · Total <strong>{brl(totalSel)}</strong></p>
                <Button disabled={!selecionados.length || gerando} onClick={gerarLote}>
                  {gerando ? "Gerando..." : "Gerar lote PIX"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ListaLotes />
    </div>
  );
}

function ListaLotes() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { operador, session } = useRhAuth();
  const [detalhe, setDetalhe] = useState<any | null>(null);
  const [aprovar, setAprovar] = useState<any | null>(null);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);

  const podeAprovar = operador ? operador.pode_aprovar !== false : true;
  const podeExecutar = operador ? operador.pode_executar !== false : true;

  const { data: lotes, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["rh-lotes", mostrarArquivados],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_lotes_listar", {
        p_limite: 20,
        p_incluir_arquivados: mostrarArquivados,
      } as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const cancelar = async (id: string) => {
    const { error } = await supabase.rpc("rh_lote_cancelar", { p_lote_id: id });
    if (error) return toast({ title: "Erro", description: erroRh(error).mensagem, variant: "destructive" });
    toast({ title: "Lote cancelado" });
    qc.invalidateQueries({ queryKey: ["rh-lotes"] });
    qc.invalidateQueries({ queryKey: ["rh-folha-mes"] });
  };

  const arquivar = async (l: any, arquivar: boolean) => {
    if (arquivar && !window.confirm("Arquivar este lote? O histórico bancário é preservado.")) return;
    const { error } = await supabase.rpc("rh_lote_arquivar" as any, { p_lote_id: l.id, p_arquivar: arquivar });
    if (error) return toast({ title: "Erro", description: erroRh(error).mensagem, variant: "destructive" });
    toast({ title: arquivar ? "Lote arquivado" : "Lote desarquivado" });
    qc.invalidateQueries({ queryKey: ["rh-lotes"] });
  };

  const executar = async (id: string) => {
    const { error } = await supabase.functions.invoke("inter-executar-lote", { body: { lote_id: id } });
    if (error) {
      const e = await lerErroEdge(error, "Falha ao executar o lote");
      return toast({
        title: "Erro ao executar",
        description:
          e.status === 403
            ? "Você não tem permissão para executar pagamentos."
            : [e.mensagem, e.dica].filter(Boolean).join(" — "),
        variant: "destructive",
      });
    }
    toast({ title: "Execução disparada" });
    qc.invalidateQueries({ queryKey: ["rh-lotes"] });
  };



  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-serif">Lotes</CardTitle>
        <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={mostrarArquivados}
            onCheckedChange={(v) => setMostrarArquivados(!!v)}
          />
          mostrar arquivados
        </label>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isFetching && "animate-spin")} /> Atualizar
        </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : !lotes?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lote criado ainda.</p>
        ) : (
          lotes.map((l) => {
            const st = LOTE_STATUS[l.status] ?? { label: l.status, className: "bg-muted" };
            return (
              <div key={l.id} className={cn("border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3", l.arquivado && "opacity-60")}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{l.descricao ?? "Lote"}</span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full", st.className)}>{st.label}</span>
                    {l.arquivado && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">arquivado</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {competenciaLabel(l.competencia)} · {l.qtd ?? l.qtd_itens ?? 0} itens · {brl(l.total_previsto)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {l.status === "rascunho" && (
                    <>
                      <span title={podeAprovar ? undefined : "Sua conta não tem permissão para aprovar a folha."}>
                        <Button size="sm" disabled={!podeAprovar} onClick={() => setAprovar(l)}>Conferir e aprovar</Button>
                      </span>
                      {!podeAprovar && (
                        <span className="text-[10px] text-muted-foreground">Sem permissão para aprovar</span>
                      )}
                      <Button size="sm" variant="outline" onClick={() => cancelar(l.id)}>Cancelar lote</Button>
                    </>
                  )}
                  {l.status === "aprovado" && (
                    <>
                      <span title={podeExecutar ? undefined : "Sua conta não tem permissão para executar pagamentos."}>
                        <Button size="sm" disabled={!podeExecutar} onClick={() => executar(l.id)}>Pagar agora</Button>
                      </span>
                      {!podeExecutar && (
                        <span className="text-[10px] text-muted-foreground">Sem permissão para pagar</span>
                      )}
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDetalhe(l)}>Ver detalhe</Button>
                  {l.arquivado ? (
                    <Button size="sm" variant="ghost" onClick={() => arquivar(l, false)}>
                      <ArchiveRestore className="h-3.5 w-3.5 mr-1" />Desarquivar
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => arquivar(l, true)}>
                      <Archive className="h-3.5 w-3.5 mr-1" />Arquivar
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      <DetalheLoteDialog lote={detalhe} onClose={() => setDetalhe(null)} />
      <AprovarLoteDialog
        lote={aprovar}
        onClose={() => setAprovar(null)}
        aprovadoPor={operador?.email ?? session?.user?.email ?? ""}
      />


    </Card>
  );
}

/** rh_lote_detalhe devolve um OBJETO { lote, itens, resumo, resumo_por_status }.
 *  Normaliza para { lote, itens[], resumo[] } — nunca chamar .map direto na resposta. */
function normalizarDetalhe(data: any) {
  if (!data) return { lote: null, itens: [] as any[], resumo: [] as any[] };
  if (Array.isArray(data)) return { lote: null, itens: data, resumo: [] as any[] };

  const itens = Array.isArray(data.itens) ? data.itens : [];
  let resumo: any[] = [];
  if (Array.isArray(data.resumo)) resumo = data.resumo;
  else if (data.resumo_por_status && typeof data.resumo_por_status === "object") {
    resumo = Object.entries(data.resumo_por_status).map(([status, r]: [string, any]) => ({
      status,
      qtd: r?.qtd ?? 0,
      valor: r?.valor ?? 0,
    }));
  }
  return { lote: data.lote ?? data, itens, resumo };
}

function useLoteDetalhe(loteId?: string) {
  return useQuery({
    queryKey: ["rh-lote-detalhe", loteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_lote_detalhe", { p_lote_id: loteId });
      if (error) throw error;
      return normalizarDetalhe(data);
    },
    enabled: !!loteId,
  });
}

const dataOpcional = (d: any) => (d ? dataBR(d) : "—");

function ResumoStatus({ resumo }: { resumo: any[] }) {
  if (!resumo?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {resumo.map((r) => (
        <span key={r.status} className={cn("text-[11px] px-2 py-0.5 rounded-full", ITEM_STATUS[r.status] ?? "bg-muted")}>
          {r.status}: {r.qtd ?? 0} · {brl(r.valor)}
        </span>
      ))}
    </div>
  );
}

function ItensTabela({ itens }: { itens: any[] }) {
  const lista = Array.isArray(itens) ? itens : [];
  if (!lista.length) return <p className="text-sm text-muted-foreground py-4 text-center">Sem itens neste lote.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-xs uppercase text-muted-foreground">
          <th className="text-left py-2">Funcionário</th>
          <th className="text-left px-2">Descrição</th>
          <th className="text-right px-2">Valor</th>
          <th className="text-left px-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {lista.map((i, idx) => (
          <tr key={i.id ?? idx} className="border-b align-top">
            <td className="py-2">{i.funcionario ?? i.nome ?? "—"}</td>
            <td className="px-2">{i.descricao ?? i.tipo ?? "—"}</td>
            <td className="px-2 text-right tabular-nums">{brl(i.valor)}</td>
            <td className="px-2">
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full", ITEM_STATUS[i.status] ?? "bg-muted")}>
                {i.status ?? "—"}
              </span>
              {i.enviado_em && <p className="text-[10px] text-muted-foreground mt-1">enviado {dataOpcional(i.enviado_em)}</p>}
              {i.concluido_em && <p className="text-[10px] text-muted-foreground">concluído {dataOpcional(i.concluido_em)}</p>}
              {i.codigo_solicitacao && <p className="text-[10px] text-muted-foreground">cód. {i.codigo_solicitacao}</p>}
              {i.erro && <p className="text-[10px] text-red-600 mt-1">{i.erro}</p>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DatasLote({ lote }: { lote: any }) {
  if (!lote) return null;
  const linhas = [
    ["Criado por", lote.criado_por ? lote.criado_por : "—"],
    ["Aprovado em", dataOpcional(lote.aprovado_em)],
    ["Executado em", dataOpcional(lote.executado_em)],
    ["Finalizado em", dataOpcional(lote.finalizado_em)],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
      {linhas.map(([k, v]) => (
        <div key={k}><span className="block uppercase tracking-wide text-[10px]">{k}</span>{v}</div>
      ))}
    </div>
  );
}

function DetalheLoteDialog({ lote, onClose }: { lote: any | null; onClose: () => void }) {
  const { data, isLoading } = useLoteDetalhe(lote?.id);
  return (
    <Dialog open={!!lote} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="font-serif">{lote?.descricao ?? "Lote"}</DialogTitle></DialogHeader>
        {["executando", "aprovado"].includes(lote?.status) && (
          <div className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
            <Info className="h-4 w-4 shrink-0" />
            Aguardando confirmação do Inter; com alçada configurada, aprovar também no app do banco.
          </div>
        )}
        {isLoading ? <Skeleton className="h-40" /> : (
          <div className="space-y-3">
            <DatasLote lote={data?.lote ?? lote} />
            <ResumoStatus resumo={data?.resumo ?? []} />
            <div className="overflow-x-auto"><ItensTabela itens={data?.itens ?? []} /></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AprovarLoteDialog({ lote, onClose, aprovadoPor }: { lote: any | null; onClose: () => void; aprovadoPor: string }) {
  const { data, isLoading } = useLoteDetalhe(lote?.id);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [total, setTotal] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { setTotal(""); }, [lote?.id]);

  const totalPrevisto = Number(data?.lote?.total_previsto ?? lote?.total_previsto ?? 0);
  const totalDigitado = Number(String(total).replace(/\s|R\$/g, "").replace(/\./g, "").replace(",", "."));
  const divergente = Number.isFinite(totalDigitado) && total !== "" &&
    Math.abs(totalDigitado - totalPrevisto) > 0.009;

  const aprovar = async () => {
    if (!Number.isFinite(totalDigitado)) {
      return toast({ title: "Valor inválido", description: "Digite o total no formato 1.234,56.", variant: "destructive" });
    }
    setSalvando(true);
    const { error } = await supabase.rpc("rh_lote_aprovar", {
      p_lote_id: lote.id,
      p_total_conferido: Number(totalDigitado.toFixed(2)),
      p_aprovado_por: aprovadoPor || "—",
    });
    setSalvando(false);
    if (error) return toast({ title: "Erro ao aprovar", description: erroRh(error).mensagem, variant: "destructive" });

    toast({ title: "Lote aprovado" });
    qc.invalidateQueries({ queryKey: ["rh-lotes"] });
    qc.invalidateQueries({ queryKey: ["rh-lote-detalhe", lote.id] });
    onClose();
  };

  return (
    <Dialog open={!!lote} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="font-serif">Conferir e aprovar lote</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Digite o valor total do lote para confirmar. A aprovação é recusada se o total informado divergir do total previsto
          ({brl(totalPrevisto)}).
        </p>
        {isLoading ? <Skeleton className="h-40" /> : (
          <div className="space-y-3">
            <DatasLote lote={data?.lote ?? lote} />
            <ResumoStatus resumo={data?.resumo ?? []} />
            <div className="overflow-x-auto max-h-72"><ItensTabela itens={data?.itens ?? []} /></div>
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-xs">Total conferido</Label>
          <Input value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0,00" />
          {divergente && (
            <p className="text-[11px] text-red-600">Valor divergente do total previsto ({brl(totalPrevisto)}).</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={aprovar} disabled={!total || salvando || divergente}>Aprovar lote</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

