import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Upload, Loader2, ChevronsUpDown, ArrowUpDown, ArrowUp, ArrowDown, Sparkles, Plus } from "lucide-react";
import { NovaCategoriaDialog } from "@/components/NovaCategoriaDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { formatarData } from "@/utils/formatters";
import { useCategorias } from "@/hooks/useSupabase";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { cn } from "@/lib/utils";

type Situacao = "PAGO" | "ABERTO" | "VENCIDO" | "BAIXADO" | string;

interface BoletoLinha {
  data: string;
  data_vencimento: string;
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
  selecionado: boolean;
  categoria_id: string | null;
  categoria_sugerida: string | null;
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

    const nossoNumRaw = String(row[iNosso] ?? "").trim().replace(/\s+/g, "");
    const numDocRaw = String(row[iNumDoc] ?? "").trim();
    const numDoc = numDocRaw && numDocRaw.toLowerCase() !== "nan" ? numDocRaw : "";
    const nossoNum = nossoNumRaw && nossoNumRaw.toLowerCase() !== "nan" && nossoNumRaw.length > 3
      ? nossoNumRaw
      : "";

    const docKey = nossoNum || numDoc;
    if (!docKey) continue;

    const beneficiario = String(row[iBenef] ?? "").trim() || "Sem beneficiário";
    const nominal = parseValor(row[iNominal]);
    const valorTotal = parseValor(row[iTotal]);
    const valor = situacao === "VENCIDO" && valorTotal > 0 ? valorTotal : nominal;
    if (!(valor > 0)) continue;

    const status_pagamento: "pago" | "pendente" = ["PAGO", "BAIXADO"].includes(situacao) ? "pago" : "pendente";
    const beneKey = beneficiario.substring(0, 20).toLowerCase().replace(/\s+/g, "_");
    const fingerprint_hash = `boleto_${docKey}_${beneKey}`.substring(0, 100);

    linhas.push({
      data: isoCompetencia,
      data_vencimento: isoVenc,
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
      selecionado: true,
      categoria_id: null,
      categoria_sugerida: null,
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

function CategoryPicker({
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

type SortField = "data" | "data_vencimento" | "cliente" | "valor" | "situacao_original" | "status_pagamento";

export default function BoletosDDAImporter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<BoletoLinha[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [isCategorizando, setIsCategorizando] = useState(false);
  const [isCategorizandoHistorico, setIsCategorizandoHistorico] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const queryClient = useQueryClient();
  const { data: categorias } = useCategorias();

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

  const catMap = useMemo(() => Object.fromEntries(
    (categorias ?? []).map((c) => [c.id, (c.descricao_categoria || c.nome_categoria || "")])
  ), [categorias]);

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

  const toggleAll = (v: boolean) => setLinhas((prev) => prev.map((l) => ({ ...l, selecionado: v })));
  const allSelected = linhas.length > 0 && linhas.every((l) => l.selecionado);

  const aplicarCategoriaEmMassa = (catId: string | null) => {
    setLinhas((prev) => prev.map((l) => (l.selecionado ? { ...l, categoria_id: catId } : l)));
    setBulkCategoryOpen(false);
    toast.success("Categoria aplicada aos selecionados!");
  };

  const categorizarComIA = async () => {
    const alvos = linhas.filter((l) => l.selecionado && !l.categoria_id);
    if (alvos.length === 0) {
      toast.info("Nenhum lançamento selecionado sem categoria.");
      return;
    }
    setIsCategorizando(true);
    try {
      const data = await invokeEdgeFunction("categorizar-despesa", {
        action: "categorize",
        items: alvos.map((l) => ({ descricao: l.cliente, valor: l.valor, tipo: l.tipo })),
        categorias: categorias?.map((c) => ({ id: c.id, nome: c.nome_categoria, grupo_dre: c.grupo_dre })),
      });
      if (data?.categorized) {
        const byFp = new Map<string, { categoria_id?: string; categoria_nome?: string }>();
        alvos.forEach((l, i) => byFp.set(l.fingerprint_hash, data.categorized[i] || {}));
        setLinhas((prev) => prev.map((l) => {
          const m = byFp.get(l.fingerprint_hash);
          if (!m) return l;
          return {
            ...l,
            categoria_id: m.categoria_id ?? l.categoria_id,
            categoria_sugerida: m.categoria_nome ?? l.categoria_sugerida,
          };
        }));
        toast.success("Categorização automática concluída!");
      }
    } catch (err: any) {
      toast.error("Erro na categorização: " + (err.message || "erro desconhecido"));
    } finally {
      setIsCategorizando(false);
    }
  };

  const categorizarPorHistorico = async () => {
    if (linhas.length === 0) return;
    setIsCategorizandoHistorico(true);
    try {
      const { data: historico } = await supabase
        .from("movimentacoes_financeiras")
        .select("descricao, categoria_id, categorias_financeiras(nome_categoria)")
        .not("categoria_id", "is", null)
        .in("origem", ["extrato_safra", "extrato_cartao", "importacao", "manual", "boleto_dda"]);

      if (!historico || historico.length === 0) {
        toast.info("Nenhum histórico de categorização encontrado.");
        return;
      }

      let categorizados = 0;
      let semCorrespondencia = 0;
      const updated = linhas.map((linha) => {
        if (linha.categoria_id) return linha;
        const palavras = linha.cliente
          .toLowerCase()
          .split(/[\s—\-]+/)
          .filter((p) => p.length > 3);
        const matches = historico.filter((h: any) =>
          palavras.some((p) => h.descricao?.toLowerCase().includes(p))
        );
        if (matches.length > 0) {
          const freq: Record<string, number> = {};
          matches.forEach((m: any) => { freq[m.categoria_id] = (freq[m.categoria_id] || 0) + 1; });
          const categoriaId = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
          const categoriaNome = matches.find((m: any) => m.categoria_id === categoriaId)
            ?.categorias_financeiras?.[0]?.nome_categoria;
          categorizados++;
          return { ...linha, categoria_id: categoriaId, categoria_sugerida: categoriaNome || "Auto (histórico)" };
        }
        semCorrespondencia++;
        return linha;
      });
      setLinhas(updated);
      toast.success(`✅ ${categorizados} lançamentos categorizados por histórico · ${semCorrespondencia} sem correspondência`);
    } catch (err: any) {
      toast.error("Erro na categorização por histórico: " + (err.message || "erro desconhecido"));
    } finally {
      setIsCategorizandoHistorico(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const sortedLinhas = useMemo(() => {
    const indexed = linhas.map((l, i) => ({ l, i }));
    if (!sortField) return indexed;
    return [...indexed].sort((a, b) => {
      const va: any = (a.l as any)[sortField];
      const vb: any = (b.l as any)[sortField];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sa < sb) return sortDir === "asc" ? -1 : 1;
      if (sa > sb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [linhas, sortField, sortDir]);

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const importar = async () => {
    const alvos = linhas.filter((l) => l.selecionado);
    if (!alvos.length) {
      toast.error("Selecione ao menos um boleto.");
      return;
    }
    setImporting(true);
    try {
      const fingerprints = alvos.map((l) => l.fingerprint_hash);
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

      const linhasNovas = alvos.filter((l) => !hashsExistentes.has(l.fingerprint_hash));
      const qtdIgnorados = alvos.length - linhasNovas.length;

      const pendentes = linhasNovas.filter((l) => l.status_pagamento === "pendente");
      const mesesValores = new Map<string, Set<number>>();
      for (const b of pendentes) {
        const mes = b.data.substring(0, 7);
        if (!mesesValores.has(mes)) mesesValores.set(mes, new Set());
        mesesValores.get(mes)!.add(b.valor);
      }
      const pagamentosPorMes = new Map<string, Set<number>>();
      for (const mes of mesesValores.keys()) {
        const inicio = `${mes}-01`;
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
          categoria_id: l.categoria_id,
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
  const qtdSelecionados = linhas.filter((l) => l.selecionado).length;

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
        </div>

        {linhas.length > 0 && (
          <>
            <div className="rounded-md border bg-muted/40 p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
              <span><strong>Total:</strong> {totalCount}</span>
              <span><strong>Pagos:</strong> {pagos.length} ({formatCurrency(sum(pagos))})</span>
              <span><strong>Em aberto:</strong> {abertos.length} ({formatCurrency(sum(abertos))})</span>
              <span><strong>Vencidos:</strong> {vencidos.length} ({formatCurrency(sum(vencidos))})</span>
              <span><strong>Baixados:</strong> {baixados.length} ({formatCurrency(sum(baixados))})</span>
              <span><strong>Selecionados:</strong> {qtdSelecionados}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleAll(!allSelected)}>
                {allSelected ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
              <Popover open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1" disabled={qtdSelecionados === 0}>
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
              <Button onClick={categorizarComIA} disabled={isCategorizando} className="gap-2" size="sm">
                {isCategorizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Categorizar com IA
              </Button>
              <Button onClick={categorizarPorHistorico} disabled={isCategorizandoHistorico} variant="outline" className="gap-2" size="sm">
                {isCategorizandoHistorico ? <Loader2 className="h-4 w-4 animate-spin" /> : "📂"}
                Categorizar por Histórico
              </Button>
              <Button onClick={importar} disabled={importing} className="gap-2" size="sm">
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Importar
              </Button>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => toggleAll(e.target.checked)}
                      />
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-auto p-0 font-medium gap-1" onClick={() => handleSort("data")}>
                        Competência {sortIcon("data")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-auto p-0 font-medium gap-1" onClick={() => handleSort("data_vencimento")}>
                        Vencimento {sortIcon("data_vencimento")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-auto p-0 font-medium gap-1" onClick={() => handleSort("cliente")}>
                        Beneficiário {sortIcon("cliente")}
                      </Button>
                    </TableHead>
                    <TableHead>Nº Doc</TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" className="h-auto p-0 font-medium gap-1" onClick={() => handleSort("valor")}>
                        Valor {sortIcon("valor")}
                      </Button>
                    </TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-auto p-0 font-medium gap-1" onClick={() => handleSort("situacao_original")}>
                        Situação {sortIcon("situacao_original")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-auto p-0 font-medium gap-1" onClick={() => handleSort("status_pagamento")}>
                        Status {sortIcon("status_pagamento")}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLinhas.map(({ l, i }) => (
                    <TableRow key={`${l.fingerprint_hash}_${i}`} className={l.selecionado ? "" : "opacity-40"}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={l.selecionado}
                          onChange={(e) => setLinhas((prev) => prev.map((row, j) => j === i ? { ...row, selecionado: e.target.checked } : row))}
                        />
                      </TableCell>
                      <TableCell>{formatarData(l.data)}</TableCell>
                      <TableCell>{l.vencimentoBr}</TableCell>
                      <TableCell className="max-w-[280px] truncate" title={l.cliente}>{l.cliente}</TableCell>
                      <TableCell className="font-mono text-xs">{l.doc_key}</TableCell>
                      <TableCell className="text-right">{formatCurrency(l.valor)}</TableCell>
                      <TableCell>
                        <CategoryPicker
                          categorias={categoriasDropdown}
                          catMap={catMap}
                          value={l.categoria_id}
                          sugerida={l.categoria_sugerida}
                          onChange={(v) => setLinhas((prev) => prev.map((row, j) => j === i ? { ...row, categoria_id: v } : row))}
                        />
                      </TableCell>
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
