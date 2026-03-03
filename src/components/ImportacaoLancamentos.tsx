// src/components/ImportacaoLancamentos.tsx
// Passo 1: Usuário importa o arquivo CSV/Excel

import { useRef } from "react";

interface Props {
  onImportar: (lancamentos: { descricao: string; valor: number; data: string }[]) => void;
}

export default function ImportacaoLancamentos({ onImportar }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const texto = ev.target?.result as string;
      const linhas = texto.trim().split("\n");

      // Ignora o cabeçalho (primeira linha)
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-lg w-full text-center space-y-6">
        <div className="text-5xl">📂</div>
        <h1 className="text-2xl font-bold text-gray-800">Importar Lançamentos</h1>
        <p className="text-gray-500 text-sm">
          Importe um arquivo <strong>.csv</strong> com suas despesas.<br />
          O arquivo deve ter as colunas: <code className="bg-gray-100 px-1 rounded">descricao, valor, data</code>
        </p>

        {/* Exemplo de formato */}
        <div className="bg-gray-50 rounded-lg p-4 text-left text-xs text-gray-500 font-mono">
          <p className="font-semibold text-gray-600 mb-1">Exemplo de CSV:</p>
          <p>descricao,valor,data</p>
          <p>Aluguel escritório,3500,2026-03-01</p>
          <p>Google Ads,800,2026-03-02</p>
          <p>Salário equipe,12000,2026-03-05</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleArquivo}
          className="hidden"
        />

        <button
          onClick={() => inputRef.current?.click()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          Selecionar arquivo CSV
        </button>
      </div>
    </div>
  );
}
