import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Sparkles, Check, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCategorias } from "@/hooks/useSupabase";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { useQueryClient } from "@tanstack/react-query";

interface ParsedRow {
  data: string;
  data_vencimento: string | null;
  descricao: string;
  valor: number;
  categoria_id: string | null;
  categoria_sugerida: string | null;
  tipo: "entrada" | "saida";
  selecionado: boolean;
}

function parseDate(raw: string): string {
  // Handle dd/mm/yyyy
  const parts = raw.trim().split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y.length === 2 ? "20" + y : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Handle yyyy-mm-dd
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

function parseCSVSafra(text: string): ParsedRow[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const rows: ParsedRow[] = [];

  for (const line of lines) {
    // Try semicolon first then comma
    const sep = line.includes(";") ? ";" : ",";
    const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));

    // Skip header lines
    if (cols[0]?.toLowerCase().includes("data") || cols[0]?.toLowerCase().includes("date")) continue;
    if (cols.length < 2) continue;

    // Try to detect date in first column
    const dateCandidate = cols[0];
    if (!/\d/.test(dateCandidate)) continue;

    const data = parseDate(dateCandidate);
    // Description is usually col 1 or 2
    const descricao = cols.length >= 3 ? cols[1] : cols[1];
    // Value - find numeric column
    let valor = 0;
    for (let i = cols.length - 1; i >= 1; i--) {
      const cleaned = cols[i].replace(/[R$\s.]/g, "").replace(",", ".");
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num !== 0) {
        valor = num;
        break;
      }
    }

    if (!data || valor === 0) continue;

    rows.push({
      data,
      data_vencimento: null,
      descricao: descricao || "Sem descrição",
      valor: Math.abs(valor),
      tipo: valor < 0 ? "saida" : "entrada",
      categoria_id: null,
      categoria_sugerida: null,
      selecionado: true,
    });
  }

  return rows;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function ImportarExtrato() {
  const { data: categorias } = useCategorias();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isCategorizando, setIsCategorizando] = useState(false);
  const [isSalvando, setIsSalvando] = useState(false);
  const [banco, setBanco] = useState("generico");
  const [cartaoNome, setCartaoNome] = useState("");
  const [faturaVencimento, setFaturaVencimento] = useState("");
  

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
      const text = await file.text();
      const parsed = parseCSVSafra(text);
      if (parsed.length === 0) {
        toast.error("Nenhum lançamento encontrado no arquivo. Verifique o formato.");
        return;
      }
      setRows(parsed);
      toast.success(`${parsed.length} lançamentos importados`);
    } else if (file.name.endsWith(".pdf")) {
      toast.info("Processando PDF... A IA irá extrair os lançamentos.");
      // For PDF, we'll read as base64 and send to edge function
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const data = await invokeEdgeFunction("categorizar-despesa", {
            action: "parse_pdf",
            pdf_base64: base64,
            categorias: categorias?.map((c) => ({ id: c.id, nome: c.nome_categoria, grupo_dre: c.grupo_dre })),
          });
          if (data?.rows?.length > 0) {
            setRows(data.rows.map((r: any) => ({
              data: r.data,
              data_vencimento: r.data_vencimento || null,
              descricao: r.descricao,
              valor: Math.abs(r.valor),
              tipo: r.valor < 0 ? "saida" as const : (r.tipo || "saida") as any,
              categoria_id: r.categoria_id || null,
              categoria_sugerida: r.categoria_sugerida || null,
              selecionado: true,
            })));
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
      toast.error("Formato não suportado. Use CSV ou PDF.");
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

    const isCartao = banco === "cartao";

    if (isCartao && !cartaoNome.trim()) {
      toast.error("Informe o nome do cartão.");
      return;
    }

    if (isCartao && !faturaVencimento) {
      toast.error("Informe a data de vencimento da fatura.");
      return;
    }

    setIsSalvando(true);
    try {
      let faturaId: string | null = null;

      // Se for cartão, criar ou localizar fatura por (cartao_nome + data_vencimento)
      if (isCartao) {
        const totalFatura = selecionados.reduce((s, r) => s + r.valor, 0);
        const mesRef = selecionados[0]?.data?.substring(0, 7) || new Date().toISOString().substring(0, 7);

        // Buscar fatura existente por cartão + vencimento
        const { data: faturaExistente } = await supabase
          .from("cartoes_faturas")
          .select("id, valor_total")
          .eq("cartao_nome", cartaoNome.trim())
          .eq("data_vencimento", faturaVencimento)
          .maybeSingle();

        if (faturaExistente) {
          faturaId = faturaExistente.id;
          // Somar ao valor total existente
          await supabase
            .from("cartoes_faturas")
            .update({
              valor_total: (faturaExistente.valor_total ?? 0) + totalFatura,
              saldo_em_aberto: (faturaExistente.valor_total ?? 0) + totalFatura - 0,
            })
            .eq("id", faturaId);
        } else {
          const { data: novaFatura, error: errFatura } = await supabase
            .from("cartoes_faturas")
            .insert({
              cartao_nome: cartaoNome.trim(),
              mes_referencia: mesRef,
              valor_total: totalFatura,
              saldo_em_aberto: totalFatura,
              data_vencimento: faturaVencimento,
              status: "aberta",
              valor_pago: 0,
            })
            .select("id")
            .single();
          if (errFatura) throw errFatura;
          faturaId = novaFatura.id;
        }
      }

      // Buscar categoria padrão para fallback
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

      const inserts = selecionados
        .map((r) => {
          const valor = normalizeNumberForDb(r.valor);
          const data = normalizeDateForDb(r.data);
          const dataVencimento = normalizeDateForDb(r.data_vencimento);

          if (!Number.isFinite(valor) || !data) return null;

          const base: any = {
            data,
            data_vencimento: isCartao ? faturaVencimento : dataVencimento,
            descricao: r.descricao,
            valor,
            tipo: isCartao ? "saida" : r.tipo,
            categoria_id: r.categoria_id || (isCartao ? categoriaPadrao : null),
            origem: `extrato_${banco}`,
            status_pagamento: isCartao ? "em_aberto" : "pago",
          };

          if (isCartao) {
            base.conta_tipo = "cartao_fatura";
            base.fatura_id = faturaId;
            base.impacta_dre = true;
            base.impacta_fluxo = false;
          }

          return base;
        })
        .filter(Boolean);

      if (inserts.length === 0) {
        throw new Error("Nenhum lançamento válido para salvar. Revise as datas e valores importados.");
      }

      const { error } = await supabase.from("movimentacoes_financeiras").insert(inserts);
      if (error) throw error;

      toast.success(`${selecionados.length} lançamentos salvos!${isCartao ? ` Fatura vinculada: ${cartaoNome}` : ""}`);
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
      .map(([grupo, itens]) => ({
        grupo,
        itens: itens.sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.grupo.localeCompare(b.grupo));
  }, [categorias]);

  const catMap = Object.fromEntries(
    (categorias ?? []).map((c) => [c.id, (c.descricao_categoria || c.nome_categoria || "")])
  );

  const totalEntradas = rows.filter((r) => r.selecionado && r.tipo === "entrada").reduce((s, r) => s + r.valor, 0);
  const totalSaidas = rows.filter((r) => r.selecionado && r.tipo === "saida").reduce((s, r) => s + r.valor, 0);
  const totalGeral = rows.filter((r) => r.selecionado).reduce((s, r) => s + r.valor, 0);

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
                  <SelectItem value="cartao">Cartão de Crédito (PDF)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {banco === "cartao" && (
              <>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-sm font-medium text-foreground mb-1 block">Nome do Cartão</label>
                  <Input placeholder="Ex: Nubank, Itaú..." value={cartaoNome} onChange={(e) => setCartaoNome(e.target.value)} />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-sm font-medium text-foreground mb-1 block">Vencimento da Fatura</label>
                  <Input type="date" value={faturaVencimento} onChange={(e) => setFaturaVencimento(e.target.value)} />
                </div>
              </>
            )}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-foreground mb-1 block">Arquivo CSV ou PDF</label>
              <Input type="file" accept=".csv,.txt,.pdf" onChange={handleFile} />
            </div>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
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
                    <TableHead>Categoria</TableHead>
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
                      <TableCell>
                        <Select
                          value={r.categoria_id || "none"}
                          onValueChange={(v) => setRows((prev) => prev.map((row, j) => j === i ? { ...row, categoria_id: v === "none" ? null : v } : row))}
                        >
                          <SelectTrigger className="h-8 text-xs w-[180px]">
                            <SelectValue placeholder={r.categoria_sugerida || "Sem categoria"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem categoria</SelectItem>
                            {categorias?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.nome_categoria}</SelectItem>
                            ))}
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
