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
  vencimento: string; // YYYY-MM-DD
  vencimentoBr: string; // DD/MM/YYYY
  num_documento: string;
  nosso_numero: string;
  doc_key: string;
  cliente: string;
  valor_nominal: number;
  valor_total: number;
  valor: number;
  situacao: Situacao;
  status_pagamento: "pago" | "pendente";
  fingerprint_hash: string;
}

function normalizeHeader(value: string): string {
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
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (m) {
    const yy = m[3].length === 2 ? "20" + m[3] : m[3];
    return { iso: `${yy}-${m[2]}-${m[1]}`, br: `${m[1]}/${m[2]}/${yy}` };
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { iso: `${iso[1]}-${iso[2]}-${iso[3]}`, br: `${iso[3]}/${iso[2]}/${iso[1]}` };
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

function buildFingerprint(docKey: string, cliente: string): string {
  const slug = (cliente || "").substring(0, 25).toLowerCase().replace(/ /g, "_");
  return `boleto_${docKey}_${slug}`;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function parseBoletosDDA(buffer: ArrayBuffer): { linhas: BoletoLinha[]; ignoradosBaixado: number } {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const jsonRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" }) as any[][];

  let headerIdx = -1;
  let headerMap: Record<string, number> = {};
  for (let i = 0; i < Math.min(jsonRows.length, 20); i++) {
    const cols = (jsonRows[i] ?? []).map((c) => normalizeHeader(String(c ?? "")));
    if (cols.includes("vencimento") && cols.some((c) => c.includes("situacao"))) {
      headerIdx = i;
      headerMap = Object.fromEntries(cols.map((c, idx) => [c, idx]));
      break;
    }
  }
  if (headerIdx < 0) return { linhas: [], ignoradosBaixado: 0 };

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
  const iNumDoc = findIdx("N documento", "Nº documento", "No documento", "numero documento", "n documento");
  const iNosso = findIdx("Nosso numero", "Nosso número");
  const iBenef = findIdx("Beneficiario", "Beneficiário");
  const iNominal = findIdx("Nominal R", "Nominal", "Nominal (R$)");
  const iTotal = findIdx("Valor Total R", "Valor Total", "Valor Total (R$)");
  const iSit = findIdx("Situacao", "Situação");

  const linhas: BoletoLinha[] = [];
  let ignoradosBaixado = 0;

  for (let i = headerIdx + 1; i < jsonRows.length; i++) {
    const row = jsonRows[i] ?? [];
    if (!row.some((c) => String(c ?? "").trim() !== "")) continue;

    const situacao = String(row[iSit] ?? "").trim().toUpperCase();
    if (!situacao) continue;
    if (situacao === "BAIXADO") {
      ignoradosBaixado++;
      continue;
    }

    const { iso, br } = parseDataBR(row[iVenc]);
    if (!iso) continue;

    const num_documento = String(row[iNumDoc] ?? "").trim();
    const nosso_numero = String(row[iNosso] ?? "").trim();
    const doc_key = num_documento || nosso_numero;
    if (!doc_key) continue;

    const cliente = String(row[iBenef] ?? "").trim() || "Sem beneficiário";
    const valor_nominal = parseValor(row[iNominal]);
    const valor_total = parseValor(row[iTotal]);
    const valor = situacao === "VENCIDO" && valor_total > 0 ? valor_total : valor_nominal;
    if (!(valor > 0)) continue;

    const status_pagamento: "pago" | "pendente" = situacao === "PAGO" ? "pago" : "pendente";

    linhas.push({
      vencimento: iso,
      vencimentoBr: br,
      num_documento,
      nosso_numero,
      doc_key,
      cliente,
      valor_nominal,
      valor_total,
      valor,
      situacao,
      status_pagamento,
      fingerprint_hash: buildFingerprint(doc_key, cliente),
    });
  }

  return { linhas, ignoradosBaixado };
}

export default function BoletosDDAImporter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<BoletoLinha[]>([]);
  const [ignoradosBaixado, setIgnoradosBaixado] = useState(0);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLinhas([]);
    setIgnoradosBaixado(0);
  };

  const preview = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecione um arquivo .xlsx primeiro.");
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const { linhas: ls, ignoradosBaixado: ig } = parseBoletosDDA(buffer);
      setLinhas(ls);
      setIgnoradosBaixado(ig);
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
      const fingerprints = linhas.map((l) => l.fingerprint_hash);
      const hashsExistentes = new Set<string>();
      // chunk para evitar URLs grandes
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

      const novas = linhas.filter((l) => !hashsExistentes.has(l.fingerprint_hash));
      const qtdIgnorados = linhas.length - novas.length;

      if (novas.length > 0) {
        const payload = novas.map((l) => ({
          data: l.vencimento,
          data_vencimento: l.vencimento,
          descricao: `${l.cliente} - ${l.doc_key}`,
          valor: l.valor,
          tipo: "saida" as const,
          origem: "boleto_dda",
          fingerprint_hash: l.fingerprint_hash,
          tipo_origem: "boleto",
          impacta_dre: true,
          impacta_fluxo: true,
          cliente: l.cliente,
          status_pagamento: l.status_pagamento,
        }));

        // insert in chunks
        for (let i = 0; i < payload.length; i += 500) {
          const slice = payload.slice(i, i + 500);
          const { error } = await supabase.from("movimentacoes_financeiras").insert(slice);
          if (error) throw error;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["movimentacoes_financeiras"] });

      if (qtdIgnorados === 0) {
        toast.success(`✅ ${novas.length} boletos importados com sucesso.`);
      } else {
        toast.warning(`✅ ${novas.length} importados · ⚠️ ${qtdIgnorados} já existiam e foram ignorados.`);
      }

      setLinhas([]);
      setIgnoradosBaixado(0);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      toast.error(err?.message || "Erro ao importar boletos.");
    } finally {
      setImporting(false);
    }
  };

  const totalCount = linhas.length;
  const pagos = linhas.filter((l) => l.situacao === "PAGO");
  const abertos = linhas.filter((l) => l.situacao === "ABERTO");
  const vencidos = linhas.filter((l) => l.situacao === "VENCIDO");
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
            <Input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={onFile}
            />
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
              <span><strong>Total:</strong> {totalCount} boletos</span>
              <span><strong>Pagos:</strong> {pagos.length} ({formatCurrency(sum(pagos))})</span>
              <span><strong>Em aberto:</strong> {abertos.length} ({formatCurrency(sum(abertos))})</span>
              <span><strong>Vencidos:</strong> {vencidos.length} ({formatCurrency(sum(vencidos))})</span>
              <span><strong>Ignorados (BAIXADO):</strong> {ignoradosBaixado}</span>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                      <TableCell>{formatarData(l.vencimento)}</TableCell>
                      <TableCell className="max-w-[280px] truncate" title={l.cliente}>{l.cliente}</TableCell>
                      <TableCell className="font-mono text-xs">{l.doc_key}</TableCell>
                      <TableCell className="text-right">{formatCurrency(l.valor)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            l.situacao === "PAGO" ? "default" :
                            l.situacao === "VENCIDO" ? "destructive" :
                            "secondary"
                          }
                        >
                          {l.situacao}
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
