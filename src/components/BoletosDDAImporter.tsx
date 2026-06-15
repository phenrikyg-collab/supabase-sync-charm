import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { formatarData } from "@/utils/formatters";

type Situacao = "PAGO" | "ABERTO" | "VENCIDO" | "BAIXADO" | string;

interface BoletoLinha {
  data: string;                 // competência → DRE
  data_vencimento: string;        // vencimento → fluxo de caixa / contas a pagar
  descricao: string;
  valor: number;
  tipo: "saida";
  origem: "boleto_dda";
  fingerprint_hash: string;
  tipo_origem: "boleto";
  impacta_dre: true;
  impacta_fluxo: true;
  cliente: string;
  status_pagamento: "pago" | "pendente";
  situacao_original: Situacao;
  // ui-only
  competenciaBr: string;
  vencimentoBr: string;
  doc_key: string;
}

function normalizeHeader(value: any): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseDataBR(val: any): { iso: string; br: string } {
  if (val instanceof Date && !isNaN(val.getTime())) {
    const d = String(val.getDate()).padStart(2, "0");
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const y = val.getFullYear();
    return { iso: `${y}-${m}-${d}`, br: `${d}/${m}/${y}` };
  }
  if (typeof val === "number" && val > 30000 && val < 60000) {
    const d = new Date((val - 25569) * 86400000);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yy = d.getUTCFullYear();
    return { iso: `${yy}-${mm}-${dd}`, br: `${dd}/${mm}/${yy}` };
  }
  const s = String(val ?? "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const yy = m[3].length === 2 ? "20" + m[3] : m[3];
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    return { iso: `${yy}-${mm}-${dd}`, br: `${dd}/${mm}/${yy}` };
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { iso: `${iso[1]}-${iso[2]}-${iso[3]}`, br: `${iso[3]}/${iso[2]}/${iso[1]}` };
  if (/^\d{8}$/.test(s)) {
    return { iso: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`, br: `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}` };
  }
  return { iso: "", br: s };
}

function parseValor(val: any): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const s = String(val ?? "").replace(/R\$\s*/g, "").trim();
  if (!s) return 0;
  const sanitized = s.replace(/[^\d.,-]/g, "");
  const normalized = sanitized.includes(",") && sanitized.includes(".")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function findSheetWithHeaders(wb: XLSX.WorkBook): { rows: any[][]; headerIdx: number; headerMap: Record<string, number> } | null {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" }) as any[][];
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const cols = (rows[i] ?? []).map((c) => normalizeHeader(c));
      const hasVenc = cols.includes("vencimento");
      const hasSit = cols.some((c) => c.includes("situacao"));
      const hasBenef = cols.some((c) => c.includes("beneficiario"));
      if (hasVenc && hasSit && hasBenef) {
        const map: Record<string, number> = {};
        cols.forEach((c, idx) => { if (c && map[c] === undefined) map[c] = idx; });
        return { rows, headerIdx: i, headerMap: map };
      }
    }
  }
  return null;
}

function parseBoletosDDA(buffer: ArrayBuffer): { linhas: BoletoLinha[] } {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const found = findSheetWithHeaders(wb);
  if (!found) return { linhas: [] };
  const { rows, headerIdx, headerMap } = found;

  const findIdx = (...keys: string[]): number => {
    for (const k of keys) {
      const norm = normalizeHeader(k);
      if (headerMap[norm] !== undefined) return headerMap[norm];
      for (const hk of Object.keys(headerMap)) {
        if (hk.includes(norm)) return headerMap[hk];
      }
    }
    return -1;
  };

  const iVenc = findIdx("Vencimento");
  const iCompetencia = findIdx("Data de competencia", "Data competencia");
  const iNumDoc = findIdx("N documento", "Nº documento", "numero documento");
  const iNosso = findIdx("Nosso numero", "Nosso número");
  const iBenef = findIdx("Beneficiario", "Beneficiário");
  const iNominal = findIdx("Nominal R", "Nominal");
  const iTotal = findIdx("Valor Total R", "Valor Total");
  const iSit = findIdx("Situacao", "Situação");

  const linhas: BoletoLinha[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (!row.some((c) => String(c ?? "").trim() !== "")) continue;

    const situacao = String(row[iSit] ?? "").trim().toUpperCase();
    if (!situacao) continue;

    const { iso: isoVenc, br: brVenc } = parseDataBR(row[iVenc]);
    if (!isoVenc) continue;

    // Data de competência — usar quando disponível, fallback para vencimento
    let isoCompetencia = isoVenc;
    let brCompetencia = brVenc;
    if (iCompetencia >= 0) {
      const compRaw = row[iCompetencia];
      if (compRaw !== undefined && compRaw !== "" && compRaw !== null) {
        const parsedComp = parseDataBR(compRaw);
        if (parsedComp.iso) {
          isoCompetencia = parsedComp.iso;
          brCompetencia = parsedComp.br;
        }
      }
    }

    const numDocRaw = String(row[iNumDoc] ?? "").trim();
    const nossoNum = String(row[iNosso] ?? "").trim();
    const numDoc = numDocRaw && numDocRaw.toLowerCase() !== "nan" ? numDocRaw : "";
    const docKey = numDoc || nossoNum;
    if (!docKey) continue;

    const beneficiario = String(row[iBenef] ?? "").trim() || "Sem beneficiário";
    const nominal = parseValor(row[iNominal]);
    const valorTotal = parseValor(row[iTotal]);
    const valor = situacao === "VENCIDO" && valorTotal > 0 ? valorTotal : nominal;
    if (!(valor > 0)) continue;

    const status_pagamento: "pago" | "pendente" = ["PAGO", "BAIXADO"].includes(situacao) ? "pago" : "pendente";
    const beneKey = beneficiario.substring(0, 25).toLowerCase().replace(/\s+/g, "_");
    const fingerprint_hash = `boleto_${docKey}_${beneKey}`;

    linhas.push({
      data: isoCompetencia,          // competência → DRE
      data_vencimento: isoVenc,      // vencimento → fluxo de caixa / contas a pagar
      descricao: `${beneficiario} - ${docKey}`,
      valor,
      tipo: "saida",
      origem: "boleto_dda",
      fingerprint_hash,
      tipo_origem: "boleto",
      impacta_dre: true,
      impacta_fluxo: true,
      cliente: beneficiario,
      status_pagamento,
      situacao_original: situacao,
      competenciaBr: brCompetencia,
      vencimentoBr: brVenc,
      doc_key: docKey,
    });
  }

  return { linhas };
}

function situacaoBadgeVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "PAGO" || s === "BAIXADO") return "default";
  if (s === "VENCIDO") return "destructive";
  return "secondary";
}

function situacaoBadgeClass(s: string): string {
  if (s === "PAGO" || s === "BAIXADO") return "bg-green-600 hover:bg-green-700 text-white";
  if (s === "ABERTO") return "bg-blue-600 hover:bg-blue-700 text-white";
  if (s === "VENCIDO") return "bg-red-600 hover:bg-red-700 text-white";
  return "";
}

export default function BoletosDDAImporter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<BoletoLinha[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLinhas([]);
  };

  const preview = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecione um arquivo .xlsx primeiro.");
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const { linhas: ls } = parseBoletosDDA(buffer);
      setLinhas(ls);
      if (!ls.length) {
        toast.warning("Nenhum boleto encontrado na planilha.");
      } else {
        toast.success(`${ls.length} boletos prontos para revisão.`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao processar a planilha.");
    }
  };

  const importar = async () => {
    if (!linhas.length) return;
    setImporting(true);
    try {
      // 1. Checagem de duplicatas
      const fingerprints = linhas.map((l) => l.fingerprint_hash);
      const hashsExistentes = new Set<string>();
      const CHUNK = 200;
      for (let i = 0; i < fingerprints.length; i += CHUNK) {
        const slice = fingerprints.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("movimentacoes_financeiras")
          .select("fingerprint_hash")
          .in("fingerprint_hash", slice);
        if (error) throw error;
        (data || []).forEach((d: any) => d.fingerprint_hash && hashsExistentes.add(d.fingerprint_hash));
      }

      const linhasNovas = linhas.filter((l) => !hashsExistentes.has(l.fingerprint_hash));
      const qtdIgnorados = linhas.length - linhasNovas.length;

      // 2. Conciliação com extrato Safra para boletos pendentes
      const pendentes = linhasNovas.filter((l) => l.status_pagamento === "pendente");
      // Agrupar por mês para reduzir queries
      const mesesValores = new Map<string, Set<number>>();
      for (const b of pendentes) {
        const mes = b.data.substring(0, 7);
        if (!mesesValores.has(mes)) mesesValores.set(mes, new Set());
        mesesValores.get(mes)!.add(b.valor);
      }
      // Cache de pagamentos por mês: Map<mes, Set<valor>>
      const pagamentosPorMes = new Map<string, Set<number>>();
      for (const mes of mesesValores.keys()) {
        const inicio = `${mes}-01`;
        // fim do mês
        const [y, m] = mes.split("-").map(Number);
        const fimDate = new Date(y, m, 0);
        const fim = `${mes}-${String(fimDate.getDate()).padStart(2, "0")}`;
        const { data, error } = await supabase
          .from("movimentacoes_financeiras")
          .select("valor")
          .eq("origem", "extrato_safra")
          .gte("data", inicio)
          .lte("data", fim);
        if (error) throw error;
        const set = new Set<number>();
        (data || []).forEach((d: any) => {
          const v = Math.abs(Number(d.valor) || 0);
          set.add(Number(v.toFixed(2)));
        });
        pagamentosPorMes.set(mes, set);
      }
      for (const b of pendentes) {
        const mes = b.data.substring(0, 7);
        const set = pagamentosPorMes.get(mes);
        if (set && set.has(Number(b.valor.toFixed(2)))) {
          b.status_pagamento = "pago";
        }
      }

      // 3. Insert
      if (linhasNovas.length > 0) {
        const payload = linhasNovas.map((l) => ({
          data: l.data,
          data_vencimento: l.data_vencimento,
          descricao: l.descricao,
          valor: l.valor,
          tipo: l.tipo,
          origem: l.origem,
          fingerprint_hash: l.fingerprint_hash,
          tipo_origem: l.tipo_origem,
          impacta_dre: l.impacta_dre,
          impacta_fluxo: l.impacta_fluxo,
          cliente: l.cliente,
          status_pagamento: l.status_pagamento,
        }));

        for (let i = 0; i < payload.length; i += 500) {
          const slice = payload.slice(i, i + 500);
          const { error } = await supabase.from("movimentacoes_financeiras").insert(slice);
          if (error) throw error;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["movimentacoes_financeiras"] });

      const qtdPagos = linhasNovas.filter((l) => l.status_pagamento === "pago").length;
      const qtdAbertos = linhasNovas.length - qtdPagos;

      toast.success(`✅ ${linhasNovas.length} boletos importados · ${qtdPagos} pagos · ${qtdAbertos} em aberto`);
      if (qtdIgnorados > 0) {
        toast.warning(`⚠️ ${qtdIgnorados} já existiam e foram ignorados`);
      }

      setLinhas([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      toast.error(err?.message || "Erro ao importar boletos.");
    } finally {
      setImporting(false);
    }
  };

  const totalCount = linhas.length;
  const grupo = (s: string) => linhas.filter((l) => l.situacao_original === s);
  const pagos = grupo("PAGO");
  const abertos = grupo("ABERTO");
  const vencidos = grupo("VENCIDO");
  const baixados = grupo("BAIXADO");
  const sum = (arr: BoletoLinha[]) => arr.reduce((s, l) => s + l.valor, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Boletos DDA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Arquivo Excel (.xlsx)</label>
            <Input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFile} />
            {fileName && <p className="text-xs text-muted-foreground mt-1">{fileName}</p>}
          </div>
          <Button onClick={preview} variant="outline" disabled={importing}>
            Pré-visualizar
          </Button>
          {linhas.length > 0 && (
            <Button onClick={importar} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importar
            </Button>
          )}
        </div>

        {linhas.length > 0 && (
          <>
            <div className="rounded-md border bg-muted/40 p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
              <span><strong>Total:</strong> {totalCount}</span>
              <span><strong>Pagos:</strong> {pagos.length} ({formatCurrency(sum(pagos))})</span>
              <span><strong>Em aberto:</strong> {abertos.length} ({formatCurrency(sum(abertos))})</span>
              <span><strong>Vencidos:</strong> {vencidos.length} ({formatCurrency(sum(vencidos))})</span>
              <span><strong>Baixados:</strong> {baixados.length} ({formatCurrency(sum(baixados))})</span>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Beneficiário</TableHead>
                    <TableHead>Nº Doc</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l, idx) => (
                    <TableRow key={`${l.fingerprint_hash}_${idx}`}>
                      <TableCell>{formatarData(l.data)}</TableCell>
                      <TableCell>{l.vencimentoBr}</TableCell>
                      <TableCell className="max-w-[280px] truncate" title={l.cliente}>{l.cliente}</TableCell>
                      <TableCell className="font-mono text-xs">{l.doc_key}</TableCell>
                      <TableCell className="text-right">{formatCurrency(l.valor)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={situacaoBadgeVariant(l.situacao_original)}
                          className={situacaoBadgeClass(l.situacao_original)}
                        >
                          {l.situacao_original}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={l.status_pagamento === "pago" ? "default" : "outline"}>
                          {l.status_pagamento}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
