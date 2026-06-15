import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatarData } from "@/utils/formatters";

interface VindiRow {
  id: string;
  data_transacao: string | null;
  numero_pedido: string;
  cliente: string;
  email_cliente: string;
  meio_pagamento: string;
  parcelas: number;
  valor_pago: number;
  valor_frete: number;
  valor_loja: number;
  taxa: number;
  taxa_percentual: number;
  data_credito: string | null;
  status: string;
  codigo_rastreio: string | null;
  nsu: string;
}

function parseNumeroPedido(val: string): string {
  if (!val || val === "-") return "";
  if (val.includes("E") || val.includes("e")) {
    const n = parseFloat(val);
    if (!isNaN(n)) return Math.round(n).toString();
  }
  return val.trim();
}

function parseValor(val: string): number {
  if (!val || val === "-") return 0;
  return parseFloat(val.replace("R$ ", "").replace(/\./g, "").replace(",", ".")) || 0;
}

function parseData(val: string): string | null {
  if (!val || val === "-") return null;
  const [d, m, y] = val.split("/");
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '"') {
      if (inQuotes && line[j + 1] === '"') { current += '"'; j++; }
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else current += ch;
  }
  result.push(current);
  return result.map((c) => c.trim().replace(/^"|"$/g, ""));
}

function normalizeHeader(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseVindiCsv(text: string): VindiRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = parseCSVLine(lines[0], ";");
  const idx = (aliases: string[]): number => {
    for (const a of aliases) {
      const i = header.findIndex((h) => normalizeHeader(h) === normalizeHeader(a));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iId = idx(["Id"]);
  const iData = idx(["Data da Transação", "Data da Transacao"]);
  const iNumero = idx(["Número pedido", "Numero pedido"]);
  const iCliente = idx(["Cliente"]);
  const iEmail = idx(["E-mail do cliente", "Email do cliente"]);
  const iMeio = idx(["Meio de Pagamento"]);
  const iParcelas = idx(["Parcelas"]);
  const iValorPago = idx(["Valor Pago"]);
  const iValorFrete = idx(["Valor Frete"]);
  const iValorLoja = idx(["Valor loja", "Valor Loja"]);
  const iTaxa = idx(["Taxa"]);
  const iDataCredito = idx(["Data Credito", "Data Crédito"]);
  const iStatus = idx(["Status"]);
  const iRastreio = idx(["Código de rastreio", "Codigo de rastreio"]);
  const iNsu = idx(["NSU"]);

  const rows: VindiRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], ";");
    const id = (cols[iId] || "").trim();
    if (!id) continue;
    const valor_pago = parseValor(cols[iValorPago] || "");
    const taxa = parseValor(cols[iTaxa] || "");
    rows.push({
      id,
      data_transacao: parseData(cols[iData] || ""),
      numero_pedido: parseNumeroPedido(cols[iNumero] || ""),
      cliente: (cols[iCliente] || "").trim(),
      email_cliente: (cols[iEmail] || "").trim(),
      meio_pagamento: (cols[iMeio] || "").trim(),
      parcelas: parseInt(cols[iParcelas] || "0", 10) || 0,
      valor_pago,
      valor_frete: parseValor(cols[iValorFrete] || ""),
      valor_loja: parseValor(cols[iValorLoja] || ""),
      taxa,
      taxa_percentual: valor_pago > 0 ? taxa / valor_pago : 0,
      data_credito: parseData(cols[iDataCredito] || ""),
      status: (cols[iStatus] || "").trim(),
      codigo_rastreio: cols[iRastreio] && cols[iRastreio] !== "-" ? cols[iRastreio].trim() : null,
      nsu: (cols[iNsu] || "").trim(),
    });
  }
  return rows;
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtPct(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  const ls = s.toLowerCase();
  if (ls.includes("aprov")) return "default";
  if (ls.includes("cancel")) return "secondary";
  if (ls.includes("reprov")) return "destructive";
  return "outline";
}

export default function VindiImporter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<VindiRow[]>([]);
  const [loading, setLoading] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setRows([]);
  };

  const importar = async () => {
    if (!file) {
      toast.error("Selecione um arquivo CSV.");
      return;
    }
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const text = new TextDecoder("windows-1252").decode(buffer);
      const parsed = parseVindiCsv(text);
      if (!parsed.length) {
        toast.error("Nenhuma linha encontrada no CSV.");
        setLoading(false);
        return;
      }

      // Upsert em chunks
      const chunkSize = 500;
      let total = 0;
      for (let i = 0; i < parsed.length; i += chunkSize) {
        const chunk = parsed.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("vindi_transacoes" as any)
          .upsert(chunk, { onConflict: "id", ignoreDuplicates: false });
        if (error) throw error;
        total += chunk.length;
      }

      setRows(parsed);
      toast.success(`${total} linhas importadas com sucesso.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Falha ao importar CSV.");
    } finally {
      setLoading(false);
    }
  };

  const aprovadas = rows.filter((r) => r.status.toLowerCase().includes("aprov"));
  const canceladas = rows.filter((r) => r.status.toLowerCase().includes("cancel"));
  const reprovadas = rows.filter((r) => r.status.toLowerCase().includes("reprov"));
  const totalAprovadas = aprovadas.reduce((s, r) => s + r.valor_pago, 0);
  const totalTaxa = rows.reduce((s, r) => s + r.taxa, 0);
  const totalPago = rows.reduce((s, r) => s + r.valor_pago, 0);
  const taxaMedia = totalPago > 0 ? totalTaxa / totalPago : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar CSV Vindi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <label className="text-sm font-medium text-foreground mb-1 block">Arquivo CSV (separador ; · encoding Latin-1)</label>
              <Input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFile} />
            </div>
            <Button onClick={importar} disabled={!file || loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Importa todas as linhas (Aprovada, Cancelada, Reprovada) com upsert pelo campo <code>id</code>.
          </p>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo da importação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Total</div>
                <div className="font-semibold text-lg">{rows.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Aprovadas</div>
                <div className="font-semibold text-lg">{aprovadas.length}</div>
                <div className="text-xs text-muted-foreground">{fmtCurrency(totalAprovadas)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Canceladas</div>
                <div className="font-semibold text-lg">{canceladas.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Reprovadas</div>
                <div className="font-semibold text-lg">{reprovadas.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Taxa total</div>
                <div className="font-semibold text-lg">{fmtCurrency(totalTaxa)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Taxa média</div>
                <div className="font-semibold text-lg">{fmtPct(taxaMedia)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transações</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nº Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Meio Pagamento</TableHead>
                  <TableHead className="text-right">Parcelas</TableHead>
                  <TableHead className="text-right">Valor Pago</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">Taxa %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Crédito</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.data_transacao ? formatarData(r.data_transacao) : "-"}</TableCell>
                    <TableCell>{r.numero_pedido || "-"}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={r.cliente}>{r.cliente || "-"}</TableCell>
                    <TableCell>{r.meio_pagamento || "-"}</TableCell>
                    <TableCell className="text-right">{r.parcelas || "-"}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(r.valor_pago)}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(r.taxa)}</TableCell>
                    <TableCell className="text-right">{fmtPct(r.taxa_percentual)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{r.status || "-"}</Badge>
                    </TableCell>
                    <TableCell>{r.data_credito ? formatarData(r.data_credito) : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
