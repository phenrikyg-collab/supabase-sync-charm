import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, CreditCard } from "lucide-react";

export interface Parcela {
  numero: number;
  data_vencimento: string;
  valor: number;
}

interface Props {
  parcelas: Parcela[];
  setParcelas: (p: Parcela[]) => void;
  disabled: boolean;
  dataEntrada: string;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function ParcelasNF({ parcelas, setParcelas, disabled, dataEntrada }: Props) {
  const addParcela = () => {
    const num = parcelas.length + 1;
    // Default: 30 days after last parcela or data_entrada
    const lastDate = parcelas.length > 0 ? parcelas[parcelas.length - 1].data_vencimento : dataEntrada;
    const d = new Date(lastDate);
    d.setDate(d.getDate() + 30);
    setParcelas([...parcelas, { numero: num, data_vencimento: d.toISOString().split("T")[0], valor: 0 }]);
  };

  const removeParcela = (i: number) => {
    setParcelas(parcelas.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, numero: idx + 1 })));
  };

  const updateParcela = (i: number, field: keyof Parcela, value: any) => {
    const updated = [...parcelas];
    updated[i] = { ...updated[i], [field]: value };
    setParcelas(updated);
  };

  const totalParcelas = parcelas.reduce((sum, p) => sum + p.valor, 0);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="font-serif font-bold text-lg text-foreground">Parcelas</h2>
          </div>
          {!disabled && (
            <Button variant="outline" size="sm" onClick={addParcela} className="gap-1">
              <Plus className="h-4 w-4" /> Adicionar Parcela
            </Button>
          )}
        </div>

        {parcelas.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Parcela</TableHead>
                  <TableHead>Data Vencimento</TableHead>
                  <TableHead className="text-right">Valor (R$)</TableHead>
                  {!disabled && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelas.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.numero}/{parcelas.length}</TableCell>
                    <TableCell>
                      {disabled ? p.data_vencimento : (
                        <Input type="date" value={p.data_vencimento} onChange={(e) => updateParcela(i, "data_vencimento", e.target.value)} className="w-44" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {disabled ? formatCurrency(p.valor) : (
                        <Input type="number" step="0.01" value={p.valor || ""} onChange={(e) => updateParcela(i, "valor", Number(e.target.value))} className="w-32 ml-auto text-right" />
                      )}
                    </TableCell>
                    {!disabled && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeParcela(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-right text-sm font-medium text-foreground">
              Total Parcelas: {formatCurrency(totalParcelas)}
            </div>
          </>
        ) : (
          <p className="text-center text-muted-foreground py-4 text-sm">
            Nenhuma parcela adicionada. Clique em "Adicionar Parcela" para incluir.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
