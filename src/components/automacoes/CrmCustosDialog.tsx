import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { rpcFluxos } from "./api";
import { brlCrm, type ConfigCustosCrm, type CustoCrm } from "./crmTipos";

const vazio: CustoCrm = { canal: "whatsapp", categoria: "MARKETING", custo_usd: 0, custo_brl_fixo: null, descricao: "" };

export function CrmCustosDialog({ open, onOpenChange, onSalvo }: { open: boolean; onOpenChange: (v: boolean) => void; onSalvo: () => void }) {
  const consulta = useQuery({ queryKey: ["crm-custos"], enabled: open, queryFn: () => rpcFluxos<ConfigCustosCrm>("crm_custos_listar") });
  const [cotacao, setCotacao] = useState(0);
  const [janelaWhatsapp, setJanelaWhatsapp] = useState(24);
  const [janelaEmail, setJanelaEmail] = useState(7);
  const [custos, setCustos] = useState<CustoCrm[]>([]);

  useEffect(() => {
    if (!consulta.data) return;
    setCotacao(Number(consulta.data.config?.cotacao_usd_brl ?? 0));
    setJanelaWhatsapp(Number(consulta.data.config?.janela_whatsapp_horas ?? 24));
    setJanelaEmail(Number(consulta.data.config?.janela_email_dias ?? 7));
    setCustos(consulta.data.custos ?? []);
  }, [consulta.data]);

  const alterar = (indice: number, campo: keyof CustoCrm, valor: string) => setCustos((lista) => lista.map((item, i) => i === indice ? {
    ...item,
    [campo]: campo === "custo_usd" || campo === "custo_brl_fixo" ? (valor === "" ? null : Number(valor)) : valor,
  } : item));

  const salvar = useMutation({
    mutationFn: () => rpcFluxos("crm_custos_salvar", {
      p_config: { cotacao_usd_brl: cotacao, janela_whatsapp_horas: janelaWhatsapp, janela_email_dias: janelaEmail },
      p_custos: custos.map(({ canal, categoria, custo_usd, custo_brl_fixo, descricao }) => ({ canal, categoria, custo_usd, custo_brl_fixo, descricao })),
    }),
    onSuccess: () => { toast({ title: "Custos e atribuição salvos" }); onOpenChange(false); onSalvo(); },
    onError: (erro: Error) => toast({ title: "Não foi possível salvar", description: erro.message, variant: "destructive" }),
  });

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
      <DialogHeader><DialogTitle>Custos e atribuição</DialogTitle><DialogDescription>Valores usados para calcular custo, receita influenciada e ROAS.</DialogDescription></DialogHeader>
      {consulta.isLoading ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-64" /></div> : consulta.isError ? <div className="py-8 text-center"><p className="text-sm text-danger">Não foi possível carregar os custos.</p><Button className="mt-3" variant="outline" onClick={() => consulta.refetch()}>Tentar de novo</Button></div> : <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label>Cotação do dólar</Label><Input type="number" min="0" step="0.01" value={cotacao} onChange={(e) => setCotacao(Number(e.target.value))} /></div>
          <div className="space-y-1"><Label>Janela do WhatsApp (horas)</Label><Input type="number" min="1" value={janelaWhatsapp} onChange={(e) => setJanelaWhatsapp(Number(e.target.value))} /></div>
          <div className="space-y-1"><Label>Janela do e-mail (dias)</Label><Input type="number" min="1" value={janelaEmail} onChange={(e) => setJanelaEmail(Number(e.target.value))} /></div>
        </div>
        <div className="rounded-md border">
          <Table><TableHeader><TableRow><TableHead>Canal</TableHead><TableHead>Categoria</TableHead><TableHead>US$</TableHead><TableHead>Fixo R$</TableHead><TableHead>Custo calculado</TableHead><TableHead>Descrição</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
            <TableBody>{custos.map((item, indice) => <TableRow key={`${item.canal}-${item.categoria}-${indice}`}>
              <TableCell><Input className="min-w-28" value={item.canal} onChange={(e) => alterar(indice, "canal", e.target.value)} /></TableCell>
              <TableCell><Input className="min-w-32" value={item.categoria} onChange={(e) => alterar(indice, "categoria", e.target.value)} /></TableCell>
              <TableCell><Input className="min-w-24" type="number" min="0" step="0.0001" value={item.custo_usd ?? ""} onChange={(e) => alterar(indice, "custo_usd", e.target.value)} /></TableCell>
              <TableCell><Input className="min-w-24" type="number" min="0" step="0.01" value={item.custo_brl_fixo ?? ""} onChange={(e) => alterar(indice, "custo_brl_fixo", e.target.value)} /></TableCell>
              <TableCell className="whitespace-nowrap font-medium">{brlCrm(item.custo_brl_fixo ?? Number(item.custo_usd ?? 0) * cotacao)}</TableCell>
              <TableCell><Input className="min-w-48" value={item.descricao ?? ""} onChange={(e) => alterar(indice, "descricao", e.target.value)} /></TableCell>
              <TableCell><Button size="icon" variant="ghost" aria-label="Excluir custo" onClick={() => setCustos((lista) => lista.filter((_, i) => i !== indice))}><Trash2 className="h-4 w-4 text-danger" /></Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCustos((lista) => [...lista, { ...vazio }])}><Plus className="mr-2 h-4 w-4" />Adicionar custo</Button>
      </div>}
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={consulta.isLoading || salvar.isPending} onClick={() => salvar.mutate()}>{salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}