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
  "=": "igual a",
  "<>": "diferente de",
  ">": "maior que",
  ">=": "maior ou igual a",
  "<": "menor que",
  "<=": "menor ou igual a",
  entre: "entre",
  contem: "contém",
  nao_contem: "não contém",
  em: "está em",
  nao_em: "não está em",
  vazio: "vazio",
  nao_vazio: "não vazio",
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
  cond, campos, negada, empilhado, onChange, onNegar, onRemover,
}: {
  cond: Condicao;
  campos: CampoPublico[];
  negada: boolean;
  empilhado: boolean;
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
    <div className="relative space-y-2 rounded-lg border bg-background p-2.5 pr-9">
      <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant={negada ? "secondary" : "ghost"}
          className="h-7 px-2 text-[11px]"
          onClick={() => onNegar(!negada)}
          title="Inverter esta condição"
        >
          não
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onRemover}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className={cn("grid min-w-0 gap-2", !empilhado && "sm:grid-cols-[1.2fr_1.6fr] sm:items-start")}>
        <Select
          value={cond.campo}
          onValueChange={(v) => {
            const novo = campos.find((c) => c.campo === v);
            const opsNovas = OPS_POR_TIPO[novo?.tipo ?? "texto"] ?? OPS_POR_TIPO.texto;
            onChange({ campo: v, op: opsNovas.includes(cond.op) ? cond.op : opsNovas[0], valor: undefined });
          }}
        >
          <SelectTrigger className="h-auto min-h-9 w-full items-start py-1.5 text-left [&>span]:whitespace-normal [&>span]:break-words [&>span]:text-left">
            <SelectValue placeholder="Campo" />
          </SelectTrigger>
          <SelectContent>
            {grupos.map(([g, itens]) => (
              <SelectGroup key={g}>
                <SelectLabel>{g}</SelectLabel>
                {itens.map((c) => (
                  <SelectItem key={c.campo} value={c.campo}>
                    <span className="flex items-center gap-1.5">
                      {c.rotulo}
                      {c.congela_publico && <AlertTriangle className="h-3 w-3 text-warning" />}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <div className="grid min-w-0 gap-2 [grid-template-columns:minmax(6.5rem,1fr)_1.6fr]">
          <Select value={cond.op} onValueChange={(v) => onChange({ ...cond, op: v, valor: undefined })}>
            <SelectTrigger className="h-9 min-w-0"><SelectValue placeholder="Operador" /></SelectTrigger>
            <SelectContent>
              {ops.map((o) => <SelectItem key={o} value={o}>{ROTULO_OP[o] ?? o}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="min-w-0">
            <ValorWidget campo={campo} cond={cond} onChange={(v) => onChange({ ...cond, valor: v })} />
          </div>
        </div>
      </div>
      {campo?.descricao && <p className="mt-2 px-0.5 text-[11px] leading-relaxed text-muted-foreground">{campo.descricao}</p>}
      {campo?.congela_publico && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-2 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
          <p className="text-[11px] text-warning">
            Data fixa: este público não se atualiza sozinho.
            {campo.equivalente_vivo_rotulo
              ? ` Para ele acompanhar o calendário, use ${campo.equivalente_vivo_rotulo}.`
              : ""}
          </p>
          {campo.equivalente_vivo && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto h-7 px-2 text-[11px]"
              onClick={() => {
                const novo = campos.find((c) => c.campo === campo.equivalente_vivo);
                const opsNovas = OPS_POR_TIPO[novo?.tipo ?? "texto"] ?? OPS_POR_TIPO.texto;
                onChange({
                  campo: campo.equivalente_vivo as string,
                  op: opsNovas.includes(cond.op) ? cond.op : opsNovas[0],
                  valor: undefined,
                });
              }}
            >
              Trocar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function GrupoEditor({
  no, campos, nivel, empilhado, onChange, onRemover, textoVazio,
}: {
  no: { e: No[] } | { ou: No[] };
  campos: CampoPublico[];
  nivel: number;
  empilhado: boolean;
  onChange: (n: No) => void;
  onRemover?: () => void;
  textoVazio?: string;
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
        <p className="px-1 text-xs text-muted-foreground">
          {nivel === 0 && textoVazio ? textoVazio : "Nenhuma condição ainda. Adicione a primeira abaixo."}
        </p>
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
              empilhado={empilhado}
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
                empilhado={empilhado}
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

/** Objeto sem chave nenhuma ou grupo vazio: filtro vazio válido, "todo mundo entra". */
const ehFiltroVazio = (filtro: any): boolean => {
  if (filtro == null) return true;
  if (typeof filtro !== "object" || Array.isArray(filtro)) return false;
  const chaves = Object.keys(filtro);
  if (chaves.length === 0) return true;
  const itens = (filtro as any).e ?? (filtro as any).ou;
  return chaves.every((k) => k === "e" || k === "ou") && Array.isArray(itens) && itens.length === 0;
};

/**
 * Normaliza o filtro lido do banco.
 * null, {}, { e: [] } e { ou: [] } viram o filtro vazio editável.
 * Condição ou "nao" soltos na raiz são envolvidos em um grupo "e".
 * Só devolve null (corrompido) para o que não dá para interpretar:
 * não-objeto, array solto ou chave raiz desconhecida.
 */
export function normalizarFiltro(filtro: any): No | null {
  if (ehFiltroVazio(filtro)) return filtroVazio();
  if (typeof filtro !== "object" || Array.isArray(filtro)) return null;
  if (ehGrupo(filtro)) return filtro as No;
  if (ehCondicao(filtro)) return { e: [filtro] };
  if (ehNao(filtro)) return { e: [filtro as any] };
  return null;
}

/** Forma canônica gravada no banco quando o usuário deixa o filtro vazio. */
export function filtroParaSalvar(filtro: any): any {
  return ehFiltroVazio(filtro) ? {} : filtro;
}

export function ConstrutorPublico({
  filtro, campos, empilhado = false, onChange,
}: {
  filtro: No;
  campos: CampoPublico[];
  empilhado?: boolean;
  onChange: (n: No) => void;
}) {
  const normalizado = normalizarFiltro(filtro);
  if (!normalizado) {
    return (
      <div className="space-y-2 rounded-xl border border-danger/40 bg-danger/5 p-3">
        <p className="text-sm text-danger">Este filtro está corrompido e não pode ser editado.</p>
        <Button size="sm" variant="outline" onClick={() => onChange(filtroVazio())}>
          Limpar e recomeçar
        </Button>
      </div>
    );
  }
  return (
    <GrupoEditor
      no={normalizado as any}
      campos={campos}
      nivel={0}
      empilhado={empilhado}
      onChange={onChange}
      textoVazio="Sem filtro: todo mundo que o gatilho pegar entra"
    />
  );
}

/** Deixa a mensagem crua do banco legível para quem está montando o público. */
export function mensagemErroPublico(bruto: string): string {
  const m = /campo nao disponivel no canal email:\s*([\w.]+)/i.exec(bruto);
  if (m) return `O campo "${m[1]}" só existe no WhatsApp e não pode ser usado em e-mail. Troque por um campo da lista.`;
  if (/campo de p[uú]blico desconhecido/i.test(bruto))
    return "Este filtro está corrompido. Limpe o filtro e monte as condições de novo.";
  return bruto;
}

export type DiagnosticoFiltro = {
  campos?: string[];
  vivo?: boolean;
  congelam?: { campo: string; rotulo: string; troque_por: string; troque_por_rotulo: string }[];
};

/** Diz se o público se refaz sozinho a cada execução ou se é uma foto congelada. */
export function useDiagnosticoFiltro(filtro: No | null, enabled = true) {
  const chave = filtro ? JSON.stringify(filtro) : "";
  return useQuery({
    queryKey: ["emails-filtro-diagnostico", chave],
    queryFn: async () =>
      (await rpcEmails<DiagnosticoFiltro>("emails_filtro_diagnostico", { p_filtro: filtro })) ?? {},
    enabled: enabled && !!filtro && contarCondicoes(filtro) > 0,
  });
}

export function SeloPublicoVivo({ filtro, enabled = true }: { filtro: No | null; enabled?: boolean }) {
  const { data } = useDiagnosticoFiltro(filtro, enabled);
  if (!data || data.vivo == null) return null;
  const vivo = !!data.vivo;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant="outline"
        className={cn(
          "text-[11px]",
          vivo
            ? "border-success/30 bg-success/15 text-success"
            : "border-warning/30 bg-warning/15 text-warning",
        )}
      >
        {vivo ? "Público vivo" : "Público fixo"}
      </Badge>
      {!vivo && (data.congelam ?? []).length > 0 && (
        <span className="text-[11px] text-muted-foreground">
          Datas fixas em: {(data.congelam ?? []).map((c) => c.rotulo).join(", ")}
        </span>
      )}
    </div>
  );
}

/** "consultado agora" nos primeiros instantes, depois "consultado às HH:MM". */
export function textoConsulta(quando: Date | number | null | undefined): string {
  if (!quando) return "";
  const d = quando instanceof Date ? quando : new Date(quando);
  if (Number.isNaN(d.getTime())) return "";
  if (Date.now() - d.getTime() < 60000) return "consultado agora";
  return `consultado às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}
