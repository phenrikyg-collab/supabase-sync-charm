import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";

interface Props {
  numeroNf: string;
  setNumeroNf: (v: string) => void;
  fornecedor: string;
  setFornecedor: (v: string) => void;
  dataEntrada: string;
  setDataEntrada: (v: string) => void;
  disabled: boolean;
}

export default function DadosNotaFiscal({ numeroNf, setNumeroNf, fornecedor, setFornecedor, dataEntrada, setDataEntrada, disabled }: Props) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-serif font-bold text-lg text-foreground">Dados da Nota Fiscal</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Nº NF *</Label>
            <Input value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} placeholder="Ex: 12345" disabled={disabled} />
          </div>
          <div className="space-y-2">
            <Label>Fornecedor *</Label>
            <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" disabled={disabled} />
          </div>
          <div className="space-y-2">
            <Label>Data Entrada</Label>
            <Input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} disabled={disabled} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
