import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { brl, dataBr } from "@/lib/financeiroFormat";
import { lerTudo, n, Linha } from "@/lib/finViews";

const TIPOS = ["Empresa", "Pessoal", "Encargo financeiro", "Liquidação de NF", "Liquidação de mídia", "Empréstimo via cartão", "Revisar", "Ignorar"];
const Q = ["fin-view", "fin_cartao_lancamentos"];

function LinhaEditavel({ l, cats }: { l: Linha; cats: Linha[] }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<string>(l.tipo ?? "");
  const [cat, setCat] = useState<string>(l.categoria_codigo ?? "");
  const [salvando, setSalvando] = useState(false);
  const mudou = tipo !== (l.tipo ?? "") || cat !== (l.categoria_codigo ?? "");

  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase
      .from("fin_cartao_lancamentos" as never)
      .update({ tipo, categoria_codigo: cat || null, revisado: true } as never)
      .eq("id", l.id);
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Lançamento salvo");
    qc.invalidateQueries({ queryKey: Q });
  };

  return (
    <TableRow className={tipo === "Ignorar" ? "opacity-50" : ""}>
      <TableCell className="whitespace-nowrap text-xs">{dataBr(l.data_compra)}</TableCell>
      <TableCell className="text-sm">
        {l.descricao}
        {l.parcela && <span className="ml-1 text-xs text-muted-foreground">{l.parcela}</span>}
        {l.nota && <div className="text-[11px] text-muted-foreground">{l.nota}</div>}
      </TableCell>
      <TableCell className="text-xs">{l.cartao}</TableCell>
      <TableCell>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={cat || "__nenhuma"} onValueChange={(v) => setCat(v === "__nenhuma" ? "" : v)}>
          <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__nenhuma">Sem categoria</SelectItem>
            {cats.map((c) => <SelectItem key={c.codigo} value={String(c.codigo)}>{c.codigo} · {c.nome_categoria}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right font-mono text-sm">{brl(l.valor)}</TableCell>
      <TableCell className="text-right">
        {mudou ? (
          <Button size="sm" disabled={salvando} onClick={salvar}>{salvando ? "..." : "Salvar"}</Button>
        ) : l.revisado ? (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">Revisado</Badge>
        ) : (
          <Button size="sm" variant="outline" disabled={salvando} onClick={salvar}>Marcar revisado</Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function Faturas() {
  const q = useQuery({ queryKey: Q, queryFn: () => lerTudo("fin_cartao_lancamentos", { col: "data_compra", asc: false }) });
  const cq = useQuery({
    queryKey: ["fin-categorias-codigo"],
    queryFn: async () => (await lerTudo("categorias_financeiras")).filter((c) => c.codigo).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric: true })),
  });
  const [cartao, setCartao] = useState("todos");
  const [fatura, setFatura] = useState("todas");
  const [tipo, setTipo] = useState("todos");
  const [mostrarIgnorar, setMostrarIgnorar] = useState(false);

  const dados = q.data ?? [];
  const cartoes = useMemo(() => [...new Set(dados.map((l) => l.cartao).filter(Boolean))].sort(), [dados]);
  const faturas = useMemo(() => [...new Set(dados.filter((l) => cartao === "todos" || l.cartao === cartao).map((l) => String(l.fatura_venc ?? "").slice(0, 10)).filter(Boolean))].sort().reverse(), [dados, cartao]);

  const filtrados = dados.filter(
    (l) =>
      (cartao === "todos" || l.cartao === cartao) &&
      (fatura === "todas" || String(l.fatura_venc ?? "").slice(0, 10) === fatura) &&
      (tipo === "todos" || l.tipo === tipo) &&
      (mostrarIgnorar || tipo === "Ignorar" || l.tipo !== "Ignorar"),
  );

  const totais = useMemo(() => {
    const m = new Map<string, number>();
    filtrados.forEach((l) => m.set(l.tipo || "Sem tipo", (m.get(l.tipo || "Sem tipo") ?? 0) + n(l.valor)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtrados]);

  if (q.isLoading) return <div className="py-20 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Faturas Cartão</h1>
        <p className="text-sm text-muted-foreground mt-1">Classifique as compras de cada fatura</p>
      </div>
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {totais.map(([t, v]) => (
          <Card key={t}><CardContent className="pt-4 pb-3">
            <p className="text-xs uppercase text-muted-foreground">{t}</p>
            <p className="text-lg font-serif font-bold">{brl(v)}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={cartao} onValueChange={(v) => { setCartao(v); setFatura("todas"); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os cartões</SelectItem>{cartoes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fatura} onValueChange={setFatura}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todas">Todas as faturas</SelectItem>{faturas.map((f) => <SelectItem key={f} value={f}>Vence {dataBr(f)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os tipos</SelectItem>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-2"><Switch id="ign" checked={mostrarIgnorar} onCheckedChange={setMostrarIgnorar} /><Label htmlFor="ign">Mostrar ignorados</Label></div>
        <span className="text-sm text-muted-foreground">{filtrados.length} lançamentos</span>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Compra</TableHead><TableHead>Descrição</TableHead><TableHead>Cartão</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Valor</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.slice(0, 500).map((l) => <LinhaEditavel key={`${l.id}-${l.tipo}-${l.categoria_codigo}-${l.revisado}`} l={l} cats={cq.data ?? []} />)}
            </TableBody>
          </Table>
          {filtrados.length > 500 && <p className="p-3 text-xs text-muted-foreground">Mostrando 500 de {filtrados.length}. Use os filtros para refinar.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
