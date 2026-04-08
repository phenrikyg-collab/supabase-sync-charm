import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Upload, Sparkles, Check, Loader2, FileText, ChevronsUpDown } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useCategorias, useCartoesCredito } from "@/hooks/useSupabase";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatarData } from "@/utils/formatters";

interface ParsedRow {
  data: string;
  data_vencimento: string | null;
  descricao: string;
  valor: number;
  categoria_id: string | null;
  categoria_sugerida: string | null;
  tipo: "entrada" | "saida";
  frequencia: string | null;
  parcela_atual: number | null;
  parcela_total: number | null;
  selecionado: boolean;
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
      parcela_atual: parcela?.atual ?? null,
      parcela_total: parcela?.total ?? null,
      selecionado: true,
    });
  }
  return rows;
}

function parseExcelFile(buffer: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  const rows: ParsedRow[] = [];

  for (const row of jsonRows) {
    const vals = Object.values(row).map((v) => String(v ?? "").trim());
    if (vals.length < 2) continue;
    const dateCandidate = vals[0];
    if (!/\d/.test(dateCandidate)) continue;
    if (dateCandidate.toLowerCase().includes("data")) continue;

    const data = parseDate(dateCandidate);
    const descricao = vals[1] || "Sem descrição";
    let valor = 0;
    for (let i = vals.length - 1; i >= 1; i--) {
      const cleaned = vals[i].replace(/[R$\s.]/g, "").replace(",", ".");
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
      parcela_atual: parcela?.atual ?? null,
      parcela_total: parcela?.total ?? null,
      selecionado: true,
    });
  }
  return rows;
}

function parseExcelSafra(buffer: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", header: 1 }) as any[][];
  const rows: ParsedRow[] = [];

  // Skip header row(s)
  for (let i = 0; i < jsonRows.length; i++) {
    const cols = jsonRows[i].map((v: any) => String(v ?? "").trim());
    if (cols.length < 4) continue;
    // Skip header
    if (cols[0]?.toLowerCase().includes("data") || cols[0]?.toLowerCase().includes("pagamento")) continue;
    if (!/\d/.test(cols[0])) continue;

    const dataPagamento = parseDate(cols[0]); // Col A - Data Pagamento
    const dataCompetencia = parseDate(cols[1]); // Col B - Data competência
    const descricao = cols[2] || "Sem descrição"; // Col C - Favorecido/Beneficiário
    
    // Col D - Valor in centavos
    const valorRaw = parseFloat(String(cols[3]).replace(/[^\d.-]/g, ""));
    if (isNaN(valorRaw) || valorRaw === 0) continue;
    const valor = Math.abs(valorRaw / 100);

    if (!dataCompetencia) continue;

    rows.push({
      data: dataCompetencia,
      data_vencimento: dataPagamento || null,
      descricao,
      valor,
      tipo: "entrada",
      categoria_id: null,
      categoria_sugerida: null,
      frequencia: null,
      parcela_atual: null,
      parcela_total: null,
      selecionado: true,
    });
  }
  return rows;
}

function parseVindiTransacoes(text: string): ParsedRow[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const rows: ParsedRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    // Skip header
    if (i === 0 && cols[0]?.toLowerCase().includes("data")) continue;
    if (cols.length < 5) continue;
    if (!/\d/.test(cols[0])) continue;

    const dataTransacao = parseDate(cols[0]); // Data da Transação
    const cliente = cols[2] || "Sem descrição"; // Cliente
    // Valor Pago: remove "R$ " and convert comma to dot
    const valorStr = cols[3].replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".");
    const valor = parseFloat(valorStr);
    const dataCredito = parseDate(cols[4]); // Data Credito

    if (!dataTransacao || isNaN(valor) || valor === 0) continue;

    rows.push({
      data: dataTransacao,
      data_vencimento: dataCredito || null,
      descricao: cliente,
      valor: Math.abs(valor),
      tipo: "entrada",
      categoria_id: null,
      categoria_sugerida: null,
      frequencia: null,
      parcela_atual: null,
      parcela_total: null,
      selecionado: true,
    });
  }
  return rows;
}

function parseVindiTaxas(text: string): ParsedRow[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const rows: ParsedRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    // Skip header
    if (i === 0 && cols[0]?.toLowerCase().includes("data")) continue;
    if (cols.length < 6) continue;
    if (!/\d/.test(cols[0])) continue;

    const dataTransacao = parseDate(cols[0]); // Data da Transação
    const cliente = cols[3] || ""; // Cliente
    // Taxa: remove "-R$ " and convert comma to dot
    const taxaStr = cols[4].replace(/-?R\$\s*/g, "").replace(/\./g, "").replace(",", ".");
    const valor = parseFloat(taxaStr);
    const dataDebito = parseDate(cols[5]); // Data Débito

    if (!dataTransacao || isNaN(valor) || valor === 0) continue;

    rows.push({
      data: dataTransacao,
      data_vencimento: dataDebito || null,
      descricao: `Taxa Vindi - ${cliente}`.trim(),
      valor: Math.abs(valor),
      tipo: "saida",
      categoria_id: null,
      categoria_sugerida: null,
      frequencia: null,
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
  const displayLabel = value ? (catMap[value] || "Selecionar") : (sugerida || "Sem categoria");

  return (
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function ImportarExtrato() {
  const { data: categorias } = useCategorias();
  const { data: cartoes = [] } = useCartoesCredito();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isCategorizando, setIsCategorizando] = useState(false);
  const [isSalvando, setIsSalvando] = useState(false);
  const [banco, setBanco] = useState("generico");
  const [cartaoSelecionado, setCartaoSelecionado] = useState("");
  const [cartaoNomeManual, setCartaoNomeManual] = useState("");
  const [faturaVencimento, setFaturaVencimento] = useState("");
  const [bancoCartao, setBancoCartao] = useState("");
  const [valorTotalFatura, setValorTotalFatura] = useState("");
  const [validacao, setValidacao] = useState<{ tipo: "ok" | "divergente"; qtd: number; total: number; divergencia?: number; valorInformado?: number } | null>(null);

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
      setRows(parsed);
      const parcelados = parsed.filter((r) => r.parcela_total);
      toast.success(`${parsed.length} lançamentos importados${parcelados.length > 0 ? ` (${parcelados.length} parcelados detectados)` : ""}`);
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const buffer = await file.arrayBuffer();
      const parsed = banco === "safra" ? parseExcelSafra(buffer) : parseExcelFile(buffer);
      if (parsed.length === 0) {
        toast.error("Nenhum lançamento encontrado na planilha. Verifique o formato.");
        return;
      }
      setRows(parsed);
      const parcelados = parsed.filter((r) => r.parcela_total);
      toast.success(`${parsed.length} lançamentos importados${parcelados.length > 0 ? ` (${parcelados.length} parcelados detectados)` : ""}`);
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
            setRows(data.rows.map((r: any) => {
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
  }, [categorias]);

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

  const salvarMovimentacoes = async () => {
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
            };
          }).filter(Boolean);

          if (inserts.length > 0) {
            const { error } = await supabase.from("movimentacoes_financeiras").insert(inserts);
            if (error) throw error;
            await updateFaturaTotal(faturaId, totalNaoParcelados);
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

            const { error } = await supabase.from("movimentacoes_financeiras").insert({
              data,
              data_vencimento: vencParcela,
              descricao: `${descClean} ${p}/${parcelaTotal}`,
              valor: valorParcela,
              tipo: "saida",
              categoria_id: row.categoria_id || categoriaPadrao,
              origem: "extrato_cartao",
              status_pagamento: "em_aberto",
              parcela_info: `${p}/${parcelaTotal}`,
              conta_tipo: "cartao_fatura",
              fatura_id: faturaId,
              impacta_dre: true,
              impacta_fluxo: false,
            });
            if (error) throw error;
            await updateFaturaTotal(faturaId, valorParcela);
          }
        }

        const totalParcelamentos = parcelados.length;
        toast.success(
          `${selecionados.length} lançamentos salvos! Fatura: ${cartaoNomeFinal}` +
          (totalParcelamentos > 0 ? ` · ${totalParcelamentos} parcelamentos distribuídos nas próximas faturas` : "")
        );
      } else {
        // Non-card: normal flow
        const inserts = selecionados.map((r) => {
          const valor = normalizeNumberForDb(r.valor);
          const data = normalizeDateForDb(r.data);
          const dataVencimento = normalizeDateForDb(r.data_vencimento);
          if (!Number.isFinite(valor) || !data) return null;
          return {
            data,
            data_vencimento: dataVencimento,
            descricao: r.descricao,
            valor,
            tipo: r.tipo,
            categoria_id: r.categoria_id || null,
            origem: `extrato_${banco}`,
            status_pagamento: "pago",
            frequencia: r.frequencia || null,
          };
        }).filter(Boolean);

        if (inserts.length === 0) {
          throw new Error("Nenhum lançamento válido para salvar.");
        }
        const { error } = await supabase.from("movimentacoes_financeiras").insert(inserts);
        if (error) throw error;
        toast.success(`${selecionados.length} lançamentos salvos!`);
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
        <p className="text-sm text-muted-foreground mt-1">Importe extratos bancários CSV ou faturas PDF</p>
      </div>

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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>Selecionar Todos</Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>Desmarcar Todos</Button>
              <Button onClick={categorizarComIA} disabled={isCategorizando} className="gap-2">
                {isCategorizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Categorizar com IA
              </Button>
              <Button onClick={salvarMovimentacoes} disabled={isSalvando} variant="default" className="gap-2">
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
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    {isCartao && <TableHead>Parcela</TableHead>}
                    <TableHead>Categoria</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={r.selecionado ? "" : "opacity-40"}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={r.selecionado}
                          onChange={(e) => setRows((prev) => prev.map((row, j) => j === i ? { ...row, selecionado: e.target.checked } : row))}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{r.data}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{r.data_vencimento || "—"}</TableCell>
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
                          onChange={(v) => setRows((prev) => prev.map((row, j) => j === i ? { ...row, categoria_id: v } : row))}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.frequencia || "unica"}
                          onValueChange={(v) => setRows((prev) => prev.map((row, j) => j === i ? { ...row, frequencia: v === "unica" ? null : v } : row))}
                        >
                          <SelectTrigger className="h-8 text-xs w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unica">Única</SelectItem>
                            <SelectItem value="mensal">Mensal</SelectItem>
                            <SelectItem value="anual">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${r.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                        {r.tipo === "saida" ? "-" : ""}{formatCurrency(r.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
