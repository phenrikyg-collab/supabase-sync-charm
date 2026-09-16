import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ConfigItem = { valor: unknown; descricao?: string | null };
type Config = Record<string, ConfigItem>;

const NUMERICOS = [
  "dias_sem_postagem",
  "dias_parado",
  "folga_previsao_dias",
  "dias_importar",
  "dias_parar",
  "me_paginas",
];
const TEXTOS = ["pagina_base_url", "whatsapp_atendimento"];

const ROTULOS: Record<string, string> = {
  dias_sem_postagem: "Dias sem postagem",
  dias_parado: "Dias parado",
  folga_previsao_dias: "Folga na previsão (dias)",
  dias_importar: "Dias para importar",
  dias_parar: "Dias para parar de consultar",
  me_paginas: "Páginas do Melhor Envio",
  pagina_base_url: "Endereço da página de rastreio",
  whatsapp_atendimento: "WhatsApp do atendimento",
};

export function ConfiguracoesTab() {
  const { data, refetch } = useQuery({
    queryKey: ["logistica-config"],
    queryFn: async () => {
      const { data, error } = await chamarRpc<Config>("logistica_config_ler");
      if (error) throw error;
      return data ?? {};
    },
  });

  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const inicial: Record<string, string> = {};
    Object.entries(data).forEach(([chave, item]) => {
      inicial[chave] = item?.valor === null || item?.valor === undefined ? "" : String(item.valor);
    });
    setValores(inicial);
  }, [data]);

  async function salvar(chave: string, numerico: boolean) {
    const bruto = valores[chave] ?? "";
    let valor: unknown;
    if (numerico) {
      if (bruto.trim() === "") {
        toast.error("Informe um número");
        return;
      }
      valor = Number(String(bruto).replace(",", "."));
      if (Number.isNaN(valor as number)) {
        toast.error("Informe um número");
        return;
      }
    } else {
      valor = bruto.trim() === "" ? null : bruto;
    }
    setSalvando(chave);
    const { data: resposta, error } = await chamarRpc<{ ok?: boolean; erro?: string | null }>(
      "logistica_config_salvar",
      { p_chave: chave, p_valor: valor },
    );
    setSalvando(null);
    if (error) {
      toast.error(error.message || "Não foi possível salvar");
      return;
    }
    if (resposta && resposta.ok === false) {
      toast.error(resposta.erro || "Não foi possível salvar");
      return;
    }
    toast.success("Configuração salva");
    refetch();
  }

  function campo(chave: string, numerico: boolean) {
    const item = data?.[chave];
    return (
      <div key={chave} className="space-y-1.5">
        <Label htmlFor={`cfg-${chave}`}>{ROTULOS[chave] ?? chave}</Label>
        <div className="flex gap-2">
          <Input
            id={`cfg-${chave}`}
            type={numerico ? "number" : "text"}
            value={valores[chave] ?? ""}
            onChange={(e) => setValores((v) => ({ ...v, [chave]: e.target.value }))}
          />
          <Button variant="outline" onClick={() => salvar(chave, numerico)} disabled={salvando === chave}>
            Salvar
          </Button>
        </div>
        {item?.descricao && <p className="text-xs text-muted-foreground">{item.descricao}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Prazos e consultas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{NUMERICOS.map((c) => campo(c, true))}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Página e atendimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{TEXTOS.map((c) => campo(c, false))}</CardContent>
      </Card>
    </div>
  );
}
