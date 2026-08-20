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
import { Plus } from "lucide-react";
import { brl, dataBRCompleta } from "@/lib/rh";
import { cn } from "@/lib/utils";

const TIPOS_CHAVE = ["cpf", "cnpj", "email", "telefone", "aleatoria"];

const vazio = {
  id: null as string | null, nome: "", cpf: "", cargo: "", chave_pix: "", tipo_chave_pix: "cpf",
  ativo: true, observacao: "", admissao: "", salario_base: "", vt_mensal: "", va_mensal: "", cesta_valor: "",
  registrada: false, vt_desconto_pct: "0",
};


export function FuncionariosTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<typeof vazio | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["rh-funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_funcionarios_listar", { p_incluir_inativos: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

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
            va_mensal: f.va_mensal != null ? String(f.va_mensal) : "",
            cesta_valor: f.cesta_valor != null ? String(f.cesta_valor) : "",
            registrada: !!f.registrada,
            vt_desconto_pct: f.vt_desconto_pct != null ? String(f.vt_desconto_pct) : "0",
          }
        : { ...vazio }
    );

  const salvar = async () => {
    if (!edit) return;
    const num = (v: string) => (v === "" ? null : Number(String(v).replace(/\./g, "").replace(",", ".")));
    const { error } = await supabase.rpc("rh_funcionario_salvar", {
      p_nome: edit.nome,
      p_chave_pix: edit.chave_pix,
      p_tipo_chave_pix: edit.tipo_chave_pix,
      p_id: edit.id,
      p_cpf: edit.cpf || null,
      p_cargo: edit.cargo || null,
      p_ativo: edit.ativo,
      p_observacao: edit.observacao || null,
      p_admissao: edit.admissao || null,
      p_salario_base: num(edit.salario_base),
      p_vt_mensal: num(edit.vt_mensal),
      p_va_mensal: num(edit.va_mensal),
      p_cesta_valor: num(edit.cesta_valor),
      p_registrada: edit.registrada,
      p_vt_desconto_pct: edit.registrada ? Math.min(6, Math.max(0, Number(num(edit.vt_desconto_pct) ?? 0))) : 0,
    } as any);

    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: "Funcionário salvo" });
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["rh-funcionarios"] });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-serif">Funcionários</CardTitle>
        <Button size="sm" onClick={() => abrir()}><Plus className="h-3.5 w-3.5 mr-2" />Novo funcionário</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
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
                  </td>
                  <td className="px-3">{dataBRCompleta(f.admissao)}</td>
                  <td className="px-3 text-right tabular-nums">{brl(f.salario_base)}</td>
                  <td className="px-3 text-xs">{f.tipo_chave_pix ?? "—"} · {f.chave_pix ?? "—"}</td>
                  <td className="px-3">
                    <div className="flex flex-wrap gap-1">
                      {Number(f.vt_mensal) > 0 && <Chip>VT {brl(f.vt_mensal)}</Chip>}
                      {Number(f.va_mensal) > 0 && <Chip>VA {brl(f.va_mensal)}</Chip>}
                      {Number(f.cesta_valor) > 0 && <Chip>Cesta {brl(f.cesta_valor)}</Chip>}
                    </div>
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
                <Campo label="Salário base"><Input value={edit.salario_base} onChange={(e) => setEdit({ ...edit, salario_base: e.target.value })} placeholder="0,00" /></Campo>
                <Campo label="VT mensal"><Input value={edit.vt_mensal} onChange={(e) => setEdit({ ...edit, vt_mensal: e.target.value })} placeholder="0,00" /></Campo>
                <Campo label="VA mensal (Ticket)"><Input value={edit.va_mensal} onChange={(e) => setEdit({ ...edit, va_mensal: e.target.value })} placeholder="0,00" /></Campo>
                <Campo label="Cesta básica"><Input value={edit.cesta_valor} onChange={(e) => setEdit({ ...edit, cesta_valor: e.target.value })} placeholder="0,00" /></Campo>
                <Campo label="Observação"><Input value={edit.observacao} onChange={(e) => setEdit({ ...edit, observacao: e.target.value })} /></Campo>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} />
                  <Label className="text-xs">Ativo</Label>
                </div>
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
