import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnviarWhatsAppInline } from "@/components/rfm/EnviarWhatsAppInline";
import { moeda } from "@/components/recuperacao/comum";
import { cn } from "@/lib/utils";
import { Loader2, Ticket, CheckCircle2, Wallet, Percent, TimerOff, Globe, Link as LinkIcon } from "lucide-react";

type Resumo = {
  total_emitidos: number | null;
  total_usados: number | null;
  taxa_conversao_pct: number | null;
  total_expirados_sem_uso: number | null;
  valor_total_convertido_em_vendas: number | null;
  valor_total_desconto_concedido: number | null;
};

type ResumoCanal = Resumo & { origem: string | null };

type Cupom = {
  origem: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  codigo: string | null;
  criado_em: string | null;
  cupom_expira_em: string | null;
  pedido_onde_foi_usado: string | null;
  usado_em: string | null;
  valor_convertido_em_vendas: number | null;
  valor_desconto_concedido: number | null;
  foi_usado: boolean | null;
  expirou_sem_uso: boolean | null;
};

const ROTULO_ORIGEM: Record<string, string> = {
  popup_site: "Site",
  link_bio: "Link da Bio",
};

function rotuloOrigem(o?: string | null) {
  const chave = (o ?? "").trim();
  return ROTULO_ORIGEM[chave] ?? (chave || "—");
}

function IconeOrigem({ origem }: { origem?: string | null }) {
  const Icone = (origem ?? "") === "link_bio" ? LinkIcon : Globe;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Icone className="h-3.5 w-3.5 text-muted-foreground" />
      {rotuloOrigem(origem)}
    </span>
  );
}

function dataHora(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pct(v?: number | null) {
  return `${Number(v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function diasAte(v?: string | null) {
  if (!v) return null;
  const d = new Date(v).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86_400_000);
}

type Status = "usado" | "valido" | "expirado";

function statusDe(c: Cupom): Status {
  if (c.foi_usado) return "usado";
  if (c.expirou_sem_uso) return "expirado";
  return "valido";
}

function StatusBadgeCupom({ cupom }: { cupom: Cupom }) {
  const s = statusDe(cupom);
  const dias = diasAte(cupom.cupom_expira_em);
  if (s === "usado") {
    return (
      <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
        Usado
      </span>
    );
  }
  if (s === "expirado") {
    return (
      <span className="inline-flex items-center rounded-full border border-danger/30 bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">
        Expirado sem uso
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="inline-flex w-fit items-center rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">
        Válido, não usado
      </span>
      {dias != null && dias <= 2 && (
        <span className="text-[10px] font-semibold text-danger">
          {dias <= 0 ? "Expira hoje" : dias === 1 ? "Expira amanhã" : "Expira em 2 dias"}
        </span>
      )}
    </span>
  );
}

export default function Cupons() {
  const [filtroStatus, setFiltroStatus] = useState<"todos" | Status>("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todas");

  const { data: resumo } = useQuery({
    queryKey: ["vw_cupons_resumo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_cupons_resumo" as any).select("*").maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as Resumo | null;
    },
  });

  const { data: porCanal = [] } = useQuery({
    queryKey: ["vw_cupons_conversao_por_canal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_cupons_conversao_por_canal" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as ResumoCanal[];
    },
  });

  const { data: cupons = [], isLoading } = useQuery({
    queryKey: ["vw_cupons_emitidos_status"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_cupons_emitidos_status" as any).select("*").limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as Cupom[];
    },
  });

  const origens = useMemo(
    () => Array.from(new Set(cupons.map((c) => (c.origem ?? "").trim()).filter(Boolean))).sort(),
    [cupons]
  );

  const linhas = useMemo(() => {
    const peso: Record<Status, number> = { valido: 0, usado: 1, expirado: 2 };
    return cupons
      .filter((c) => (filtroStatus === "todos" ? true : statusDe(c) === filtroStatus))
      .filter((c) => (filtroOrigem === "todas" ? true : (c.origem ?? "").trim() === filtroOrigem))
      .sort((a, b) => {
        const d = peso[statusDe(a)] - peso[statusDe(b)];
        if (d !== 0) return d;
        const ea = a.cupom_expira_em ? new Date(a.cupom_expira_em).getTime() : Infinity;
        const eb = b.cupom_expira_em ? new Date(b.cupom_expira_em).getTime() : Infinity;
        return ea - eb;
      });
  }, [cupons, filtroStatus, filtroOrigem]);

  const cards = [
    { titulo: "Cupons emitidos", valor: String(resumo?.total_emitidos ?? 0), icone: Ticket },
    {
      titulo: "Usados",
      valor: String(resumo?.total_usados ?? 0),
      sub: `Conversão ${pct(resumo?.taxa_conversao_pct)}`,
      icone: CheckCircle2,
    },
    { titulo: "Convertido em vendas", valor: moeda(resumo?.valor_total_convertido_em_vendas), icone: Wallet },
    { titulo: "Desconto concedido", valor: moeda(resumo?.valor_total_desconto_concedido), icone: Percent },
    { titulo: "Expirados sem uso", valor: String(resumo?.total_expirados_sem_uso ?? 0), icone: TimerOff },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">Cupons</h1>
        <p className="text-sm text-muted-foreground">
          Cupons capturados no site e no Link da Bio — emissão, uso e valor gerado.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.titulo}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{c.titulo}</CardTitle>
              <c.icone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="font-serif text-2xl font-bold">{c.valor}</p>
              {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg">Taxa de conversão por canal</CardTitle>
        </CardHeader>
        <CardContent>
          {porCanal.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem dados por canal.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Emitidos</TableHead>
                    <TableHead className="text-right">Usados</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                    <TableHead className="text-right">Expirados sem uso</TableHead>
                    <TableHead className="text-right">Convertido</TableHead>
                    <TableHead className="text-right">Desconto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porCanal.map((c) => (
                    <TableRow key={c.origem ?? "sem-origem"}>
                      <TableCell><IconeOrigem origem={c.origem} /></TableCell>
                      <TableCell className="text-right">{c.total_emitidos ?? 0}</TableCell>
                      <TableCell className="text-right">{c.total_usados ?? 0}</TableCell>
                      <TableCell className="text-right font-semibold">{pct(c.taxa_conversao_pct)}</TableCell>
                      <TableCell className="text-right">{c.total_expirados_sem_uso ?? 0}</TableCell>
                      <TableCell className="text-right">{moeda(c.valor_total_convertido_em_vendas)}</TableCell>
                      <TableCell className="text-right">{moeda(c.valor_total_desconto_concedido)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
                <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="usado">Usados</SelectItem>
                  <SelectItem value="valido">Válidos sem uso</SelectItem>
                  <SelectItem value="expirado">Expirados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Origem</Label>
              <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as origens</SelectItem>
                  {origens.map((o) => (
                    <SelectItem key={o} value={o}>{rotuloOrigem(o)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : linhas.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum cupom encontrado com esses filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Emitido em</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uso</TableHead>
                    <TableHead>Lembrete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((c, i) => {
                    const s = statusDe(c);
                    const dias = diasAte(c.cupom_expira_em);
                    return (
                      <TableRow
                        key={`${c.codigo ?? "cupom"}-${c.telefone ?? ""}-${i}`}
                        className={cn(s === "valido" && dias != null && dias <= 2 && "bg-warning/5")}
                      >
                        <TableCell><IconeOrigem origem={c.origem} /></TableCell>
                        <TableCell className="font-medium">
                          {c.nome?.trim() || <span className="text-muted-foreground">Não identificado</span>}
                          {c.email && <div className="text-[11px] text-muted-foreground">{c.email}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{c.telefone || "—"}</TableCell>
                        <TableCell className="font-mono text-xs font-semibold">{c.codigo || "—"}</TableCell>
                        <TableCell className="text-xs">{dataHora(c.criado_em)}</TableCell>
                        <TableCell className="text-xs">{dataHora(c.cupom_expira_em)}</TableCell>
                        <TableCell><StatusBadgeCupom cupom={c} /></TableCell>
                        <TableCell className="text-xs">
                          {s === "usado" ? (
                            <div className="space-y-0.5">
                              <div className="font-medium">Pedido {c.pedido_onde_foi_usado ?? "—"}</div>
                              <div className="text-muted-foreground">{dataHora(c.usado_em)}</div>
                              <div>
                                Venda <span className="font-semibold">{moeda(c.valor_convertido_em_vendas)}</span> · Desconto{" "}
                                <span className="font-semibold text-danger">{moeda(c.valor_desconto_concedido)}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {s === "valido" && c.telefone ? (
                            <EnviarWhatsAppInline
                              telefone={c.telefone}
                              placeholder={`Lembrete do cupom ${c.codigo ?? ""}...`}
                              mostrarAviso
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
