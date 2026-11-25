import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Search } from "lucide-react";
import { formatarDataHora } from "@/lib/dataBr";

type Row = Record<string, any>;
const FN = "pagarme-estornar";
const SEM_PERMISSAO = "Seu usuário não tem permissão para estornos";

export function msgErro(e: any): string {
  if (e?.status === 403) return SEM_PERMISSAO;
  return e?.message || "Erro inesperado";
}

async function chamar(body: Row): Promise<Row> {
  const r = await invokeEdgeFunction(FN, body);
  if (r && r.ok === false && (r.resultado === undefined || r.resultado === null)) {
    const err: any = new Error(r.erro || r.error || "Erro na operação");
    if (r.status === 403 || r.codigo === 403) err.status = 403;
    throw err;
  }
  return r ?? {};
}

const brlC = (c: any) =>
  c === null || c === undefined || c === "" ? "-" : (Number(c) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const metodo = (m: any) => (m === "credit_card" ? "Cartão" : m === "pix" ? "Pix" : m || "-");
const txt = (v: any) => (v === null || v === undefined || v === "" ? "-" : String(v));

/** Converte "12,34" ou "12.34" em centavos inteiros; NaN se inválido. */
export function reaisParaCentavos(v: string): number {
  const s = v.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}

const STATUS: Record<string, string> = {
  confirmado: "border-success/30 bg-success/15 text-success",
  enviado: "border-primary/30 bg-primary/15 text-primary",
  pendente: "border-warning/30 bg-warning/15 text-warning",
  incerto: "border-warning/30 bg-warning/15 text-warning",
  falhou: "border-danger/30 bg-danger/15 text-danger",
};
function BadgeStatus({ s }: { s: any }) {
  if (!s) return <>-</>;
  return <Badge variant="outline" className={STATUS[s] ?? "bg-muted text-muted-foreground"}>{String(s)}</Badge>;
}

function Secao({ titulo, children, extra }: { titulo: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <h2 className="font-serif text-lg font-semibold text-card-foreground">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function BadgeTray({ r }: { r: Row }) {
  const cheio = (v: any) => v !== null && v !== undefined && v !== "";
  if (cheio(r.tray_erro)) return <Badge variant="outline" title={String(r.tray_erro)} className="border-danger/30 bg-danger/15 text-danger">Erro na Tray</Badge>;
  if (cheio(r.tray_aplicado_em)) {
    if (r.tray_status_ok === true) return <Badge variant="outline" className="border-success/30 bg-success/15 text-success">Estornado na Tray</Badge>;
    if (r.tray_pedido_inteiro === false) return <Badge variant="outline" className="bg-muted text-muted-foreground">Só observação (parcial)</Badge>;
    if (r.tray_pedido_inteiro === true && (r.tray_status_ok === null || r.tray_status_ok === undefined)) return <Badge variant="outline" className="bg-muted text-muted-foreground">Já estava cancelado</Badge>;
  } else if (r.status === "confirmado") {
    return <Badge variant="outline" className="border-warning/30 bg-warning/15 text-warning">Aguardando Tray</Badge>;
  }
  return <>-</>;
}

function TabelaEstornos({ rows, loading, onConferir, conferindo }: { rows: Row[]; loading?: boolean; onConferir: (id: any) => void; conferindo: any }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Pedido Tray</th><th className="py-2 pr-3">Método</th>
            <th className="py-2 pr-3 text-right">Valor</th><th className="py-2 pr-3">Motivo</th><th className="py-2 pr-3">Quem pediu</th>
            <th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Tray</th><th className="py-2 pr-3">Erro</th><th className="py-2 pr-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="border-b last:border-0">
              <td className="py-2 pr-3">{r.criado_em ? formatarDataHora(r.criado_em) : "-"}</td>
              <td className="py-2 pr-3">{txt(r.tray_order_id)}</td>
              <td className="py-2 pr-3">{metodo(r.metodo)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{brlC(r.valor_centavos)}</td>
              <td className="py-2 pr-3">{txt(r.motivo)}</td>
              <td className="py-2 pr-3">{txt(r.solicitado_por)}</td>
              <td className="py-2 pr-3"><BadgeStatus s={r.status} /></td>
              <td className="py-2 pr-3"><BadgeTray r={r} /></td>
              <td className="py-2 pr-3 text-danger">{txt(r.erro || r.tray_erro)}</td>
              <td className="py-2 pr-3">
                {(r.status === "incerto" || r.status === "enviado") && r.id != null && (
                  <Button size="sm" variant="outline" disabled={conferindo === r.id} onClick={() => onConferir(r.id)}>
                    {conferindo === r.id ? "Conferindo..." : "Conferir"}
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {loading && <tr><td colSpan={10} className="py-4"><Skeleton className="h-6 w-full" /></td></tr>}
          {!loading && rows.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-muted-foreground">Nenhum estorno.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function EstornosPagarme() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<Row | null>(null);
  const [conferindo, setConferindo] = useState<any>(null);

  const consulta = useQuery({
    queryKey: ["pagarme-estornos-consulta", buscaAtiva],
    queryFn: () => chamar({ acao: "consultar", busca: buscaAtiva }),
    enabled: !!buscaAtiva,
    retry: false,
  });
  const recentes = useQuery({
    queryKey: ["pagarme-estornos-recentes"],
    queryFn: () => chamar({ acao: "recentes", dias: 30 }),
    retry: false,
  });

  const recarregar = () => {
    if (buscaAtiva) qc.invalidateQueries({ queryKey: ["pagarme-estornos-consulta", buscaAtiva] });
    qc.invalidateQueries({ queryKey: ["pagarme-estornos-recentes"] });
  };

  const conferir = async (id: any) => {
    setConferindo(id);
    try {
      const r = await chamar({ acao: "conferir", estorno_id: id });
      toast.success(r.status ? `Estorno conferido: ${r.status}` : "Estorno conferido");
    } catch (e) {
      toast.error(msgErro(e));
    } finally {
      setConferindo(null);
      recarregar();
    }
  };

  const listaRows = (d: any): Row[] => (Array.isArray(d) ? d : Array.isArray(d?.estornos) ? d.estornos : Array.isArray(d?.itens) ? d.itens : []);
  const cobrancas: Row[] = consulta.data?.cobrancas ?? [];
  const pode = consulta.data?.pode_executar === true;
  const historico: Row[] = Array.isArray(consulta.data?.historico) ? consulta.data!.historico : [];

  return (
    <div className="space-y-6">
      <Secao titulo="Buscar cobrança">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); const b = busca.trim(); if (!b) return; if (b === buscaAtiva) consulta.refetch(); else setBuscaAtiva(b); }}
        >
          <div className="min-w-[260px] flex-1 space-y-1">
            <Label htmlFor="busca-estorno">Pedido Tray, order ou cobrança</Label>
            <Input id="busca-estorno" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Button type="submit" disabled={!busca.trim() || consulta.isFetching}><Search className="mr-1 h-4 w-4" />Buscar</Button>
        </form>
        {consulta.error && <p className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{msgErro(consulta.error)}</p>}
        {consulta.isFetching && <Skeleton className="mt-4 h-24 w-full" />}
        {buscaAtiva && consulta.data && !consulta.isFetching && cobrancas.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma cobrança encontrada.</p>
        )}
        {cobrancas.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {cobrancas.map((c) => (
              <div key={c.id} className="rounded-lg border p-4 text-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold">Pedido Tray {txt(c.tray_order_id)}</span>
                  <Badge variant="outline">{txt(c.status)}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">Método</dt><dd>{metodo(c.metodo)}{c.bandeira ? ` · ${c.bandeira}` : ""}{c.parcelas ? ` · ${c.parcelas}x` : ""}</dd>
                  <dt className="text-muted-foreground">Pago</dt><dd className="tabular-nums">{brlC(c.pago_centavos)}</dd>
                  <dt className="text-muted-foreground">Já estornado</dt><dd className="tabular-nums">{brlC(c.estornado_centavos)}</dd>
                  <dt className="text-muted-foreground">Disponível para estorno</dt><dd className="font-semibold tabular-nums">{brlC(c.disponivel_centavos)}</dd>
                  <dt className="text-muted-foreground">Pago em</dt><dd>{c.pago_em ? formatarDataHora(c.pago_em) : "-"}</dd>
                  <dt className="text-muted-foreground">Cliente</dt><dd className="break-all">{txt(typeof c.cliente === "object" && c.cliente ? c.cliente.email : c.cliente)}</dd>
                </dl>
                {pode && Number(c.disponivel_centavos) > 0 && (
                  <Button className="mt-3" size="sm" variant="destructive" onClick={() => setAlvo(c)}>Estornar</Button>
                )}
              </div>
            ))}
          </div>
        )}
        {buscaAtiva && consulta.data && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Histórico do pedido</h3>
            <TabelaEstornos rows={historico} onConferir={conferir} conferindo={conferindo} />
          </div>
        )}
      </Secao>

      <Secao titulo="Estornos dos últimos 30 dias">
        {recentes.error && <p className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{msgErro(recentes.error)}</p>}
        <TabelaEstornos rows={listaRows(recentes.data)} loading={recentes.isLoading} onConferir={conferir} conferindo={conferindo} />
      </Secao>

      {alvo && <ModalEstorno cobranca={alvo} onClose={() => setAlvo(null)} onFim={recarregar} />}
    </div>
  );
}

function ModalEstorno({ cobranca, onClose, onFim }: { cobranca: Row; onClose: () => void; onFim: () => void }) {
  const disp = Number(cobranca.disponivel_centavos) || 0;
  const dispTxt = (disp / 100).toFixed(2).replace(".", ",");
  const [tipo, setTipo] = useState<"total" | "parcial">("total");
  const [valor, setValor] = useState(dispTxt);
  const [valor2, setValor2] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [incerto, setIncerto] = useState<any>(null);

  const c1 = reaisParaCentavos(valor);
  const c2 = reaisParaCentavos(valor2);
  const valorOk = Number.isFinite(c1) && c1 > 0 && c1 <= disp;
  const iguais = Number.isFinite(c2) && c1 === c2;
  const motivoOk = motivo.trim().length >= 5;
  const valido = valorOk && iguais && motivoOk && !enviando && incerto == null;

  const confirmar = async () => {
    if (!valido) return;
    setEnviando(true);
    try {
      const r = await chamar({ acao: "executar", cobranca_id: cobranca.id, valor_centavos: c1, confirmar_valor_centavos: c2, motivo: motivo.trim() });
      const res = r.resultado;
      if (res === "confirmado") { toast.success("Estorno confirmado"); onFim(); onClose(); return; }
      if (res === "enviado") { toast.success("Estorno enviado, aguardando confirmação da Pagar.me"); onFim(); onClose(); return; }
      if (res === "incerto") {
        toast.warning(r.erro || "Resultado incerto. Confira antes de tentar de novo.");
        setIncerto(r.estorno_id ?? r.id ?? true);
        onFim();
        return;
      }
      toast.error(r.erro || "O estorno falhou");
      onFim();
      setEnviando(false);
    } catch (e) {
      toast.error(msgErro(e));
      onFim();
      setEnviando(false);
    }
  };

  const conferir = async () => {
    if (incerto === true) { onClose(); return; }
    try {
      const r = await chamar({ acao: "conferir", estorno_id: incerto });
      toast.success(r.status ? `Estorno conferido: ${r.status}` : "Estorno conferido");
    } catch (e) { toast.error(msgErro(e)); }
    onFim();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !enviando) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Estornar pedido Tray {txt(cobranca.tray_order_id)}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <p>Disponível para estorno: <strong>{brlC(disp)}</strong></p>
          <RadioGroup value={tipo} onValueChange={(v) => { setTipo(v as any); setValor(v === "total" ? dispTxt : ""); setValor2(""); }} className="flex gap-6">
            <label className="flex items-center gap-2"><RadioGroupItem value="total" />Total</label>
            <label className="flex items-center gap-2"><RadioGroupItem value="parcial" />Parcial</label>
          </RadioGroup>
          <div className="space-y-1">
            <Label htmlFor="v1">Valor do estorno (R$)</Label>
            <Input id="v1" inputMode="decimal" value={valor} readOnly={tipo === "total"} onChange={(e) => setValor(e.target.value)} />
            {valor && !valorOk && <p className="text-xs text-danger">Valor inválido ou acima do disponível</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="v2">Digite o valor de novo (R$)</Label>
            <Input id="v2" inputMode="decimal" value={valor2} onChange={(e) => setValor2(e.target.value)} />
            {valor2 && !iguais && <p className="text-xs text-danger">Os valores não são iguais</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="mot">Motivo</Label>
            <Textarea id="mot" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
            {motivo && !motivoOk && <p className="text-xs text-danger">Mínimo de 5 caracteres</p>}
          </div>
          <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 font-medium text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>O estorno devolve o dinheiro à cliente pela Pagar.me e não pode ser desfeito. No estorno total, o pedido na Tray passa para ESTORNADO. No parcial, só ganha uma observação.</span>
          </div>
        </div>
        <DialogFooter>
          {incerto != null ? (
            <Button onClick={conferir}>Conferir</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={enviando}>Voltar</Button>
              <Button variant="destructive" onClick={confirmar} disabled={!valido}>{enviando ? "Estornando..." : "Confirmar estorno"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
