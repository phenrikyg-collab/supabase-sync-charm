// src/components/ImportacaoLancamentos.tsx
// Versão 2: aceita CSV e PDF de extrato de cartão

import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LancamentoImportado {
  descricao: string;
  valor: number;
  data: string;
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

      const { data, error } = await supabase.functions.invoke("classify-category", {
        body: { pdfBase64: base64 },
      });

      if (error) throw new Error(error.message);
      if (!data?.transacoes?.length) throw new Error("Nenhuma transação encontrada no PDF");

      const lancamentos: LancamentoImportado[] = data.transacoes.map((t: any) => ({
        descricao: t.descricao,
        valor: t.valor,
        data: t.data,
        categoria: t.categoria,
      }));

      onImportar(lancamentos);
    } catch (err: any) {
      setErro(err.message || "Erro ao processar o PDF");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-lg w-full text-center space-y-6">
        <div className="text-5xl">📂</div>
        <h1 className="text-2xl font-bold text-gray-800">Importar Lançamentos</h1>
        <p className="text-gray-500 text-sm">
          Importe um extrato de cartão em <strong>PDF</strong> ou uma planilha em <strong>CSV</strong>.
        </p>

        {processando ? (
          <div className="space-y-3">
            <div className="animate-spin text-4xl">⏳</div>
            <p className="text-blue-600 font-medium">Lendo o PDF e classificando transações...</p>
            <p className="text-gray-400 text-sm">Isso pode levar alguns segundos</p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => pdfRef.current?.click()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              📄 Importar extrato PDF
            </button>
            <p className="text-xs text-gray-400">
              Extratos de cartão de crédito em PDF — o Claude extrai e classifica automaticamente
            </p>

            <div className="flex items-center gap-3 text-gray-300">
              <hr className="flex-1" />
              <span className="text-sm text-gray-400">ou</span>
              <hr className="flex-1" />
            </div>

            <button
              onClick={() => csvRef.current?.click()}
              className="w-full border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              📊 Importar planilha CSV
            </button>
            <p className="text-xs text-gray-400">
              Arquivo com colunas: <code className="bg-gray-100 px-1 rounded">descricao, valor, data</code>
            </p>
          </div>
        )}

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            ⚠️ {erro}
          </div>
        )}

        <input ref={pdfRef} type="file" accept=".pdf" onChange={handlePDF} className="hidden" />
        <input ref={csvRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
      </div>
    </div>
  );
}
