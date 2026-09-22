import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  rpcCashback, listaDe, brl, dataBr, corStatus, ROTULO_STATUS, type Linha,
} from "@/lib/cashback";
import { CarregandoBloco, EstadoErro, EstadoVazio } from "./Estados";

const STATUS = ["todos", "ativo", "usado", "expirado", "cancelado", "devolvido"];

export function CuponsTab({ onAbrirCliente }: { onAbrirCliente: (customer: string) => void }) {
  const [status, setStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [buscaDebounce, setBuscaDebounce] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounce(busca.trim()), 400);
    return () => clearTimeout(t);
  }, [busca]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await rpcCashback("cashback_cupons_listar", {
        p_status: status === "todos" ? null : status,
        p_busca: buscaDebounce || null,
        p_limite: 200,
      });
      setLinhas(listaDe(r));
    } catch (e: any) {
      setErro(e?.message ?? "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  }, [status, buscaDebounce]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "todos" ? "Todos os status" : ROTULO_STATUS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-9 w-[360px]"
          placeholder="Buscar por nome da cliente, e-mail, código do cupom ou pedido"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {carregando ? (
            <CarregandoBloco />
          ) : erro ? (
            <EstadoErro mensagem={erro} onTentar={carregar} />
          ) : linhas.length === 0 ? (
            <EstadoVazio titulo="Nenhum cupom encontrado." descricao="Tente outro status ou outra busca." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Mínimo</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pedido de origem</TableHead>
                  <TableHead>Usado no pedido</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((c, i) => (
                  <TableRow key={c.id ?? i}>
                    <TableCell className="font-medium">
                      <div>{c.cliente ?? c.nome ?? "-"}</div>
                      {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.code ?? "-"}</TableCell>
                    <TableCell>{brl(c.valor)}</TableCell>
                    <TableCell>{brl(c.valor_minimo)}</TableCell>
                    <TableCell>{dataBr(c.validade)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={corStatus(c.status)}>
                        {ROTULO_STATUS[String(c.status).toLowerCase()] ?? c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.pedido_origem ?? "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.pedido_uso ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!c.tray_customer_id}
                        onClick={() => onAbrirCliente(String(c.tray_customer_id ?? ""))}
                      >
                        Ver cliente
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
