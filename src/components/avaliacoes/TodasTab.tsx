import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  avalLista,
  avalModerar,
  avalResponder,
  formatarData,
  numero,
  texto,
} from "@/lib/avaliacoes";

const TAMANHO = 25;

function Estrelas({ nota }: { nota: any }) {
  const n = Number(nota ?? 0);
  if (!n) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-0.5" title={`${n} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= n ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

function fotosDe(l: Record<string, any>): string[] {
  const brutas = l.fotos ?? l.midias ?? l.imagens ?? [];
  if (!Array.isArray(brutas)) return [];
  return brutas
    .map((f: any) => (typeof f === "string" ? f : f?.url ?? f?.foto_url ?? f?.midia_url))
    .filter(Boolean);
}

export function TodasTab() {
  const { toast } = useToast();
  const [status, setStatus] = useState("todas");
  const [nota, setNota] = useState("todas");
  const [produto, setProduto] = useState("");
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState({ produto: "", busca: "" });
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [linhas, setLinhas] = useState<Array<Record<string, any>>>([]);
  const [total, setTotal] = useState(0);
  const [aberta, setAberta] = useState<Record<string, any> | null>(null);
  const [resposta, setResposta] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const r = await avalLista({
        status: status === "todas" ? null : status,
        nota: nota === "todas" ? null : Number(nota),
        produto: filtros.produto || null,
        busca: filtros.busca || null,
        pagina,
        tamanho: TAMANHO,
      });
      setLinhas((r.itens ?? r.linhas ?? []) as Array<Record<string, any>>);
      setTotal(Number(r.total ?? 0));
    } catch (e: any) {
      toast({ title: "Não foi possível carregar", description: e.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, nota, filtros, pagina]);

  function abrir(l: Record<string, any>) {
    setAberta(l);
    setResposta(String(l.resposta_loja ?? l.resposta ?? ""));
  }

  async function salvarResposta() {
    if (!aberta) return;
    setSalvando(true);
    try {
      await avalResponder(aberta.id ?? aberta.avaliacao_id, resposta);
      toast({ title: "Resposta salva" });
      await carregar();
    } catch (e: any) {
      toast({ title: "Não foi possível salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  async function moderar(st: "publicada" | "rejeitada") {
    if (!aberta) return;
    setSalvando(true);
    try {
      await avalModerar(aberta.id ?? aberta.avaliacao_id, "produto", st);
      toast({ title: st === "publicada" ? "Publicada" : "Rejeitada" });
      setAberta(null);
      await carregar();
    } catch (e: any) {
      toast({ title: "Não foi possível moderar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  const paginas = Math.max(1, Math.ceil((total || linhas.length) / TAMANHO));

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setPagina(1);
            setStatus(v);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="publicada">Publicada</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="rejeitada">Rejeitada</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={nota}
          onValueChange={(v) => {
            setPagina(1);
            setNota(v);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Nota" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as notas</SelectItem>
            {[5, 4, 3, 2, 1].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} estrela{n > 1 ? "s" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          className="w-44"
          placeholder="ID do produto"
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPagina(1);
              setFiltros({ produto: produto.trim(), busca: busca.trim() });
            }
          }}
        />

        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por texto ou nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPagina(1);
                setFiltros({ produto: produto.trim(), busca: busca.trim() });
              }
            }}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setPagina(1);
            setFiltros({ produto: produto.trim(), busca: busca.trim() });
          }}
        >
          Buscar
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr className="text-left">
                {["Data", "Produto", "Nota", "Cliente", "Texto", "Caimento", "Fotos", "Status", "Pedido"].map(
                  (h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  </td>
                </tr>
              )}
              {!carregando && !linhas.length && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground">
                    Nenhuma avaliação neste filtro.
                  </td>
                </tr>
              )}
              {!carregando &&
                linhas.map((l, i) => {
                  const fotos = fotosDe(l);
                  return (
                    <tr
                      key={String(l.id ?? i)}
                      onClick={() => abrir(l)}
                      className="cursor-pointer border-t border-border hover:bg-accent/40"
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatarData(l.data ?? l.criado_em ?? l.data_avaliacao)}
                      </td>
                      <td className="px-3 py-2">{texto(l.produto ?? l.produto_nome)}</td>
                      <td className="px-3 py-2">
                        <Estrelas nota={l.nota} />
                      </td>
                      <td className="px-3 py-2">{texto(l.cliente ?? l.cliente_nome)}</td>
                      <td className="max-w-[280px] truncate px-3 py-2">
                        {texto(l.texto ?? l.comentario)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{texto(l.caimento)}</td>
                      <td className="px-3 py-2">
                        <div className="flex -space-x-2">
                          {fotos.slice(0, 4).map((f, k) => (
                            <img
                              key={k}
                              src={f}
                              alt=""
                              className="h-8 w-8 rounded border border-border object-cover"
                            />
                          ))}
                          {!fotos.length && "—"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Badge variant="secondary">{texto(l.status)}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{texto(l.pedido)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{numero(total)} avaliações</span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pagina <= 1 || carregando}
            onClick={() => setPagina((p) => p - 1)}
          >
            Anterior
          </Button>
          <span>
            Página {pagina} de {paginas}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={pagina >= paginas || carregando}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      <Sheet open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-serif">
              {texto(aberta?.produto ?? aberta?.produto_nome)}
            </SheetTitle>
          </SheetHeader>
          {aberta && (
            <div className="space-y-5 pt-4">
              <div className="flex items-center justify-between">
                <Estrelas nota={aberta.nota} />
                <Badge variant="secondary">{texto(aberta.status)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {texto(aberta.cliente ?? aberta.cliente_nome)} ·{" "}
                {formatarData(aberta.data ?? aberta.criado_em)} · Pedido {texto(aberta.pedido)}
              </p>
              <p className="whitespace-pre-wrap text-sm">{texto(aberta.texto ?? aberta.comentario)}</p>
              {fotosDe(aberta).length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {fotosDe(aberta).map((f, i) => (
                    <a key={i} href={f} target="_blank" rel="noreferrer">
                      <img src={f} alt="" className="h-28 w-full rounded border border-border object-cover" />
                    </a>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="resposta-loja">
                  Resposta da loja
                </label>
                <Textarea
                  id="resposta-loja"
                  rows={4}
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                />
                <Button size="sm" onClick={salvarResposta} disabled={salvando}>
                  Salvar
                </Button>
              </div>
              <div className="flex gap-2 border-t border-border pt-4">
                <Button className="flex-1" disabled={salvando} onClick={() => moderar("publicada")}>
                  Publicar
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  disabled={salvando}
                  onClick={() => moderar("rejeitada")}
                >
                  Rejeitar
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
