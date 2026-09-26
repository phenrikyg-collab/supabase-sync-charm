import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MessageCircle, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { useAbrirConversa } from "@/lib/abrirConversa";
import { detalhe, kpis, lista, refazerResumo, type DetalheCliente } from "@/lib/trocasClientes";
import { BarrasMotivos, ChipsTamanhos, ListaProtocolos } from "@/components/reversa/HistoricoTrocasCliente";

const LIMITE = 50;
const FILTROS = [
  ["troca_muito", "Trocam muito"], ["recorrentes", "2 ou mais"], ["todas", "Todas"],
  ["grupo:vestibilidade", "Tamanho e caimento"], ["grupo:expectativa", "Modelo, tecido ou cor"],
  ["grupo:qualidade", "Defeito"], ["grupo:operacao", "Erro no envio"],
];
const ORDENS = [["solicitacoes", "Mais solicitações"], ["taxa", "Maior taxa"], ["recente", "Mais recente"], ["nome", "Nome"]];
const num = (v: any) => Number(v ?? 0).toLocaleString("pt-BR");

export default function TrocasClientes() {
  const [params, setParams] = useSearchParams();
  const clienteAberto = params.get("cliente");
  const [k, setK] = useState<any>(null);
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [filtro, setFiltro] = useState("troca_muito");
  const [ordem, setOrdem] = useState("solicitacoes");
  const [pagina, setPagina] = useState(0);
  const [dados, setDados] = useState<{ total: number; linhas: DetalheCliente[] } | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { kpis().then(setK).catch((e) => toast.error(e.message)); }, []);
  useEffect(() => { const t = setTimeout(() => { setBuscaAtiva(busca.trim()); setPagina(0); }, 400); return () => clearTimeout(t); }, [busca]);
  useEffect(() => {
    setCarregando(true);
    lista({ p_busca: buscaAtiva || null, p_filtro: filtro, p_ordem: ordem, p_limite: LIMITE, p_offset: pagina * LIMITE })
      .then(setDados).catch((e) => toast.error(e.message)).finally(() => setCarregando(false));
  }, [buscaAtiva, filtro, ordem, pagina]);

  const abrir = (id?: string | number) => {
    const p = new URLSearchParams(params);
    if (id != null) p.set("cliente", String(id)); else p.delete("cliente");
    setParams(p, { replace: true });
  };

  const c = k?.criterio ?? {};
  const maxDist = Math.max(1, ...((k?.distribuicao ?? []) as any[]).map((d) => Number(d.clientes) || 0));
  const total = Number(dados?.total ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold">Clientes que trocam</h1>
        <p className="text-sm text-muted-foreground">Histórico de trocas e devoluções por cliente{k?.atualizado_em ? ` · atualizado em ${new Date(k.atualizado_em).toLocaleString("pt-BR")}` : ""}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Clientes com troca", num(k?.clientes)],
          ["Trocam muito", num(k?.troca_muito)],
          ["Das solicitações vêm delas", k ? `${Number(k.pct_solicitacoes_troca_muito ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "-"],
          ["Com 2 ou mais", num(k?.recorrentes)],
        ].map(([r, v]) => (
          <Card key={r} className="p-4"><p className="text-xs text-muted-foreground">{r}</p><p className="text-2xl font-semibold">{k ? v : "-"}</p></Card>
        ))}
      </div>
      {k && <p className="text-xs text-muted-foreground">Troca muito: {c.min} ou mais solicitações, ou {c.min_taxa} ou mais com metade ou mais dos pedidos trocados.</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4"><p className="mb-3 text-sm font-semibold">Motivos de quem troca muito</p><BarrasMotivos motivos={k?.motivos_troca_muito ?? []} /></Card>
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Peças que mais voltam entre elas</p>
          <div className="space-y-1.5 text-sm">
            {(k?.produtos_troca_muito ?? []).map((p: any, i: number) => (
              <div key={i} className="flex justify-between gap-2"><span className="min-w-0 truncate">{p.produto}</span><span className="shrink-0 text-xs text-muted-foreground">{p.n} peças · {p.clientes} clientes</span></div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Distribuição de solicitações</p>
          <div className="space-y-2 text-sm">
            {(k?.distribuicao ?? []).map((d: any) => (
              <div key={d.faixa}>
                <div className="flex justify-between"><span>{d.faixa}</span><span className="text-muted-foreground">{num(d.clientes)}</span></div>
                <div className="h-2 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${(Number(d.clientes) / maxDist) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Nome, e-mail, CPF, telefone, protocolo ou pedido" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtro} onValueChange={(v) => { setFiltro(v); setPagina(0); }} disabled={!!buscaAtiva}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>{FILTROS.map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ordem} onValueChange={(v) => { setOrdem(v); setPagina(0); }}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{ORDENS.map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Cliente</TableHead><TableHead>Solicitações</TableHead><TableHead>Trocas / Reemb. / Recus.</TableHead>
              <TableHead>Motivo principal</TableHead><TableHead>Tamanho e peça</TableHead><TableHead>Última</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {carregando ? (
                <TableRow><TableCell colSpan={6} className="text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></TableCell></TableRow>
              ) : (dados?.linhas ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma cliente encontrada</TableCell></TableRow>
              ) : dados!.linhas.map((l) => (
                <TableRow key={String(l.tray_customer_id)} className="cursor-pointer" onClick={() => abrir(l.tray_customer_id)}>
                  <TableCell className="max-w-[280px]">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="font-medium">{l.nome ?? "-"}</span>{l.troca_muito && <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">Troca muito</Badge>}</div>
                    <p className="truncate text-xs text-muted-foreground">{l.email ?? "-"}</p>
                    {l.resumo_ia && <p className="truncate text-xs text-muted-foreground">{l.resumo_ia.split("\n")[0]}</p>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{l.solicitacoes} de {l.pedidos} pedidos<span className="block text-xs text-muted-foreground">{l.taxa_pct ?? 0}%</span></TableCell>
                  <TableCell>{l.trocas ?? 0} / {l.reembolsos ?? 0} / {l.recusadas ?? 0}</TableCell>
                  <TableCell>{l.motivo_principal_rotulo ?? "-"}</TableCell>
                  <TableCell className="max-w-[200px]"><span>{l.tamanho_principal ?? "-"}</span><p className="truncate text-xs text-muted-foreground">{l.produto_principal ?? "-"}</p></TableCell>
                  <TableCell className="whitespace-nowrap">{l.ultima_br ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {total > LIMITE && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <span className="text-muted-foreground">{pagina * LIMITE + 1} a {Math.min(total, (pagina + 1) * LIMITE)} de {total}</span>
            <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={(pagina + 1) * LIMITE >= total} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
          </div>
        )}
      </Card>

      <Sheet open={!!clienteAberto} onOpenChange={(o) => !o && abrir()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {clienteAberto && <PainelCliente id={clienteAberto} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PainelCliente({ id }: { id: string }) {
  const [d, setD] = useState<DetalheCliente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [refazendo, setRefazendo] = useState(false);
  const abrirConversa = useAbrirConversa();
  const carregar = () => detalhe(id).then((r) => { setD(r); setErro(null); }).catch((e) => setErro(e.message));
  useEffect(() => { setD(null); carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const refazer = async () => {
    setRefazendo(true);
    try { await refazerResumo(d?.tray_customer_id ?? id); await carregar(); toast.success("Resumo refeito"); }
    catch (e: any) { toast.error(e.message); }
    finally { setRefazendo(false); }
  };

  if (erro) return <p className="text-sm text-destructive">{erro}</p>;
  if (!d) return <Loader2 className="mx-auto mt-10 h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle className="flex flex-wrap items-center gap-2">{d.nome ?? "-"}{d.troca_muito && <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">Troca muito</Badge>}</SheetTitle>
        <p className="text-xs text-muted-foreground">{[d.email, d.cpf].filter(Boolean).join(" · ")}</p>
        <p className="text-sm">{d.solicitacoes} solicitações em {d.pedidos} pedidos ({d.taxa_pct ?? 0}%) · {d.trocas ?? 0} trocas · {d.reembolsos ?? 0} reembolsos · {d.recusadas ?? 0} recusadas</p>
        <p className="text-xs text-muted-foreground">De {d.primeira_br ?? "-"} a {d.ultima_br ?? "-"}</p>
      </SheetHeader>
      {d.conversa_id != null && (
        <Button variant="outline" size="sm" onClick={() => abrirConversa(d.conversa_id!)}><MessageCircle className="mr-1 h-4 w-4" />Abrir conversa no WhatsApp</Button>
      )}
      <section className="rounded-md border border-border bg-muted/40 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Leitura da IA</p>
          <Button variant="ghost" size="sm" disabled={refazendo} onClick={refazer}>
            {refazendo ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}Refazer resumo
          </Button>
        </div>
        {d.resumo_ia ? <p className="whitespace-pre-line text-sm font-medium">{d.resumo_ia}</p> : <p className="text-sm text-muted-foreground">Resumo ainda não gerado</p>}
        {d.resumo_ia_em_br && <p className="mt-1 text-xs text-muted-foreground">Gerado em {d.resumo_ia_em_br}</p>}
        {d.resumo_desatualizado && <p className="mt-1 text-xs text-warning">o histórico mudou depois deste resumo</p>}
      </section>
      {(d.motivos ?? []).length > 0 && <section><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Motivos</p><BarrasMotivos motivos={d.motivos!} pequeno /></section>}
      {(d.tamanhos ?? []).length > 0 && <section><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tamanhos</p><ChipsTamanhos tamanhos={d.tamanhos!} /></section>}
      {(d.produtos ?? []).length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peças que mais voltaram</p>
          <div className="space-y-1 text-sm">{d.produtos!.map((p, i) => (
            <div key={i}><div className="flex justify-between gap-2"><span className="min-w-0 truncate">{p.produto}</span><span className="text-muted-foreground">{p.n}</span></div>
              {(p.motivos ?? []).length > 0 && <p className="text-xs text-muted-foreground">{p.motivos!.join(", ")}</p>}</div>
          ))}</div>
        </section>
      )}
      <section><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Protocolos</p><ListaProtocolos protocolos={d.protocolos ?? []} /></section>
    </div>
  );
}
