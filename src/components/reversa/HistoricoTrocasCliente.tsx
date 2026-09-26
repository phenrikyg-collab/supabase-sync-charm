import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { corGrupo, type DetalheCliente, type Motivo, type Protocolo } from "@/lib/trocasClientes";

const PREF: Record<string, string> = { troca: "Troca", reembolso: "Reembolso", misto: "Misto" };

export function BarrasMotivos({ motivos, pequeno }: { motivos: Motivo[]; pequeno?: boolean }) {
  const max = Math.max(1, ...motivos.map((m) => Number(m.n) || 0));
  return (
    <div className="space-y-1.5">
      {motivos.map((m, i) => (
        <div key={`${m.codigo ?? m.rotulo}-${i}`} className={pequeno ? "text-xs" : "text-sm"}>
          <div className="flex justify-between gap-2">
            <span className="min-w-0 truncate">{m.rotulo}</span>
            <span className="shrink-0 text-muted-foreground">{m.n}</span>
          </div>
          <div className={`w-full rounded bg-muted ${pequeno ? "h-1.5" : "h-2"}`}>
            <div className={`h-full rounded ${corGrupo(m.grupo)}`} style={{ width: `${(Number(m.n) / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChipsTamanhos({ tamanhos }: { tamanhos: NonNullable<DetalheCliente["tamanhos"]> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tamanhos.map((t) => (
        <Badge key={t.tamanho} variant="outline" className="font-normal">
          {t.tamanho} ({t.n})
          {Number(t.ficou_grande) > 0 && ` · ficou grande ${t.ficou_grande}x`}
          {Number(t.ficou_pequeno) > 0 && ` · ficou pequeno ${t.ficou_pequeno}x`}
        </Badge>
      ))}
    </div>
  );
}

export function ListaProtocolos({ protocolos, recolher }: { protocolos: Protocolo[]; recolher?: number }) {
  const [todos, setTodos] = useState(false);
  const visiveis = recolher && !todos ? protocolos.slice(0, recolher) : protocolos;
  return (
    <div className="space-y-2">
      {visiveis.map((p, i) => {
        const titulo = p.protocolo ?? `T&D pedido ${p.pedido ?? "-"}`;
        return (
          <div key={`${p.protocolo ?? p.pedido}-${i}`} className="min-w-0 rounded-md border border-border p-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {p.origem === "reversa" && p.protocolo ? (
                <Link to={`/trocas-site?busca=${encodeURIComponent(p.protocolo)}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                  {titulo}
                </Link>
              ) : (
                <span className="font-semibold">{titulo}</span>
              )}
              <span className="text-muted-foreground">{p.data_br ?? "-"}</span>
              {p.preferencia && <Badge variant="outline" className="font-normal">{PREF[p.preferencia] ?? p.preferencia}</Badge>}
              {p.status && (
                <Badge variant="outline" className={p.recusada ? "border-destructive/30 bg-destructive/10 text-destructive" : "text-muted-foreground"}>
                  {p.status}
                </Badge>
              )}
            </div>
            {(p.pecas ?? []).map((pc, j) => (
              <div key={j} className="mt-1 break-words text-muted-foreground [overflow-wrap:anywhere]">
                <span className="text-foreground">{[pc.produto, pc.cor, pc.tamanho].filter(Boolean).join(" · ")}</span>
                {pc.motivo_rotulo && ` · ${pc.motivo_rotulo}`}
                {pc.tamanho_desejado && ` · quer ${pc.tamanho_desejado}`}
                {pc.comentario && <span className="block italic">"{pc.comentario}"</span>}
              </div>
            ))}
          </div>
        );
      })}
      {recolher && protocolos.length > recolher && (
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setTodos((v) => !v)}>
          {todos ? "ver menos" : `ver todos (${protocolos.length})`}
        </Button>
      )}
    </div>
  );
}
