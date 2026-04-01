import { useState } from "react";
import ImportacaoLancamentos, { DadosCartao } from "@/components/ImportacaoLancamentos";
import RevisaoLancamentos from "@/components/RevisaoLancamentos";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

type Etapa = "importar" | "revisar" | "concluido";

interface LancamentoImportado {
  descricao: string;
  valor: number;
  data: string;
  data_vencimento?: string | null;
  tipo?: "entrada" | "saida";
  categoria_id?: string | null;
  categoria_sugerida?: string | null;
  categoria?: any;
}

export default function ImportarPage() {
  const [etapa, setEtapa] = useState<Etapa>("importar");
  const [lancamentos, setLancamentos] = useState<LancamentoImportado[]>([]);
  const [dadosCartao, setDadosCartao] = useState<DadosCartao | undefined>();

  const handleImportar = (dados: LancamentoImportado[], cartao?: DadosCartao) => {
    setLancamentos(dados);
    setDadosCartao(cartao);
    setEtapa("revisar");
  };

  if (etapa === "importar") {
    return <ImportacaoLancamentos onImportar={handleImportar} />;
  }

  if (etapa === "revisar") {
    return (
      <RevisaoLancamentos
        lancamentosImportados={lancamentos}
        dadosCartao={dadosCartao}
        onConcluir={() => setEtapa("concluido")}
        onVoltar={() => setEtapa("importar")}
      />
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-card rounded-2xl shadow-lg p-10 max-w-md w-full text-center space-y-6 border border-border">
        <CheckCircle2 className="h-16 w-16 mx-auto text-success" />
        <h1 className="text-2xl font-serif font-bold text-foreground">Lançamentos salvos!</h1>
        <p className="text-muted-foreground">
          Todos os lançamentos foram classificados e salvos com sucesso.
        </p>
        <Button onClick={() => { setEtapa("importar"); setDadosCartao(undefined); }} className="w-full">
          Importar novo arquivo
        </Button>
      </div>
    </div>
  );
}
