import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Upload, Sparkles, Check, Loader2, FileText, ChevronsUpDown, ArrowUpDown, AlertTriangle, CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VindiImporter from "@/components/VindiImporter";
import BoletosDDAImporter from "@/components/BoletosDDAImporter";
import { NovaCategoriaDialog } from "@/components/NovaCategoriaDialog";
import { Plus } from "lucide-react";
import { useCategorias, useCartoesCredito, useMovimentacoesFinanceiras } from "@/hooks/useSupabase";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatarData } from "@/utils/formatters";

function gerarFingerprint(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36) + '_' + str.length;
}

function fingerprintExtrato(data: string, valor: number, descricao: string): string {
  return 'ext_' + gerarFingerprint(`${data}|${valor.toFixed(2)}|${descricao.trim().toLowerCase()}`);
}

function fingerprintCartao(vencimento: string, valor: number, estabelecimento: string, parcela: string | null): string {
  const mes = (vencimento || '').slice(0, 7);
  const numParcela = parcela?.split('/')[0] ?? '1';
  return 'cc_' + gerarFingerprint(`${mes}|${valor.toFixed(2)}|${estabelecimento.trim().toLowerCase()}|${numParcela}`);
}



interface ParsedRow {
  data: string;
  data_vencimento: string | null;
  descricao: string;
  valor: number;
  categoria_id: string | null;
  categoria_sugerida: string | null;
  tipo: "entrada" | "saida";
  frequencia: string | null;
  frequencia_tipo: string | null;
  frequencia_meses: number | null;
  parcela_atual: number | null;
  parcela_total: number | null;
  selecionado: boolean;
  fingerprint_hash?: string;
  origem_override?: string;
  possivel_duplicata?: boolean;
}

// Detect installment info from description: "2/12", "PARCELA 2 DE 12", "2 DE 12", etc.
function detectParcela(desc: string): { atual: number; total: number } | null {
  // Pattern: "1/12", "02/12"
  const m1 = desc.match(/(\d{1,2})\/(\d{1,2})(?!\d)/);
  if (m1) {
    const a = parseInt(m1[1]), t = parseInt(m1[2]);
    if (a >= 1 && t >= 2 && a <= t && t <= 48) return { atual: a, total: t };
  }
  // Pattern: "PARCELA 1 DE 12", "parc 1 de 12"
  const m2 = desc.match(/parc(?:ela)?\s*(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/i);
  if (m2) {
    const a = parseInt(m2[1]), t = parseInt(m2[2]);
    if (a >= 1 && t >= 2 && a <= t && t <= 48) return { atual: a, total: t };
  }
  return null;
}

function parseDate(raw: string): string {
  const parts = raw.trim().split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y.length === 2 ? "20" + y : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) return raw.trim().substring(0, 10);
  return raw.trim();
}

function converterDataCSV(data: string): string {
  if (!data) return "";
  const trim = data.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trim)) return trim;
  const [dia, mes, ano] = trim.split("/");
  if (!dia || !mes || !ano) return trim;
  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

function converterValorBR(valor: string): number {
  const limpo = valor
    .replace(/R\$\s*/g, "")
    .replace(/-/g, "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(limpo) || 0;
}

function converterValorExcel(valor: any): number {
  if (typeof valor === "number") return valor;
  return converterValorBR(String(valor));
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function detectDelimiter(line: string): ";" | "," {
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function getValueFromHeader(row: string[], headerMap: Record<string, number>, aliases: string[]): string {
  for (const alias of aliases) {
    const idx = headerMap[normalizeHeader(alias)];
    if (idx !== undefined) {
      return String(row[idx] ?? "").trim();
    }
  }
  return "";
}

function normalizeDateForDb(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function normalizeNumberForDb(raw: number | string): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}$/.test(value)) return NaN;
  const sanitized = value.replace(/[^\d.,-]/g, "");
  if (!sanitized) return NaN;
  const normalized = sanitized.includes(",") && sanitized.includes(".")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().substring(0, 10);
}

function parseCSVSafra(text: string): ParsedRow[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const rows: ParsedRow[] = [];

  for (const line of lines) {
    const sep = line.includes(";") ? ";" : ",";
    const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols[0]?.toLowerCase().includes("data") || cols[0]?.toLowerCase().includes("date")) continue;
    if (cols.length < 2) continue;
    const dateCandidate = cols[0];
    if (!/\d/.test(dateCandidate)) continue;

    const data = parseDate(dateCandidate);
    const descricao = cols[1] || "Sem descrição";
    let valor = 0;
    for (let i = cols.length - 1; i >= 1; i--) {
      const cleaned = cols[i].replace(/[R$\s.]/g, "").replace(",", ".");
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num !== 0) { valor = num; break; }
    }
    if (!data || valor === 0) continue;

    const parcela = detectParcela(descricao);

    rows.push({
      data,
      data_vencimento: null,
      descricao,
      valor: Math.abs(valor),
      tipo: valor < 0 ? "saida" : "entrada",
      categoria_id: null,
      categoria_sugerida: null,
      frequencia: null,
      frequencia_tipo: null,
      frequencia_meses: null,
      parcela_atual: parcela?.atual ?? null,
      parcela_total: parcela?.total ?? null,
      selecionado: true,
    });
  }
  return rows;
}

// Safra "Extrato" sheet: Data | Situação | Tipo do Lançamento | Lançamento | Complemento | Nº Documento | Valor
function parseSafraExtrato(buffer: ArrayBuffer): ParsedRow[] | null {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  // Prefer sheet literally named "Extrato"
  const sheetName = wb.SheetNames.find((n) => normalizeHeader(n) === "extrato") ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;
  const grid = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" }) as any[][];

  // Locate header row containing the Safra Extrato columns
  let headerIndex = -1;
  let headerMap: Record<string, number> = {};
  const required = ["data", "situacao", "tipo do lancamento", "lancamento", "valor"];
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const cols = (grid[i] ?? []).map((c) => normalizeHeader(String(c ?? "")));
    if (required.every((r) => cols.some((c) => c === r || c.includes(r)))) {
      headerIndex = i;
      headerMap = Object.fromEntries(cols.map((c, idx) => [c, idx]));
      break;
    }
  }
  if (headerIndex < 0) return null;

  const findIdx = (...keys: string[]): number => {
    for (const k of keys) {
      const nk = normalizeHeader(k);
      for (const headerKey of Object.keys(headerMap)) {
        if (headerKey === nk || headerKey.includes(nk)) return headerMap[headerKey];
      }
    }
    return -1;
  };
  const iData = findIdx("data");
  const iLanc = findIdx("lancamento");
  const iCompl = findIdx("complemento");
  const iNumDoc = findIdx("n documento", "no documento", "numero documento", "n° documento", "nº documento", "documento");
  const iValor = findIdx("valor");

  const rows: ParsedRow[] = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cols = grid[i] ?? [];
    if (!cols.some((c) => String(c ?? "").trim() !== "")) continue;

    const rawData = cols[iData];
    const dataIso = excelDateToString(rawData);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) continue;

    const valorNum = converterValorExcel(cols[iValor]);
    if (!Number.isFinite(valorNum) || valorNum === 0) continue;
    const tipo: "entrada" | "saida" = valorNum < 0 ? "saida" : "entrada";
    const valorAbs = Math.abs(valorNum);

    const lanc = String(cols[iLanc] ?? "").trim();
    let compl = iCompl >= 0 ? String(cols[iCompl] ?? "").trim() : "";
    // Drop placeholder values and avoid duplicating Lançamento
    if (compl && ["nan", "null", "-", "--", "0"].includes(compl.toLowerCase())) compl = "";
    if (compl && compl.toLowerCase() === lanc.toLowerCase()) compl = "";
    // Never include generic "Débito" or "Crédito" as the Lançamento prefix
    const lancLower = lanc.toLowerCase();
    const isGenericLanc = lancLower === "débito" || lancLower === "debito" || lancLower === "crédito" || lancLower === "credito";
    let descricao = (compl && !isGenericLanc ? `${lanc} — ${compl}` : (isGenericLanc ? compl : lanc)).trim() || "Sem descrição";
    // Safety: strip any accidental "Débito — " or "Crédito — " prefix
    descricao = descricao.replace(/^d[eé]bito\s*[—-]\s*/i, "").replace(/^cr[eé]dito\s*[—-]\s*/i, "");

    const numDoc = iNumDoc >= 0 ? String(cols[iNumDoc] ?? "").trim() : "";
    const descSlug = descricao.substring(0, 20).toLowerCase().replace(/\s+/g, "_");
    const fp = `safra_${dataIso}_${numDoc || valorAbs.toFixed(2)}_${descSlug}`;

    rows.push({
      data: dataIso,
      data_vencimento: dataIso,
      descricao,
      valor: valorAbs,
      tipo,
      categoria_id: null,
      categoria_sugerida: null,
      frequencia: null,
      frequencia_tipo: null,
      frequencia_meses: null,
      parcela_atual: null,
      parcela_total: null,
      selecionado: true,
      fingerprint_hash: fp,
      origem_override: "extrato_safra",
    });
  }

  return rows.length > 0 ? rows : null;
}

function parseExcelFile(buffer: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  const rows: ParsedRow[] = [];

  for (const row of jsonRows) {
    const rawVals = Object.values(row);
    const vals = rawVals.map((v) => String(v ?? "").trim());
    if (vals.length < 2) continue;
    const dateCandidate = vals[0];
    if (!/\d/.test(dateCandidate)) continue;
    if (dateCandidate.toLowerCase().includes("data")) continue;

    const data = parseDate(dateCandidate);
    const descricao = vals[1] || "Sem descrição";
    let valor = 0;
    for (let i = rawVals.length - 1; i >= 1; i--) {
      const raw = rawVals[i];
      // If it's already a number from Excel, use it directly
      if (typeof raw === "number" && raw !== 0 && Number.isFinite(raw)) {
        valor = raw;
        break;
      }
      // Otherwise try to parse as Brazilian formatted string
      const num = converterValorBR(String(raw));
      if (num !== 0) { valor = num; break; }
    }
    if (!data || valor === 0) continue;

    const parcela = detectParcela(descricao);
    rows.push({
      data,
      data_vencimento: null,
      descricao,
      valor: Math.abs(valor),
      tipo: valor < 0 ? "saida" : "entrada",
      categoria_id: null,
      categoria_sugerida: null,
      frequencia: null,
      frequencia_tipo: null,
      frequencia_meses: null,
      parcela_atual: parcela?.atual ?? null,
      parcela_total: parcela?.total ?? null,
      selecionado: true,
    });
  }
  return rows;
}

function excelDateToString(val: any): string {
  if (val instanceof Date) {
    const d = val;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (typeof val === "number" && val > 30000 && val < 60000) {
    // Excel serial date number
    const d = new Date((val - 25569) * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return converterDataCSV(String(val ?? "").trim());
}

function parseExcelSafra(buffer: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", header: 1 }) as any[][];
  const rows: ParsedRow[] = [];

  let headerIndex = -1;
  let headerMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(jsonRows.length, 10); i++) {
    const cols = jsonRows[i] ?? [];
    const normalized = cols.map((col) => normalizeHeader(String(col ?? "")));
    if (normalized.some((col) => col.includes("valor")) && normalized.some((col) => col.includes("data"))) {
      headerIndex = i;
      headerMap = Object.fromEntries(normalized.map((col, idx) => [col, idx]));
      break;
    }
  }

  const isPagamentoLayout = Object.keys(headerMap).some((key) =>
    key.includes("favorecido") || key.includes("beneficiario") || key.includes("data pagamento")
  );

  for (let i = headerIndex >= 0 ? headerIndex + 1 : 0; i < jsonRows.length; i++) {
    const cols = jsonRows[i] ?? [];
    if (!cols.some((col) => String(col ?? "").trim() !== "")) continue;

    const rawDataPagamento = headerIndex >= 0
      ? getValueFromHeader(cols.map((col) => String(col ?? "")), headerMap, ["Data pagamento", "Data Pagamento", "Data"])
      : String(cols[0] ?? "");
    const rawDataCompetencia = headerIndex >= 0
      ? getValueFromHeader(cols.map((col) => String(col ?? "")), headerMap, ["Data competência", "Data Competencia", "Data pagamento", "Data Pagamento", "Data"])
      : String(cols[1] ?? cols[0] ?? "");
    const descricao = headerIndex >= 0
      ? getValueFromHeader(cols.map((col) => String(col ?? "")), headerMap, ["Favorecido / Beneficiário", "Favorecido / Beneficiario", "Descrição", "Descricao"])
      : String(cols[2] ?? cols[1] ?? "");
    const valorBruto = headerIndex >= 0
      ? cols[headerMap[normalizeHeader("Valor")]]
      : cols[3] ?? cols[2];

    const dataPagamento = excelDateToString(rawDataPagamento);
    const dataCompetencia = excelDateToString(rawDataCompetencia || rawDataPagamento);
    const valor = converterValorExcel(valorBruto);

    if (!dataCompetencia.match(/^\d{4}-\d{2}-\d{2}$/) || valor === 0) continue;

    rows.push({
      data: dataCompetencia,
      data_vencimento: (dataPagamento || dataCompetencia) || null,
      descricao: String(descricao ?? "").trim() || "Sem descrição",
      valor: Math.abs(valor),
      tipo: isPagamentoLayout ? "saida" : valor < 0 ? "saida" : "entrada",
      categoria_id: null,
      categoria_sugerida: null,
      frequencia: null,
      frequencia_tipo: null,
      frequencia_meses: null,
      parcela_atual: null,
      parcela_total: null,
      selecionado: true,
    });
  }

  return rows;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '"') {
      if (inQuotes && line[j + 1] === '"') {
        current += '"';
        j++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseVindiTransacoes(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows: ParsedRow[] = [];
  if (lines.length === 0) return rows;

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCSVLine(lines[0], delimiter).map((col) => col.replace(/^"|"$/g, "").trim());
  const headerMap = Object.fromEntries(header.map((col, idx) => [normalizeHeader(col), idx]));

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delimiter).map((col) => col.replace(/^"|"$/g, "").trim());
    if (!cols.some((col) => col)) continue;

    const dataTransacao = converterDataCSV(
      getValueFromHeader(cols, headerMap, ["Data da Transação", "Data Competência", "Data Competencia"])
    );
    const cliente = getValueFromHeader(cols, headerMap, ["Cliente"]);
    const valor = converterValorBR(getValueFromHeader(cols, headerMap, ["Valor Pago"]));
    const dataCredito = converterDataCSV(getValueFromHeader(cols, headerMap, ["Data Credito", "Data Crédito"]));

    if (!dataTransacao || valor === 0) continue;

    rows.push({
      data: dataTransacao,
      data_vencimento: dataCredito || null,
      descricao: cliente ? `Venda de Produtos - ${cliente}` : "Venda de Produtos - Vindi",
      valor: Math.abs(valor),
      tipo: "entrada",
      categoria_id: null,
      categoria_sugerida: null,
      frequencia: null,
      frequencia_tipo: null,
      frequencia_meses: null,
      parcela_atual: null,
      parcela_total: null,
      selecionado: true,
    });
  }
  return rows;
}

function parseVindiTaxas(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows: ParsedRow[] = [];
  if (lines.length === 0) return rows;

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCSVLine(lines[0], delimiter).map((col) => col.replace(/^"|"$/g, "").trim());
  const headerMap = Object.fromEntries(header.map((col, idx) => [normalizeHeader(col), idx]));

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delimiter).map((col) => col.replace(/^"|"$/g, "").trim());
    if (!cols.some((col) => col)) continue;

    const dataTransacao = converterDataCSV(
      getValueFromHeader(cols, headerMap, ["Data da Transação", "Data Competência", "Data Competencia"])
    );
    const cliente = getValueFromHeader(cols, headerMap, ["Cliente"]);
    const valor = converterValorBR(getValueFromHeader(cols, headerMap, ["Taxa"]));
    const dataDebito = converterDataCSV(getValueFromHeader(cols, headerMap, ["Data Débito", "Data Debito"]));

    if (!dataTransacao || valor === 0) continue;

    rows.push({
      data: dataTransacao,
      data_vencimento: dataDebito || null,
      descricao: cliente ? `Taxa TrayPagamentos (Vindi) - ${cliente}` : "Taxa TrayPagamentos (Vindi)",
      valor: Math.abs(valor),
      tipo: "saida",
      categoria_id: null,
      categoria_sugerida: null,
      frequencia: null,
      frequencia_tipo: null,
      frequencia_meses: null,
      parcela_atual: null,
      parcela_total: null,
      selecionado: true,
    });
  }
  return rows;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function SearchableCategory({
  categorias,
  catMap,
  value,
  sugerida,
  onChange,
}: {
  categorias: { grupo: string; itens: { id: string; label: string }[] }[];
  catMap: Record<string, string>;
  value: string | null;
  sugerida: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const displayLabel = value ? (catMap[value] || "Selecionar") : (sugerida || "Sem categoria");

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-[200px] justify-between text-xs font-normal truncate">
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar categoria..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
            <CommandItem onSelect={() => { onChange(null); setOpen(false); }}>
              Sem categoria
            </CommandItem>
            {categorias.map(({ grupo, itens }) => (
              <CommandGroup key={grupo} heading={grupo}>
                {itens.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${grupo} ${item.label}`}
                    onSelect={() => { onChange(item.id); setOpen(false); }}
                    className={cn("text-xs", value === item.id && "font-semibold")}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandGroup>
              <CommandItem
                value="__nova_categoria__"
                onSelect={() => { setOpen(false); setNovaOpen(true); }}
                className="text-xs text-primary font-medium"
              >
                <Plus className="h-3 w-3 mr-1" /> Criar nova categoria
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    <NovaCategoriaDialog
      open={novaOpen}
      onOpenChange={setNovaOpen}
      onCreated={(id) => onChange(id)}
    />
    </>
  );
}

export default function ImportarExtrato() {
  const { data: categorias } = useCategorias();
  const { data: cartoes = [] } = useCartoesCredito();
  const { data: movsExistentes } = useMovimentacoesFinanceiras();
  const queryClient = useQueryClient();
  const [importTab, setImportTab] = useState<string>("extrato");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isCategorizando, setIsCategorizando] = useState(false);
  const [isSalvando, setIsSalvando] = useState(false);
  const [banco, setBanco] = useState("generico");
  const [cartaoSelecionado, setCartaoSelecionado] = useState("");
  const [cartaoNomeManual, setCartaoNomeManual] = useState("");
  const [faturaVencimento, setFaturaVencimento] = useState("");
  const [bancoCartao, setBancoCartao] = useState("");
  const [valorTotalFatura, setValorTotalFatura] = useState("");
  const [sortField, setSortField] = useState<"data" | "descricao" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkNovaCategoriaOpen, setBulkNovaCategoriaOpen] = useState(false);
  const [validacao, setValidacao] = useState<{ tipo: "ok" | "divergente"; qtd: number; total: number; divergencia?: number; valorInformado?: number } | null>(null);
  const [duplicatasAlert, setDuplicatasAlert] = useState<{ count: number; items: string[] } | null>(null);
  const [salvarAposDuplicata, setSalvarAposDuplicata] = useState(false);
  const [isCategorizandoHistorico, setIsCategorizandoHistorico] = useState(false);

  // Build a map of description -> categoria_id from historical transactions
  const historicoCategoria = useMemo(() => {
    const map: Record<string, string> = {};
    const keywordIndex: Array<{ tokens: string[]; categoria_id: string }> = [];
    if (!movsExistentes) return { map, keywordIndex };
    const STOPWORDS = new Set([
      "pix", "ted", "doc", "enviado", "enviada", "recebido", "recebida",
      "pagamento", "boleto", "transferencia", "transferência", "debito", "débito",
      "credito", "crédito", "compra", "saque", "deposito", "depósito",
      "de", "da", "do", "dos", "das", "em", "para", "por", "com", "sem",
      "a", "o", "e", "ao", "as", "os", "no", "na", "um", "uma",
      "ltda", "sa", "s.a", "cia", "me", "eireli", "epp",
      "conta", "corrente", "cnpj", "cpf", "ref", "parc", "parcela",
      "fatura", "cartao", "cartão", "extrato", "safra", "documento",
    ]);
    const extractTokens = (desc: string): string[] => {
      const norm = desc
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ");
      return Array.from(new Set(
        norm.split(/\s+/).filter((t) => t.length >= 4 && !STOPWORDS.has(t))
      ));
    };
    // Process most recent first so latest categorization wins
    const sorted = [...movsExistentes].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    sorted.forEach((m) => {
      if (m.categoria_id && m.descricao) {
        const descNorm = m.descricao
          .replace(/\s*\(\d+\/[∞\d]+\)\s*$/, "")
          .replace(/\s*\d+\/\d+\s*$/, "")
          .replace(/💳\s*/, "")
          .trim().toLowerCase();
        if (descNorm && !map[descNorm]) {
          map[descNorm] = m.categoria_id;
        }
        const tokens = extractTokens(m.descricao);
        if (tokens.length > 0) {
          keywordIndex.push({ tokens, categoria_id: m.categoria_id });
        }
      }
    });
    return { map, keywordIndex };
  }, [movsExistentes]);

  // Build a set of existing transaction keys for duplicate detection
  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    (movsExistentes ?? []).forEach(m => {
      if (m.data && m.descricao) {
        keys.add(`${m.data}|${Math.abs(m.valor).toFixed(2)}|${m.descricao.trim().toLowerCase()}`);
      }
    });
    return keys;
  }, [movsExistentes]);

  // Auto-categorize parsed rows from history (exact match → keyword match)
  const autoCategorizeFromHistory = useCallback((parsedRows: ParsedRow[]): ParsedRow[] => {
    const { map, keywordIndex } = historicoCategoria;
    const STOPWORDS = new Set([
      "pix", "ted", "doc", "enviado", "enviada", "recebido", "recebida",
      "pagamento", "boleto", "transferencia", "transferência", "debito", "débito",
      "credito", "crédito", "compra", "saque", "deposito", "depósito",
      "de", "da", "do", "dos", "das", "em", "para", "por", "com", "sem",
      "a", "o", "e", "ao", "as", "os", "no", "na", "um", "uma",
      "ltda", "sa", "s.a", "cia", "me", "eireli", "epp",
      "conta", "corrente", "cnpj", "cpf", "ref", "parc", "parcela",
      "fatura", "cartao", "cartão", "extrato", "safra", "documento",
    ]);
    const tokensOf = (desc: string): string[] => {
      const norm = desc
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ");
      return Array.from(new Set(
        norm.split(/\s+/).filter((t) => t.length >= 4 && !STOPWORDS.has(t))
      ));
    };
    let autoCount = 0;
    const result = parsedRows.map((r) => {
      if (r.categoria_id) return r;
      const descNorm = r.descricao
        .replace(/\s*\(\d+\/[∞\d]+\)\s*$/, "")
        .replace(/\s*\d+\/\d+\s*$/, "")
        .replace(/💳\s*/, "")
        .trim().toLowerCase();
      // 1) Exact match
      const exact = map[descNorm];
      if (exact) {
        autoCount++;
        return { ...r, categoria_id: exact, categoria_sugerida: "Auto (histórico)" };
      }
      // 2) Keyword match — pick history entry sharing any significant token
      const rowTokens = tokensOf(r.descricao);
      if (rowTokens.length === 0) return r;
      for (const entry of keywordIndex) {
        if (entry.tokens.some((t) => rowTokens.includes(t))) {
          autoCount++;
          return { ...r, categoria_id: entry.categoria_id, categoria_sugerida: "Auto (histórico)" };
        }
      }
      return r;
    });
    if (autoCount > 0) {
      toast.info(`${autoCount} lançamento(s) categorizado(s) automaticamente pelo histórico`);
    }
    return result;
  }, [historicoCategoria]);

  // Verify if there's a registered "frequencia" matching the row description.
  // - If matched and the same month already has an entry → mark as possivel_duplicata (unchecked).
  // - If matched but no entry this month → pre-fill frequencia + categoria_id from history.
  const verificarFrequenciasCadastradas = useCallback(async (parsedRows: ParsedRow[]): Promise<ParsedRow[]> => {
    try {
      const { data: comFrequencia } = await supabase
        .from("movimentacoes_financeiras")
        .select("descricao, frequencia, frequencia_meses, frequencia_tipo, categoria_id")
        .not("frequencia", "is", null)
        .neq("frequencia", "unica");

      if (!comFrequencia || comFrequencia.length === 0) return parsedRows;

      const result: ParsedRow[] = [];
      let duplicadasCount = 0;
      let freqPreenchidasCount = 0;

      for (const linha of parsedRows) {
        const palavras = (linha.descricao || "")
          .toLowerCase()
          .split(/[\s—\-]+/)
          .filter((p) => p.length > 4);

        const match = comFrequencia.find((h: any) => {
          const hDesc = (h.descricao || "").toLowerCase();
          return palavras.some((p) => hDesc.includes(p));
        });

        if (!match) {
          result.push(linha);
          continue;
        }

        const mesAno = (linha.data || "").substring(0, 7); // "YYYY-MM"
        const primeiraPalavra = (match.descricao || "").split(" ")[0] || "";

        let jaExisteNoMes = false;
        if (mesAno && primeiraPalavra) {
          const { data: jaExiste } = await supabase
            .from("movimentacoes_financeiras")
            .select("id")
            .ilike("descricao", `%${primeiraPalavra}%`)
            .gte("data", `${mesAno}-01`)
            .lte("data", `${mesAno}-31`)
            .limit(1);
          jaExisteNoMes = !!(jaExiste && jaExiste.length > 0);
        }

        if (jaExisteNoMes) {
          duplicadasCount++;
          result.push({ ...linha, possivel_duplicata: true, selecionado: false });
        } else {
          freqPreenchidasCount++;
          result.push({
            ...linha,
            frequencia: match.frequencia ?? linha.frequencia,
            frequencia_tipo: match.frequencia_tipo ?? linha.frequencia_tipo,
            frequencia_meses: match.frequencia_meses ?? linha.frequencia_meses,
            categoria_id: linha.categoria_id || match.categoria_id || null,
          });
        }
      }

      if (duplicadasCount > 0) {
        toast.warning(`⚠️ ${duplicadasCount} possível(is) duplicata(s) de lançamento recorrente — desmarcadas automaticamente`);
      }
      if (freqPreenchidasCount > 0) {
        toast.info(`🔁 ${freqPreenchidasCount} lançamento(s) com frequência pré-preenchida pelo histórico`);
      }
      return result;
    } catch (err) {
      console.error("Erro ao verificar frequências cadastradas:", err);
      return parsedRows;
    }
  }, []);

  // Wrapper: auto-categorize + verify frequencies, then set rows
  const processarLinhas = useCallback(async (parsed: ParsedRow[]) => {
    const categorizadas = autoCategorizeFromHistory(parsed);
    const finais = await verificarFrequenciasCadastradas(categorizadas);
    setRows(finais);
  }, [autoCategorizeFromHistory, verificarFrequenciasCadastradas]);


  // Check for duplicates
  const checkDuplicates = useCallback((parsedRows: ParsedRow[]): { count: number; items: string[] } => {
    const dupes: string[] = [];
    parsedRows.filter(r => r.selecionado).forEach(r => {
      const key = `${r.data}|${Math.abs(r.valor).toFixed(2)}|${r.descricao.trim().toLowerCase()}`;
      if (existingKeys.has(key)) {
        dupes.push(`${r.descricao} (${r.data} - R$ ${r.valor.toFixed(2)})`);
      }
    });
    return { count: dupes.length, items: dupes.slice(0, 10) };
  }, [existingKeys]);

  const isCartao = banco === "cartao";
  const cartaoNomeFinal = useMemo(() => {
    if (!isCartao) return "";
    if (cartaoSelecionado === "__manual") return cartaoNomeManual.trim();
    const found = cartoes.find((c: any) => c.id === cartaoSelecionado);
    return found?.nome || "";
  }, [isCartao, cartaoSelecionado, cartaoNomeManual, cartoes]);

  // Auto-fill vencimento from selected card
  const handleCartaoChange = (val: string) => {
    setCartaoSelecionado(val);
    if (val !== "__manual") {
      const card = cartoes.find((c: any) => c.id === val);
      if (card && !faturaVencimento) {
        // Auto-suggest next month's vencimento based on dia_vencimento
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, card.dia_vencimento);
        setFaturaVencimento(nextMonth.toISOString().substring(0, 10));
      }
    }
  };

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Pre-lookup Vindi categories with fallback
    let vindiPreCategoriaId: string | null = null;
    if (banco === "vindi_transacoes") {
      // Try descricao_categoria first, then nome_categoria as fallback
      let { data: cat } = await supabase
        .from("categorias_financeiras")
        .select("id")
        .eq("descricao_categoria", "Venda de produtos")
        .eq("grupo_dre", "RECEITAS")
        .maybeSingle();
      if (!cat) {
        const { data: fallback } = await supabase
          .from("categorias_financeiras")
          .select("id")
          .eq("nome_categoria", "Receita com Vendas")
          .eq("grupo_dre", "RECEITAS")
          .limit(1)
          .maybeSingle();
        cat = fallback;
      }
      vindiPreCategoriaId = cat?.id ?? null;
    } else if (banco === "vindi_taxas") {
      let { data: cat } = await supabase
        .from("categorias_financeiras")
        .select("id")
        .eq("descricao_categoria", "Taxa TrayPagamentos (Vindi)")
        .eq("grupo_dre", "DEDUÇÕES SOBRE VENDAS")
        .maybeSingle();
      if (!cat) {
        const { data: fallback } = await supabase
          .from("categorias_financeiras")
          .select("id")
          .eq("nome_categoria", "Taxas de Gateway")
          .eq("grupo_dre", "DEDUÇÕES SOBRE VENDAS")
          .limit(1)
          .maybeSingle();
        cat = fallback;
      }
      vindiPreCategoriaId = cat?.id ?? null;
    }


    if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
      let text: string;
      if (banco === "vindi_transacoes" || banco === "vindi_taxas") {
        // Vindi uses latin1 encoding
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder("latin1");
        text = decoder.decode(buffer);
      } else {
        text = await file.text();
      }

      let parsed: ParsedRow[];
      if (banco === "vindi_transacoes") {
        parsed = parseVindiTransacoes(text);
      } else if (banco === "vindi_taxas") {
        parsed = parseVindiTaxas(text);
      } else {
        parsed = parseCSVSafra(text);
      }

      if (parsed.length === 0) {
        toast.error("Nenhum lançamento encontrado no arquivo. Verifique o formato.");
        return;
      }
      if (vindiPreCategoriaId) {
        parsed = parsed.map((r) => ({ ...r, categoria_id: vindiPreCategoriaId }));
      }
      await processarLinhas(parsed);
      const parcelados = parsed.filter((r) => r.parcela_total);
      toast.success(`${parsed.length} lançamentos importados${parcelados.length > 0 ? ` (${parcelados.length} parcelados detectados)` : ""}`);
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const buffer = await file.arrayBuffer();
      const safraExtrato = parseSafraExtrato(buffer);
      const parsed = safraExtrato ?? (banco === "safra" ? parseExcelSafra(buffer) : parseExcelFile(buffer));
      if (parsed.length === 0) {
        toast.error("Nenhum lançamento encontrado na planilha. Verifique o formato.");
        return;
      }
      await processarLinhas(parsed);
      const parcelados = parsed.filter((r) => r.parcela_total);
      if (safraExtrato) {
        toast.success(`${parsed.length} lançamentos do Extrato Safra detectados`);
      } else {
        toast.success(`${parsed.length} lançamentos importados${parcelados.length > 0 ? ` (${parcelados.length} parcelados detectados)` : ""}`);
      }
    } else if (file.name.endsWith(".pdf")) {
      toast.info("Processando PDF... A IA irá extrair os lançamentos.");
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const parseSafeNum = (v: string) => {
            const s = v.trim().replace(/[^\d.,-]/g, "");
            const n = s.includes(",") && s.includes(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", ".");
            return Number(n);
          };
          const valorFaturaNum = valorTotalFatura ? parseSafeNum(valorTotalFatura) : null;

          const data = await invokeEdgeFunction("categorizar-despesa", {
            action: "parse_pdf",
            pdf_base64: base64,
            categorias: categorias?.map((c) => ({ id: c.id, nome: c.nome_categoria, grupo_dre: c.grupo_dre })),
            banco: bancoCartao || undefined,
            valorTotalFatura: Number.isFinite(valorFaturaNum) ? valorFaturaNum : undefined,
          });
          if (data?.rows?.length > 0) {
            await processarLinhas(data.rows.map((r: any) => {
              const parcela = detectParcela(r.descricao || "");
              return {
                data: r.data,
                data_vencimento: r.data_vencimento || null,
                descricao: r.descricao,
                valor: Math.abs(r.valor),
                tipo: r.valor < 0 ? "saida" as const : (r.tipo || "saida") as any,
                categoria_id: r.categoria_id || null,
                categoria_sugerida: r.categoria_sugerida || null,
                frequencia: null,
                frequencia_tipo: null,
                frequencia_meses: null,
                parcela_atual: parcela?.atual ?? null,
                parcela_total: parcela?.total ?? null,
                selecionado: true,
              };
            }));

            // Validation
            if (Number.isFinite(valorFaturaNum) && valorFaturaNum! > 0) {
              const totalExtraido = data.rows.reduce((s: number, r: any) => s + Math.abs(r.valor), 0);
              const divergencia = Math.abs(totalExtraido - valorFaturaNum!);
              if (divergencia < 0.01) {
                setValidacao({ tipo: "ok", qtd: data.rows.length, total: totalExtraido });
              } else {
                setValidacao({ tipo: "divergente", qtd: data.rows.length, total: totalExtraido, divergencia, valorInformado: valorFaturaNum! });
              }
            } else {
              setValidacao(null);
            }

            toast.success(`${data.rows.length} lançamentos extraídos do PDF`);
          } else {
            toast.error("Não foi possível extrair lançamentos do PDF.");
          }
        } catch (err: any) {
          toast.error("Erro ao processar PDF: " + (err.message || "erro desconhecido"));
        }
      };
      reader.readAsDataURL(file);
    } else {
      toast.error("Formato não suportado. Use CSV, Excel (.xlsx) ou PDF.");
    }
  }, [categorias, banco, bancoCartao, valorTotalFatura, processarLinhas]);

  const categorizarComIA = async () => {
    if (rows.length === 0) return;
    setIsCategorizando(true);
    try {
      const data = await invokeEdgeFunction("categorizar-despesa", {
        action: "categorize",
        items: rows.map((r) => ({ descricao: r.descricao, valor: r.valor, tipo: r.tipo })),
        categorias: categorias?.map((c) => ({ id: c.id, nome: c.nome_categoria, grupo_dre: c.grupo_dre })),
      });

      if (data?.categorized) {
        setRows((prev) =>
          prev.map((r, i) => ({
            ...r,
            categoria_id: data.categorized[i]?.categoria_id ?? r.categoria_id,
            categoria_sugerida: data.categorized[i]?.categoria_nome ?? r.categoria_sugerida,
          }))
        );
        toast.success("Categorização automática concluída!");
      }
    } catch (err: any) {
      toast.error("Erro na categorização: " + (err.message || "erro desconhecido"));
    } finally {
      setIsCategorizando(false);
    }
  };

  const categorizarPorHistorico = async () => {
    if (rows.length === 0) return;
    setIsCategorizandoHistorico(true);
    try {
      const { data: historico } = await supabase
        .from('movimentacoes_financeiras')
        .select('descricao, categoria_id, categorias_financeiras(nome_categoria)')
        .not('categoria_id', 'is', null)
        .in('origem', ['extrato_safra', 'extrato_cartao', 'importacao', 'manual']);

      if (!historico || historico.length === 0) {
        toast.info("Nenhum histórico de categorização encontrado.");
        return;
      }

      let categorizados = 0;
      let semCorrespondencia = 0;

      const updatedRows = rows.map((linha) => {
        if (linha.categoria_id) return linha;

        const palavras = linha.descricao
          .toLowerCase()
          .split(/[\s—\-]+/)
          .filter((p) => p.length > 3);

        const matches = historico.filter((h: any) =>
          palavras.some((p) => h.descricao?.toLowerCase().includes(p))
        );

        if (matches.length > 0) {
          const freq: Record<string, number> = {};
          matches.forEach((m: any) => {
            freq[m.categoria_id] = (freq[m.categoria_id] || 0) + 1;
          });
          const categoriaId = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])[0][0];
          const categoriaNome = matches.find((m: any) => m.categoria_id === categoriaId)
            ?.categorias_financeiras?.[0]?.nome_categoria;

          categorizados++;
          return {
            ...linha,
            categoria_id: categoriaId,
            categoria_sugerida: categoriaNome || "Auto (histórico)",
          };
        }

        semCorrespondencia++;
        return linha;
      });

      setRows(updatedRows);
      toast.success(`✅ ${categorizados} lançamentos categorizados por histórico · ${semCorrespondencia} sem correspondência`);
    } catch (err: any) {
      toast.error("Erro na categorização por histórico: " + (err.message || "erro desconhecido"));
    } finally {
      setIsCategorizandoHistorico(false);
    }
  };

  const salvarMovimentacoes = async (skipDuplicateCheck = false) => {
    const selecionados = rows.filter((r) => r.selecionado);
    if (selecionados.length === 0) {
      toast.error("Selecione ao menos um lançamento.");
      return;
    }

    if (isCartao && !cartaoNomeFinal) {
      toast.error("Selecione ou informe o nome do cartão.");
      return;
    }

    if (isCartao && !faturaVencimento) {
      toast.error("Informe a data de vencimento da fatura.");
      return;
    }

    // Duplicate check
    if (!skipDuplicateCheck) {
      const dupes = checkDuplicates(selecionados);
      if (dupes.count > 0) {
        setDuplicatasAlert(dupes);
        return;
      }
    }

    setIsSalvando(true);
    try {
      // Category fallback
      let categoriaPadrao: string | null = null;
      if (isCartao && categorias?.length) {
        const found = categorias.find(
          (c) =>
            c.nome_categoria?.toLowerCase().includes("não classificad") ||
            c.nome_categoria?.toLowerCase().includes("nao classificad") ||
            c.nome_categoria?.toLowerCase().includes("outros")
        );
        if (found) categoriaPadrao = found.id;
      }

      if (isCartao) {
        // Group rows: parcelados need future faturas, non-parcelados go to current fatura
        const parcelados = selecionados.filter((r) => r.parcela_total && r.parcela_total >= 2);
        const naoParcelados = selecionados.filter((r) => !r.parcela_total || r.parcela_total < 2);
        let qtdInseridosCartao = 0;
        let qtdIgnoradosCartao = 0;


        // Helper: get or create fatura for a given vencimento
        const getOrCreateFatura = async (vencimento: string, mesRef: string): Promise<string> => {
          const { data: existing } = await supabase
            .from("cartoes_faturas")
            .select("id, valor_total")
            .eq("cartao_nome", cartaoNomeFinal)
            .eq("data_vencimento", vencimento)
            .maybeSingle();

          if (existing) return existing.id;

          const { data: nova, error } = await supabase
            .from("cartoes_faturas")
            .insert({
              cartao_nome: cartaoNomeFinal,
              mes_referencia: mesRef,
              valor_total: 0,
              saldo_em_aberto: 0,
              data_vencimento: vencimento,
              status: "aberta",
              valor_pago: 0,
            })
            .select("id")
            .single();
          if (error) throw error;
          return nova.id;
        };

        // Helper: update fatura total
        const updateFaturaTotal = async (faturaId: string, addValor: number) => {
          const { data: f } = await supabase.from("cartoes_faturas").select("valor_total, valor_pago").eq("id", faturaId).single();
          if (f) {
            const newTotal = (f.valor_total ?? 0) + addValor;
            const newSaldo = newTotal - (f.valor_pago ?? 0);
            const newStatus = (f.valor_pago ?? 0) >= newTotal && newTotal > 0 ? "paga" : (f.valor_pago ?? 0) > 0 ? "parcial" : "aberta";
            await supabase.from("cartoes_faturas").update({ valor_total: newTotal, saldo_em_aberto: newSaldo, status: newStatus }).eq("id", faturaId);
          }
        };

        // Process non-installment items → current fatura
        if (naoParcelados.length > 0) {
          const mesRef = faturaVencimento.substring(0, 7);
          const faturaId = await getOrCreateFatura(faturaVencimento, mesRef);
          const totalNaoParcelados = naoParcelados.reduce((s, r) => s + r.valor, 0);

          const inserts = naoParcelados.map((r) => {
            const valor = normalizeNumberForDb(r.valor);
            const data = normalizeDateForDb(r.data);
            if (!Number.isFinite(valor) || !data) return null;
            return {
              data,
              data_vencimento: faturaVencimento,
              descricao: r.descricao,
              valor,
              tipo: "saida",
              categoria_id: r.categoria_id || categoriaPadrao,
              origem: "extrato_cartao",
              status_pagamento: "em_aberto",
              frequencia: r.frequencia || null,
              conta_tipo: "cartao_fatura",
              fatura_id: faturaId,
              impacta_dre: true,
              impacta_fluxo: false,
              tipo_origem: "cartao",
              fingerprint_hash: fingerprintCartao(faturaVencimento, valor, r.descricao, null),
            };
          }).filter(Boolean) as any[];

          if (inserts.length > 0) {
            const fingerprints = inserts.map((l: any) => l.fingerprint_hash);
            const { data: existentes } = await supabase
              .from("movimentacoes_financeiras")
              .select("fingerprint_hash")
              .in("fingerprint_hash", fingerprints);
            const hashsExistentes = new Set((existentes ?? []).map((e: any) => e.fingerprint_hash));
            const linhasNovas = inserts.filter((l: any) => !hashsExistentes.has(l.fingerprint_hash));
            const qtdIgnoradosLocal = inserts.length - linhasNovas.length;
            let qtdInseridos = 0;
            let totalInserido = 0;
            if (linhasNovas.length > 0) {
              const { data: inseridos, error } = await supabase
                .from("movimentacoes_financeiras")
                .insert(linhasNovas)
                .select("id, valor");
              if (error) throw error;
              qtdInseridos = inseridos?.length ?? 0;
              totalInserido = (inseridos ?? []).reduce((s: number, x: any) => s + Number(x.valor ?? 0), 0);
            }
            qtdInseridosCartao += qtdInseridos;
            qtdIgnoradosCartao += qtdIgnoradosLocal;
            if (totalInserido > 0) await updateFaturaTotal(faturaId, totalInserido);
          }
        }


        // Process installment items → distribute across future faturas
        for (const row of parcelados) {
          const parcelaAtual = row.parcela_atual ?? 1;
          const parcelaTotal = row.parcela_total!;
          const valorParcela = row.valor;
          const data = normalizeDateForDb(row.data);
          if (!data) continue;

          // Get card dia_vencimento for calculating future dates
          const card = cartoes.find((c: any) => c.nome === cartaoNomeFinal);
          const diaVenc = card?.dia_vencimento ?? (parseInt(faturaVencimento.substring(8, 10)) || 10);

          // Create entries for remaining installments (current + future)
          for (let p = parcelaAtual; p <= parcelaTotal; p++) {
            const monthsOffset = p - parcelaAtual;
            const baseDate = new Date(faturaVencimento + "T00:00:00");
            baseDate.setMonth(baseDate.getMonth() + monthsOffset);
            // Adjust day to card's vencimento
            const maxDay = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
            baseDate.setDate(Math.min(diaVenc, maxDay));
            const vencParcela = baseDate.toISOString().substring(0, 10);
            const mesRef = vencParcela.substring(0, 7);

            const faturaId = await getOrCreateFatura(vencParcela, mesRef);

            // Clean description (remove existing parcela pattern) and add correct one
            let descClean = row.descricao
              .replace(/\s*\d{1,2}\/\d{1,2}\s*/g, " ")
              .replace(/\s*parc(?:ela)?\s*\d{1,2}\s*(?:de|\/)\s*\d{1,2}/i, "")
              .trim();

            const parcelaInfo = `${p}/${parcelaTotal}`;
            const fingerprint = fingerprintCartao(vencParcela, valorParcela, row.descricao, parcelaInfo);
            const { data: jaExiste } = await supabase
              .from("movimentacoes_financeiras")
              .select("fingerprint_hash")
              .eq("fingerprint_hash", fingerprint)
              .maybeSingle();
            if (jaExiste) {
              qtdIgnoradosCartao += 1;
              continue;
            }
            const { error } = await supabase
              .from("movimentacoes_financeiras")
              .insert({
                data,
                data_vencimento: vencParcela,
                descricao: `${descClean} ${parcelaInfo}`,
                valor: valorParcela,
                tipo: "saida",
                categoria_id: row.categoria_id || categoriaPadrao,
                origem: "extrato_cartao",
                status_pagamento: "em_aberto",
                parcela_info: parcelaInfo,
                conta_tipo: "cartao_fatura",
                fatura_id: faturaId,
                impacta_dre: true,
                impacta_fluxo: false,
                tipo_origem: "cartao",
                fingerprint_hash: fingerprint,
              });
            if (error) throw error;
            qtdInseridosCartao += 1;
            await updateFaturaTotal(faturaId, valorParcela);
          }

        }

        const totalParcelamentos = parcelados.length;
        const msgBase =
          `Fatura: ${cartaoNomeFinal}` +
          (totalParcelamentos > 0 ? ` · ${totalParcelamentos} parcelamentos distribuídos nas próximas faturas` : "");
        if (qtdIgnoradosCartao === 0) {
          toast.success(`✅ ${qtdInseridosCartao} lançamentos importados com sucesso. ${msgBase}`);
        } else {
          toast.warning(
            `✅ ${qtdInseridosCartao} lançamentos importados · ⚠️ ${qtdIgnoradosCartao} já existiam e foram ignorados. ${msgBase}`
          );
        }

      } else {
        // Non-card: normal flow
        // For Vindi, lookup fixed categories
        let vindiCategoriaId: string | null = null;
        if (banco === "vindi_transacoes") {
          const { data: cat } = await supabase
            .from("categorias_financeiras")
            .select("id")
            .eq("descricao_categoria", "Venda de produtos")
            .maybeSingle();
          vindiCategoriaId = cat?.id ?? null;
        } else if (banco === "vindi_taxas") {
          const { data: cat } = await supabase
            .from("categorias_financeiras")
            .select("id")
            .eq("descricao_categoria", "Taxa TrayPagamentos (Vindi)")
            .maybeSingle();
          vindiCategoriaId = cat?.id ?? null;
        }

        const isVindi = banco === "vindi_transacoes" || banco === "vindi_taxas";

        const inserts = selecionados.map((r) => {
          const valor = normalizeNumberForDb(r.valor);
          const data = normalizeDateForDb(r.data);
          const dataVencimento = normalizeDateForDb(r.data_vencimento);
          if (!Number.isFinite(valor) || !data) return null;
          const origem = r.origem_override
            ?? (isVindi ? (banco === "vindi_transacoes" ? "vindi_transacoes" : "vindi_taxas") : `extrato_${banco}`);
          return {
            data,
            data_vencimento: dataVencimento,
            descricao: r.descricao,
            valor,
            tipo: r.tipo,
            categoria_id: r.categoria_id || vindiCategoriaId || null,
            origem,
            status_pagamento: r.tipo === "entrada" ? "recebido" : "pago",
            frequencia: r.frequencia === "mensal_indeterminada" || r.frequencia === "mensal_por_periodo" ? "Mensal" : r.frequencia || null,
            frequencia_tipo: r.frequencia_tipo || null,
            frequencia_meses: r.frequencia_meses || null,
            impacta_dre: true,
            impacta_fluxo: true,
            tipo_origem: "extrato",
            fingerprint_hash: r.fingerprint_hash || fingerprintExtrato(data, valor, r.descricao),
          };
        }).filter(Boolean) as any[];

        if (inserts.length === 0) {
          throw new Error("Nenhum lançamento válido para salvar.");
        }
        const fingerprints = inserts.map((l: any) => l.fingerprint_hash);
        const { data: existentes } = await supabase
          .from("movimentacoes_financeiras")
          .select("fingerprint_hash")
          .in("fingerprint_hash", fingerprints);
        const hashsExistentes = new Set((existentes ?? []).map((e: any) => e.fingerprint_hash));
        const linhasNovas = inserts.filter((l: any) => !hashsExistentes.has(l.fingerprint_hash));
        const qtdIgnorados = inserts.length - linhasNovas.length;
        let qtdInseridos = 0;
        let totalInserido = 0;
        if (linhasNovas.length > 0) {
          const { data: inseridos, error } = await supabase
            .from("movimentacoes_financeiras")
            .insert(linhasNovas)
            .select("id");
          if (error) throw error;
          qtdInseridos = inseridos?.length ?? 0;
          totalInserido = linhasNovas.reduce((s: number, l: any) => s + Number(l.valor || 0), 0);
        }
        const isSafraExtrato = inserts.some((l: any) => l.origem === "extrato_safra");
        if (qtdIgnorados === 0) {
          toast.success(
            isSafraExtrato
              ? `✅ ${qtdInseridos} lançamentos importados (${formatCurrency(totalInserido)})`
              : `✅ ${qtdInseridos} lançamentos importados com sucesso.`
          );
        } else {
          toast.warning(`✅ ${qtdInseridos} importados · ⚠️ ${qtdIgnorados} já existiam e foram ignorados.`);
        }
      }


      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["cartoes_faturas"] });
      setRows([]);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "erro desconhecido"));
    } finally {
      setIsSalvando(false);
    }
  };

  const toggleAll = (v: boolean) => setRows((prev) => prev.map((r) => ({ ...r, selecionado: v })));

  const handleSort = (field: "data" | "descricao") => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortField) return rows.map((r, i) => ({ ...r, _idx: i }));
    const sorted = rows.map((r, i) => ({ ...r, _idx: i })).sort((a, b) => {
      const va = sortField === "data" ? a.data : a.descricao.toLowerCase();
      const vb = sortField === "data" ? b.data : b.descricao.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [rows, sortField, sortDir]);

  const aplicarCategoriaEmMassa = (catId: string | null) => {
    setRows((prev) =>
      prev.map((r) => r.selecionado ? { ...r, categoria_id: catId } : r)
    );
    setBulkCategoryOpen(false);
    toast.success("Categoria aplicada aos selecionados!");
  };

  const categoriasDropdown = useMemo(() => {
    const agrupadas = new Map<string, { id: string; label: string }[]>();
    const vistos = new Set<string>();

    for (const categoria of categorias ?? []) {
      const label = (categoria.descricao_categoria || categoria.nome_categoria || "").trim();
      const grupo = (categoria.grupo_dre || "Outros").trim();
      if (!label || vistos.has(label.toLowerCase())) continue;
      vistos.add(label.toLowerCase());
      const itens = agrupadas.get(grupo) ?? [];
      itens.push({ id: categoria.id, label });
      agrupadas.set(grupo, itens);
    }

    return Array.from(agrupadas.entries())
      .map(([grupo, itens]) => ({ grupo, itens: itens.sort((a, b) => a.label.localeCompare(b.label)) }))
      .sort((a, b) => a.grupo.localeCompare(b.grupo));
  }, [categorias]);

  const catMap = Object.fromEntries(
    (categorias ?? []).map((c) => [c.id, (c.descricao_categoria || c.nome_categoria || "")])
  );

  const totalEntradas = rows.filter((r) => r.selecionado && r.tipo === "entrada").reduce((s, r) => s + r.valor, 0);
  const totalSaidas = rows.filter((r) => r.selecionado && r.tipo === "saida").reduce((s, r) => s + r.valor, 0);
  const totalGeral = rows.filter((r) => r.selecionado).reduce((s, r) => s + r.valor, 0);
  const totalParcelados = rows.filter((r) => r.selecionado && r.parcela_total).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Importar Extrato</h1>
        <p className="text-sm text-muted-foreground mt-1">Importe extratos bancários CSV, faturas PDF ou CSV da Vindi</p>
      </div>

      <Tabs value={importTab} onValueChange={setImportTab}>
        <TabsList>
          <TabsTrigger value="extrato">Extrato / Fatura</TabsTrigger>
          <TabsTrigger value="vindi">Vindi</TabsTrigger>
          <TabsTrigger value="boletos">Boletos DDA</TabsTrigger>
        </TabsList>
        <TabsContent value="vindi" className="mt-6">
          <VindiImporter />
        </TabsContent>
        <TabsContent value="boletos" className="mt-6">
          <BoletosDDAImporter />
        </TabsContent>
        <TabsContent value="extrato" className="mt-6 space-y-6">



      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload do Arquivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium text-foreground mb-1 block">Banco</label>
              <Select value={banco} onValueChange={setBanco}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="generico">Genérico</SelectItem>
                  <SelectItem value="safra">Safra</SelectItem>
                  <SelectItem value="bradesco">Bradesco</SelectItem>
                  <SelectItem value="vindi_transacoes">Vindi - Transações</SelectItem>
                  <SelectItem value="vindi_taxas">Vindi - Taxas</SelectItem>
                  <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isCartao && (
              <>
                <div className="flex-1 min-w-[180px]">
                  <label className="text-sm font-medium text-foreground mb-1 block">Cartão</label>
                  <Select value={cartaoSelecionado} onValueChange={handleCartaoChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                    <SelectContent>
                      {cartoes.filter((c: any) => c.ativo).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome} (dia {c.dia_vencimento})</SelectItem>
                      ))}
                      <SelectItem value="__manual">Outro (digitar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {cartaoSelecionado === "__manual" && (
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-sm font-medium text-foreground mb-1 block">Nome do Cartão</label>
                    <Input placeholder="Ex: Nubank, Itaú..." value={cartaoNomeManual} onChange={(e) => setCartaoNomeManual(e.target.value)} />
                  </div>
                )}
                <div className="flex-1 min-w-[150px]">
                  <label className="text-sm font-medium text-foreground mb-1 block">Vencimento da Fatura</label>
                  <Input type="date" value={faturaVencimento} onChange={(e) => setFaturaVencimento(e.target.value)} />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-sm font-medium text-foreground mb-1 block">Banco do cartão</label>
                  <Select value={bancoCartao} onValueChange={setBancoCartao}>
                    <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nubank">Nubank</SelectItem>
                      <SelectItem value="itau">Itaú</SelectItem>
                      <SelectItem value="cora">Cora</SelectItem>
                      <SelectItem value="sicredi">Sicredi</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-sm font-medium text-foreground mb-1 block">Valor total da fatura (R$)</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 1.250,00"
                    value={valorTotalFatura}
                    onChange={(e) => setValorTotalFatura(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Para validação automática</p>
                </div>
              </>
            )}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-foreground mb-1 block">Arquivo CSV, Excel ou PDF</label>
              <Input type="file" accept=".csv,.txt,.xlsx,.xls,.pdf" onChange={handleFile} />
            </div>
          </div>

          {(banco === "vindi_transacoes" || banco === "vindi_taxas") && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <button
                type="button"
                className="underline text-primary hover:text-primary/80"
                onClick={() => {
                  let csv = "";
                  let filename = "";
                  if (banco === "vindi_transacoes") {
                    csv = "Data Competencia;Data Credito;Valor Pago\n" +
                      "01/04/2026;05/04/2026;426,00\n" +
                      "01/04/2026;05/04/2026;1250,50\n" +
                      "02/04/2026;06/04/2026;89,90\n";
                    filename = "vindi_transacoes_exemplo.csv";
                  } else {
                    csv = "Data Competência;Data Débito;Taxa\n" +
                      "01/04/2026;05/04/2026;-53,20\n" +
                      "01/04/2026;05/04/2026;-156,31\n" +
                      "02/04/2026;06/04/2026;-11,24\n";
                    filename = "vindi_taxas_exemplo.csv";
                  }
                  const blob = new Blob([csv], { type: "text/csv;charset=latin1" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = filename;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Baixar planilha de exemplo ({banco === "vindi_transacoes" ? "Transações" : "Taxas"})
              </button>
            </div>
          )}

          {validacao?.tipo === "ok" && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-3 text-sm text-green-800 dark:bg-green-950/30 dark:border-green-700 dark:text-green-300">
              ✅ Fatura validada! {validacao.qtd} transações encontradas, total R$ {validacao.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.
            </div>
          )}

          {validacao?.tipo === "divergente" && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm text-yellow-800 dark:bg-yellow-950/30 dark:border-yellow-700 dark:text-yellow-300">
              ⚠️ Atenção: foram encontradas {validacao.qtd} transações somando R$ {validacao.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.
              Divergência de R$ {validacao.divergencia!.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em relação ao valor informado (R$ {validacao.valorInformado!.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).
              Revise os lançamentos antes de salvar.
            </div>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-4 flex-wrap">
              <Badge variant="outline" className="text-success border-success/30">
                Entradas: {formatCurrency(totalEntradas)}
              </Badge>
              <Badge variant="outline" className="text-destructive border-destructive/30">
                Saídas: {formatCurrency(totalSaidas)}
              </Badge>
              <Badge variant="default">
                Total: {formatCurrency(totalGeral)}
              </Badge>
              <Badge variant="secondary">{rows.filter((r) => r.selecionado).length} selecionados</Badge>
              {isCartao && totalParcelados > 0 && (
                <Badge variant="outline" className="border-primary/30 text-primary">
                  🔄 {totalParcelados} parcelados
                </Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>Selecionar Todos</Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>Desmarcar Todos</Button>
              <Popover open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1" disabled={!rows.some((r) => r.selecionado)}>
                    <ChevronsUpDown className="h-3 w-3" />
                    Categoria em massa
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Buscar categoria..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                      <CommandItem onSelect={() => aplicarCategoriaEmMassa(null)}>
                        Sem categoria
                      </CommandItem>
                      {categoriasDropdown.map(({ grupo, itens }) => (
                        <CommandGroup key={grupo} heading={grupo}>
                          {itens.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={`${grupo} ${item.label}`}
                              onSelect={() => aplicarCategoriaEmMassa(item.id)}
                              className="text-xs"
                            >
                              {item.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button onClick={categorizarComIA} disabled={isCategorizando} className="gap-2">
                {isCategorizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Categorizar com IA
              </Button>
              <Button onClick={categorizarPorHistorico} disabled={isCategorizandoHistorico} variant="outline" className="gap-2">
                {isCategorizandoHistorico ? <Loader2 className="h-4 w-4 animate-spin" /> : "📂"}
                Categorizar por Histórico
              </Button>
              <Button onClick={() => salvarMovimentacoes()} disabled={isSalvando} variant="default" className="gap-2">
                {isSalvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Salvar Selecionados
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">✓</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-auto p-0 font-medium gap-1" onClick={() => handleSort("data")}>
                        Competência <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-auto p-0 font-medium gap-1" onClick={() => handleSort("descricao")}>
                        Descrição <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Tipo</TableHead>
                    {isCartao && <TableHead>Parcela</TableHead>}
                    <TableHead>Categoria</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((r) => {
                    const idx = r._idx;
                    return (
                    <TableRow key={idx} className={cn(
                      r.selecionado ? "" : "opacity-40",
                      r.possivel_duplicata && "bg-yellow-50 dark:bg-yellow-950/30"
                    )}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={r.selecionado}
                            onChange={(e) => setRows((prev) => prev.map((row, j) => j === idx ? { ...row, selecionado: e.target.checked } : row))}
                          />
                          {r.possivel_duplicata && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-4 w-4 text-yellow-600 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Possível duplicata — já existe lançamento recorrente neste mês
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 font-normal gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <CalendarIcon className="h-3 w-3" />
                              {formatarData(r.data)}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={r.data ? new Date(r.data + "T00:00:00") : undefined}
                              onSelect={(d) => {
                                if (!d) return;
                                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                setRows((prev) => prev.map((row, j) => j === idx ? { ...row, data: iso } : row));
                              }}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{formatarData(r.data_vencimento)}</TableCell>
                      <TableCell className="max-w-xs truncate">{r.descricao}</TableCell>
                      <TableCell>
                        <Badge variant={r.tipo === "entrada" ? "default" : "secondary"}>
                          {r.tipo}
                        </Badge>
                      </TableCell>
                      {isCartao && (
                        <TableCell>
                          {r.parcela_total ? (
                            <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                              {r.parcela_atual}/{r.parcela_total}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        <SearchableCategory
                          categorias={categoriasDropdown}
                          catMap={catMap}
                          value={r.categoria_id}
                          sugerida={r.categoria_sugerida}
                          onChange={(v) => setRows((prev) => prev.map((row, j) => j === idx ? { ...row, categoria_id: v } : row))}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.frequencia || "unica"}
                          onValueChange={(v) => setRows((prev) => prev.map((row, j) => j === idx ? {
                            ...row,
                            frequencia: v === "unica" ? null : v,
                            frequencia_tipo: v === "mensal_indeterminada" ? "indeterminada" : v === "mensal_por_periodo" ? "por_periodo" : null,
                            frequencia_meses: v === "mensal_por_periodo" ? 3 : null,
                          } : row))}
                        >
                          <SelectTrigger className="h-8 text-xs w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unica">Única</SelectItem>
                            <SelectItem value="mensal_indeterminada">Mensal (até cancelar)</SelectItem>
                            <SelectItem value="mensal_por_periodo">Mensal (X meses)</SelectItem>
                            <SelectItem value="anual">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                        {r.frequencia === "mensal_por_periodo" && (
                          <Input
                            type="number"
                            min={2}
                            max={60}
                            className="h-7 text-xs w-16 mt-1"
                            value={r.frequencia_meses || 3}
                            onChange={(e) => setRows((prev) => prev.map((row, j) => j === idx ? { ...row, frequencia_meses: parseInt(e.target.value) || 3 } : row))}
                            placeholder="Meses"
                          />
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${r.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                        {r.tipo === "saida" ? "-" : ""}{formatCurrency(r.valor)}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
        </TabsContent>
      </Tabs>
      {/* Duplicate detection alert */}

      <AlertDialog open={!!duplicatasAlert} onOpenChange={(open) => !open && setDuplicatasAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Possíveis Duplicidades Detectadas
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Foram encontrados <strong>{duplicatasAlert?.count}</strong> lançamento(s) que já existem na base
                  com a mesma data, valor e descrição:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-xs max-h-40 overflow-y-auto">
                  {duplicatasAlert?.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                  {(duplicatasAlert?.count || 0) > 10 && (
                    <li className="text-muted-foreground">...e mais {(duplicatasAlert?.count || 0) - 10} duplicatas</li>
                  )}
                </ul>
                <p className="font-medium">Deseja salvar mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setDuplicatasAlert(null);
              salvarMovimentacoes(true);
            }}>
              Salvar Mesmo Assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
