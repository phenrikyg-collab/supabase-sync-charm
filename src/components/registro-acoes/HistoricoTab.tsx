import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CLASSE_SINAL, acoesListar, baixarCSV, dec, ddmm, isNil, rotuloDe, rotuloSemana,
  valorPorUnidade, type AcoesOpcoes,
} from "@/lib/registroAcoes";

const TODOS = "__todos__";
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function HistoricoTab({
  opcoes, onAbrirAcao,
}: { opcoes: AcoesOpcoes; onAbrirAcao: (a: any) => void }) {
  const hoje = new Date();
  const inicioPadrao = new Date(hoje);
  inicioPadrao.setDate(inicioPadrao.getDate() - 120);

  const [inicio, setInicio] = useState(iso(inicioPadrao));
  const [fim, setFim] = useState(iso(hoje));
  const [tipo, setTipo] = useState(TODOS);
  const [driver, setDriver] = useState(TODOS);
  const [sinal, setSinal] = useState(TODOS);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 25;

  const { data, isLoading, error } = useQuery({
    queryKey: ["acoes", "listar", inicio, fim, tipo, driver, sinal, busca],
    queryFn: async () => {
      const d = await acoesListar({
        p_inicio: inicio,
        p_fim: fim,
        p_tipo: tipo === TODOS ? null : tipo,
        p_driver: driver === TODOS ? null : driver,
        p_sinal: sinal === TODOS ? null : sinal,
        p_busca: busca.trim() || null,
      });
      return Array.isArray(d) ? d : d?.acoes ?? [];
    },
  });

  const linhas: any[] = data ?? [];
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina));
  const visiveis = useMemo(
    () => linhas.slice((pagina - 1) * porPagina, pagina * porPagina),
    [linhas, pagina],
  );

  const unidadeDe = (chave: any) =>
    opcoes.drivers.find((d) => d.valor === String(chave ?? ""))?.unidade;

  const exportar = () => {
    const cab = ["Semana", "Data", "Ação", "Tipo", "Driver", "Valor x base", "Sinal", "Leitura"];
    const corpo = linhas.map((a) => [
      rotuloSemana(a.semana),
      ddmm(a.data_inicio ?? a.data),
      a.titulo,
      rotuloDe(opcoes.tipos, a.tipo),
      rotuloDe(opcoes.drivers, a.driver_alvo, "Sem driver"),
      `${valorPorUnidade(a.valor_semana, unidadeDe(a.driver_alvo))} x ${valorPorUnidade(a.base_4s, unidadeDe(a.driver_alvo))}`,
      rotuloDe(opcoes.sinais, a.sinal, ""),
      rotuloDe(opcoes.leituras, a.leitura, ""),
    ]);
    baixarCSV("registro-acoes.csv", [cab, ...corpo]);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div>
          <Label className="text-xs">Início</Label>
          <Input type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setPagina(1); }} />
        </div>
        <div>
          <Label className="text-xs">Fim</Label>
          <Input type="date" value={fim} onChange={(e) => { setFim(e.target.value); setPagina(1); }} />
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={(v) => { setTipo(v); setPagina(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {opcoes.tipos.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Driver</Label>
          <Select value={driver} onValueChange={(v) => { setDriver(v); setPagina(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {opcoes.drivers.map((d) => <SelectItem key={d.valor} value={d.valor}>{d.rotulo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Sinal</Label>
          <Select value={sinal} onValueChange={(v) => { setSinal(v); setPagina(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {opcoes.sinais.map((s) => <SelectItem key={s.valor} value={s.valor}>{s.rotulo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Busca</Label>
          <Input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Título ou descrição" />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportar} disabled={!linhas.length}>
          Exportar CSV
        </Button>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}
      {error && <Card className="p-6 text-sm text-destructive">Não deu para carregar: {(error as Error).message}</Card>}

      {!isLoading && !error && linhas.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
          Nenhuma ação registrada neste período.
        </Card>
      )}

      {!isLoading && linhas.length > 0 && (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semana</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Valor x base</TableHead>
                <TableHead>Sinal</TableHead>
                <TableHead>Leitura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((a) => (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => onAbrirAcao(a)}>
                  <TableCell className="whitespace-nowrap text-xs">{rotuloSemana(a.semana)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{ddmm(a.data_inicio ?? a.data)}</TableCell>
                  <TableCell className="text-sm">{a.titulo}</TableCell>
                  <TableCell className="text-xs">{rotuloDe(opcoes.tipos, a.tipo, "")}</TableCell>
                  <TableCell className="text-xs">{rotuloDe(opcoes.drivers, a.driver_alvo, "Sem driver")}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {valorPorUnidade(a.valor_semana, unidadeDe(a.driver_alvo))}
                    {" x "}
                    {valorPorUnidade(a.base_4s, unidadeDe(a.driver_alvo))}
                    {!isNil(a.delta_base_pct) && (
                      <span className="text-muted-foreground"> ({dec(a.delta_base_pct, 2)}%)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.sinal && (
                      <Badge variant="outline" className={`text-[10px] border ${CLASSE_SINAL[String(a.sinal)] ?? CLASSE_SINAL.sem_base}`}>
                        {rotuloDe(opcoes.sinais, a.sinal)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{rotuloDe(opcoes.leituras, a.leitura, "")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">Página {pagina} de {totalPaginas}</span>
          <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
