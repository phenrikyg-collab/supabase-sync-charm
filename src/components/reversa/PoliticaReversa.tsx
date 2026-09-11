import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { configListar, configSalvar } from "@/lib/reversaPainel";

type Config = { chave: string; valor: any; rotulo?: string; descricao?: string };

function normalizar(bruto: any): Config[] {
  if (Array.isArray(bruto)) return bruto as Config[];
  if (bruto && typeof bruto === "object")
    return Object.entries(bruto).map(([chave, valor]) => ({ chave, valor }));
  return [];
}

const ROTULOS: Record<string, string> = {
  prazo_arrependimento_dias: "Prazo de arrependimento (dias)",
  prazo_defeito_dias: "Prazo para defeito (dias)",
  validade_codigo_dias: "Validade do código de postagem (dias)",
  servicos: "Serviços dos Correios",
  regra_frete: "Regra de frete",
  centro_retorno: "Centro de retorno",
  revalidacao_automatica: "Revalidação automática",
};

export function PoliticaReversa() {
  const { toast } = useToast();
  const [itens, setItens] = useState<Config[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState("");

  async function carregar() {
    setCarregando(true);
    try {
      const lista = normalizar(await configListar());
      setItens(lista);
      const v: Record<string, string> = {};
      lista.forEach((c) => {
        v[c.chave] = typeof c.valor === "object" ? JSON.stringify(c.valor) : String(c.valor ?? "");
      });
      setValores(v);
    } catch (e: any) {
      toast({ title: "Não foi possível carregar", description: e.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(chave: string) {
    setSalvando(chave);
    const bruto = valores[chave];
    let valor: any = bruto;
    try {
      valor = JSON.parse(bruto);
    } catch {
      valor = bruto;
    }
    try {
      await configSalvar(chave, valor);
      toast({ title: "Política atualizada" });
    } catch (e: any) {
      toast({ title: "Não deu certo", description: e.message, variant: "destructive" });
    } finally {
      setSalvando("");
    }
  }

  if (carregando)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border bg-accent/40 p-3 text-sm">
        Mudar a política vale para as próximas solicitações.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Política de trocas e devoluções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {itens.map((c) => (
            <div key={c.chave} className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor={`cfg-${c.chave}`}>{c.rotulo ?? ROTULOS[c.chave] ?? c.chave}</Label>
                <Input
                  id={`cfg-${c.chave}`}
                  value={valores[c.chave] ?? ""}
                  onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}
                />
                {c.descricao && (
                  <p className="mt-1 text-xs text-muted-foreground">{c.descricao}</p>
                )}
              </div>
              <Button onClick={() => salvar(c.chave)} disabled={salvando === c.chave}>
                {salvando === c.chave && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          ))}
          {!itens.length && <p className="text-sm text-muted-foreground">Nada configurado ainda.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
