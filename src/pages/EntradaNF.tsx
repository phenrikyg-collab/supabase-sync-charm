import { useState } from "react";
import { useTecidos, useCores, useCreateEntradaTecido, useCreateRoloTecido, useCreateMovimentacao, useCategorias } from "@/hooks/useSupabase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import DadosNotaFiscal from "@/components/entrada-nf/DadosNotaFiscal";
import RolosNF, { type RoloForm } from "@/components/entrada-nf/RolosNF";
import ParcelasNF, { type Parcela } from "@/components/entrada-nf/ParcelasNF";

export default function EntradaNF() {
  const { data: tecidos } = useTecidos();
  const { data: cores } = useCores();
  const { data: categorias } = useCategorias();
  const createEntrada = useCreateEntradaTecido();
  const createRolo = useCreateRoloTecido();
  const createMov = useCreateMovimentacao();

  const [numeroNf, setNumeroNf] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [dataEntrada, setDataEntrada] = useState(new Date().toISOString().split("T")[0]);
  const [rolos, setRolos] = useState<RoloForm[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // Find categoria for "Tecidos" or "Matéria-Prima" for DRE mapping
  const categoriaTecidos = categorias?.find(
    (c) => c.descricao_categoria?.toLowerCase().includes("tecido") || c.descricao_categoria?.toLowerCase().includes("matéria")
  );

  const valorTotalRolos = rolos.reduce((sum, r) => sum + r.metragem_inicial * r.custo_por_metro, 0);

  const handleRegistrar = async () => {
    if (!numeroNf || !fornecedor) {
      toast.error("Preencha Nº NF e Fornecedor");
      return;
    }
    if (rolos.length === 0) {
      toast.error("Adicione ao menos um rolo de tecido");
      return;
    }

    setSalvando(true);
    try {
      // 1) Criar entrada
      const entrada = await createEntrada.mutateAsync({
        numero_nf: Number(numeroNf),
        fornecedor,
        data_entrada: dataEntrada,
        valor_total: valorTotalRolos,
      });

      // 2) Criar rolos vinculados
      for (const r of rolos) {
        const cor = cores?.find((c) => c.id === r.cor_id);
        await createRolo.mutateAsync({
          codigo_rolo: r.codigo_rolo,
          lote: r.lote || null,
          tecido_id: r.tecido_id,
          cor_id: r.cor_id || null,
          cor_nome: cor?.nome_cor ?? null,
          cor_hex: cor?.cor_hex ?? null,
          peso_kg: r.peso_kg,
          metragem_inicial: r.metragem_inicial,
          metragem_disponivel: r.metragem_inicial,
          custo_por_metro: r.custo_por_metro,
          entrada_tecido_id: entrada.id,
          fornecedor,
        });
      }

      // 3) Lançar parcelas nas movimentações financeiras (contas a pagar + DRE)
      for (const p of parcelas) {
        await createMov.mutateAsync({
          tipo: "saida",
          descricao: `NF ${numeroNf} - ${fornecedor} (${p.numero}/${parcelas.length})`,
          valor: p.valor,
          data: p.data_vencimento,
          categoria_id: categoriaTecidos?.id ?? null,
          origem: "nf_entrada",
          status_bling: "pendente",
          entrada_tecido_id: entrada.id,
          parcela_info: `${p.numero}/${parcelas.length}`,
        });
      }

      toast.success(`Entrada registrada com ${rolos.length} rolo(s) e ${parcelas.length} parcela(s)!`);
      setSalvo(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleNovaEntrada = () => {
    setNumeroNf("");
    setFornecedor("");
    setDataEntrada(new Date().toISOString().split("T")[0]);
    setRolos([]);
    setParcelas([]);
    setSalvo(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Entrada de <span className="text-primary">Nota Fiscal</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Registre entradas de tecido, gere rolos e lance parcelas</p>
      </div>

      <DadosNotaFiscal
        numeroNf={numeroNf} setNumeroNf={setNumeroNf}
        fornecedor={fornecedor} setFornecedor={setFornecedor}
        dataEntrada={dataEntrada} setDataEntrada={setDataEntrada}
        disabled={salvo}
      />

      <RolosNF rolos={rolos} setRolos={setRolos} tecidos={tecidos} cores={cores} disabled={salvo} />

      <ParcelasNF parcelas={parcelas} setParcelas={setParcelas} disabled={salvo} dataEntrada={dataEntrada} />

      {/* Resumo e botão */}
      {!salvo ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {rolos.length} rolo(s) • Valor total: R$ {valorTotalRolos.toFixed(2)} • {parcelas.length} parcela(s)
          </p>
          <Button onClick={handleRegistrar} disabled={salvando}>
            {salvando ? "Registrando..." : "Registrar Entrada"}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 bg-accent/10 border border-accent/30 rounded-lg">
          <p className="text-sm text-foreground">✓ Entrada registrada com sucesso! {rolos.length} rolo(s) e {parcelas.length} parcela(s).</p>
          <Button variant="outline" onClick={handleNovaEntrada}>Nova Entrada</Button>
        </div>
      )}
    </div>
  );
}
