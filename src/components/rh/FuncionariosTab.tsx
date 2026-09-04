import { erroRh } from "./useRhAuth";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { brl, dataBRCompleta } from "@/lib/rh";
import { cn } from "@/lib/utils";
import { lerErroEdge } from "@/lib/edgeError";
import { parseValorBR, LIMITE_SALARIO, LIMITE_DIARIA } from "@/lib/rhMoeda";
import { mascaraTelefone, soDigitos, telefoneBonito } from "@/lib/rhWhatsapp";
import { competenciaAtual, useRegerarFechamento } from "./useRegerarFechamento";

const RH_SUPABASE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co";
const RH_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6ZHR1bGNycXptZ29jYW1qd3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjIwMzAsImV4cCI6MjA4NzE5ODAzMH0.7CyKzK3cs-Cd-Wrh69oUAEtxW95l8iZLMCXi_3nAIPU";

const TIPOS_CHAVE = ["cpf", "cnpj", "email", "telefone", "aleatoria"];

const vazio = {
  id: null as string | null, nome: "", cpf: "", cargo: "", chave_pix: "", tipo_chave_pix: "cpf",
  ativo: true, observacao: "", admissao: "", salario_base: "", vt_mensal: "", va_mensal: "", cesta_valor: "",
  registrada: false, vt_desconto_pct: "6", vt_diaria: "", whatsapp: "",
};



export function FuncionariosTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<typeof vazio | null>(null);
  const [verificando, setVerificando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  type Resultado =
    | { tipo: "ok"; titular: string; cpf_mascarado?: string; veredito?: string; motivo?: string }
    | { tipo: "aviso"; mensagem: string; dica?: string };
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["rh-funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_funcionarios_listar", { p_incluir_inativos: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: pendentes } = useQuery({
    queryKey: ["rh-chaves-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_chaves_pendentes_confirmacao" as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const limparResultado = (id: string) =>
    setResultados((r) => {
      const n = { ...r };
      delete n[id];
      return n;
    });

  const verificarChave = async (f: any) => {
    setVerificando(f.id);
    limparResultado(f.id);
    try {
      const { data: res, error } = await supabase.functions.invoke("inter-verificar-chave", {
        body: { funcionario_id: f.id },
      });

      if (error) {
        const e = await lerErroEdge(error, "Não foi possível verificar a chave");
        toast({
          title: "Chave não verificada",
          description: [e.mensagem, e.dica].filter(Boolean).join(" — "),
          variant: "destructive",
        });
        return;
      }

      const r: any = res ?? {};
      const titular = r.titular_no_banco ?? r.titular ?? null;

      // 202: Pix saiu mas o banco ainda não devolveu o nome — aviso, não erro
      if (!titular) {
        setResultados((s) => ({
          ...s,
          [f.id]: {
            tipo: "aviso",
            mensagem: r.erro ?? "o banco ainda não devolveu o nome do recebedor",
            dica: r.dica ?? "tente de novo em alguns minutos",
          },
        }));
        return;
      }

      setResultados((s) => ({
        ...s,
        [f.id]: {
          tipo: "ok",
          titular,
          cpf_mascarado: r.cpf_mascarado,
          veredito: r.veredito,
          motivo: r.motivo,
        },
      }));
      toast({ title: "Chave verificada", description: `Titular no banco: ${titular}` });
    } catch (e: any) {
      toast({ title: "Erro ao verificar chave", description: e?.message, variant: "destructive" });
    } finally {
      setVerificando(null);
    }
  };

  const confirmarTitular = async (f: any) => {
    const r = resultados[f.id];
    if (!r || r.tipo !== "ok") return;
    const divergente = !!r.veredito && !/^(ok|confere|compat)/i.test(r.veredito);
    if (divergente) {
      const ok = window.confirm(
        `Atenção: o veredito da verificação foi "${r.veredito}"${r.motivo ? ` (${r.motivo})` : ""}.\n\n` +
          `Titular no banco: ${r.titular}\nCadastro: ${f.nome}\n\nConfirmar mesmo assim?`,
      );
      if (!ok) return;
    }
    setConfirmando(f.id);
    const { error } = await supabase.rpc("rh_chave_confirmar" as any, {
      p_funcionario_id: f.id,
      p_titular: r.titular,
    });
    setConfirmando(null);
    if (error) {
      return toast({ title: "Erro ao confirmar titular", description: erroRh(error).mensagem, variant: "destructive" });
    }
    toast({ title: "Titular confirmado" });
    limparResultado(f.id);
    qc.invalidateQueries({ queryKey: ["rh-funcionarios"] });
    qc.invalidateQueries({ queryKey: ["rh-chaves-pendentes"] });
  };




  const abrir = (f?: any) =>
    setEdit(
      f
        ? {
            id: f.id, nome: f.nome ?? "", cpf: f.cpf ?? "", cargo: f.cargo ?? "",
            chave_pix: f.chave_pix ?? "", tipo_chave_pix: f.tipo_chave_pix ?? "cpf",
            ativo: f.ativo ?? true, observacao: f.observacao ?? "",
            admissao: f.admissao ? String(f.admissao).slice(0, 10) : "",
            salario_base: f.salario_base != null ? String(f.salario_base) : "",
            vt_mensal: f.vt_mensal != null ? String(f.vt_mensal) : "",
            vt_diaria: f.vt_diaria != null ? String(f.vt_diaria) : "",
            va_mensal: f.va_mensal != null ? String(f.va_mensal) : "",
            cesta_valor: f.cesta_valor != null ? String(f.cesta_valor) : "",
            registrada: !!f.registrada,
            vt_desconto_pct: f.vt_desconto_pct != null ? String(f.vt_desconto_pct) : "6",
            whatsapp: f.whatsapp ? mascaraTelefone(String(f.whatsapp)) : "",
          }
        : { ...vazio }
    );

  const salvar = async () => {
    if (!edit) return;
    const num = (v: string) => parseValorBR(v);

    const salario = num(edit.salario_base);
    const diaria = num(edit.vt_diaria);

    if (salario != null && salario > LIMITE_SALARIO) {
      if (!window.confirm(`Salário base de ${brl(salario)} — esse valor parece alto, confirma?`)) return;
    }
    if (diaria != null && diaria > LIMITE_DIARIA) {
      if (!window.confirm(`Passagem diária de ${brl(diaria)} — esse valor parece alto, confirma?`)) return;
    }

    const original = (data ?? []).find((f: any) => f.id === edit.id);
    const mudouValor =
      !!edit.id &&
      (Number(original?.salario_base ?? 0) !== Number(salario ?? 0) ||
        Number(original?.vt_diaria ?? 0) !== Number(diaria ?? 0));

    const payload: Record<string, any> = {
      p_nome: edit.nome,
      p_chave_pix: edit.chave_pix,
      p_tipo_chave_pix: edit.tipo_chave_pix,
      p_id: edit.id,
      p_cpf: edit.cpf || null,
      p_cargo: edit.cargo || null,
      p_ativo: edit.ativo,
      p_observacao: edit.observacao || null,
      p_admissao: edit.admissao || null,
      p_salario_base: salario,
      p_vt_mensal: num(edit.vt_mensal),
      p_vt_diaria: diaria,
      p_va_mensal: num(edit.va_mensal),
      p_cesta_valor: num(edit.cesta_valor),
      p_registrada: edit.registrada,
      p_vt_desconto_pct: edit.registrada ? Math.min(6, Math.max(0, Number(num(edit.vt_desconto_pct) ?? 0))) : 0,
    };

    const whatsapp = soDigitos(edit.whatsapp) || null;
    let { error } = await supabase.rpc("rh_funcionario_salvar", { ...payload, p_whatsapp: whatsapp } as any);
    let whatsappNaoSalvo = false;
    if (error && (error as any).code === "PGRST202") {
      // backend ainda sem o parâmetro p_whatsapp — salva o resto e avisa
      whatsappNaoSalvo = true;
      ({ error } = await supabase.rpc("rh_funcionario_salvar", payload as any));
    }

    if (error) return toast({ title: "Erro ao salvar", description: erroRh(error).mensagem, variant: "destructive" });
    if (whatsappNaoSalvo && whatsapp) {
      toast({
        title: "WhatsApp não foi salvo",
        description: "O backend ainda não aceita o parâmetro p_whatsapp em rh_funcionario_salvar. Os demais dados foram salvos.",
        variant: "destructive",
      });
    }
    if (mudouValor) {
      avisarRegeracao(
        competenciaAtual(),
        "Funcionário salvo",
        "Salário ou diária de VT mudaram — rode 'Gerar lançamentos do mês' e regere o holerite de fechamento para atualizar o líquido.",
      );
    } else {
      toast({ title: "Funcionário salvo" });
    }
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["rh-funcionarios"] });
  };


  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-serif">Funcionários</CardTitle>
        <Button size="sm" onClick={() => abrir()}><Plus className="h-3.5 w-3.5 mr-2" />Novo funcionário</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto space-y-4">
        {!!pendentes?.length && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                {pendentes.length} chave(s) PIX aguardando confirmação de titular
              </p>
              <p className="mt-0.5">
                O lote PIX é recusado enquanto houver pendências: {pendentes.map((p: any) => p.nome ?? p.funcionario_nome ?? p.chave_pix).join(", ")}
              </p>
            </div>
          </div>
        )}
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="text-left py-2">Funcionário</th>
                <th className="text-left px-3">Admissão</th>
                <th className="text-right px-3">Salário base</th>
                <th className="text-left px-3">Chave PIX</th>
                <th className="text-left px-3">Benefícios</th>
                <th className="text-left px-3">Registro</th>
                <th className="text-left px-3">Status</th>
                <th className="text-right px-3"></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((f) => (
                <tr key={f.id} className="border-b">
                  <td className="py-2">
                    <div className="font-medium">{f.nome}</div>
                    <div className="text-xs text-muted-foreground">{f.cargo ?? "—"}</div>
                    {f.whatsapp ? (
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {telefoneBonito(f.whatsapp)}
                      </div>
                    ) : (
                      <span className="mt-1 inline-block text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        sem WhatsApp
                      </span>
                    )}
                  </td>
                  <td className="px-3">{dataBRCompleta(f.admissao)}</td>
                  <td className="px-3 text-right tabular-nums">{brl(f.salario_base)}</td>
                  <td className="px-3 text-xs align-top">
                    <div>{f.tipo_chave_pix ?? "—"} · {f.chave_pix ?? "—"}</div>
                    {f.chave_confirmada || f.titular_confirmado ? (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        <ShieldCheck className="h-3 w-3" />
                        {f.titular_confirmado || "titular confirmado"}
                      </span>
                    ) : (
                      <div className="mt-1 space-y-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px]"
                          disabled={!f.chave_pix || verificando === f.id}
                          onClick={() => verificarChave(f)}
                        >
                          {verificando === f.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                          Verificar chave Pix
                        </Button>
                        {resultados[f.id]?.tipo === "aviso" && (
                          <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-800">
                            <div className="font-medium">{(resultados[f.id] as any).mensagem}</div>
                            {(resultados[f.id] as any).dica && <div>{(resultados[f.id] as any).dica}</div>}
                            <div>A idempotência evita gastar outro centavo ao tentar de novo.</div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px]"
                              disabled={verificando === f.id}
                              onClick={() => verificarChave(f)}
                            >
                              {verificando === f.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                              Tentar de novo
                            </Button>
                          </div>
                        )}
                        {resultados[f.id]?.tipo === "ok" && (
                          <div className="space-y-1">
                            <div className="text-[10px] text-muted-foreground">
                              Titular no banco:{" "}
                              <span className="font-medium text-foreground">{(resultados[f.id] as any).titular}</span>
                              {(resultados[f.id] as any).cpf_mascarado ? ` · ${(resultados[f.id] as any).cpf_mascarado}` : ""}
                            </div>
                            {(resultados[f.id] as any).veredito && (
                              <div
                                className={cn(
                                  "text-[10px]",
                                  /^(ok|confere|compat)/i.test((resultados[f.id] as any).veredito)
                                    ? "text-green-700"
                                    : "text-amber-700",
                                )}
                              >
                                veredito: {(resultados[f.id] as any).veredito}
                                {(resultados[f.id] as any).motivo ? ` — ${(resultados[f.id] as any).motivo}` : ""}
                              </div>
                            )}
                            <Button
                              size="sm"
                              className="h-6 text-[10px]"
                              disabled={confirmando === f.id}
                              onClick={() => confirmarTitular(f)}
                            >
                              {confirmando === f.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                              Confirmar titular
                            </Button>
                          </div>
                        )}

                      </div>
                    )}
                  </td>

                  <td className="px-3">
                    <div className="flex flex-wrap gap-1">
                      {Number(f.vt_diaria) > 0 ? (
                        <Chip>VT {brl(f.vt_diaria)}/dia</Chip>
                      ) : Number(f.vt_mensal) > 0 ? (
                        <Chip>VT {brl(f.vt_mensal)}</Chip>
                      ) : null}
                      {Number(f.va_mensal) > 0 && <Chip>VA {brl(f.va_mensal)}</Chip>}
                      {Number(f.cesta_valor) > 0 && <Chip>Cesta {brl(f.cesta_valor)}</Chip>}
                    </div>
                  </td>
                  <td className="px-3">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full",
                      f.registrada ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {f.registrada ? "CLT" : "Sem registro"}
                    </span>
                  </td>

                  <td className="px-3">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full", f.ativo ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
                      {f.ativo ? "ativo" : "inativo"}
                    </span>
                  </td>
                  <td className="px-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => abrir(f)}>Editar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-serif">{edit?.id ? "Editar funcionário" : "Novo funcionário"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Adiantamento = 40% e saldo = 60% do salário base são calculados automaticamente ao gerar a folha.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Campo label="Nome"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Campo>
                <Campo label="CPF"><Input value={edit.cpf} onChange={(e) => setEdit({ ...edit, cpf: e.target.value })} /></Campo>
                <Campo label="Cargo"><Input value={edit.cargo} onChange={(e) => setEdit({ ...edit, cargo: e.target.value })} /></Campo>
                <Campo label="Admissão"><Input type="date" value={edit.admissao} onChange={(e) => setEdit({ ...edit, admissao: e.target.value })} /></Campo>
                <Campo label="Tipo de chave PIX">
                  <Select value={edit.tipo_chave_pix} onValueChange={(v) => setEdit({ ...edit, tipo_chave_pix: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS_CHAVE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </Campo>
                <Campo label="Chave PIX"><Input value={edit.chave_pix} onChange={(e) => setEdit({ ...edit, chave_pix: e.target.value })} /></Campo>
                <Campo label="WhatsApp">
                  <Input
                    value={edit.whatsapp}
                    onChange={(e) => setEdit({ ...edit, whatsapp: mascaraTelefone(e.target.value) })}
                    placeholder="(11) 99999-9999"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    número que recebe holerite, recibo e comprovante
                  </p>
                </Campo>
                <Campo label="Salário base"><Input value={edit.salario_base} onChange={(e) => setEdit({ ...edit, salario_base: e.target.value })} placeholder="0,00" /></Campo>
                <Campo label="Passagem diária (R$)">
                  <Input value={edit.vt_diaria} onChange={(e) => setEdit({ ...edit, vt_diaria: e.target.value })} placeholder="0,00" />
                  <p className="text-[10px] text-muted-foreground">VT do mês = diária × dias úteis (menos feriados e faltas)</p>
                </Campo>
                <Campo label="VT fixo mensal (R$)">
                  <Input value={edit.vt_mensal} onChange={(e) => setEdit({ ...edit, vt_mensal: e.target.value })} placeholder="0,00" />
                  <p className="text-[10px] text-muted-foreground">usado apenas se a passagem diária estiver zerada</p>
                </Campo>
                <Campo label="VA mensal (Ticket)"><Input value={edit.va_mensal} onChange={(e) => setEdit({ ...edit, va_mensal: e.target.value })} placeholder="0,00" /></Campo>
                <Campo label="Cesta básica (R$)">
                  <Input value={edit.cesta_valor} onChange={(e) => setEdit({ ...edit, cesta_valor: e.target.value })} placeholder="0,00" />
                  <p className="text-[10px] text-muted-foreground">paga dentro do fechamento, como provento do holerite</p>
                </Campo>
                <Campo label="Observação"><Input value={edit.observacao} onChange={(e) => setEdit({ ...edit, observacao: e.target.value })} /></Campo>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} />
                  <Label className="text-xs">Ativo</Label>
                </div>
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={edit.registrada}
                      onCheckedChange={(v) => setEdit({ ...edit, registrada: v, vt_desconto_pct: v ? (edit.vt_desconto_pct || "6") : "0" })}
                    />
                    <Label className="text-xs">Registrada (CLT)</Label>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Registrada: INSS descontado no fechamento, FGTS informado no holerite e desconto opcional de VT. Sem registro: recebe os benefícios normalmente, sem nenhum desconto.
                  </p>
                </div>
                {edit.registrada && (
                  <Campo label="Desconto de VT (%)">
                    <Input
                      type="number"
                      min={0}
                      max={6}
                      step={0.5}
                      value={edit.vt_desconto_pct}
                      onChange={(e) => setEdit({ ...edit, vt_desconto_pct: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      padrão 6% (máximo legal); 0% = empresa paga o VT integral
                    </p>
                  </Campo>
                )}


              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
                <Button onClick={salvar} disabled={!edit.nome || !edit.chave_pix}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{children}</span>;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
