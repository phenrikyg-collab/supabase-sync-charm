import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Download, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CarregandoTabela, EstadoErro, EstadoVazio } from "./Estados";
import { baixarCsv, dataBr, inteiro, listaDe, numero, rpcAviseMe, type Linha } from "@/lib/aviseMe";

export type Grade = { produto_id: any; produto?: string; cor?: string; tamanho?: string };

const LIMITE = 100;

export function OrdemCorteTab({
  onAbrirGrade,
  onIrParaDisparo,
}: {
  onAbrirGrade: (g: Grade) => void;
  onIrParaDisparo: (g: Grade) => void;
}) {
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [soVoltaram, setSoVoltaram] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAtiva(busca.trim());
      setOffset(0);
    }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  async function carregar(novoOffset = offset, acumular = false) {
    setCarregando(true);
    setErro(null);
    try {
      const r = await rpcAviseMe("avise_me_demanda", {
        p_busca: buscaAtiva || null,
        p_so_voltaram: soVoltaram,
        p_limite: LIMITE,
        p_offset: novoOffset,
      });
      const novas = listaDe(r);
      setLinhas((antigas) => (acumular ? [...antigas, ...novas] : novas));
    } catch (e: any) {
      setErro(e?.message ?? "Erro inesperado");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaAtiva, soVoltaram]);

  function exportar() {
    baixarCsv(
      "avise-me-ordem-de-corte.csv",
      ["produto", "cor", "tamanho", "esperando", "estoque_hoje", "primeiro_pedido", "ultimo_pedido"],
      linhas.map((l) => [
        l.produto ?? "",
        l.cor ?? "",
        l.tamanho ?? "",
        numero(l.esperando),
        numero(l.estoque_hoje ?? l.estoque),
        dataBr(l.primeiro_pedido),
        dataBr(l.ultimo_pedido),
      ]),
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto, cor ou tamanho"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="so-voltaram" checked={soVoltaram} onCheckedChange={setSoVoltaram} />
          <Label htmlFor="so-voltaram" className="text-sm">Só as que voltaram</Label>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => carregar(0, false)}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Atualizar
          </Button>
          <Button size="sm" onClick={exportar} disabled={!linhas.length}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        {erro ? (
          <EstadoErro mensagem={erro} onTentar={() => carregar(0, false)} />
        ) : carregando && !linhas.length ? (
          <CarregandoTabela />
        ) : !linhas.length ? (
          <EstadoVazio
            titulo="Ninguém na fila ainda"
            descricao="Quando alguém pedir aviso de volta ao estoque, a grade aparece aqui."
          />
        ) : (
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead className="text-right">Esperando</TableHead>
                  <TableHead className="text-right">Estoque hoje</TableHead>
                  <TableHead>Primeiro pedido</TableHead>
                  <TableHead>Último pedido</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l, i) => {
                  const voltou = !!l.voltou;
                  const grade: Grade = {
                    produto_id: l.produto_id,
                    produto: l.produto,
                    cor: l.cor,
                    tamanho: l.tamanho,
                  };
                  return (
                    <TableRow
                      key={`${l.produto_id}-${l.cor}-${l.tamanho}-${i}`}
                      onClick={() => onAbrirGrade(grade)}
                      className={cn("cursor-pointer", voltou && "bg-success/5")}
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {l.produto ?? ""}
                          {l.grade_nao_encontrada && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                              </TooltipTrigger>
                              <TooltipContent>
                                Esta grade não casou com nenhuma variação da Tray, confira cor e tamanho
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>{l.cor ?? ""}</TableCell>
                      <TableCell>{l.tamanho ?? ""}</TableCell>
                      <TableCell className="text-right">{inteiro(l.esperando)}</TableCell>
                      <TableCell className="text-right">{inteiro(l.estoque_hoje ?? l.estoque)}</TableCell>
                      <TableCell>{dataBr(l.primeiro_pedido)}</TableCell>
                      <TableCell>{dataBr(l.ultimo_pedido)}</TableCell>
                      <TableCell className="text-right">
                        {voltou && (
                          <span className="flex items-center justify-end gap-2">
                            <Badge className="bg-success/15 text-success hover:bg-success/15">voltou</Badge>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onIrParaDisparo(grade);
                              }}
                            >
                              Avisar
                            </Button>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </Card>

      {linhas.length >= LIMITE && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={carregando}
            onClick={() => {
              const novo = offset + LIMITE;
              setOffset(novo);
              carregar(novo, true);
            }}
          >
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}
