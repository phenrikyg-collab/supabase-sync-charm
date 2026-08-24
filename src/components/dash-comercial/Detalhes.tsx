import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/dashComercial";

export interface DetalheTicket {
  itens_por_pedido: number;
  preco_medio_item: number;
  ticket: number;
  pedidos: number;
}
export interface DetalheFunil {
  sessoes: number;
  carrinho: number;
  checkout: number;
  compras: number;
}
export interface LinhaPagamento {
  meio: string;
  rec_atual: number;
  rec_comp: number;
  qtd_atual: number;
  qtd_comp: number;
}
export interface LinhaCanal { canal: string; atual: number; comp: number }
export interface LinhaCampanha { campanha: string; spend: number; cliques: number; cpc: number; roas: number }

export interface DadosDetalhe {
  ticket: { atual: DetalheTicket; comp: DetalheTicket };
  aprovacao: LinhaPagamento[];
  conversao: { atual: DetalheFunil; comp: DetalheFunil };
  sessoes: LinhaCanal[];
  midia: LinhaCampanha[];
}

const Delta = ({ v, inverso = false, moeda = false }: { v: number; inverso?: boolean; moeda?: boolean }) => (
  <span className={cn("tabular-nums", (inverso ? -v : v) >= 0 ? "text-pos" : "text-neg")}>
    {v >= 0 ? "+" : "−"}{moeda ? fmtBRL(Math.abs(v)) : fmtNum(Math.abs(v), 2)}
  </span>
);

function varPct(a: number, b: number) { return b === 0 ? 0 : ((a - b) / Math.abs(b)) * 100; }

export function DetalheDriver({ id, dados }: { id: string; dados: DadosDetalhe }) {
  if (id === "ticket") {
    const { atual: a, comp: c } = dados.ticket;
    const dItens = varPct(a.itens_por_pedido, c.itens_por_pedido);
    const dPreco = varPct(a.preco_medio_item, c.preco_medio_item);
    const culpado = Math.abs(dItens) > Math.abs(dPreco) ? "cross-sell" : "preço médio do item";
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ticket = itens por pedido × preço médio do item. Separa queda de cross-sell de queda de preço.
        </p>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Componente</TableHead><TableHead className="text-right">Atual</TableHead>
            <TableHead className="text-right">Comparativo</TableHead><TableHead className="text-right">Δ %</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Itens por pedido</TableCell>
              <TableCell className="text-right tabular-nums">{fmtNum(a.itens_por_pedido, 2)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtNum(c.itens_por_pedido, 2)}</TableCell>
              <TableCell className="text-right"><Delta v={dItens} /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Preço médio do item</TableCell>
              <TableCell className="text-right tabular-nums">{fmtBRL(a.preco_medio_item)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtBRL(c.preco_medio_item)}</TableCell>
              <TableCell className="text-right"><Delta v={dPreco} /></TableCell>
            </TableRow>
            <TableRow className="font-semibold">
              <TableCell>Ticket médio</TableCell>
              <TableCell className="text-right tabular-nums">{fmtBRL(a.ticket)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtBRL(c.ticket)}</TableCell>
              <TableCell className="text-right"><Delta v={varPct(a.ticket, c.ticket)} /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="rounded-md bg-muted/60 p-3 text-sm">
          A maior parte da variação veio de <strong>{culpado}</strong>: itens {fmtNum(c.itens_por_pedido, 2)} → {fmtNum(a.itens_por_pedido, 2)}
          {" "}e preço {fmtBRL(c.preco_medio_item)} → {fmtBRL(a.preco_medio_item)}.
        </p>
      </div>
    );
  }

  if (id === "aprovacao") {
    const linhas = [...dados.aprovacao].sort((x, y) => (y.rec_atual - y.rec_comp) - (x.rec_atual - x.rec_comp));
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Receita cancelada por meio de pagamento, ordenada por Δ em R$.</p>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Meio de pagamento</TableHead>
            <TableHead className="text-right">Cancelado (R$)</TableHead>
            <TableHead className="text-right">Comparativo</TableHead>
            <TableHead className="text-right">Δ R$</TableHead>
            <TableHead className="text-right">Qtd</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.meio || "(vazio)"}>
                <TableCell className="font-medium">{l.meio || "(sem meio de pagamento)"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(l.rec_atual)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{fmtBRL(l.rec_comp)}</TableCell>
                <TableCell className="text-right"><Delta v={l.rec_atual - l.rec_comp} inverso moeda /></TableCell>
                <TableCell className="text-right tabular-nums">{fmtNum(l.qtd_atual)} <span className="text-muted-foreground">/ {fmtNum(l.qtd_comp)}</span></TableCell>
              </TableRow>
            ))}
            {!linhas.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Sem cancelamentos no período.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (id === "conversao") {
    const etapas = (f: DetalheFunil) => [
      { nome: "Sessões", v: f.sessoes, base: f.sessoes },
      { nome: "Adicionou ao carrinho", v: f.carrinho, base: f.sessoes },
      { nome: "Iniciou checkout", v: f.checkout, base: f.carrinho },
      { nome: "Compra", v: f.compras, base: f.checkout },
    ];
    const a = etapas(dados.conversao.atual);
    const c = etapas(dados.conversao.comp);
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Funil GA4: sessões → carrinho → checkout → compra, com a taxa de queda de cada etapa.</p>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Etapa</TableHead><TableHead className="text-right">Atual</TableHead>
            <TableHead className="text-right">Passagem</TableHead><TableHead className="text-right">Queda</TableHead>
            <TableHead className="text-right">Comparativo</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {a.map((e, i) => {
              const passagem = e.base ? (e.v / e.base) * 100 : 0;
              return (
                <TableRow key={e.nome}>
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(e.v)}</TableCell>
                  <TableCell className="text-right tabular-nums">{i === 0 ? "—" : fmtPct(passagem, 1)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", i > 0 && passagem < 50 ? "text-neg" : "")}>
                    {i === 0 ? "—" : fmtPct(100 - passagem, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNum(c[i].v)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (id === "sessoes") {
    const linhas = [...dados.sessoes].sort((x, y) => y.atual - x.atual);
    return (
      <Table>
        <TableHeader><TableRow>
          <TableHead>Canal</TableHead><TableHead className="text-right">Sessões</TableHead>
          <TableHead className="text-right">Comparativo</TableHead><TableHead className="text-right">Δ</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {linhas.map((l) => (
            <TableRow key={l.canal}>
              <TableCell className="font-medium">{l.canal}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtNum(l.atual)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNum(l.comp)}</TableCell>
              <TableCell className="text-right"><Delta v={l.atual - l.comp} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // mídia / cps
  const linhas = [...dados.midia].sort((x, y) => y.spend - x.spend);
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Campanha</TableHead><TableHead className="text-right">Spend</TableHead>
        <TableHead className="text-right">Cliques</TableHead><TableHead className="text-right">CPC</TableHead>
        <TableHead className="text-right">ROAS</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {linhas.map((l) => (
          <TableRow key={l.campanha}>
            <TableCell className="max-w-[220px] truncate font-medium" title={l.campanha}>{l.campanha}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtBRL(l.spend)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtNum(l.cliques)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtBRL(l.cpc)}</TableCell>
            <TableCell className={cn("text-right tabular-nums", l.roas >= 1 ? "text-pos" : "text-neg")}>{fmtNum(l.roas, 2)}x</TableCell>
          </TableRow>
        ))}
        {!linhas.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Sem investimento no período.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}
