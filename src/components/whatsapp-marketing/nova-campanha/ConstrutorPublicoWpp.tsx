import { useMemo } from "react";
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
  sem_telefone?: number;
  cadastros_duplicados?: number;
  contatos_unicos?: number;
  opt_out?: number;
  alvo?: number;
  descartados?: number;
};

export function montarFiltro(regras: Regra[]) {
  return { e: regras.filter((r) => r.campo && r.op) };
}

/** Filtro só vale quando tem pelo menos uma regra completa. */
export function filtroOuNulo(regras: Regra[]) {
  const f = montarFiltro(regras);
  return f.e.length > 0 ? f : null;
}

const num = (v: any) => Number(v ?? 0).toLocaleString("pt-BR");

/** Construtor de regras, usado no público principal e no público de exclusão. */
export function EditorRegras({
  regras, onRegras, rotuloAdicionar = "Adicionar regra",
}: { regras: Regra[]; onRegras: (r: Regra[]) => void; rotuloAdicionar?: string }) {
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

      <Button
        variant="outline" size="sm"
        onClick={() => onRegras([...regras, { campo: "", op: "=", valor: "" }])}
      >
        <Plus className="h-4 w-4 mr-1" /> {rotuloAdicionar}
      </Button>
    </div>
  );
}

/** Funil do público: alvo em destaque e as perdas explicadas embaixo. */
export function BlocoSimulacao({ simulacao, carregando }: { simulacao: Simulacao | null; carregando: boolean }) {
  if (!simulacao && !carregando) return null;
  const s = simulacao ?? {};
  const linhas: string[] = [];
  if (Number(s.no_publico ?? 0) > 0) linhas.push(`de ${num(s.no_publico)} no público`);
  if (Number(s.sem_telefone ?? 0) > 0) linhas.push(`${num(s.sem_telefone)} sem telefone válido`);
  if (Number(s.cadastros_duplicados ?? 0) > 0)
    linhas.push(`${num(s.cadastros_duplicados)} cadastros duplicados (mesma cliente, dois cadastros)`);
  if (Number(s.opt_out ?? 0) > 0) linhas.push(`${num(s.opt_out)} pediram para não receber`);

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-2xl font-serif">{num(s.alvo)} clientes vão receber</p>
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {linhas.map((l, i) => <p key={i}>{l}</p>)}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Esse é o número que vai sair: a conferência e o preparo do envio leem a mesma conta no banco.
      </p>
    </Card>
  );
}
