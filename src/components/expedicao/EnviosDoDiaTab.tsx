import { useMemo, useState } from "react";
import { format, subDays, parse } from "date-fns";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, Download, Printer, RefreshCw, Truck, PackageX, Package } from "lucide-react";
import { toast } from "sonner";
import { useRomaneio, type ItemRomaneio, type RomaneioDia } from "@/hooks/useBonificacaoExpedicao";

const vazio = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s === "" ? "-" : s;
};

const somaPecas = (itens: ItemRomaneio[]) =>
  itens.reduce((acc, i) => acc + (Number(i.pecas) || 0), 0);

const escapeHtml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function csvGrupo(itens: ItemRomaneio[]) {
  const linhas = [
    "pedido;cliente;servico;codigo;destino;pecas",
    ...itens.map((i) =>
      [i.pedido, i.cliente, i.servico, i.codigo, i.destino, i.pecas]
        .map((c) => String(c ?? "").replace(/;/g, ","))
        .join(";")
    ),
  ];
  return "\uFEFF" + linhas.join("\r\n");
}

function baixarCsv(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function grupoHtml(titulo: string, itens: ItemRomaneio[], diaBr: string) {
  const linhas = itens
    .map(
      (i, idx) => `<tr>
      <td>${idx + 1}</td>
      <td>#${escapeHtml(i.pedido)}</td>
      <td>${escapeHtml(i.cliente ?? "-")}</td>
      <td>${escapeHtml(i.servico ?? "-")}</td>
      <td class="cod">${escapeHtml(i.codigo ?? "-")}</td>
      <td>${escapeHtml(i.destino ?? "-")}</td>
      <td class="num">${escapeHtml(i.pecas ?? 0)}</td>
    </tr>`
    )
    .join("");

  return `<section class="folha">
    <header>
      <h1>ROMANEIO DE ENVIOS · ${escapeHtml(titulo)}</h1>
      <div class="meta">
        <span>Data: ${escapeHtml(diaBr)}</span>
        <span>Use Mariana Cardoso</span>
      </div>
    </header>
    <table>
      <thead>
        <tr><th>Nº</th><th>Pedido</th><th>Cliente</th><th>Serviço</th><th>Código</th><th>Destino</th><th>Peças</th></tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
    <p class="total">Total: ${itens.length} volumes · ${somaPecas(itens)} peças</p>
    <div class="assinaturas">
      <p>Entregue por ______________________________</p>
      <p>Recebido por (motorista/agência) ______________________________</p>
      <p>Data e hora ___/___/_____ ___:___</p>
    </div>
  </section>`;
}

function imprimirRomaneio(grupos: { titulo: string; itens: ItemRomaneio[] }[], diaBr: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    toast.error("Libere as janelas pop-up para imprimir.");
    return;
  }
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" />
<title>Romaneio de envios ${escapeHtml(diaBr)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; background:#fff; font-size:12px; }
  .folha { padding:16mm 14mm; page-break-after: always; }
  .folha:last-child { page-break-after: auto; }
  header { border-bottom:2px solid #111; padding-bottom:8px; margin-bottom:12px; }
  h1 { font-size:17px; letter-spacing:.5px; }
  .meta { display:flex; justify-content:space-between; font-size:12px; color:#444; margin-top:4px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#eee; text-align:left; font-size:11px; padding:5px 6px; border:1px solid #bbb; }
  td { padding:5px 6px; border:1px solid #bbb; font-size:12px; }
  td.cod { font-family: "Courier New", monospace; font-weight:700; }
  td.num { text-align:right; }
  .total { margin-top:10px; font-weight:700; font-size:13px; }
  .assinaturas { margin-top:26px; line-height:2.4; font-size:12px; }
  @page { size: A4 portrait; margin: 0; }
</style></head><body>
${grupos.map((g) => grupoHtml(g.titulo, g.itens, diaBr)).join("")}
<script>window.onload = function(){ window.print(); }</script>
</body></html>`);
  win.document.close();
}

function BlocoEnvios({
  titulo,
  itens,
  diaBr,
  chave,
  conferidos,
  alternarConferido,
}: {
  titulo: string;
  itens: ItemRomaneio[];
  diaBr: string;
  chave: string;
  conferidos: Record<string, boolean>;
  alternarConferido: (id: string) => void;
}) {
  const nConferidos = itens.filter((_, idx) => conferidos[`${chave}-${idx}`]).length;

  const copiarCodigos = async () => {
    const codigos = itens.map((i) => i.codigo).filter(Boolean).join("\n");
    if (!codigos) {
      toast.error("Nenhum código para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(codigos);
      toast.success("Códigos copiados.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-serif text-lg">
            {titulo} · {itens.length} pedidos
          </h3>
          <span className="text-xs text-muted-foreground">
            {nConferidos} de {itens.length} conferidos
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={copiarCodigos}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar códigos
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              baixarCsv(
                `romaneio-${titulo.toLowerCase().replace(/\s+/g, "-")}-${diaBr.replace(/\//g, "-")}.csv`,
                csvGrupo(itens)
              )
            }
          >
            <Download className="h-3.5 w-3.5 mr-1" /> Baixar CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => imprimirRomaneio([{ titulo, itens }], diaBr)}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir romaneio
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">Nº</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead className="text-right">Peças</TableHead>
              <TableHead>Postado</TableHead>
              <TableHead className="w-24">Conferido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((i, idx) => {
              const id = `${chave}-${idx}`;
              return (
                <TableRow key={id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">#{i.pedido}</TableCell>
                  <TableCell>{vazio(i.cliente)}</TableCell>
                  <TableCell>{vazio(i.servico)}</TableCell>
                  <TableCell className="font-mono text-xs">{vazio(i.codigo)}</TableCell>
                  <TableCell className="text-sm">{vazio(i.destino)}</TableCell>
                  <TableCell className="text-right">{Number(i.pecas) || 0}</TableCell>
                  <TableCell>
                    {i.postado ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Postado</Badge>
                    ) : (
                      <Badge variant="secondary">Aguardando</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={!!conferidos[id]}
                      onCheckedChange={() => alternarConferido(id)}
                      aria-label="Conferido"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Total: {itens.length} pedidos · {somaPecas(itens)} peças
      </p>
    </div>
  );
}

export default function EnviosDoDiaTab() {
  const hoje = format(new Date(), "yyyy-MM-dd");
  const [dia, setDia] = useState(hoje);
  const [conferidos, setConferidos] = useState<Record<string, boolean>>({});
  const { data, isLoading, refetch, isFetching } = useRomaneio(dia);

  const romaneio = data as RomaneioDia | null;
  const diaBr = romaneio?.dia_br ?? format(parse(dia, "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
  const correios = romaneio?.correios ?? [];
  const transportadoras = romaneio?.transportadoras ?? [];

  const alternarConferido = (id: string) =>
    setConferidos((prev) => ({ ...prev, [id]: !prev[id] }));

  const gruposImpressao = useMemo(
    () => [
      ...(correios.length ? [{ titulo: "Correios", itens: correios }] : []),
      ...transportadoras.map((g) => ({
        titulo: g.transportadora ?? "Transportadora",
        itens: g.itens ?? [],
      })),
    ],
    [correios, transportadoras]
  );

  const vazioTotal = !isLoading && gruposImpressao.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Dia</Label>
            <Input
              type="date"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              className="w-44 mt-1"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setDia(hoje)}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setDia(format(subDays(parse(dia, "yyyy-MM-dd", new Date()), 1), "yyyy-MM-dd"))
            }
          >
            Dia anterior
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (!gruposImpressao.length) {
                toast.error("Nenhum envio para imprimir.");
                return;
              }
              imprimirRomaneio(gruposImpressao, diaBr);
            }}
          >
            <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir tudo
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Package className="h-4 w-4" /> Correios
          </div>
          <p className="text-3xl font-serif mt-1">{romaneio?.totais?.correios ?? 0}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Truck className="h-4 w-4" /> Transportadoras
          </div>
          <p className="text-3xl font-serif mt-1">{romaneio?.totais?.transportadoras ?? 0}</p>
        </Card>
        <Card className={`p-4 ${(romaneio?.totais?.sem_codigo ?? 0) > 0 ? "border-orange-400" : ""}`}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <PackageX className="h-4 w-4" /> Sem código
          </div>
          <p
            className={`text-3xl font-serif mt-1 ${
              (romaneio?.totais?.sem_codigo ?? 0) > 0 ? "text-orange-500" : ""
            }`}
          >
            {romaneio?.totais?.sem_codigo ?? 0}
          </p>
        </Card>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando envios...</p>}

      {vazioTotal && (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum envio registrado neste dia.
        </Card>
      )}

      {correios.length > 0 && (
        <Card className="p-5">
          <BlocoEnvios
            titulo="Correios"
            itens={correios}
            diaBr={diaBr}
            chave="correios"
            conferidos={conferidos}
            alternarConferido={alternarConferido}
          />
        </Card>
      )}

      {transportadoras.length > 0 && (
        <Card className="p-5 space-y-8">
          {transportadoras.map((g, gi) => (
            <BlocoEnvios
              key={`${g.transportadora ?? "t"}-${gi}`}
              titulo={g.transportadora ?? "Transportadora"}
              itens={g.itens ?? []}
              diaBr={diaBr}
              chave={`t${gi}`}
              conferidos={conferidos}
              alternarConferido={alternarConferido}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
