import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Loader2, RefreshCw, MessageCircle, ChevronDown, ChevronUp, ExternalLink, SkipForward, Check,
} from "lucide-react";

export type FollowupTipo =
  | "interesse" | "pagamento_pendente" | "carrinho_abandonado" | "pedido_cancelado";

export type Followup = {
  followup_id: number;
  tipo: FollowupTipo | string;
  etapa_seq: number;
  conversa_id: number | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  valor: number | null;
  referencia: string | null;
  devido_em: string | null;
  horas_atraso: number | null;
  mensagem_sugerida: string | null;
};

const TIPOS: { key: FollowupTipo; label: string; classe: string }[] = [
  { key: "interesse", label: "Interesse parado", classe: "bg-primary/15 text-primary border-primary/30" },
  { key: "pagamento_pendente", label: "Pagamento pendente", classe: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  { key: "carrinho_abandonado", label: "Carrinho abandonado", classe: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30" },
  { key: "pedido_cancelado", label: "Pedido cancelado", classe: "bg-destructive/15 text-destructive border-destructive/30" },
];

const tipoInfo = (t: string) =>
  TIPOS.find((x) => x.key === t) || { key: t as FollowupTipo, label: t, classe: "bg-muted text-muted-foreground" };

export const brl = (v?: number | null) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const somenteDigitos = (telefone?: string | null) => {
  if (typeof telefone !== "string") return "";
  // Ignora identificadores que não são telefone (ex.: "site:uuid")
  if (/[a-zA-Z]/.test(telefone)) return "";
  return telefone.replace(/\D/g, "");
};

export const telefoneValido = (telefone?: string | null) =>
  /^\d{10,13}$/.test(somenteDigitos(telefone));

const linkWhatsapp = (telefone?: string | null, mensagem?: string) => {
  const num = somenteDigitos(telefone);
  if (!/^\d{10,13}$/.test(num)) return "";
  const comDdi = num.startsWith("55") ? num : `55${num}`;
  return `https://wa.me/${comDdi}?text=${encodeURIComponent(mensagem || "")}`;
};

// Corrige moedas malformadas vindas do backend ("R$ ,50" -> "R$ 0,50")
const corrigirMoeda = (texto?: string | null) =>
  (texto || "").replace(/R\$\s*,/g, "R$ 0,");

class CardErrorBoundary extends Component<{ children: ReactNode }, { erro: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { erro: false };
  }
  static getDerivedStateFromError() {
    return { erro: true };
  }
  render() {
    if (this.state.erro) {
      return (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Não foi possível exibir este follow-up.
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

/* --------------------------------- Fila ---------------------------------- */

export function FilaFollowups() {
  const { user } = useAuth();
  const atendente = useMemo(
    () => (user?.user_metadata?.nome as string) || user?.email || "Painel",
    [user],
  );

  const [tipo, setTipo] = useState<FollowupTipo | null>(null);
  const [itens, setItens] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data, error } = await supabase.rpc("funil_followups_fila", {
      p_tipo: tipo,
      p_incluir_futuros: false,
    });
    if (error) {
      if (!silencioso) toast.error("Erro ao carregar fila: " + error.message);
    } else {
      setItens(((data as unknown) as Followup[]) || []);
    }
    setLoading(false);
  }, [tipo]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const t = setInterval(() => carregar(true), 60000);
    return () => clearInterval(t);
  }, [carregar]);

  const regenerar = async () => {
    setGerando(true);
    const { error } = await supabase.rpc("funil_followups_gerar");
    setGerando(false);
    if (error) toast.error("Erro ao gerar fila: " + error.message);
    else { toast.success("Fila atualizada"); carregar(true); }
  };

  const remover = (id: number) => setItens((p) => p.filter((i) => i.followup_id !== id));

  const total = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={tipo === null ? "default" : "outline"} onClick={() => setTipo(null)}>
          Todos
        </Button>
        {TIPOS.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={tipo === t.key ? "default" : "outline"}
            onClick={() => setTipo(t.key)}
          >
            {t.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={regenerar} disabled={gerando} className="ml-auto">
          <RefreshCw className={cn("h-4 w-4 mr-2", gerando && "animate-spin")} />
          Atualizar fila
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3">
        <span className="text-sm">
          <strong>{itens.length}</strong> follow-up(s) na fila
        </span>
        <span className="text-sm">
          Valor em aberto: <strong>{brl(total)}</strong>
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : itens.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum follow-up pendente. 🎉
        </p>
      ) : (
        <div className="space-y-2">
          {itens.map((item, idx) => (
            <CardErrorBoundary key={item?.followup_id ?? `fu-${idx}`}>
              <CardFollowup
                item={item}
                expandido={aberto === item.followup_id}
                onToggle={() => setAberto(aberto === item.followup_id ? null : item.followup_id)}
                atendente={atendente}
                onFinalizado={() => remover(item.followup_id)}
              />
            </CardErrorBoundary>
          ))}
        </div>
      )}
    </div>
  );
}

function CardFollowup({
  item, expandido, onToggle, atendente, onFinalizado,
}: {
  item: Followup;
  expandido: boolean;
  onToggle: () => void;
  atendente: string;
  onFinalizado: () => void;
}) {
  const info = tipoInfo(item.tipo);
  const [mensagem, setMensagem] = useState(item.mensagem_sugerida || "");
  const [resultado, setResultado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const atrasado = (Number(item.horas_atraso) || 0) > 24;

  useEffect(() => { setMensagem(item.mensagem_sugerida || ""); }, [item.mensagem_sugerida]);

  const concluir = async () => {
    setSalvando(true);
    const { error } = await supabase.rpc("funil_followup_concluir", {
      p_followup_id: item.followup_id,
      p_atendente: atendente,
      p_resultado: resultado || null,
    } as never);
    setSalvando(false);
    if (error) toast.error("Erro ao concluir: " + error.message);
    else { toast.success("Follow-up concluído"); onFinalizado(); }
  };

  const pular = async () => {
    setSalvando(true);
    const { error } = await supabase.rpc("funil_followup_pular", {
      p_followup_id: item.followup_id,
      p_atendente: atendente,
      p_motivo: motivo || null,
    } as never);
    setSalvando(false);
    if (error) toast.error("Erro ao pular: " + error.message);
    else { toast.success("Follow-up pulado"); onFinalizado(); }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 cursor-pointer" onClick={onToggle}>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{item.nome || "Sem nome"}</p>
            <p className="text-xs text-muted-foreground">{item.telefone || "sem telefone"}</p>
          </div>
          <Badge variant="outline" className={info.classe}>{info.label}</Badge>
          <Badge variant="secondary">{item.etapa_seq || 1}º de 3</Badge>
          {item.valor ? <Badge variant="outline">{brl(item.valor)}</Badge> : null}
          <span className={cn("text-xs", atrasado ? "text-destructive font-medium" : "text-muted-foreground")}>
            {Math.round(Number(item.horas_atraso) || 0)}h de atraso
          </span>
          {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>

        {item.referencia && (
          <p className="text-xs text-muted-foreground line-clamp-1">{item.referencia}</p>
        )}

        {expandido && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1">
              <Label htmlFor={`msg-${item.followup_id}`}>Mensagem sugerida</Label>
              <Textarea
                id={`msg-${item.followup_id}`}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`res-${item.followup_id}`}>Resultado (opcional)</Label>
                <Input
                  id={`res-${item.followup_id}`}
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  placeholder="Ex.: respondeu, vai pensar"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`mot-${item.followup_id}`}>Motivo para pular (opcional)</Label>
                <Input
                  id={`mot-${item.followup_id}`}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: cliente pediu para não chamar"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" disabled={!item.telefone}>
                <a
                  href={linkWhatsapp(item.telefone, mensagem)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Abrir WhatsApp
                </a>
              </Button>
              <Button size="sm" variant="secondary" onClick={concluir} disabled={salvando}>
                <Check className="h-4 w-4 mr-2" /> Concluir
              </Button>
              <Button size="sm" variant="outline" onClick={pular} disabled={salvando}>
                <SkipForward className="h-4 w-4 mr-2" /> Pular
              </Button>
              {item.conversa_id ? (
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/atendimento?conversa=${item.conversa_id}`}>
                    <ExternalLink className="h-4 w-4 mr-2" /> Ver conversa
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------- Resumo ---------------------------------- */

type Resumo = {
  na_fila_agora?: number;
  por_tipo?: {
    tipo: string; total: number; na_fila: number; feitos: number;
    recuperados: number; valor_recuperado: number; valor_em_aberto: number;
  }[];
  valor_recuperado_total?: number;
  valor_em_aberto_total?: number;
};

export function ResumoFollowups({ inicio, fim }: { inicio: string; fim: string }) {
  const [dados, setDados] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("funil_followups_resumo", {
        p_inicio: inicio, p_fim: fim,
      });
      if (!ativo) return;
      if (error) toast.error("Erro no resumo de follow-ups: " + error.message);
      else setDados((data as unknown) as Resumo);
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, [inicio, fim]);

  const porTipo = dados?.por_tipo || [];
  const recuperados = porTipo.reduce((s, t) => s + (Number(t.recuperados) || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recuperação por follow-up</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4 sm:grid-cols-2">
              <Mini titulo="Na fila agora" valor={String(dados?.na_fila_agora || 0)} />
              <Mini titulo="Valor em aberto" valor={brl(dados?.valor_em_aberto_total)} />
              <Mini titulo="Recuperados" valor={String(recuperados)} />
              <Mini titulo="Valor recuperado" valor={brl(dados?.valor_recuperado_total)} />
            </div>

            {porTipo.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Na fila</TableHead>
                    <TableHead className="text-right">Feitos</TableHead>
                    <TableHead className="text-right">Recuperados</TableHead>
                    <TableHead className="text-right">Valor recuperado</TableHead>
                    <TableHead className="text-right">Valor em aberto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porTipo.map((t) => (
                    <TableRow key={t.tipo}>
                      <TableCell>
                        <Badge variant="outline" className={tipoInfo(t.tipo).classe}>
                          {tipoInfo(t.tipo).label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{t.total || 0}</TableCell>
                      <TableCell className="text-right">{t.na_fila || 0}</TableCell>
                      <TableCell className="text-right">{t.feitos || 0}</TableCell>
                      <TableCell className="text-right">{t.recuperados || 0}</TableCell>
                      <TableCell className="text-right">{brl(t.valor_recuperado)}</TableCell>
                      <TableCell className="text-right">{brl(t.valor_em_aberto)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-xl font-semibold mt-0.5">{valor}</p>
    </div>
  );
}

/* ------------------------------ Templates -------------------------------- */

type Template = {
  id: number;
  tipo?: string | null;
  etapa_seq?: number | null;
  corpo?: string | null;
  titulo?: string | null;
};

export function TemplatesFollowup() {
  const [itens, setItens] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [rascunhos, setRascunhos] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("funil_followup_templates");
    if (error) toast.error("Erro ao carregar templates: " + error.message);
    else setItens(((data as unknown) as Template[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (t: Template) => {
    setSalvando(t.id);
    const { error } = await supabase.rpc("funil_followup_template_editar", {
      p_id: t.id,
      p_corpo: rascunhos[t.id] ?? t.corpo ?? "",
    });
    setSalvando(null);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else { toast.success("Template salvo"); carregar(); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Variáveis disponíveis: <code>{"{{primeiro_nome}}"}</code>, <code>{"{{itens}}"}</code>,{" "}
        <code>{"{{valor}}"}</code>
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {itens.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className={tipoInfo(t.tipo || "").classe}>
                    {tipoInfo(t.tipo || "").label}
                  </Badge>
                  <span className="text-muted-foreground font-normal">
                    Toque {t.etapa_seq || 1}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  rows={5}
                  value={rascunhos[t.id] ?? t.corpo ?? ""}
                  onChange={(e) => setRascunhos((p) => ({ ...p, [t.id]: e.target.value }))}
                />
                <Button size="sm" onClick={() => salvar(t)} disabled={salvando === t.id}>
                  {salvando === t.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
