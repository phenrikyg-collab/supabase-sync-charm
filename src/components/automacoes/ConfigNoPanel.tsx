import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, X } from "lucide-react";
import { SEGMENTOS_RFM, TIPOS_NO, resumoGatilho, type NoData } from "./tipos";

const DICA_VARIAVEIS = "Variáveis disponíveis: {{nome}} e {{primeiro_nome}}";

type Props = {
  data: NoData;
  onChange: (config: Record<string, any>) => void;
  onRemover: () => void;
  onFechar: () => void;
};

export function ConfigNoPanel({ data, onChange, onRemover, onFechar }: Props) {
  const [config, setConfig] = useState<Record<string, any>>(data.config ?? {});
  const meta = TIPOS_NO[data.tipo] ?? TIPOS_NO.fim;
  const Icone = meta.icon;

  useEffect(() => {
    setConfig(data.config ?? {});
  }, [data]);

  const { data: tags = [] } = useQuery({
    queryKey: ["whatsapp-tags"],
    enabled: data.tipo === "aplicar_tag",
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc("whatsapp_listar_tags" as any);
      if (error) throw error;
      return (d ?? []) as any[];
    },
  });

  const set = (patch: Record<string, any>) => {
    const novo = { ...config, ...patch };
    setConfig(novo);
    onChange(novo);
  };

  return (
    <Card className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Icone className={`h-4 w-4 ${meta.cor}`} />
          <span className="text-sm font-semibold truncate">{meta.label}</span>
        </div>
        <Button size="icon" variant="ghost" onClick={onFechar} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {data.tipo === "gatilho" && (
          <p className="text-sm text-muted-foreground">
            {resumoGatilho(data.gatilhoTipo, data.gatilhoConfig)}
            <br />
            <span className="text-xs">O gatilho é definido na criação do fluxo e não pode ser removido.</span>
          </p>
        )}

        {data.tipo === "espera" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Dias</Label>
              <Input
                type="number"
                min={0}
                value={config.dias ?? 0}
                onChange={(e) => set({ dias: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Horas</Label>
              <Input
                type="number"
                min={0}
                value={config.horas ?? 0}
                onChange={(e) => set({ horas: Number(e.target.value) })}
              />
            </div>
          </div>
        )}

        {data.tipo === "enviar_email" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Assunto</Label>
              <Input value={config.assunto ?? ""} onChange={(e) => set({ assunto: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Corpo (HTML)</Label>
              <Textarea
                rows={10}
                className="font-mono text-xs"
                value={config.corpo ?? ""}
                onChange={(e) => set({ corpo: e.target.value })}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{DICA_VARIAVEIS}</p>
            <p className="text-[11px] text-muted-foreground">
              O envio de e-mail só funciona após a configuração do Resend; antes disso a execução registra erro.
            </p>
          </>
        )}

        {data.tipo === "enviar_whatsapp" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Mensagem</Label>
              <Textarea rows={8} value={config.mensagem ?? ""} onChange={(e) => set({ mensagem: e.target.value })} />
            </div>
            <p className="text-[11px] text-muted-foreground">{DICA_VARIAVEIS}</p>
            <p className="text-[11px] text-muted-foreground">
              Envio proativo fora da janela de 24h exige template aprovado pela Meta (ainda não implementado).
            </p>
          </>
        )}

        {data.tipo === "aplicar_tag" && (
          <div className="space-y-1">
            <Label className="text-xs">Tag</Label>
            <Select
              value={config.tag_id != null ? String(config.tag_id) : undefined}
              onValueChange={(v) => {
                const t = tags.find((x) => String(x.id) === v);
                set({ tag_id: Number.isNaN(Number(v)) ? v : Number(v), tag_nome: t?.nome ?? t?.titulo ?? null });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma tag" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((t) => (
                  <SelectItem key={String(t.id)} value={String(t.id)}>
                    {t.nome ?? t.titulo ?? `Tag ${t.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {data.tipo === "condicao" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Campo</Label>
              <Select
                value={config.campo ?? "segmento_rfm"}
                onValueChange={(v) => set({ campo: v, valor: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="segmento_rfm">Segmento RFM</SelectItem>
                  <SelectItem value="dias_desde_ultima_compra">Dias desde a última compra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Operador</Label>
              <Select value={config.operador ?? "="} onValueChange={(v) => set({ operador: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="=">igual a</SelectItem>
                  <SelectItem value=">=">maior ou igual a</SelectItem>
                  <SelectItem value="<=">menor ou igual a</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor</Label>
              {(config.campo ?? "segmento_rfm") === "segmento_rfm" ? (
                <Select value={config.valor || undefined} onValueChange={(v) => set({ valor: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTOS_RFM.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
                  value={config.valor ?? ""}
                  onChange={(e) => set({ valor: e.target.value })}
                />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Saída de cima = "sim", saída de baixo = "não".
            </p>
          </>
        )}

        {data.tipo === "fim" && (
          <p className="text-sm text-muted-foreground">Encerra a execução do fluxo. Sem configuração.</p>
        )}
      </div>

      {data.tipo !== "gatilho" && (
        <div className="p-3 border-t border-border">
          <Button variant="outline" size="sm" className="w-full text-danger" onClick={onRemover}>
            <Trash2 className="h-4 w-4 mr-2" />
            Remover nó
          </Button>
        </div>
      )}
    </Card>
  );
}
