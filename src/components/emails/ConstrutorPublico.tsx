import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { rpcEmails } from "@/lib/emails";

export type CampoPublico = {
  campo: string;
  rotulo: string;
  tipo: "numero" | "dias" | "data" | "texto" | "booleano" | "array" | string;
  grupo?: string | null;
  descricao?: string | null;
  congela_publico?: boolean | null;
  equivalente_vivo?: string | null;
  equivalente_vivo_rotulo?: string | null;
};

export type Condicao = { campo: string; op: string; valor?: any };
export type No =
  | Condicao
  | { e: No[] }
  | { ou: No[] }
  | { nao: No };

export const SEGMENTOS_RFM_EMAIL = [
  "Campeões",
  "Fiéis",
  "Não Pode Perder",
  "Novos / Promissores",
  "Precisam de Atenção",
  "Em Risco (eram fiéis)",
  "Hibernando",
  "Perdidos",
  "__sem_rfm__",
];

export const rotuloRfm = (v: string) => (v === "__sem_rfm__" ? "Sem RFM (lead sem compra)" : v);

const OPS_POR_TIPO: Record<string, string[]> = {
  numero: ["=", "<>", ">", ">=", "<", "<=", "entre", "vazio", "nao_vazio"],
  dias: ["=", "<>", ">", ">=", "<", "<=", "entre", "vazio", "nao_vazio"],
  data: ["=", "<>", ">", ">=", "<", "<=", "entre", "vazio", "nao_vazio"],
  texto: ["=", "<>", "contem", "nao_contem", "em", "nao_em", "vazio", "nao_vazio"],
  booleano: ["="],
  array: ["contem", "nao_contem", "vazio", "nao_vazio"],
};

const ROTULO_OP: Record<string, string> = {
  "=": "é igual a",
  "<>": "é diferente de",
  ">": "é maior que",
  ">=": "é maior ou igual a",
  "<": "é menor que",
  "<=": "é menor ou igual a",
  entre: "está entre",
  contem: "contém",
  nao_contem: "não contém",
  em: "é um destes",
  nao_em: "não é nenhum destes",
  vazio: "está vazio",
  nao_vazio: "não está vazio",
};

const SEM_VALOR = new Set(["vazio", "nao_vazio"]);

export function usePublicoCampos(enabled = true) {
  return useQuery({
    queryKey: ["emails-publico-campos"],
    queryFn: async () => (await rpcEmails<CampoPublico[]>("emails_publico_campos")) ?? [],
    enabled,
  });
}

export const ehCondicao = (n: any): n is Condicao => !!n && typeof n === "object" && "campo" in n;
const ehGrupo = (n: any): n is { e: No[] } | { ou: No[] } =>
  !!n && typeof n === "object" && (Array.isArray((n as any).e) || Array.isArray((n as any).ou));
const ehNao = (n: any): n is { nao: No } => !!n && typeof n === "object" && "nao" in n;

export const filtroVazio = (): No => ({ e: [] });

export function contarCondicoes(no: any): number {
  if (!no) return 0;
  if (ehCondicao(no)) return 1;
  if (ehNao(no)) return contarCondicoes(no.nao);
  if (ehGrupo(no)) {
    const itens = (no as any).e ?? (no as any).ou ?? [];
    return itens.reduce((s: number, i: No) => s + contarCondicoes(i), 0);
  }
  return 0;
}

/** Texto legível do filtro, para a pessoa entender o que está escolhendo. */
export function descreverFiltro(no: any, campos: CampoPublico[], nivel = 0): string {
  if (!no) return "Sem filtro";
  const rotulo = (c: string) => campos.find((x) => x.campo === c)?.rotulo ?? c;

  if (ehCondicao(no)) {
    const op = ROTULO_OP[no.op] ?? no.op;
    if (SEM_VALOR.has(no.op)) return `${rotulo(no.campo)} ${op}`;
    const v = no.valor;
    let texto: string;
    if (Array.isArray(v)) {
      texto = no.op === "entre" ? `${v[0]} e ${v[1]}` : v.map((x) => rotuloRfm(String(x))).join(", ");
    } else if (typeof v === "boolean") {
      texto = v ? "sim" : "não";
    } else {
      texto = rotuloRfm(String(v ?? ""));
    }
    return `${rotulo(no.campo)} ${op} ${texto}`;
  }

  if (ehNao(no)) return `não (${descreverFiltro(no.nao, campos, nivel + 1)})`;

  if (ehGrupo(no)) {
    const juncao = Array.isArray((no as any).e) ? " E " : " OU ";
    const itens: No[] = (no as any).e ?? (no as any).ou ?? [];
    if (itens.length === 0) return "Sem condições";
    const texto = itens.map((i) => descreverFiltro(i, campos, nivel + 1)).join(juncao);
    return nivel > 0 ? `(${texto})` : texto;
  }

  return "Filtro não reconhecido";
}

function ValorWidget({
  campo, cond, onChange,
}: { campo?: CampoPublico; cond: Condicao; onChange: (v: any) => void }) {
  const tipo = campo?.tipo ?? "texto";
  if (SEM_VALOR.has(cond.op)) return null;

  if (tipo === "booleano") {
    return (
      <div className="flex items-center gap-2">
        <Switch checked={cond.valor === true} onCheckedChange={(v) => onChange(v)} />
        <span className="text-xs text-muted-foreground">{cond.valor === true ? "sim" : "não"}</span>
      </div>
    );
  }

  if (cond.op === "entre") {
    const v: any[] = Array.isArray(cond.valor) ? cond.valor : ["", ""];
    const tipoInput = tipo === "data" ? "date" : "number";
    return (
      <div className="flex items-center gap-1">
        <Input
          type={tipoInput}
          className="h-9"
          value={v[0] ?? ""}
          onChange={(e) => onChange([tipoInput === "number" ? Number(e.target.value) : e.target.value, v[1] ?? ""])}
        />
        <span className="text-xs text-muted-foreground">e</span>
        <Input
          type={tipoInput}
          className="h-9"
          value={v[1] ?? ""}
          onChange={(e) => onChange([v[0] ?? "", tipoInput === "number" ? Number(e.target.value) : e.target.value])}
        />
      </div>
    );
  }

  if (cond.op === "em" || cond.op === "nao_em") {
    const selecionados: any[] = Array.isArray(cond.valor) ? cond.valor : [];
    if (cond.campo === "segmento_rfm") {
      return (
        <div className="flex flex-wrap gap-1">
          {SEGMENTOS_RFM_EMAIL.map((s) => {
            const ativo = selecionados.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  onChange(ativo ? selecionados.filter((x) => x !== s) : [...selecionados, s])
                }
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                  ativo ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {rotuloRfm(s)}
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <Input
        className="h-9"
        placeholder="Separe por vírgula"
        value={selecionados.join(", ")}
        onChange={(e) => onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))}
      />
    );
  }

  if (cond.campo === "segmento_rfm") {
    return (
      <Select value={String(cond.valor ?? "")} onValueChange={(v) => onChange(v)}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Escolha" /></SelectTrigger>
        <SelectContent>
          {SEGMENTOS_RFM_EMAIL.map((s) => (
            <SelectItem key={s} value={s}>{rotuloRfm(s)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const tipoInput = tipo === "data" ? "date" : tipo === "numero" || tipo === "dias" ? "number" : "text";
  return (
    <Input
      type={tipoInput}
      className="h-9"
      value={cond.valor ?? ""}
      onChange={(e) => onChange(tipoInput === "number" ? Number(e.target.value) : e.target.value)}
    />
  );
}

function CondicaoLinha({
  cond, campos, negada, onChange, onNegar, onRemover,
}: {
  cond: Condicao;
  campos: CampoPublico[];
  negada: boolean;
  onChange: (c: Condicao) => void;
  onNegar: (v: boolean) => void;
  onRemover: () => void;
}) {
  const campo = campos.find((c) => c.campo === cond.campo);
  const ops = OPS_POR_TIPO[campo?.tipo ?? "texto"] ?? OPS_POR_TIPO.texto;

  const grupos = useMemo(() => {
    const mapa = new Map<string, CampoPublico[]>();
    campos.forEach((c) => {
      const g = c.grupo || "Outros";
      mapa.set(g, [...(mapa.get(g) ?? []), c]);
    });
    return [...mapa.entries()];
  }, [campos]);

  return (
    <div className="space-y-1 rounded-lg border bg-background p-2">
      <div className="grid items-center gap-2 md:grid-cols-[1.2fr_1fr_1.4fr_auto]">
        <Select
          value={cond.campo}
          onValueChange={(v) => {
            const novo = campos.find((c) => c.campo === v);
            const opsNovas = OPS_POR_TIPO[novo?.tipo ?? "texto"] ?? OPS_POR_TIPO.texto;
            onChange({ campo: v, op: opsNovas.includes(cond.op) ? cond.op : opsNovas[0], valor: undefined });
          }}
        >
          <SelectTrigger className="h-9"><SelectValue placeholder="Campo" /></SelectTrigger>
          <SelectContent>
            {grupos.map(([g, itens]) => (
              <SelectGroup key={g}>
                <SelectLabel>{g}</SelectLabel>
                {itens.map((c) => (
                  <SelectItem key={c.campo} value={c.campo}>{c.rotulo}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Select value={cond.op} onValueChange={(v) => onChange({ ...cond, op: v, valor: undefined })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Operador" /></SelectTrigger>
          <SelectContent>
            {ops.map((o) => <SelectItem key={o} value={o}>{ROTULO_OP[o] ?? o}</SelectItem>)}
          </SelectContent>
        </Select>

        <ValorWidget campo={campo} cond={cond} onChange={(v) => onChange({ ...cond, valor: v })} />

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={negada ? "secondary" : "ghost"}
            className="h-8 px-2 text-[11px]"
            onClick={() => onNegar(!negada)}
            title="Inverter esta condição"
          >
            não
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onRemover}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {campo?.descricao && <p className="px-1 text-[11px] text-muted-foreground">{campo.descricao}</p>}
    </div>
  );
}

function GrupoEditor({
  no, campos, nivel, onChange, onRemover,
}: {
  no: { e: No[] } | { ou: No[] };
  campos: CampoPublico[];
  nivel: number;
  onChange: (n: No) => void;
  onRemover?: () => void;
}) {
  const juncao: "e" | "ou" = Array.isArray((no as any).e) ? "e" : "ou";
  const itens: No[] = (no as any)[juncao] ?? [];

  const trocarJuncao = (nova: "e" | "ou") => onChange({ [nova]: itens } as any);
  const setItens = (novos: No[]) => onChange({ [juncao]: novos } as any);

  const adicionarCondicao = () => {
    const primeiro = campos[0];
    if (!primeiro) return;
    const ops = OPS_POR_TIPO[primeiro.tipo] ?? OPS_POR_TIPO.texto;
    setItens([...itens, { campo: primeiro.campo, op: ops[0], valor: undefined }]);
  };

  return (
    <div className={cn("space-y-2 rounded-xl border p-3", nivel > 0 && "bg-muted/30")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border">
          {(["e", "ou"] as const).map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => trocarJuncao(j)}
              className={cn(
                "px-3 py-1 text-xs transition-colors",
                juncao === j ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {j === "e" ? "E (todas)" : "OU (qualquer uma)"}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {juncao === "e" ? "a pessoa precisa passar em todas as condições" : "basta passar em uma das condições"}
        </span>
        {onRemover && (
          <Button type="button" size="icon" variant="ghost" className="ml-auto h-8 w-8" onClick={onRemover}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {itens.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">Nenhuma condição ainda. Adicione a primeira abaixo.</p>
      )}

      {itens.map((item, i) => {
        const trocar = (n: No) => setItens(itens.map((x, j) => (j === i ? n : x)));
        const remover = () => setItens(itens.filter((_, j) => j !== i));

        const negada = ehNao(item);
        const interno: No = negada ? (item as any).nao : item;

        if (ehCondicao(interno)) {
          return (
            <CondicaoLinha
              key={i}
              cond={interno}
              campos={campos}
              negada={negada}
              onChange={(c) => trocar(negada ? { nao: c } : c)}
              onNegar={(v) => trocar(v ? { nao: interno } : interno)}
              onRemover={remover}
            />
          );
        }

        if (ehGrupo(interno)) {
          return (
            <div key={i} className="space-y-1">
              {negada && <Badge variant="outline" className="text-[10px]">não</Badge>}
              <GrupoEditor
                no={interno as any}
                campos={campos}
                nivel={nivel + 1}
                onChange={(n) => trocar(negada ? { nao: n } : n)}
                onRemover={remover}
              />
            </div>
          );
        }

        return null;
      })}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={adicionarCondicao}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar condição
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setItens([...itens, { e: [] }])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar grupo
        </Button>
      </div>
    </div>
  );
}

export function ConstrutorPublico({
  filtro, campos, onChange,
}: { filtro: No; campos: CampoPublico[]; onChange: (n: No) => void }) {
  if (!ehGrupo(filtro)) {
    return (
      <div className="space-y-2 rounded-xl border border-danger/40 bg-danger/5 p-3">
        <p className="text-sm text-danger">Este filtro está corrompido e não pode ser editado.</p>
        <Button size="sm" variant="outline" onClick={() => onChange(filtroVazio())}>
          Limpar e recomeçar
        </Button>
      </div>
    );
  }
  return <GrupoEditor no={filtro as any} campos={campos} nivel={0} onChange={onChange} />;
}

/** Deixa a mensagem crua do banco legível para quem está montando o público. */
export function mensagemErroPublico(bruto: string): string {
  const m = /campo nao disponivel no canal email:\s*([\w.]+)/i.exec(bruto);
  if (m) return `O campo "${m[1]}" só existe no WhatsApp e não pode ser usado em e-mail. Troque por um campo da lista.`;
  if (/campo de p[uú]blico desconhecido/i.test(bruto))
    return "Este filtro está corrompido. Limpe o filtro e monte as condições de novo.";
  return bruto;
}
