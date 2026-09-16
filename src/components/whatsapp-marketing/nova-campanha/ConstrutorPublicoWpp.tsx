import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { chamarRpc } from "@/lib/supabaseRpc";

export type Regra = { campo: string; op: string; valor?: any };

export const OPERADORES = [
  { valor: "=", rotulo: "é igual a" },
  { valor: "<>", rotulo: "é diferente de" },
  { valor: ">", rotulo: "maior que" },
  { valor: ">=", rotulo: "maior ou igual a" },
  { valor: "<", rotulo: "menor que" },
  { valor: "<=", rotulo: "menor ou igual a" },
  { valor: "entre", rotulo: "está entre" },
  { valor: "em", rotulo: "está na lista" },
  { valor: "nao_em", rotulo: "não está na lista" },
  { valor: "contem", rotulo: "contém" },
  { valor: "nao_contem", rotulo: "não contém" },
  { valor: "vazio", rotulo: "está vazio" },
  { valor: "nao_vazio", rotulo: "não está vazio" },
];

const SEM_VALOR = ["vazio", "nao_vazio"];
const LISTA = ["em", "nao_em"];

export type Simulacao = {
  no_publico?: number;
  com_telefone_valido?: number;
  sem_telefone?: number;
  opt_out?: number;
  alvo?: number;
};

export function montarFiltro(regras: Regra[]) {
  return { e: regras.filter((r) => r.campo && r.op) };
}

export default function ConstrutorPublicoWpp({
  regras, onRegras, simulacao, onSimular, simulando,
}: {
  regras: Regra[];
  onRegras: (r: Regra[]) => void;
  simulacao: Simulacao | null;
  onSimular: () => void;
  simulando: boolean;
}) {
  const { data: campos = [] } = useQuery({
    queryKey: ["publico-campos-whatsapp"],
    queryFn: async () => {
      const { data, error } = await chamarRpc("publico_campos_whatsapp" as any);
      if (error) throw error;
      return (data ?? []) as { campo: string; rotulo: string; tipo?: string; grupo?: string }[];
    },
  });

  const grupos = useMemo(() => {
    const mapa = new Map<string, typeof campos>();
    campos.forEach((c) => {
      const g = c.grupo || "Outros";
      if (!mapa.has(g)) mapa.set(g, [] as any);
      (mapa.get(g) as any).push(c);
    });
    return [...mapa.entries()];
  }, [campos]);

  const mudar = (i: number, patch: Partial<Regra>) =>
    onRegras(regras.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      {regras.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sem nenhuma regra, a campanha vai para todo o público com telefone válido.
        </p>
      )}

      {regras.map((r, i) => {
        const campo = campos.find((c) => c.campo === r.campo);
        const numerico = ["numero", "inteiro", "decimal", "moeda", "data"].includes(String(campo?.tipo ?? ""));
        return (
          <Card key={i} className="p-3 grid grid-cols-1 md:grid-cols-[1fr_180px_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Campo</Label>
              <Select value={r.campo} onValueChange={(v) => mudar(i, { campo: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha o campo" /></SelectTrigger>
                <SelectContent>
                  {grupos.map(([g, lista]) => (
                    <SelectGroup key={g}>
                      <SelectLabel>{g}</SelectLabel>
                      {lista.map((c) => (
                        <SelectItem key={c.campo} value={c.campo}>{c.rotulo}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Condição</Label>
              <Select value={r.op} onValueChange={(v) => mudar(i, { op: v, valor: undefined })}>
                <SelectTrigger><SelectValue placeholder="Condição" /></SelectTrigger>
                <SelectContent>
                  {OPERADORES.map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              {!SEM_VALOR.includes(r.op) && <Label className="text-xs">Valor</Label>}
              {SEM_VALOR.includes(r.op) ? (
                <p className="text-xs text-muted-foreground pb-2">Sem valor para esta condição.</p>
              ) : r.op === "entre" ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="de"
                    value={Array.isArray(r.valor) ? r.valor[0] ?? "" : ""}
                    onChange={(e) =>
                      mudar(i, { valor: [numerico ? Number(e.target.value) : e.target.value, Array.isArray(r.valor) ? r.valor[1] ?? "" : ""] })
                    }
                  />
                  <Input
                    placeholder="até"
                    value={Array.isArray(r.valor) ? r.valor[1] ?? "" : ""}
                    onChange={(e) =>
                      mudar(i, { valor: [Array.isArray(r.valor) ? r.valor[0] ?? "" : "", numerico ? Number(e.target.value) : e.target.value] })
                    }
                  />
                </div>
              ) : LISTA.includes(r.op) ? (
                <Input
                  placeholder="valores separados por vírgula"
                  value={Array.isArray(r.valor) ? r.valor.join(", ") : ""}
                  onChange={(e) =>
                    mudar(i, { valor: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })
                  }
                />
              ) : (
                <Input
                  value={r.valor ?? ""}
                  placeholder="valor"
                  onChange={(e) => mudar(i, { valor: numerico ? Number(e.target.value) : e.target.value })}
                />
              )}
            </div>

            <Button
              variant="ghost" size="icon"
              onClick={() => onRegras(regras.filter((_, idx) => idx !== i))}
              aria-label="Remover regra"
            >
              <X className="h-4 w-4" />
            </Button>
          </Card>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline" size="sm"
          onClick={() => onRegras([...regras, { campo: "", op: "=", valor: "" }])}
        >
          <Plus className="h-4 w-4 mr-1" /> Adicionar regra
        </Button>
        <Button size="sm" onClick={onSimular} disabled={simulando}>
          {simulando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Conferir público
        </Button>
      </div>

      {simulacao && (
        <Card className="p-4 space-y-2">
          <p className="text-2xl font-serif">
            {Number(simulacao.alvo ?? 0).toLocaleString("pt-BR")} clientes vão receber
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>No público: {Number(simulacao.no_publico ?? 0).toLocaleString("pt-BR")}</span>
            <span>Com telefone válido: {Number(simulacao.com_telefone_valido ?? 0).toLocaleString("pt-BR")}</span>
            <span>Sem telefone: {Number(simulacao.sem_telefone ?? 0).toLocaleString("pt-BR")}</span>
            <span>Saíram da lista: {Number(simulacao.opt_out ?? 0).toLocaleString("pt-BR")}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
