import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead } from "@/components/SortableHead";
import { MessageCircle, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type LinhaAudiencia = {
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  perfil?: string | null;
  compras?: number | null;
  total_gasto?: number | null;
  ultima_compra?: string | null;
  tem_conversa_whatsapp?: boolean | null;
};

const CORES_PERFIL: Record<string, string> = {
  campeas: "bg-success/10 text-success border-success/30",
  campeãs: "bg-success/10 text-success border-success/30",
  campeoes: "bg-success/10 text-success border-success/30",
  fieis: "bg-info/10 text-info border-info/30",
  fiéis: "bg-info/10 text-info border-info/30",
  potenciais: "bg-primary/10 text-primary border-primary/30",
  novas: "bg-primary/10 text-primary border-primary/30",
  novos: "bg-primary/10 text-primary border-primary/30",
  promissoras: "bg-primary/10 text-primary border-primary/30",
  atencao: "bg-warning/10 text-warning border-warning/30",
  "atenção": "bg-warning/10 text-warning border-warning/30",
  "em risco": "bg-warning/10 text-warning border-warning/30",
  risco: "bg-warning/10 text-warning border-warning/30",
  hibernando: "bg-muted text-muted-foreground border-border",
  inativas: "bg-danger/10 text-danger border-danger/30",
  inativos: "bg-danger/10 text-danger border-danger/30",
  perdidas: "bg-danger/10 text-danger border-danger/30",
  perdidos: "bg-danger/10 text-danger border-danger/30",
};

function corPerfil(perfil?: string | null) {
  if (!perfil) return "bg-muted text-muted-foreground border-border";
  return CORES_PERFIL[perfil.trim().toLowerCase()] ?? "bg-muted text-muted-foreground border-border";
}

function moeda(v?: number | null) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export default function Audiencia() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<{ campo: keyof LinhaAudiencia; dir: "asc" | "desc" }>({
    campo: "total_gasto",
    dir: "desc",
  });

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["vw-audiencia"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_audiencia" as any).select("*").limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as LinhaAudiencia[];
    },
  });

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const base = !t
      ? linhas
      : linhas.filter((l) =>
          [l.nome, l.email, l.telefone].some((v) => (v ?? "").toLowerCase().includes(t)),
        );
    const arr = [...base];
    arr.sort((a, b) => {
      const va = a[ordem.campo];
      const vb = b[ordem.campo];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return ordem.dir === "asc" ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb), "pt-BR");
      return ordem.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [linhas, busca, ordem]);

  const alternar = (campo: keyof LinhaAudiencia) =>
    setOrdem((o) => (o.campo === campo ? { campo, dir: o.dir === "asc" ? "desc" : "asc" } : { campo, dir: "desc" }));

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-4">
      <div>
        <h1 className="font-serif text-4xl text-foreground">Audiência</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Diretório único de contatos — clientes, leads e conversas de WhatsApp.
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail ou telefone"
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {filtradas.length} contato{filtradas.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="border border-border rounded-md overflow-auto max-h-[calc(100vh-300px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <SortableHead
                  active={ordem.campo === "nome"}
                  direction={ordem.dir}
                  onClick={() => alternar("nome")}
                >
                  Nome
                </SortableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <SortableHead
                  active={ordem.campo === "perfil"}
                  direction={ordem.dir}
                  onClick={() => alternar("perfil")}
                >
                  Perfil
                </SortableHead>
                <SortableHead
                  active={ordem.campo === "compras"}
                  direction={ordem.dir}
                  onClick={() => alternar("compras")}
                  className="text-right"
                >
                  Compras
                </SortableHead>
                <SortableHead
                  active={ordem.campo === "total_gasto"}
                  direction={ordem.dir}
                  onClick={() => alternar("total_gasto")}
                  className="text-right"
                >
                  Total gasto
                </SortableHead>
                <SortableHead
                  active={ordem.campo === "ultima_compra"}
                  direction={ordem.dir}
                  onClick={() => alternar("ultima_compra")}
                >
                  Última compra
                </SortableHead>
                <TableHead className="text-center">WhatsApp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    Carregando contatos…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum contato encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtradas.map((l, i) => (
                <TableRow key={`${l.telefone ?? l.email ?? "x"}-${i}`}>
                  <TableCell className="font-medium">{l.nome || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.email || "—"}</TableCell>
                  <TableCell className="text-sm">{l.telefone || "—"}</TableCell>
                  <TableCell>
                    {l.perfil ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                          corPerfil(l.perfil),
                        )}
                      >
                        {l.perfil}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">{l.compras ?? 0}</TableCell>
                  <TableCell className="text-right">{moeda(l.total_gasto)}</TableCell>
                  <TableCell>{formatarData(l.ultima_compra)}</TableCell>
                  <TableCell className="text-center">
                    {l.tem_conversa_whatsapp ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-success"
                        title="Abrir conversa no Atendimento"
                        onClick={() =>
                          navigate(`/atendimento?telefone=${encodeURIComponent(l.telefone ?? "")}`)
                        }
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
