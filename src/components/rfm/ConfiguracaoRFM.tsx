import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { ConfigRFM, CONFIG_RFM_PADRAO, salvarConfigRFM } from "@/lib/rfm";

type Props = {
  config: ConfigRFM;
  onChange: (cfg: ConfigRFM) => void;
};

type CampoDef = { chave: keyof ConfigRFM; label: string };

const CAMPOS: { titulo: string; campos: CampoDef[] }[] = [
  {
    titulo: "Recência",
    campos: [
      { chave: "r4", label: "Recência 4 (dias)" },
      { chave: "r3", label: "Recência 3 (dias)" },
      { chave: "r2", label: "Recência 2 (dias)" },
      { chave: "r1", label: "Recência 1 (dias)" },
    ],
  },
  {
    titulo: "Frequência",
    campos: [
      { chave: "f4", label: "Frequência 4 (pedidos)" },
      { chave: "f3", label: "Frequência 3 (pedidos)" },
      { chave: "f2", label: "Frequência 2 (pedidos)" },
      { chave: "f1", label: "Frequência 1 (pedidos)" },
    ],
  },
  {
    titulo: "Monetário",
    campos: [
      { chave: "m4", label: "Monetário 4 (R$)" },
      { chave: "m3", label: "Monetário 3 (R$)" },
      { chave: "m2", label: "Monetário 2 (R$)" },
      { chave: "m1", label: "Monetário 1 (R$)" },
    ],
  },
];

export function ConfiguracaoRFM({ config, onChange }: Props) {
  const [rascunho, setRascunho] = useState<ConfigRFM>(config);

  const set = (chave: keyof ConfigRFM, valor: string) =>
    setRascunho((r) => ({ ...r, [chave]: Number(valor.replace(",", ".")) || 0 }));

  const salvar = () => {
    salvarConfigRFM(rascunho);
    onChange(rascunho);
    toast.success("Matriz RFM atualizada");
  };

  const restaurar = () => {
    setRascunho(CONFIG_RFM_PADRAO);
    salvarConfigRFM(CONFIG_RFM_PADRAO);
    onChange(CONFIG_RFM_PADRAO);
    toast.success("Parâmetros padrão restaurados");
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="text-base">Configuração da Matriz RFM</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Faixas de pontuação (5 = melhor). A segmentação do painel é recalculada com estes valores.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={restaurar}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Padrão
          </Button>
          <Button size="sm" onClick={salvar}>
            <Save className="h-3.5 w-3.5 mr-1" />
            Salvar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {CAMPOS.map((grupo) => (
            <div key={grupo.titulo} className="rounded-lg border p-4 space-y-3">
              <p className="font-serif text-base font-semibold">{grupo.titulo}</p>
              {grupo.campos.map((c) => (
                <div key={c.chave} className="space-y-1">
                  <Label className="text-xs text-primary">{c.label}</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={String(rascunho[c.chave])}
                    onChange={(e) => set(c.chave, e.target.value)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
