import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Info } from "lucide-react";

type Regra = {
  id: string;
  ordem: number | null;
  segmento: string | null;
  r_operador: string | null;
  r_valor: number | null;
  f_operador: string | null;
  f_valor: number | null;
  m_operador: string | null;
  m_valor: number | null;
  ativo: boolean | null;
};

const OPERADORES = [">=", "<=", "="] as const;
const VAZIO = "__vazio__";

function CampoCondicao({
  operador, valor, onChange,
}: {
  operador: string | null;
  valor: number | null;
  onChange: (op: string | null, val: number | null) => void;
}) {
  const [texto, setTexto] = useState(valor == null ? "" : String(valor));
  useEffect(() => setTexto(valor == null ? "" : String(valor)), [valor]);

  return (
    <div className="flex items-center gap-1">
      <Select
        value={operador ?? VAZIO}
        onValueChange={(v) => onChange(v === VAZIO ? null : v, v === VAZIO ? null : valor)}
      >
        <SelectTrigger className="h-8 w-[74px] text-xs">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={VAZIO}>—</SelectItem>
          {OPERADORES.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="h-8 w-16 text-xs"
        value={texto}
        disabled={!operador}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => onChange(operador, texto.trim() === "" ? null : Number(texto))}
      />
    </div>
  );
}

export function RegrasMatrizTab() {
  const queryClient = useQueryClient();
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const { data: regras = [], isLoading, error } = useQuery({
    queryKey: ["rfm_regras_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfm_regras_config" as any)
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Regra[];
    },
  });

  const atualizar = async (id: string, campos: Partial<Regra>) => {
    setSalvandoId(id);
    const { error } = await supabase.from("rfm_regras_config" as any).update(campos as any).eq("id", id);
    setSalvandoId(null);
    if (error) {
      toast.error("Não foi possível salvar a regra", { description: error.message });
      return;
    }
    toast.success("Regra atualizada");
    queryClient.invalidateQueries({ queryKey: ["rfm_regras_config"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuração da Matriz</CardTitle>
        <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            As regras são avaliadas <strong>em ordem crescente</strong> — a primeira que bater define o
            segmento do cliente. Operador vazio (—) significa que aquela dimensão não é avaliada na regra.
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-6">
            Não foi possível carregar as regras: {(error as any)?.message}. Verifique se você está autenticado.
          </p>
        ) : regras.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">
            Nenhuma regra cadastrada ainda (ou seu usuário não tem permissão de leitura).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ordem</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Recência (R)</TableHead>
                  <TableHead>Frequência (F)</TableHead>
                  <TableHead>Monetário (M)</TableHead>
                  <TableHead className="text-right">Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regras.map((r) => (
                  <TableRow key={r.id} className={salvandoId === r.id ? "opacity-60" : undefined}>
                    <TableCell>
                      <Input
                        className="h-8 w-16 text-xs"
                        defaultValue={r.ordem ?? ""}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== r.ordem) atualizar(r.id, { ordem: v });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 min-w-[160px] text-xs"
                        defaultValue={r.segmento ?? ""}
                        onBlur={(e) => {
                          if (e.target.value !== r.segmento) atualizar(r.id, { segmento: e.target.value });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <CampoCondicao
                        operador={r.r_operador}
                        valor={r.r_valor}
                        onChange={(op, val) => atualizar(r.id, { r_operador: op, r_valor: val })}
                      />
                    </TableCell>
                    <TableCell>
                      <CampoCondicao
                        operador={r.f_operador}
                        valor={r.f_valor}
                        onChange={(op, val) => atualizar(r.id, { f_operador: op, f_valor: val })}
                      />
                    </TableCell>
                    <TableCell>
                      <CampoCondicao
                        operador={r.m_operador}
                        valor={r.m_valor}
                        onChange={(op, val) => atualizar(r.id, { m_operador: op, m_valor: val })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={!!r.ativo}
                        onCheckedChange={(v) => atualizar(r.id, { ativo: v })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
