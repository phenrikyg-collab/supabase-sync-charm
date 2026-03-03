import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCategorias } from "@/hooks/useSupabase";

interface LancamentoImportado {
  descricao: string;
  valor: number;
  data: string;
  tipo: "entrada" | "saida";
  categoria_id?: string | null;
  categoria_sugerida?: string | null;
}

interface Props {
  onImportar: (dados: LancamentoImportado[]) => void;
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

function parseCSV(text: string): LancamentoImportado[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const rows: LancamentoImportado[] = [];

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
      if (!isNaN(num) && num !== 0) {
        valor = num;
        break;
      }
    }

    if (!data || valor === 0) continue;

    rows.push({
      data,
      descricao,
      valor: Math.abs(valor),
      tipo: valor < 0 ? "saida" : "entrada",
    });
  }

  return rows;
}

export default function ImportacaoLancamentos({ onImportar }: Props) {
  const { data: categorias } = useCategorias();
  const [banco, setBanco] = useState("generico");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        toast.error("Nenhum lançamento encontrado no arquivo. Verifique o formato.");
        return;
      }
      toast.success(`${parsed.length} lançamentos importados`);
      onImportar(parsed);
    } else if (file.name.endsWith(".pdf")) {
      setIsProcessing(true);
      toast.info("Processando PDF com IA...");
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const { data, error } = await supabase.functions.invoke("categorizar-despesa", {
            body: {
              action: "parse_pdf",
              pdf_base64: base64,
              categorias: categorias?.map((c) => ({ id: c.id, nome: c.nome_categoria, grupo_dre: c.grupo_dre })),
            },
          });
          if (error) throw error;
          if (data?.rows?.length > 0) {
            const mapped = data.rows.map((r: any) => ({
              data: r.data,
              descricao: r.descricao,
              valor: Math.abs(r.valor),
              tipo: r.valor < 0 ? ("saida" as const) : (r.tipo || "saida") as any,
              categoria_id: r.categoria_id || null,
              categoria_sugerida: r.categoria_sugerida || null,
            }));
            toast.success(`${mapped.length} lançamentos extraídos do PDF`);
            onImportar(mapped);
          } else {
            toast.error("Não foi possível extrair lançamentos do PDF.");
          }
        } catch (err: any) {
          toast.error("Erro ao processar PDF: " + (err.message || "erro desconhecido"));
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } else {
      toast.error("Formato não suportado. Use CSV ou PDF.");
    }
  }, [categorias, onImportar]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Importar Extrato</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Importe extratos bancários CSV ou faturas PDF para classificação automática
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload do Arquivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
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
            <div className="flex-1">
              <label className="text-sm font-medium text-foreground mb-1 block">Arquivo CSV ou PDF</label>
              <Input type="file" accept=".csv,.txt,.pdf" onChange={handleFile} disabled={isProcessing} />
            </div>
          </div>

          {isProcessing && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Processando arquivo com IA...</span>
            </div>
          )}

          <div className="border-2 border-dashed border-border rounded-xl p-10 text-center space-y-3">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">
              Selecione um arquivo CSV (Safra, Bradesco) ou PDF de fatura de cartão
            </p>
            <p className="text-xs text-muted-foreground/60">
              A IA irá categorizar automaticamente cada lançamento
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
