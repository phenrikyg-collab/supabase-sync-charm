import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { rpcCashback, listaDe, dataHoraBr, numero, type Linha } from "@/lib/cashback";
import { EstadoVazio } from "./Estados";

type Props = {
  resumo: Record<string, any>;
  templatesEmail: string[];
  onAtualizar: () => void;
};

export function ReguaTab({ resumo, templatesEmail, onAtualizar }: Props) {
  const regua = listaDe(resumo.regua).slice().sort((a, b) => numero(a.ordem) - numero(b.ordem));
  const falhados = listaDe(resumo.avisos_falhados ?? resumo.avisos_com_problema);
  const [salvando, setSalvando] = useState<string | null>(null);

  async function salvar(tipo: string, patch: Record<string, any>) {
    setSalvando(tipo);
    try {
      await rpcCashback("cashback_regua_salvar", { p_tipo: tipo, p_patch: patch });
      toast.success("Régua atualizada.");
      onAtualizar();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
        O disparo por WhatsApp só funciona com template aprovado na Meta. Sem o nome do template preenchido, o aviso
        falha e volta para a fila. A ordem dos parâmetros do template é fixa: nome da cliente, valor do cupom, valor
        mínimo, validade.
      </div>

      {regua.length === 0 ? (
        <Card><CardContent className="p-0"><EstadoVazio titulo="Nenhum aviso configurado na régua." /></CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {regua.map((r: Linha) => {
            const canais: string[] = Array.isArray(r.canais) ? r.canais : [];
            const tipo = String(r.tipo);
            const alternarCanal = (canal: string) => {
              const novos = canais.includes(canal) ? canais.filter((c) => c !== canal) : [...canais, canal];
              salvar(tipo, { canais: novos });
            };
            return (
              <Card key={tipo}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{r.nome ?? tipo}</p>
                      {r.descricao && <p className="mt-0.5 text-xs text-muted-foreground">{r.descricao}</p>}
                    </div>
                    <Switch
                      checked={!!r.ativo}
                      disabled={salvando === tipo}
                      onCheckedChange={(v) => salvar(tipo, { ativo: v })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Canais</Label>
                    <div className="flex gap-2">
                      <Toggle
                        size="sm"
                        variant="outline"
                        pressed={canais.includes("whatsapp")}
                        onPressedChange={() => alternarCanal("whatsapp")}
                      >
                        WhatsApp
                      </Toggle>
                      <Toggle
                        size="sm"
                        variant="outline"
                        pressed={canais.includes("email")}
                        onPressedChange={() => alternarCanal("email")}
                      >
                        E-mail
                      </Toggle>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Template de WhatsApp</Label>
                    <Input
                      className="h-9"
                      defaultValue={r.template_whatsapp ?? ""}
                      placeholder="nome do template aprovado na Meta"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (r.template_whatsapp ?? "")) salvar(tipo, { template_whatsapp: v || null });
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Template de e-mail</Label>
                    <Select
                      value={r.template_email ?? ""}
                      onValueChange={(v) => salvar(tipo, { template_email: v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Escolha um template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templatesEmail.length === 0 ? (
                          <SelectItem value="__vazio" disabled>Nenhum template auto-cashback</SelectItem>
                        ) : (
                          templatesEmail.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {r.dias_antes != null && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Avisar quantos dias antes</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-9 w-28"
                        defaultValue={numero(r.dias_antes)}
                        onBlur={(e) => {
                          const v = Math.max(0, Math.round(numero(e.target.value)));
                          if (v !== numero(r.dias_antes)) salvar(tipo, { dias_antes: v });
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <h3 className="border-b p-4 text-sm font-medium">Avisos com problema</h3>
          {falhados.length === 0 ? (
            <EstadoVazio titulo="Nenhum aviso falhou." />
          ) : (
            <div className="divide-y">
              {falhados.map((a: Linha, i) => (
                <div key={a.id ?? i} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {a.tipo} · {a.cliente ?? a.nome ?? ""} · {a.canal}
                    </p>
                    <p className="truncate text-xs text-danger">{a.erro}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {dataHoraBr(a.criado_em ?? a.data ?? a.atualizado_em)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
