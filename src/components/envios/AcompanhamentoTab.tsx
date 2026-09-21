import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { SeloSituacao, num, inteiro } from "./comum";
import { GavetaEnvio } from "./GavetaEnvio";

type Resumo = {
  ativos?: number | null;
  alertas_total?: number | null;
  entregues?: number | null;
  media_dias_entrega?: number | null;
  pct_no_prazo?: number | null;
  enviados_sem_codigo?: number | null;
  ultima_rodada_br?: string | null;
  ultima_rodada_erros?: string[] | null;
  alertas?: { tipo?: string; alerta?: string; rotulo?: string; n?: number }[];
  por_situacao?: { situacao: string; rotulo: string; n?: number }[];
};

type ItemLista = {
  envio_id: number;
  pedido?: string | number | null;
  cliente?: string | null;
  destino?: string | null;
  transportadora?: string | null;
  servico?: string | null;
  situacao?: string | null;
  situacao_rotulo?: string | null;
  ultimo_evento?: string | null;
  ultimo_evento_em_br?: string | null;
  ultimo_evento_local?: string | null;
  dias_desde_envio?: number | null;
  previsao_br?: string | null;
  passou_previsao?: boolean | null;
  alertas?: { rotulo?: string }[] | null;
};

type Lista = { itens?: ItemLista[]; total?: number | null };

const PERIODOS = [7, 30, 60];
const TRANSPORTADORAS = ["Correios", "Loggi", "Jadlog", "JeT"];
const LIMITE = 50;

export function AcompanhamentoTab() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [dias, setDias] = useState(30);
  const [busca, setBusca] = useState(params.get("busca") ?? "");

  const [situacoes, setSituacoes] = useState<string[]>([]);
  const [transportadora, setTransportadora] = useState<string>("");
  const [alerta, setAlerta] = useState<string>("");
  const [apenasAtivos, setApenasAtivos] = useState(true);
  const [offset, setOffset] = useState(0);
  const [marcados, setMarcados] = useState<number[]>([]);
  const [aberto, setAberto] = useState<number | null>(null);
  const [consultando, setConsultando] = useState(false);

  const { data: resumo } = useQuery({
    queryKey: ["logistica-resumo", dias],
    queryFn: async () => {
      const { data, error } = await chamarRpc<Resumo>("logistica_painel_resumo", { p_dias: dias });
      if (error) throw error;
      return data ?? {};
    },
  });

  const filtro = useMemo(() => {
    const f: Record<string, unknown> = { limite: LIMITE, offset, apenas_ativos: apenasAtivos };
    if (busca.trim()) f.busca = busca.trim();
    if (situacoes.length) f.situacao = situacoes;
    if (transportadora) f.transportadora = transportadora;
    if (alerta) f.alerta = alerta;
    return f;
  }, [busca, situacoes, transportadora, alerta, apenasAtivos, offset]);

  const { data: lista, isLoading } = useQuery({
    queryKey: ["logistica-lista", filtro],
    queryFn: async () => {
      const { data, error } = await chamarRpc<Lista>("logistica_painel_lista", { p_filtro: filtro });
      if (error) throw error;
      return data ?? {};
    },
  });

  const itens = lista?.itens ?? [];
  const total = Number(lista?.total ?? 0);
  const erros = resumo?.ultima_rodada_erros ?? [];

  function alternarSituacao(s: string) {
    setOffset(0);
    setSituacoes((atual) => (atual.includes(s) ? atual.filter((x) => x !== s) : [...atual, s]));
  }

  function alternarAlerta(valor: string) {
    setOffset(0);
    setAlerta((atual) => (atual === valor ? "" : valor));
  }

  async function consultarMarcados() {
    if (!marcados.length) return;
    setConsultando(true);
    const { data, error } = await chamarRpc<{ mensagem?: string }>("logistica_consultar_agora", {
      p_envio_ids: marcados.slice(0, 50),
    });
    setConsultando(false);
    if (error) {
      toast.error(error.message || "Não foi possível consultar");
      return;
    }
    toast.success(data?.mensagem || "Consulta pedida");
    setMarcados([]);
    setTimeout(() => qc.invalidateQueries({ queryKey: ["logistica-lista"] }), 10000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map((d) => (
          <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>
            {d} dias
          </Button>
        ))}
        <span className="text-xs text-muted-foreground">período usado nos números de entregues</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Em andamento</p>
            <p className="text-2xl font-semibold">{inteiro(resumo?.ativos)}</p>
          </CardContent>
        </Card>
        <Card className={Number(resumo?.alertas_total ?? 0) > 0 ? "border-orange-300 bg-orange-50" : undefined}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Precisam de atenção</p>
            <p className="text-2xl font-semibold">{inteiro(resumo?.alertas_total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Entregues no período</p>
            <p className="text-2xl font-semibold">{inteiro(resumo?.entregues)}</p>
            <p className="text-xs text-muted-foreground">média de {num(resumo?.media_dias_entrega)} dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">No prazo</p>
            <p className="text-2xl font-semibold">{num(resumo?.pct_no_prazo)}%</p>
          </CardContent>
        </Card>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Enviados sem código</p>
                <p className="text-2xl font-semibold">{inteiro(resumo?.enviados_sem_codigo)}</p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            Pedidos marcados como ENVIADO na Tray há mais de 1 dia sem código de rastreio
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Última consulta às transportadoras: {resumo?.ultima_rodada_br || "sem dados"}</span>
        {erros.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {erros.map((e, i) => (
                <p key={i}>{String(e)}</p>
              ))}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(resumo?.alertas ?? []).map((a, i) => {
          const valor = String(a.tipo ?? a.alerta ?? a.rotulo ?? "");
          return (
            <Badge
              key={`${valor}-${i}`}
              variant={alerta === valor ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => alternarAlerta(valor)}
            >
              {a.rotulo || valor} {inteiro(a.n)}
            </Badge>
          );
        })}
        <Badge
          variant={alerta === "qualquer" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => alternarAlerta("qualquer")}
        >
          Todos com alerta
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Pedido, código ou nome"
          value={busca}
          onChange={(e) => {
            setOffset(0);
            setBusca(e.target.value);
          }}
          className="w-64"
        />
        <Select
          value={transportadora || "todas"}
          onValueChange={(v) => {
            setOffset(0);
            setTransportadora(v === "todas" ? "" : v);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Transportadora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as transportadoras</SelectItem>
            {TRANSPORTADORAS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="apenas-ativos"
            checked={apenasAtivos}
            onCheckedChange={(v) => {
              setOffset(0);
              setApenasAtivos(v);
            }}
          />
          <Label htmlFor="apenas-ativos" className="text-sm">
            Só em andamento
          </Label>
        </div>
        {marcados.length > 0 && (
          <Button size="sm" onClick={consultarMarcados} disabled={consultando}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Consultar agora ({marcados.length})
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(resumo?.por_situacao ?? []).map((s) => (
          <Badge
            key={s.situacao}
            variant={situacoes.includes(s.situacao) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => alternarSituacao(s.situacao)}
          >
            {s.rotulo} {s.n !== undefined ? inteiro(s.n) : ""}
          </Badge>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Transportadora</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Último evento</TableHead>
                <TableHead>Enviado há</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead>Alertas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((it) => (
                <TableRow
                  key={it.envio_id}
                  className="cursor-pointer"
                  onClick={() => setAberto(it.envio_id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={marcados.includes(it.envio_id)}
                      onCheckedChange={(v) =>
                        setMarcados((m) =>
                          v ? [...m, it.envio_id] : m.filter((x) => x !== it.envio_id),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">#{it.pedido ?? ""}</TableCell>
                  <TableCell>{it.cliente || "sem nome"}</TableCell>
                  <TableCell>{it.destino || ""}</TableCell>
                  <TableCell>
                    <div>{it.transportadora || ""}</div>
                    {it.servico && <div className="text-xs text-muted-foreground">{it.servico}</div>}
                  </TableCell>
                  <TableCell>
                    <SeloSituacao situacao={it.situacao} rotulo={it.situacao_rotulo} />
                  </TableCell>
                  <TableCell className="max-w-56">
                    <div className="truncate">{it.ultimo_evento || "sem informação"}</div>
                    <div className="text-xs text-muted-foreground">
                      {[it.ultimo_evento_em_br, it.ultimo_evento_local].filter(Boolean).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {it.dias_desde_envio === null || it.dias_desde_envio === undefined
                      ? "sem dados"
                      : `${num(it.dias_desde_envio, 0)} dias`}
                  </TableCell>
                  <TableCell className={it.passou_previsao ? "whitespace-nowrap text-red-600" : "whitespace-nowrap"}>
                    {it.previsao_br || "sem previsão"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(it.alertas ?? []).map((a, i) => (
                        <Badge key={i} variant="outline" className="border-orange-200 bg-orange-50 text-orange-800">
                          {a.rotulo}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && itens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                    Nenhum envio com esses filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total > 0
            ? `${offset + 1} a ${Math.min(offset + LIMITE, total)} de ${inteiro(total)}`
            : "Nenhum resultado"}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - LIMITE))}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={offset + LIMITE >= total}
            onClick={() => setOffset((o) => o + LIMITE)}
          >
            Próxima
          </Button>
        </div>
      </div>

      <GavetaEnvio envioId={aberto} onFechar={() => setAberto(null)} />
    </div>
  );
}
