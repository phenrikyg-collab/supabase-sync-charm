// src/components/RevisaoLancamentos.tsx
// Passo 2: Tela de revisão com sugestão de categoria + % de confiança

import { useEffect, useState } from "react";
import { useClassifyCategory, Lancamento, ClassificationResult } from "@/hooks/useClassifyCategory";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  lancamentosImportados: { descricao: string; valor: number; data: string; data_vencimento?: string | null }[];
  onConcluir: () => void;
  onVoltar: () => void;
}

const CATEGORIAS = [
  { codigo: 1, nome: "Receita com Vendas" },
  { codigo: 2, nome: "Impostos Sobre Vendas" },
  { codigo: 4, nome: "Custos Variáveis" },
  { codigo: 5, nome: "Gastos com Pessoal" },
  { codigo: 6, nome: "Gastos com Ocupação" },
  { codigo: 7, nome: "Gastos com Serviços de Terceiros" },
  { codigo: 8, nome: "Gastos com Marketing" },
  { codigo: 9, nome: "Receitas não Operacionais" },
  { codigo: 10, nome: "Gastos não Operacionais" },
  { codigo: 11, nome: "Imposto de Renda e CSLL" },
  { codigo: 12, nome: "Investimentos" },
  { codigo: 13, nome: "Transferências e Ajustes de Saldo (Déb)" },
  { codigo: 14, nome: "Transferências e Ajustes de Saldo (Cré)" },
  { codigo: 15, nome: "Logística operacional" },
  { codigo: 16, nome: "Gastos com sistemas, site e aplicativos" },
  { codigo: 17, nome: "Gastos com manutenção - produção" },
  { codigo: 18, nome: "Despesas com brindes e presentes" },
  { codigo: 19, nome: "Embalagem geral" },
  { codigo: 99, nome: "Importação" },
  { codigo: 100, nome: "Compras de equipamentos" },
  { codigo: 101, nome: "Taxas de Gateway" },
  { codigo: 102, nome: "Estornos" },
  { codigo: 103, nome: "Logística de vendas" },
  { codigo: 104, nome: "Comissão de vendedores" },
  { codigo: 105, nome: "Parcelamento de saldo do cartão de crédito" },
  { codigo: 106, nome: "Despesas administrativas" },
];

function BadgeConfianca({ confianca }: { confianca: number }) {
  const cor =
    confianca >= 85
      ? "bg-green-100 text-green-700"
      : confianca >= 60
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cor}`}>{confianca}% confiança</span>;
}

export default function RevisaoLancamentos({ lancamentosImportados, onConcluir, onVoltar }: Props) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const { classificarLotes, carregando } = useClassifyCategory();

  useEffect(() => {
    const iniciais: Lancamento[] = lancamentosImportados.map((l, i) => ({
      id: `import-${i}`,
      ...l,
    }));
    setLancamentos(iniciais);
    classificarLotes(iniciais, setLancamentos);
  }, []);

  const alterarCategoria = (id: string, codigo: number) => {
    const cat = CATEGORIAS.find((c) => c.codigo === codigo);
    if (!cat) return;
    setLancamentos((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              categoria: { ...l.categoria!, codigo, nome: cat.nome, confianca: 100, motivo: "Alterado manualmente" },
            }
          : l,
      ),
    );
  };

  const salvarTodos = async () => {
    setSalvando(true);
    try {
      const registros = lancamentos
        .filter((l) => l.categoria)
        .map((l) => {
          const imported = lancamentosImportados.find((_, i) => `import-${i}` === l.id);
          return {
            descricao: l.descricao,
            valor: l.valor,
            data: l.data,
            data_vencimento: imported?.data_vencimento || null,
            tipo: l.categoria!.tipo === "Crédito" ? "entrada" : "saida",
            origem: "importacao",
          };
        });

      const { error } = await supabase.from("movimentacoes_financeiras").insert(registros);
      if (error) throw error;
      onConcluir();
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const classificados = lancamentos.filter((l) => l.categoria && !l.classificando).length;
  const total = lancamentos.length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Revisão de Lançamentos</h1>
            <p className="text-sm text-gray-500 mt-1">
              {carregando
                ? `Classificando... ${classificados}/${total}`
                : `${classificados} de ${total} lançamentos classificados`}
            </p>
          </div>
          <button onClick={onVoltar} className="text-sm text-gray-400 hover:text-gray-600">
            ← Voltar
          </button>
        </div>

        {/* Barra de progresso */}
        {carregando && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(classificados / total) * 100}%` }}
            />
          </div>
        )}

        {/* Lista de lançamentos */}
        <div className="space-y-3">
          {lancamentos.map((l) => (
            <div key={l.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-4">
                {/* Info do lançamento */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{l.descricao}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-gray-500">{l.data}</span>
                    <span className="text-sm font-semibold text-gray-700">
                      R$ {l.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Categoria sugerida */}
                <div className="flex-shrink-0 text-right space-y-1">
                  {l.classificando ? (
                    <div className="flex items-center gap-2 text-blue-500 text-sm">
                      <span className="animate-spin">⏳</span> Classificando...
                    </div>
                  ) : l.categoria ? (
                    <>
                      <BadgeConfianca confianca={l.categoria.confianca} />
                      <p className="text-sm font-semibold text-gray-700">{l.categoria.nome}</p>
                      <button
                        onClick={() => setExpandido(expandido === l.id ? null : l.id)}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        {expandido === l.id ? "Ocultar" : "Ver motivo / Alterar"}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-red-500">⚠️ Não classificado</span>
                  )}
                </div>
              </div>

              {/* Expansível: motivo + alterar categoria */}
              {expandido === l.id && l.categoria && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  <p className="text-xs text-gray-500 italic">💡 {l.categoria.motivo}</p>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Alterar categoria:</label>
                    <select
                      value={l.categoria.codigo}
                      onChange={(e) => alterarCategoria(l.id, parseInt(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c.codigo} value={c.codigo}>
                          [{c.codigo}] {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Botão salvar */}
        {!carregando && classificados > 0 && (
          <button
            onClick={salvarTodos}
            disabled={salvando}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            {salvando ? "Salvando..." : `✅ Salvar ${classificados} lançamentos`}
          </button>
        )}
      </div>
    </div>
  );
}
