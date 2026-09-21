import { useParams } from "react-router-dom";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOcImprimir } from "@/hooks/useBonificacaoExpedicao";

const dataBr = (v: string | null | undefined) => {
  if (!v) return "-";
  const s = String(v).slice(0, 10);
  const p = s.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
};

export default function OrdemCorteImprimir() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useOcImprimir(id);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black">
        Ordem de corte não encontrada.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          body * { visibility: hidden; }
          #folha-oc, #folha-oc * { visibility: visible; }
          #folha-oc { position: absolute; inset: 0; margin: 0; width: 100%; box-shadow: none; }
          .sem-impressao { display: none !important; }
        }
      `}</style>

      <div className="max-w-[210mm] mx-auto mb-4 flex justify-end sem-impressao">
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      <div
        id="folha-oc"
        className="max-w-[210mm] mx-auto bg-white text-black p-10 shadow-sm"
        style={{ minHeight: "297mm" }}
      >
        <div className="flex items-start justify-between border-b border-black pb-3">
          <div>
            <div className="text-xs tracking-[0.3em] uppercase">Ordem de corte</div>
            <div className="text-4xl font-bold mt-1">{data.numero_oc}</div>
          </div>
          <div className="text-right text-xs">
            <div>Status: {data.status ?? "-"}</div>
            <div>Criada em {dataBr(data.criada_em)}</div>
          </div>
        </div>

        {data.tipo === "pedido" && (
          <div className="mt-3 border border-black px-3 py-2 text-sm font-semibold uppercase tracking-wide">
            Sob encomenda · Pedido #{data.pedido}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mt-5 text-sm">
          <Campo rotulo="Cliente" valor={data.cliente ?? "-"} />
          <Campo rotulo="Data do pedido" valor={dataBr(data.data_pedido)} />
          <Campo rotulo="Criada em" valor={dataBr(data.criada_em)} />
          <Campo rotulo="Previsão de conclusão" valor={dataBr(data.previsao_pronto)} destaque />
          <Campo rotulo="Prazo de envio" valor={dataBr(data.prazo_envio)} />
        </div>

        <table className="w-full mt-6 text-sm border-collapse">
          <thead>
            <tr>
              {["Produto", "SKU", "Tecido", "Cor", "Tamanho", "Qtd"].map((h) => (
                <th key={h} className="border border-neutral-400 bg-neutral-100 text-left px-2 py-1 text-xs uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data.itens ?? []).map((it, i) => (
              <tr key={i}>
                <td className="border border-neutral-400 px-2 py-1">{it.produto ?? "-"}</td>
                <td className="border border-neutral-400 px-2 py-1">{it.sku ?? "-"}</td>
                <td className="border border-neutral-400 px-2 py-1">{it.tecido ?? "-"}</td>
                <td className="border border-neutral-400 px-2 py-1">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 border border-neutral-500"
                      style={{ backgroundColor: it.cor_hex ?? "#fff" }}
                    />
                    {it.cor ?? "-"}
                  </span>
                </td>
                <td className="border border-neutral-400 px-2 py-1">{it.tamanho ?? "-"}</td>
                <td className="border border-neutral-400 px-2 py-1 text-right">{it.quantidade}</td>
              </tr>
            ))}
            <tr>
              <td className="border border-neutral-400 px-2 py-1 font-semibold" colSpan={5}>
                Total de peças
              </td>
              <td className="border border-neutral-400 px-2 py-1 text-right font-semibold">{data.total_pecas}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-5 border border-neutral-400 p-3 text-sm min-h-[70px]">
          <div className="text-xs uppercase text-neutral-600">Observação</div>
          <div className="mt-1 whitespace-pre-wrap">{data.observacao ?? "-"}</div>
        </div>

        <div className="mt-10 space-y-6 text-sm">
          <div>Cortado por ____________________________ Data ____/____</div>
          <div>Costurado por __________________________ Data ____/____</div>
          <div>Conferido por __________________________ Data ____/____</div>
        </div>
      </div>
    </div>
  );
}

function Campo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-600">{rotulo}</div>
      <div className={destaque ? "text-lg font-bold" : "font-medium"}>{valor}</div>
    </div>
  );
}
