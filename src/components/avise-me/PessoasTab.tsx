import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, RefreshCw, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CarregandoTabela, EstadoErro, EstadoVazio } from "./Estados";
import { dataHoraBr, listaDe, rpcAviseMe, type Linha } from "@/lib/aviseMe";
import type { Grade } from "./OrdemCorteTab";

const LIMITE = 50;

const STATUS = [
  { valor: "esperando", rotulo: "Esperando" },
  { valor: "avisado", rotulo: "Avisado" },
  { valor: "cancelado", rotulo: "Cancelado" },
  { valor: "todos", rotulo: "Todos" },
];

export function PessoasTab({
  grade,
  onLimparGrade,
}: {
  grade: Grade | null;
  onLimparGrade: (campo: "produto" | "cor" | "tamanho" | "tudo") => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState("esperando");
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<any[]>([]);
  const [confirmarLote, setConfirmarLote] = useState(false);
  const [cancelarId, setCancelarId] = useState<any>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAtiva(busca.trim());
      setPagina(0);
    }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await rpcAviseMe("avise_me_pessoas", {
        p_produto_id: grade?.produto_id ?? null,
        p_cor: grade?.cor ?? null,
        p_tamanho: grade?.tamanho ?? null,
        p_status: status === "todos" ? null : status,
        p_busca: buscaAtiva || null,
        p_limite: LIMITE,
        p_offset: pagina * LIMITE,
      });
      setLinhas(listaDe(r));
      setSelecionados([]);
    } catch (e: any) {
      setErro(e?.message ?? "Erro inesperado");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, buscaAtiva, pagina, grade?.produto_id, grade?.cor, grade?.tamanho]);

  async function marcarAvisado() {
    try {
      await rpcAviseMe("avise_me_marcar_avisado", { p_ids: selecionados });
      toast({ title: `${selecionados.length} marcadas como avisado` });
      setConfirmarLote(false);
      carregar();
    } catch (e: any) {
      toast({ title: "Não foi possível marcar", description: e?.message, variant: "destructive" });
    }
  }

  async function cancelar(id: any) {
    try {
      await rpcAviseMe("avise_me_cancelar_painel", { p_id: id });
      toast({ title: "Inscrição cancelada" });
      setCancelarId(null);
      carregar();
    } catch (e: any) {
      toast({ title: "Não foi possível cancelar", description: e?.message, variant: "destructive" });
    }
  }

  const todosMarcados = linhas.length > 0 && selecionados.length === linhas.length;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPagina(0); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS.map((s) => (
              <SelectItem key={s.valor} value={s.valor}>{s.rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por e-mail ou nome"
            className="pl-8"
          />
        </div>

        <Button variant="outline" size="sm" onClick={carregar}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Atualizar
        </Button>

        {selecionados.length > 0 && (
          <Button size="sm" className="ml-auto" onClick={() => setConfirmarLote(true)}>
            Marcar como avisado ({selecionados.length})
          </Button>
        )}
      </div>

      {grade && (
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["produto", grade.produto ?? String(grade.produto_id ?? "")],
            ["cor", grade.cor],
            ["tamanho", grade.tamanho],
          ] as const).map(([campo, valor]) =>
            valor ? (
              <Badge key={campo} variant="secondary" className="gap-1">
                {campo}: {valor}
                <button onClick={() => onLimparGrade(campo as any)} className="ml-1">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ) : null,
          )}
          <Button variant="ghost" size="sm" onClick={() => onLimparGrade("tudo")}>
            Limpar filtros da grade
          </Button>
        </div>
      )}

      <Card>
        {erro ? (
          <EstadoErro mensagem={erro} onTentar={carregar} />
        ) : carregando ? (
          <CarregandoTabela />
        ) : !linhas.length ? (
          <EstadoVazio
            titulo="Ninguém na fila ainda"
            descricao="Nenhuma inscrição bate com os filtros escolhidos."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={todosMarcados}
                    onCheckedChange={(v) =>
                      setSelecionados(v ? linhas.map((l) => l.id) : [])
                    }
                  />
                </TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Quando pediu</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Checkbox
                      checked={selecionados.includes(l.id)}
                      onCheckedChange={(v) =>
                        setSelecionados((s) =>
                          v ? [...s, l.id] : s.filter((x) => x !== l.id),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">{l.email ?? ""}</TableCell>
                  <TableCell>{l.nome ?? ""}</TableCell>
                  <TableCell>{l.produto ?? ""}</TableCell>
                  <TableCell>{l.cor ?? ""}</TableCell>
                  <TableCell>{l.tamanho ?? ""}</TableCell>
                  <TableCell>{dataHoraBr(l.criado_em ?? l.quando_pediu ?? l.pedido_em)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{l.status ?? ""}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setCancelarId(l.id)}>
                          Cancelar inscrição
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Página {pagina + 1}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagina === 0}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={linhas.length < LIMITE}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmarLote} onOpenChange={setConfirmarLote}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como avisado</AlertDialogTitle>
            <AlertDialogDescription>
              {selecionados.length} inscrições passam para avisado. Isso não envia e-mail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={marcarAvisado}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelarId != null} onOpenChange={(a) => !a && setCancelarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar inscrição</AlertDialogTitle>
            <AlertDialogDescription>
              Esta pessoa deixa de esperar aviso desta grade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelar(cancelarId)}>Cancelar inscrição</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
