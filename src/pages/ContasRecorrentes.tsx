import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { brl, dataBr } from "@/lib/financeiroFormat";
import { parseValorBR, formatValorBR } from "@/lib/rhMoeda";
import { lerTudo, useView, Linha } from "@/lib/finViews";

const MEIOS = ["boleto", "pix", "debito", "cartao"];
const Q = ["fin-view", "fin_recorrentes"];
const vazio = { credor: "", descricao: "", categoria_codigo: "", valor: "", dia: "10", meio: "boleto", padrao_extrato: "", ativo: true, inicio: "", fim: "", nota: "" };

export default function ContasRecorrentes() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: Q, queryFn: () => lerTudo("fin_recorrentes", { col: "credor" }) });
  const prev = useView("vw_fin_recorrentes_previstos", { col: "vencimento" });
  const cats = useQuery({ queryKey: ["fin-categorias-codigo"], queryFn: async () => (await lerTudo("categorias_financeiras")).filter((c) => c.codigo).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric: true })) });
  const [edit, setEdit] = useState<Linha | null>(null);
  const [f, setF] = useState<typeof vazio>(vazio);
  const [salvando, setSalvando] = useState(false);

  const abrir = (l?: Linha) => {
    setEdit(l ?? {});
    setF(l ? {
      credor: l.credor ?? "", descricao: l.descricao ?? "", categoria_codigo: l.categoria_codigo ?? "",
      valor: formatValorBR(l.valor), dia: String(l.dia ?? ""), meio: l.meio ?? "boleto", padrao_extrato: l.padrao_extrato ?? "",
      ativo: l.ativo !== false, inicio: l.inicio ?? "", fim: l.fim ?? "", nota: l.nota ?? "",
    } : vazio);
  };

  const salvar = async () => {
    const dia = Number(f.dia);
    const valor = parseValorBR(f.valor);
    if (!f.credor.trim()) return toast.error("Informe o credor");
    if (valor == null) return toast.error("Informe o valor");
    if (!(dia >= 1 && dia <= 31)) return toast.error("Dia deve ser de 1 a 31");
    const payload = {
      credor: f.credor.trim(), descricao: f.descricao || null, categoria_codigo: f.categoria_codigo || null, valor, dia,
      meio: f.meio, padrao_extrato: f.padrao_extrato || null, ativo: f.ativo, inicio: f.inicio || null, fim: f.fim || null, nota: f.nota || null,
    };
    setSalvando(true);
    const tb = supabase.from("fin_recorrentes" as never);
    const { error } = edit?.id ? await tb.update(payload as never).eq("id", edit.id) : await tb.insert(payload as never);
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Conta salva");
    setEdit(null);
    qc.invalidateQueries({ queryKey: Q });
    qc.invalidateQueries({ queryKey: ["fin-view", "vw_fin_recorrentes_previstos"] });
  };

  const excluir = async (l: Linha) => {
    if (!confirm(`Excluir a conta recorrente "${l.credor}"?`)) return;
    const { error } = await supabase.from("fin_recorrentes" as never).delete().eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Conta excluída");
    qc.invalidateQueries({ queryKey: Q });
    qc.invalidateQueries({ queryKey: ["fin-view", "vw_fin_recorrentes_previstos"] });
  };

  const set = (k: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Contas Recorrentes</h1>
          <p className="text-sm text-muted-foreground mt-1">Contas que se repetem todo mês</p>
        </div>
        <Button onClick={() => abrir()}><Plus className="h-4 w-4 mr-1" /> Nova conta</Button>
      </div>
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Credor</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Dia</TableHead><TableHead>Meio</TableHead><TableHead>Extrato</TableHead><TableHead>Vigência</TableHead><TableHead className="text-right">Valor</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {(q.data ?? []).map((l) => (
                <TableRow key={l.id} className={l.ativo === false ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    {l.credor}
                    {l.folha_tipo && <Badge variant="outline" className="ml-2 text-[10px]">Folha: {l.folha_tipo}</Badge>}
                    {l.ativo === false && <Badge variant="outline" className="ml-2 text-[10px]">Inativa</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.descricao || "-"}</TableCell>
                  <TableCell className="text-xs">{l.categoria_codigo || "-"}</TableCell>
                  <TableCell>{l.dia}</TableCell>
                  <TableCell className="text-xs">{l.meio}</TableCell>
                  <TableCell className="text-xs font-mono">{l.padrao_extrato || "-"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{l.inicio ? dataBr(l.inicio) : "-"} a {l.fim ? dataBr(l.fim) : "-"}</TableCell>
                  <TableCell className="text-right font-mono">{brl(l.valor)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => abrir(l)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => excluir(l)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Previsão dos próximos meses</CardTitle></CardHeader>
        <CardContent className="p-0 max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Credor</TableHead><TableHead>Descrição</TableHead><TableHead>Meio</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
            <TableBody>
              {(prev.data ?? []).map((l, i) => (
                <TableRow key={i}>
                  <TableCell>{dataBr(l.vencimento)}</TableCell>
                  <TableCell>{l.credor}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.descricao || "-"}</TableCell>
                  <TableCell className="text-xs">{l.meio}</TableCell>
                  <TableCell className="text-right font-mono">{brl(l.valor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar conta" : "Nova conta recorrente"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label>Credor</Label><Input value={f.credor} onChange={set("credor")} /></div>
            <div className="col-span-2 space-y-1"><Label>Descrição</Label><Input value={f.descricao} onChange={set("descricao")} /></div>
            <div className="col-span-2 space-y-1">
              <Label>Categoria</Label>
              <Select value={f.categoria_codigo || "__nenhuma"} onValueChange={(v) => setF({ ...f, categoria_codigo: v === "__nenhuma" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__nenhuma">Sem categoria</SelectItem>
                  {(cats.data ?? []).map((c) => <SelectItem key={c.codigo} value={String(c.codigo)}>{c.codigo} · {c.nome_categoria}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Valor (R$)</Label><Input value={f.valor} onChange={set("valor")} placeholder="0,00" /></div>
            <div className="space-y-1"><Label>Dia do vencimento</Label><Input type="number" min={1} max={31} value={f.dia} onChange={set("dia")} /></div>
            <div className="space-y-1">
              <Label>Meio</Label>
              <Select value={f.meio} onValueChange={(v) => setF({ ...f, meio: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MEIOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Padrão no extrato</Label><Input value={f.padrao_extrato} onChange={set("padrao_extrato")} placeholder="%ENEL%" /></div>
            <div className="space-y-1"><Label>Início</Label><Input type="date" value={f.inicio} onChange={set("inicio")} /></div>
            <div className="space-y-1"><Label>Fim</Label><Input type="date" value={f.fim} onChange={set("fim")} /></div>
            <div className="col-span-2 space-y-1"><Label>Nota</Label><Textarea value={f.nota} onChange={set("nota")} rows={2} /></div>
            <div className="col-span-2 flex items-center gap-2"><Switch id="ativo" checked={f.ativo} onCheckedChange={(v) => setF({ ...f, ativo: v })} /><Label htmlFor="ativo">Ativa</Label></div>
            {edit?.folha_tipo && <p className="col-span-2 text-xs text-muted-foreground">Folha: {edit.folha_tipo} (não editável aqui)</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button disabled={salvando} onClick={salvar}>{salvando ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
