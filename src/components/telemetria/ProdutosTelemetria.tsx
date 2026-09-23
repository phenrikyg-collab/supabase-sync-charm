import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProdutoTelemetria as Produto, fetchTelemetriaProdutos, fmtBRL, fmtInt, fmtPct } from "@/lib/telemetria";

const COLUNAS: { key: keyof Produto; label: string; align?: "right" }[] = [
  { key: "nome", label: "Produto" },
  { key: "visualizacoes", label: "Visualizações", align: "right" },
  { key: "sessoes_que_viram", label: "Sessões que viram", align: "right" },
  { key: "add_carrinho", label: "Add. Carrinho", align: "right" },
  { key: "compras", label: "Compras", align: "right" },
  { key: "receita", label: "Receita", align: "right" },
  { key: "vis_carrinho_pct", label: "Vis.→Carrinho", align: "right" },
  { key: "carrinho_compra_pct", label: "Carrinho→Compra", align: "right" },
  { key: "conv_final_pct", label: "Conv. Final", align: "right" },
];

export function ProdutosTelemetria({ de, ate, limite = 100 }: { de: string; ate: string; limite?: number }) {
  const { data } = useQuery({
    queryKey: ["telemetria-produtos", de, ate, limite],
    queryFn: () => fetchTelemetriaProdutos(de, ate, limite),
    staleTime: 5 * 60_000,
  });
  const linhas = useMemo(() => data ?? [], [data]);

  const [sortCol, setSortCol] = useState<keyof Produto>("compras");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggle = (col: keyof Produto) => {
    if (sortCol === col) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const ordenadas = useMemo(() => {
    const arr = [...linhas];
    arr.sort((a, b) => {
      const av = a[sortCol]; const bv = b[sortCol];
      if (typeof av === "string" || typeof bv === "string") {
        return sortDir === "desc"
          ? String(bv ?? "").localeCompare(String(av ?? ""))
          : String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return sortDir === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
    });
    return arr;
  }, [linhas, sortCol, sortDir]);

  const medias = useMemo(() => {
    if (!linhas.length) return { sc: 0, cc: 0, final: 0 };
    return {
      sc: linhas.reduce((s, x) => s + x.vis_carrinho_pct, 0) / linhas.length,
      cc: linhas.reduce((s, x) => s + x.carrinho_compra_pct, 0) / linhas.length,
      final: linhas.reduce((s, x) => s + x.conv_final_pct, 0) / linhas.length,
    };
  }, [linhas]);

  const matriz = useMemo(() => {
    const receitas = linhas.filter((p) => p.receita > 0).map((p) => p.receita).sort((a, b) => a - b);
    const medianaReceita = receitas.length ? receitas[Math.floor(receitas.length / 2)] : 0;
    const quad = (x: number, y: number) => {
      const altaConv = x >= 5;
      const altaRec = y >= medianaReceita;
      if (altaConv && altaRec) return { label: "Escalar", fill: "#16a34a" };
      if (altaConv && !altaRec) return { label: "Oportunidade", fill: "#2563eb" };
      if (!altaConv && altaRec) return { label: "Corrigir", fill: "#dc2626" };
      return { label: "Monitorar", fill: "#9ca3af" };
    };
    const pts = linhas
      .filter((p) => p.visualizacoes > 0)
      .map((p) => {
        const q = quad(p.conv_final_pct, p.receita);
        return {
          nome: p.nome, x: p.conv_final_pct, y: p.receita,
          z: Math.max(p.compras, 1), compras: p.compras, fill: q.fill, quadrante: q.label,
        };
      });
    return { pts, medianaReceita };
  }, [linhas]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Matriz de Produtos — Conversão × Receita</CardTitle>
          <p className="text-xs text-muted-foreground">
            Linha vertical em 5% de conversão · Linha horizontal na mediana de receita ({fmtBRL(matriz.medianaReceita)})
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number" dataKey="x" name="Conversão" unit="%"
                label={{ value: "Conversão final (%)", position: "insideBottom", offset: -10 }}
              />
              <YAxis
                type="number" dataKey="y" name="Receita" tickFormatter={(v) => fmtBRL(Number(v))}
                label={{ value: "Receita", angle: -90, position: "insideLeft", offset: -10 }}
              />
              <ZAxis type="number" dataKey="z" range={[60, 600]} name="Compras" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                      <div className="mb-1 font-medium">{p.nome}</div>
                      <div>Conversão: {fmtPct(p.x)}</div>
                      <div>Receita: {fmtBRL(p.y)}</div>
                      <div>Compras: {fmtInt(p.compras)}</div>
                      <div className="mt-1 font-medium" style={{ color: p.fill }}>{p.quadrante}</div>
                    </div>
                  );
                }}
              />
              <ReferenceLine x={5} stroke="#64748b" strokeDasharray="4 4" />
              <ReferenceLine y={matriz.medianaReceita} stroke="#64748b" strokeDasharray="4 4" />
              <Scatter data={matriz.pts}>
                {matriz.pts.map((p, i) => <Cell key={i} fill={p.fill} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            {[
              { cor: "#16a34a", t: "Escalar", d: "alta conversão + alta receita" },
              { cor: "#2563eb", t: "Oportunidade", d: "alta conversão + baixa receita" },
              { cor: "#dc2626", t: "Corrigir", d: "baixa conversão + alta receita" },
              { cor: "#9ca3af", t: "Monitorar", d: "baixa conversão + baixa receita" },
            ].map((q) => (
              <div key={q.t} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-3 w-3 rounded-full" style={{ background: q.cor }} />
                <div><div className="font-medium">{q.t}</div><div className="text-muted-foreground">{q.d}</div></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance por produto (telemetria própria + Tray)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Médias — Vis.→Carrinho: <span className="font-medium">{fmtPct(medias.sc)}</span> · Carrinho→Compra:{" "}
            <span className="font-medium">{fmtPct(medias.cc)}</span> · Conv. Final:{" "}
            <span className="font-medium">{fmtPct(medias.final)}</span>
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {COLUNAS.map((c) => (
                  <TableHead
                    key={String(c.key)}
                    className={`${c.align === "right" ? "text-right" : ""} cursor-pointer select-none hover:text-foreground`}
                    onClick={() => toggle(c.key)}
                  >
                    {c.label}{sortCol === c.key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenadas.map((r) => (
                <TableRow key={r.produto_id || r.nome}>
                  <TableCell className="max-w-[280px] truncate font-medium">{r.nome}</TableCell>
                  <TableCell className="text-right">{fmtInt(r.visualizacoes)}</TableCell>
                  <TableCell className="text-right">{fmtInt(r.sessoes_que_viram)}</TableCell>
                  <TableCell className="text-right">{fmtInt(r.add_carrinho)}</TableCell>
                  <TableCell className="text-right">{fmtInt(r.compras)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.receita)}</TableCell>
                  <TableCell className={`text-right ${r.vis_carrinho_pct > medias.sc ? "font-medium text-success" : ""}`}>{fmtPct(r.vis_carrinho_pct)}</TableCell>
                  <TableCell className={`text-right ${r.carrinho_compra_pct > medias.cc ? "font-medium text-success" : ""}`}>{fmtPct(r.carrinho_compra_pct)}</TableCell>
                  <TableCell className={`text-right ${r.conv_final_pct > medias.final ? "font-medium text-success" : ""}`}>{fmtPct(r.conv_final_pct)}</TableCell>
                </TableRow>
              ))}
              {!ordenadas.length && (
                <TableRow>
                  <TableCell colSpan={COLUNAS.length} className="text-center text-muted-foreground">Sem dados no período</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
