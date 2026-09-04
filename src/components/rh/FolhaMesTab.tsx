import { erroRh } from "./useRhAuth";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ChevronDown, RefreshCw, Wallet, Users, Gift, Coins, Download, Pencil, Check, X, RotateCcw } from "lucide-react";
import { brl, dataBR, dataBRCompleta, hojeISO, TIPOS_ORDEM } from "@/lib/rh";
import { baixarDocumentoRh, nomeArquivo, prefixoComprovante } from "@/lib/rhDocumento";
import { useFolhaMes, FuncionarioFolha, PagamentoFolha } from "./useFolha";
import { parseValorBR, formatValorBR } from "@/lib/rhMoeda";
import { ValesSection } from "./ValesSection";
import { useRegerarFechamento } from "./useRegerarFechamento";
import { cn } from "@/lib/utils";

function StatusPagamento({ p }: { p?: PagamentoFolha }) {
  if (!p) return null;
  const st = p.status ?? "pendente";
  if (st === "pago")
    return <span className="text-[10px] text-green-600">pago {p.pago_em ? dataBR(p.pago_em) : ""}</span>;
  if (st === "em_lote") return <span className="text-[10px] text-blue-600">no lote</span>;
  const vencido = !!p.vencimento && p.vencimento.slice(0, 10) <= hojeISO();
  return vencido ? (
    <span className="text-[10px] text-red-600">vencido {dataBR(p.vencimento)}</span>
  ) : (
    <span className="text-[10px] text-amber-600">vence {dataBR(p.vencimento)}</span>
  );
}

function BotaoComprovante({
  pagamentoId,
  nome,
  competencia,
  tipo,
  rotulo,
}: {
  pagamentoId: string | null | undefined;
  nome: string;
  competencia: string;
  tipo: string;
  rotulo?: string;
}) {
  const { toast } = useToast();
  const [baixando, setBaixando] = useState(false);

  const baixar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pagamentoId) return;
    setBaixando(true);
    try {
      const tipoHolerite = tipo === "saldo" ? "fechamento" : (tipo as any);
      await baixarDocumentoRh(
        "comprovante",
        pagamentoId,
        nomeArquivo(nome, prefixoComprovante(tipoHolerite), competencia),
      );
    } catch (err: any) {
      toast({ title: "Erro ao baixar comprovante", description: err?.message, variant: "destructive" });
    } finally {
      setBaixando(false);
    }
  };

  if (!pagamentoId)
    return (
      <span title="pago manualmente, sem comprovante Pix" className="text-[10px] text-muted-foreground">
        {rotulo ? "sem comprovante Pix" : "—"}
      </span>
    );

  if (rotulo)
    return (
      <Button size="sm" variant="outline" onClick={baixar} disabled={baixando}>
        <Download className={cn("h-3.5 w-3.5 mr-2", baixando && "animate-pulse")} />
        {baixando ? "Gerando..." : rotulo}
      </Button>
    );

  return (
    <button
      type="button"
      onClick={baixar}
      disabled={baixando}
      title="Baixar comprovante"
      className="text-[10px] inline-flex items-center gap-1 text-primary underline disabled:opacity-50"
    >
      <Download className={cn("h-3 w-3", baixando && "animate-pulse")} />
      {baixando ? "gerando..." : "comprovante"}
    </button>
  );
}

function ValorEditavel({
  p,
  competencia,
  tipo,
  onSalvo,
}: {
  p: PagamentoFolha;
  competencia: string;
  tipo: string;
  onSalvo: () => void;
}) {
  const { toast } = useToast();
  const valor = p.valor_liquido ?? p.valor ?? p.valor_bruto ?? 0;
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(formatValorBR(valor));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!editando) setTexto(formatValorBR(valor));
  }, [valor, editando]);

  const editavel = p.editavel !== false;

  const salvar = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const novo = parseValorBR(texto);
    if (novo == null || novo < 0) {
      return toast({ title: "Valor inválido", variant: "destructive" });
    }
    setSalvando(true);
    const { data: sess } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc("rh_folha_valor_definir" as any, {
      p_id: p.id,
      p_valor: novo,
      p_por: sess?.user?.email ?? "",
      p_obs: null,
    });
    setSalvando(false);
    if (error) return toast({ title: "Erro ao salvar valor", description: erroRh(error).mensagem, variant: "destructive" });
    const r: any = Array.isArray(data) ? data[0] : data;
    toast({ title: "Valor atualizado", description: r?.aviso ?? undefined });
    setEditando(false);
    onSalvo();
  };

  const limpar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSalvando(true);
    const { error } = await supabase.rpc("rh_folha_valor_limpar" as any, { p_id: p.id });
    setSalvando(false);
    if (error) return toast({ title: "Erro", description: erroRh(error).mensagem, variant: "destructive" });
    toast({ title: "Voltou ao cálculo automático" });
    onSalvo();
  };

  if (editando)
    return (
      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 justify-end">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="h-7 w-24 text-right text-xs"
            placeholder="0,00"
            autoFocus
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={salvando} onClick={salvar}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditando(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground max-w-[190px] text-right">
          {tipo === "adiantamento"
            ? "O valor pago no dia 20 é descontado no fechamento do dia 5."
            : tipo === "saldo"
              ? "A diferença entre o calculado e o valor pago entra como arredondamento e é acertada no fechamento do mês seguinte."
              : "Valor em reais com centavos."}
        </p>
      </div>
    );

  return (
    <div className="flex items-center gap-1 justify-end">
      <span className="tabular-nums">{brl(valor)}</span>
      {p.editado && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">editado</span>
      )}
      {editavel ? (
        <>
          <button
            type="button"
            title="Editar valor"
            className="text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setEditando(true); }}
          >
            <Pencil className="h-3 w-3" />
          </button>
          {p.editado && (
            <button
              type="button"
              title="Voltar ao cálculo automático"
              className="text-muted-foreground hover:text-foreground"
              disabled={salvando}
              onClick={limpar}
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </>
      ) : (
        <span title="em lote — cancele o lote para editar" className="text-[9px] text-muted-foreground">🔒</span>
      )}
    </div>
  );
}

function Celula({
  p, nome, competencia, tipo, onSalvo,
}: { p?: PagamentoFolha; nome: string; competencia: string; tipo: string; onSalvo: () => void }) {
  if (!p) return <span className="text-muted-foreground">—</span>;
  const comprovanteId = p.pagamento_id ?? null;
  return (
    <div className="leading-tight">
      <ValorEditavel p={p} competencia={competencia} tipo={tipo} onSalvo={onSalvo} />
      <StatusPagamento p={p} />
      {p.status === "pago" && comprovanteId && (
        <div><BotaoComprovante pagamentoId={comprovanteId} nome={nome} competencia={competencia} tipo={tipo} /></div>
      )}
    </div>
  );
}


const MINI = {
  pago: "bg-green-100 text-green-700",
  pendente: "bg-amber-100 text-amber-700",
  agendado: "bg-muted text-muted-foreground",
};

export function FolhaMesTab({
  competencia,
  onIrParaLote,
  onVerHolerite,
}: {
  competencia: string;
  onIrParaLote: () => void;
  onVerHolerite?: () => void;
}) {
  const { data, isLoading, refetch } = useFolhaMes(competencia);

  const { toast } = useToast();
  const qc = useQueryClient();
  const [gerando, setGerando] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const funcionarios = data?.funcionarios ?? [];
  const tiles = data?.tiles ?? {};
  const totais = data?.totais_por_tipo ?? {};

  const gerar = async () => {
    setGerando(true);
    const { error } = await supabase.rpc("rh_folha_gerar", { p_competencia: competencia });
    setGerando(false);
    if (error) return toast({ title: "Erro ao gerar folha", description: erroRh(error).mensagem, variant: "destructive" });
    toast({ title: "Lançamentos gerados" });
    qc.invalidateQueries({ queryKey: ["rh-folha-mes"] });
  };

  const statusAgregado = (tipos: string[]) => {
    const pags = funcionarios.flatMap((f) =>
      tipos.map((t) => f.pagamentos?.[t]).filter(Boolean) as PagamentoFolha[]
    );
    if (!pags.length) return "agendado" as const;
    if (pags.every((p) => p.status === "pago")) return "pago" as const;
    if (pags.some((p) => (p.status ?? "pendente") === "pendente")) return "pendente" as const;
    return "agendado" as const;
  };

  const custoTotalTabela = useMemo(
    () => funcionarios.reduce((s, f) => s + (Number(f.custo_mes) || 0), 0),
    [funcionarios]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!funcionarios.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-4">
          <p className="text-muted-foreground">Nenhum lançamento para esta competência.</p>
          <Button onClick={gerar} disabled={gerando}>
            {gerando ? "Gerando..." : "Gerar lançamentos do mês"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={gerar} disabled={gerando}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-2", gerando && "animate-spin")} />
          Gerar lançamentos do mês
        </Button>
      </div>

      {(tiles.vencendo_qtd ?? 0) > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <AlertTriangle className="h-4 w-4" />
            {tiles.vencendo_qtd} pagamentos vencem hoje ou estão atrasados — total {brl(tiles.vencendo_valor ?? tiles.vencendo_total)}
          </div>
          <Button size="sm" onClick={onIrParaLote}>Preparar lote PIX</Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Tile titulo="Custo total do mês" valor={brl(tiles.custo_total)} icon={Coins} />
        <Tile titulo="A pagar" valor={brl(tiles.a_pagar)} legenda={`${brl(tiles.pago)} já pago`} icon={Wallet} />
        <Tile titulo="Benefícios" valor={brl(tiles.beneficios)} icon={Gift} />
        <Tile titulo="Funcionários ativos" valor={String(tiles.funcionarios_ativos ?? 0)} icon={Users} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MiniCard
          titulo="Dia 5"
          desc="Saldo líquido do fechamento (inclui cesta básica) + VT"
          status={statusAgregado(["saldo", "vt", "cesta"])}
        />
        <MiniCard titulo="Dia 20" desc="Adiantamento de 40% do salário base" status={statusAgregado(["adiantamento"])} />
        <MiniCard titulo="VA · Ticket" desc="Pedido na plataforma até dia 28 do mês anterior" status={statusAgregado(["va"])} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base font-serif">Folha por funcionário</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="text-left py-2 pr-3">Funcionário</th>
                <th className="text-right px-3">Salário base</th>
                <th className="text-right px-3">Adiant. 40%</th>
                <th className="text-right px-3">Saldo líq. (dia 5)</th>
                <th className="text-right px-3">VT</th>
                <th className="text-right px-3">VA (Ticket)</th>
                <th className="text-right pl-3">Custo do mês</th>
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((f) => {
                const fid = f.id ?? (f as any).funcionario_id;
                return (
                  <LinhaFuncionario
                    key={fid}
                    f={f}
                    competencia={competencia}
                    aberto={aberto === fid}
                    onToggle={() => setAberto(aberto === fid ? null : fid)}
                    onSalvo={() => refetch()}
                    onVerHolerite={onVerHolerite}
                  />
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t font-medium">
                <td className="py-2 pr-3">Totais</td>
                <td className="text-right px-3">—</td>
                {["adiantamento", "saldo", "vt", "va"].map((t) => (
                  <td key={t} className="text-right px-3 tabular-nums">{brl(totais[t] ?? 0)}</td>
                ))}
                <td className="text-right pl-3 tabular-nums">{brl(custoTotalTabela)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ titulo, valor, legenda, icon: Icon }: any) {
  return (
    <Card>
      <CardContent className="p-5 flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{titulo}</p>
          <p className="text-2xl font-serif font-bold">{valor}</p>
          {legenda && <p className="text-xs text-muted-foreground">{legenda}</p>}
        </div>
        <div className="rounded-lg p-2.5 bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );
}

function MiniCard({ titulo, desc, status }: { titulo: string; desc: string; status: keyof typeof MINI }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <p className="font-medium">{titulo}</p>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full", MINI[status])}>{status}</span>
        </div>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

function LinhaFuncionario({
  f, competencia, aberto, onToggle, onSalvo, onVerHolerite,
}: { f: FuncionarioFolha; competencia: string; aberto: boolean; onToggle: () => void; onSalvo: () => void; onVerHolerite?: () => void }) {
  const { toast } = useToast();
  const { avisarRegeracao } = useRegerarFechamento();
  const funcId: string | undefined = f.id ?? (f as any).funcionario_id;
  const pags = f.pagamentos ?? {};
  const saldo = pags["saldo"];
  const [liquido, setLiquido] = useState<string>(saldo?.valor_liquido != null ? String(saldo.valor_liquido) : "");
  const [obs, setObs] = useState<string>(saldo?.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [faltas, setFaltas] = useState<string>(f.faltas != null ? String(f.faltas) : "0");
  const [salvandoFaltas, setSalvandoFaltas] = useState(false);

  useEffect(() => {
    setLiquido(saldo?.valor_liquido != null ? String(saldo.valor_liquido) : "");
    setObs(saldo?.observacao ?? "");
  }, [saldo?.id, saldo?.valor_liquido, saldo?.observacao]);

  useEffect(() => {
    setFaltas(f.faltas != null ? String(f.faltas) : "0");
  }, [f.faltas]);

  const salvarFaltas = async () => {
    if (!funcId)
      return toast({
        title: "Erro ao registrar faltas",
        description: "Funcionário não identificado. Recarregue a folha e tente novamente.",
        variant: "destructive",
      });
    setSalvandoFaltas(true);
    const { data, error } = await supabase.rpc("rh_faltas_registrar", {
      p_funcionario_id: funcId,
      p_competencia: competencia,
      p_dias: Number(faltas) || 0,
      p_obs: obs || null,
    } as any);
    setSalvandoFaltas(false);
    if (error) return toast({ title: "Erro ao registrar faltas", description: erroRh(error).mensagem, variant: "destructive" });
    const r: any = Array.isArray(data) ? data[0] : data;
    avisarRegeracao(
      competencia,
      "Faltas registradas",
      `${
        r?.aviso
          ? r.aviso
          : r?.vt_recalculado != null
            ? `VT recalculado: ${brl(r.vt_recalculado)}. `
            : ""
      }Faltas descontam salário (evento 5078) e VT — regere o holerite de fechamento para atualizar o líquido do dia 5.`,
    );
    onSalvo();
  };


  const atualizar = async (extra: Record<string, any> = {}) => {
    if (!saldo?.id) return;
    setSalvando(true);
    const { error } = await supabase.rpc("rh_folha_pagamento_atualizar", {
      p_id: saldo.id,
      p_valor_liquido: parseValorBR(liquido),
      p_status: null,
      p_pago_em: null,
      p_obs: obs || null,
      ...extra,
    });
    setSalvando(false);
    if (error) return toast({ title: "Erro ao salvar", description: erroRh(error).mensagem, variant: "destructive" });
    toast({ title: "Atualizado" });
    onSalvo();
  };

  const marcarPago = async (p: PagamentoFolha) => {
    const { error } = await supabase.rpc("rh_folha_pagamento_atualizar", {
      p_id: p.id, p_valor_liquido: null, p_status: "pago", p_pago_em: hojeISO(), p_obs: null,
    });
    if (error) return toast({ title: "Erro", description: erroRh(error).mensagem, variant: "destructive" });
    toast({ title: "Pagamento marcado como pago" });
    onSalvo();
  };

  return (
    <>
      <tr className="border-b cursor-pointer hover:bg-muted/40" onClick={onToggle}>
        <td className="py-2 pr-3">
          <div className="flex items-center gap-2">
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", aberto && "rotate-180")} />
            <div>
              <div className="font-medium flex items-center gap-2">
                {f.nome}
                {Number(f.faltas) > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {f.faltas} faltas
                  </span>
                )}
                {Number(f.vales) > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    vales {brl(f.vales)}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{f.cargo ?? "—"}</div>
            </div>
          </div>
        </td>
        <td className="text-right px-3 tabular-nums">{brl(f.salario_base)}</td>
        {["adiantamento", "saldo", "vt", "va"].map((t) => (
          <td key={t} className="text-right px-3">
            <div className="flex flex-col items-end">
              <Celula p={pags[t]} nome={f.nome} competencia={competencia} tipo={t} onSalvo={onSalvo} />
              {t === "va" && pags[t] && (
                (pags[t].forma ?? f.va_forma ?? "pix") === "cartao" ? (
                  <span className="mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">cartão</span>
                ) : (
                  <span className="mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">PIX</span>
                )
              )}
            </div>
          </td>
        ))}

        <td className="text-right pl-3 tabular-nums font-medium">{brl(f.custo_mes)}</td>
      </tr>
      {aberto && (
        <tr className="border-b bg-muted/20">
          <td colSpan={7} className="p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-xs space-y-1">
                <p><span className="text-muted-foreground">Chave PIX:</span> {f.tipo_chave_pix ?? "—"} · {f.chave_pix ?? "—"}</p>
                <p><span className="text-muted-foreground">Admissão:</span> {dataBRCompleta(f.admissao)}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Saldo líquido do fechamento</Label>
                  {onVerHolerite && (
                    <button
                      type="button"
                      className="text-[10px] underline text-primary"
                      onClick={onVerHolerite}
                    >
                      Ver holerite
                    </button>
                  )}
                </div>
                <Input value={liquido} onChange={(e) => setLiquido(e.target.value)} placeholder="0,00" />
                {saldo && saldo.valor_liquido == null ? (
                  <p className="text-[10px] text-muted-foreground">
                    {brl(saldo.valor_bruto ?? saldo.valor)} bruto — gere o holerite de fechamento ou lance o líquido
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Preenchido pelo holerite — editável</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Observação</Label>
                <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Faltas, descontos..." />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Faltas no mês</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={faltas}
                    onChange={(e) => setFaltas(e.target.value)}
                    placeholder="0"
                  />
                  <Button size="sm" variant="outline" onClick={salvarFaltas} disabled={salvandoFaltas}>
                    Salvar
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Cada falta reduz um dia de VT do mês.</p>
              </div>
            </div>

            <ValesSection funcionarioId={funcId} competencia={competencia} onMudou={onSalvo} />

            <div className="flex flex-wrap gap-2 mt-4">
              <Button size="sm" onClick={() => atualizar()} disabled={salvando || !saldo}>Salvar fechamento</Button>
              {TIPOS_ORDEM.map((t) => {
                const p = pags[t];
                if (!p || p.status === "pago") return null;
                return (
                  <Button key={t} size="sm" variant="outline" onClick={() => marcarPago(p)}>
                    {t === "va" ? "Marcar pedido feito (VA)" : `Marcar ${t} pago`}
                  </Button>
                );
              })}
              {TIPOS_ORDEM.map((t) => {
                const p = pags[t];
                if (!p?.pagamento_id || p.status !== "pago") return null;
                return (
                <BotaoComprovante
                    key={`doc-${t}`}
                    pagamentoId={p.pagamento_id}
                    nome={f.nome}
                    competencia={competencia}
                    tipo={t}
                    rotulo={`Comprovante ${t}`}
                  />
                );
              })}
            </div>

          </td>
        </tr>
      )}
    </>
  );
}
