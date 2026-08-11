import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Copy, Loader2, QrCode, RefreshCw } from "lucide-react";

// As Edge Functions vivem no projeto Supabase externo (mesmo do client.ts),
// não no projeto padrão das variáveis VITE_*.
const EXTERNAL_SUPABASE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6ZHR1bGNycXptZ29jYW1qd3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjIwMzAsImV4cCI6MjA4NzE5ODAzMH0.7CyKzK3cs-Cd-Wrh69oUAEtxW95l8iZLMCXi_3nAIPU";


export type CobrancaPix = {
  id: string | number;
  codigo_solicitacao?: string | null;
  tipo?: string | null;
  valor?: number | string | null;
  situacao?: string | null;
  nome_pagador?: string | null;
  data_emissao?: string | null;
  pix_copia_cola?: string | null;
  pedido_id?: string | null;
  conversa_id?: string | number | null;
  criado_em?: string | null;
};

type RespostaGeracao = {
  ok?: boolean;
  txid?: string;
  pix_copia_cola?: string;
  status?: string;
  erro?: string;
  error?: string;
};

export async function gerarCobrancaPix(payload: {
  valor: string;
  nome_devedor?: string;
  cpf_cnpj_devedor?: string;
  pedido_id?: string;
  conversa_id?: string | number;
}): Promise<RespostaGeracao> {
  const resposta = (await invokeEdgeFunction("inter-gerar-cobranca-pix", payload, {
    baseUrl: EXTERNAL_SUPABASE_URL,
    anonKey: EXTERNAL_SUPABASE_ANON_KEY,
  })) as RespostaGeracao;

  if (resposta?.ok === false) throw new Error(resposta.erro || resposta.error || "Falha ao gerar cobrança");
  return resposta;
}

export function moedaBR(v?: number | string | null) {
  const n = typeof v === "string" ? Number(v) : v;
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataHora(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function SituacaoBadge({ situacao }: { situacao?: string | null }) {
  const s = (situacao ?? "").toUpperCase();
  const cls =
    s === "CONCLUIDA"
      ? "bg-success/10 text-success border-success/20"
      : s === "ATIVA"
        ? "bg-warning/10 text-warning border-warning/20"
        : s.startsWith("REMOVIDA")
          ? "bg-muted text-muted-foreground border-border"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold", cls)}>
      {situacao || "—"}
    </span>
  );
}

export function ResultadoPix({ codigo, txid }: { codigo: string; txid?: string | null }) {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      toast({ title: "Código copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };
  return (
    <div className="space-y-3 rounded-md border border-success/30 bg-success/5 p-3">
      <div className="flex justify-center rounded-md bg-white p-3">
        <QRCodeSVG value={codigo} size={168} />
      </div>
      {txid && <p className="text-center text-[11px] text-muted-foreground">txid: {txid}</p>}
      <p className="break-all rounded-md border border-border bg-muted/50 p-2 font-mono text-[10px]">{codigo}</p>
      <Button size="sm" className="w-full" onClick={copiar}>
        <Copy className="mr-2 h-4 w-4" />
        Copiar código
      </Button>
    </div>
  );
}

/** Mini-formulário usado dentro da conversa do WhatsApp */
export function CobrancaPixDialog({
  open,
  onOpenChange,
  conversaId,
  nomeCliente,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversaId: string | number;
  nomeCliente?: string | null;
}) {
  const queryClient = useQueryClient();
  const [valor, setValor] = useState("");
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<RespostaGeracao | null>(null);

  const gerar = async () => {
    if (!valor.trim()) return;
    setGerando(true);
    try {
      const r = await gerarCobrancaPix({ valor: valor.replace(",", "."), conversa_id: conversaId });
      setResultado(r);
      queryClient.invalidateQueries({ queryKey: ["inter-cobrancas"] });
      toast({ title: "Cobrança gerada" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar cobrança", description: e.message, variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setValor("");
          setResultado(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Gerar cobrança Pix</DialogTitle>
          <DialogDescription>
            {nomeCliente ? `Cobrança para ${nomeCliente}.` : "Cobrança para a cliente desta conversa."} Os dados do
            pagador são preenchidos automaticamente quando a cliente já está identificada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="valor-pix-conversa">Valor (R$)</Label>
            <Input
              id="valor-pix-conversa"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="150.00"
              inputMode="decimal"
            />
          </div>
          <Button className="w-full" onClick={gerar} disabled={gerando || !valor.trim()}>
            {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
            Gerar cobrança
          </Button>
          {resultado?.pix_copia_cola && (
            <ResultadoPix codigo={resultado.pix_copia_cola} txid={resultado.txid} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Aba completa de cobranças */
export function CobrancasTab() {
  const queryClient = useQueryClient();
  const [valor, setValor] = useState("");
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [pedidoId, setPedidoId] = useState("");
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<RespostaGeracao | null>(null);

  const { data: cobrancas = [], isLoading } = useQuery({
    queryKey: ["inter-cobrancas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("banco_inter_listar_cobrancas" as any, { p_limit: 50 });
      if (error) throw error;
      return (data ?? []) as CobrancaPix[];
    },
    refetchInterval: 60000,
  });

  const gerar = async () => {
    if (!valor.trim()) {
      toast({ title: "Informe o valor", variant: "destructive" });
      return;
    }
    if (nome.trim() && !documento.trim()) {
      toast({ title: "CPF/CNPJ é obrigatório quando o nome é preenchido", variant: "destructive" });
      return;
    }
    setGerando(true);
    try {
      const r = await gerarCobrancaPix({
        valor: valor.replace(",", "."),
        ...(nome.trim() ? { nome_devedor: nome.trim() } : {}),
        ...(documento.trim() ? { cpf_cnpj_devedor: documento.replace(/\D/g, "") } : {}),
        ...(pedidoId.trim() ? { pedido_id: pedidoId.trim() } : {}),
      });
      setResultado(r);
      queryClient.invalidateQueries({ queryKey: ["inter-cobrancas"] });
      toast({ title: "Cobrança gerada" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar cobrança", description: e.message, variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="p-4 space-y-3 h-fit">
        <h2 className="text-sm font-semibold">Gerar cobrança Pix</h2>
        <div className="space-y-1.5">
          <Label htmlFor="valor-pix">Valor (R$) *</Label>
          <Input id="valor-pix" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="150.00" inputMode="decimal" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nome-pix">Nome do devedor</Label>
          <Input id="nome-pix" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Maria Silva" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-pix">CPF/CNPJ {nome.trim() ? "*" : "(opcional)"}</Label>
          <Input id="doc-pix" value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="12345678900" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pedido-pix">Pedido (opcional)</Label>
          <Input id="pedido-pix" value={pedidoId} onChange={(e) => setPedidoId(e.target.value)} placeholder="ID do pedido" />
        </div>
        <Button className="w-full" onClick={gerar} disabled={gerando}>
          {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
          Gerar cobrança
        </Button>
        {resultado?.pix_copia_cola && <ResultadoPix codigo={resultado.pix_copia_cola} txid={resultado.txid} />}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border p-3">
          <h2 className="text-sm font-semibold">Cobranças recentes</h2>
        </div>
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando cobranças…</p>
        ) : cobrancas.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma cobrança gerada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Valor</TableHead>
                  <TableHead>Pagador</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobrancas.map((c) => (
                  <TableRow key={String(c.id)}>
                    <TableCell className="font-medium">{moedaBR(c.valor)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.nome_pagador || "—"}</TableCell>
                    <TableCell>
                      <SituacaoBadge situacao={c.situacao} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {dataHora(c.data_emissao ?? c.criado_em)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.pix_copia_cola && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={async () => {
                              await navigator.clipboard.writeText(c.pix_copia_cola!);
                              toast({ title: "Código copiado" });
                            }}
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            Copiar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          disabled
                          title="Consulta de status em breve"
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Atualizar status (em breve)
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
