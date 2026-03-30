// src/components/ImportacaoLancamentos.tsx
// Versão 3: aceita CSV e PDF de extrato de cartão, com datas de competência e vencimento

import { useRef, useState } from "react";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { useCategorias } from "@/hooks/useSupabase";

interface LancamentoImportado {
  descricao: string;
  valor: number;
  data: string;
  data_vencimento?: string | null;
  categoria?: any;
}

interface Props {
  onImportar: (lancamentos: LancamentoImportado[]) => void;
}

export default function ImportacaoLancamentos({ onImportar }: Props) {
  const csvRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { data: categorias } = useCategorias();

  // ── Importação CSV ──────────────────────────────────────────────────────────
  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const texto = ev.target?.result as string;
      const linhas = texto.trim().split("\n");
      const lancamentos = linhas.slice(1).map((linha, i) => {
        const colunas = linha.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        return {
          descricao: colunas[0] || `Lançamento ${i + 1}`,
          valor: parseFloat(colunas[1]) || 0,
          data: colunas[2] || new Date().toISOString().split("T")[0],
          data_vencimento: null,
        };
      }).filter((l) => l.descricao);

      onImportar(lancamentos);
    };
    reader.readAsText(file);
  };

  // ── Importação PDF ──────────────────────────────────────────────────────────
  const handlePDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessando(true);
    setErro(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
        reader.readAsDataURL(file);
      });

      const data = await invokeEdgeFunction("categorizar-despesa", {
        action: "parse_pdf",
        pdf_base64: base64,
        categorias: categorias?.map((c) => ({ id: c.id, nome: c.nome_categoria, grupo_dre: c.grupo_dre })),
      });

      if (!data?.rows?.length) throw new Error("Nenhuma transação encontrada no PDF");

      const lancamentos: LancamentoImportado[] = data.rows.map((t: any) => ({
        descricao: t.descricao,
        valor: Math.abs(t.valor),
        data: t.data,
        data_vencimento: t.data_vencimento || null,
        categoria: t.categoria_sugerida ? { nome: t.categoria_sugerida, id: t.categoria_id } : undefined,
      }));

      onImportar(lancamentos);
    } catch (err: any) {
      setErro(err.message || "Erro ao processar o PDF");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="bg-card rounded-2xl shadow-lg p-10 max-w-lg w-full text-center space-y-6 border border-border">
        <div className="text-5xl">📂</div>
        <h1 className="text-2xl font-bold text-foreground">Importar Lançamentos</h1>
        <p className="text-muted-foreground text-sm">
          Importe um extrato de cartão em <strong>PDF</strong> ou uma planilha em <strong>CSV</strong>.
        </p>

        {/* Campo de vencimento da fatura */}
        <div className="text-left">
          <label className="text-sm font-medium text-foreground mb-1 block">Vencimento da Fatura (fluxo de caixa)</label>
          <input
            type="date"
            value={vencimentoFatura}
            onChange={(e) => setVencimentoFatura(e.target.value)}
            className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {vencimentoFatura && (
            <p className="text-xs text-muted-foreground mt-1">
              📅 Competência = data da transação · Vencimento = {vencimentoFatura.split("-").reverse().join("/")}
            </p>
          )}
        </div>

        {processando ? (
          <div className="space-y-3">
            <div className="animate-spin text-4xl">⏳</div>
            <p className="text-primary font-medium">Lendo o PDF e classificando transações...</p>
            <p className="text-muted-foreground text-sm">Isso pode levar alguns segundos</p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => pdfRef.current?.click()}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              📄 Importar extrato PDF
            </button>
            <p className="text-xs text-muted-foreground">
              Extratos de cartão de crédito em PDF — a IA extrai e classifica automaticamente
            </p>

            <div className="flex items-center gap-3 text-muted-foreground/50">
              <hr className="flex-1 border-border" />
              <span className="text-sm text-muted-foreground">ou</span>
              <hr className="flex-1 border-border" />
            </div>

            <button
              onClick={() => csvRef.current?.click()}
              className="w-full border border-input hover:bg-accent text-foreground font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              📊 Importar planilha CSV
            </button>
            <p className="text-xs text-muted-foreground">
              Arquivo com colunas: <code className="bg-muted px-1 rounded">descricao, valor, data</code>
            </p>
          </div>
        )}

        {erro && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
            ⚠️ {erro}
          </div>
        )}

        <input ref={pdfRef} type="file" accept=".pdf" onChange={handlePDF} className="hidden" />
        <input ref={csvRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
      </div>
    </div>
  );
}
