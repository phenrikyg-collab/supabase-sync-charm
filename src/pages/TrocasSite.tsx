import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { PainelSolicitacao } from "@/components/reversa/PainelSolicitacao";
import { AbrirSolicitacaoDialog } from "@/components/reversa/AbrirSolicitacaoDialog";
import { PoliticaReversa } from "@/components/reversa/PoliticaReversa";
import {
  ALERTAS,
  codigoVencendo,
  formatarData,
  painelLista,
  texto,
  traco,
  type LinhaFila,
  type RespostaLista,
} from "@/lib/reversaPainel";

const LIMITE = 100;

export default function TrocasSite() {
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const [dados, setDados] = useState<RespostaLista | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const r = await painelLista({
        p_status: alerta ?? status ?? null,
        p_busca: buscaAtiva || null,
        p_limit: LIMITE,
        p_offset: 0,
      });
      setDados(r);
    } catch (e: any) {
      toast({ title: "Não foi possível carregar", description: e.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, alerta, buscaAtiva]);

  const linhas: LinhaFila[] = useMemo(() => dados?.itens ?? dados?.linhas ?? [], [dados]);
  const contagens = dados?.contagens ?? {};
  const alertas = dados?.alertas ?? {};
  const chipsStatus =
    dados?.status ??
    Object.entries(contagens).map(([s, total]) => ({ status: s, rotulo: s, total: Number(total) }));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Trocas e Devoluções</h1>
          <p className="text-sm text-muted-foreground">
            Fila da logística reversa do site, da abertura ao reembolso.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={carregar} disabled={carregando}>
            <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={() => setAbrindo(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Abrir solicitação
          </Button>
        </div>
      </header>

      <Tabs defaultValue="fila">
        <TabsList>
          <TabsTrigger value="fila">Fila</TabsTrigger>
          {isAdmin && <TabsTrigger value="politica">Política</TabsTrigger>}
        </TabsList>

        <TabsContent value="fila" className="space-y-5 pt-4">
          {/* Seção 1 — Alertas */}
          <div className="flex flex-wrap gap-3">
            {ALERTAS.filter((a) => Number(alertas[a.chave] ?? 0) > 0).map((a) => {
              const ativo = alerta === a.chave;
              return (
                <button
                  key={a.chave}
                  onClick={() => {
                    setStatus(null);
                    setAlerta(ativo ? null : a.chave);
                  }}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    ativo ? "border-primary ring-2 ring-primary/30" : "border-border"
                  } ${a.tom === "vermelho" ? "bg-destructive/10" : a.tom === "ambar" ? "bg-warning/10" : "bg-card"}`}
                >
                  <p
                    className={`text-2xl font-semibold tabular-nums ${
                      a.tom === "vermelho" ? "text-destructive" : ""
                    }`}
                  >
                    {alertas[a.chave]}
                  </p>
                  <p className="text-xs text-muted-foreground">{a.rotulo}</p>
                </button>
              );
            })}
          </div>

          {/* Seção 2 — Fila */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={!status && !alerta ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => {
                setStatus(null);
                setAlerta(null);
              }}
            >
              Todas
            </Badge>
            {chipsStatus.map((c) => (
              <Badge
                key={c.status}
                variant={status === c.status ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  setAlerta(null);
                  setStatus(status === c.status ? null : c.status);
                }}
              >
                {c.rotulo ?? c.status} {c.total != null ? `(${c.total})` : ""}
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Pedido, protocolo, nome, e-mail ou celular"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setBuscaAtiva(busca.trim())}
              />
            </div>
            <Button variant="outline" onClick={() => setBuscaAtiva(busca.trim())}>
              Buscar
            </Button>
          </div>

          <Card className="overflow-hidden">
            <div className="h-[560px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr className="text-left">
                    {[
                      "Protocolo",
                      "Cliente",
                      "Pedido",
                      "Peças",
                      "Preferência",
                      "Status",
                      "Código / rastreio",
                      "Dias",
                      "Consultora",
                    ].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
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
                        Nenhuma solicitação neste filtro.
                      </td>
                    </tr>
                  )}
                  {!carregando &&
                    linhas.map((l) => {
                      const alerta2 = codigoVencendo(l.valido_ate ?? l.postagem?.valido_ate);
                      return (
                        <tr
                          key={String(l.id)}
                          onClick={() => setSelecionado(String(l.id))}
                          className={`cursor-pointer border-t border-border hover:bg-accent/40 ${
                            alerta2 ? "text-destructive" : ""
                          }`}
                        >
                          <td className="whitespace-nowrap px-3 py-2 font-medium">
                            {texto(l.protocolo)}
                          </td>
                          <td className="px-3 py-2">{texto(l.cliente_nome ?? l.cliente)}</td>
                          <td className="whitespace-nowrap px-3 py-2">{texto(l.pedido)}</td>
                          <td className="px-3 py-2">
                            <div className="flex -space-x-2">
                              {((l.fotos ?? l.miniaturas ?? []) as string[])
                                .slice(0, 4)
                                .map((f, i) => (
                                  <img
                                    key={i}
                                    src={f}
                                    alt=""
                                    className="h-8 w-8 rounded border border-border object-cover"
                                  />
                                ))}
                              {!((l.fotos ?? l.miniaturas ?? []) as string[]).length && traco}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {texto(l.preferencia_rotulo ?? l.preferencia)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <Badge variant="secondary">{texto(l.status_rotulo ?? l.status)}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <div className="whitespace-nowrap">
                              {texto(l.codigo_autorizacao ?? l.postagem?.codigo_autorizacao)}
                            </div>
                            <div className="whitespace-nowrap text-xs text-muted-foreground">
                              {texto(l.rastreio ?? l.postagem?.rastreio)}
                              {l.valido_ate ? ` · até ${formatarData(l.valido_ate)}` : ""}
                            </div>
                          </td>
                          <td className="px-3 py-2 tabular-nums">{texto(l.dias)}</td>
                          <td className="px-3 py-2">{texto(l.consultora)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="politica" className="pt-4">
            <PoliticaReversa />
          </TabsContent>
        )}
      </Tabs>

      <PainelSolicitacao
        id={selecionado}
        aberto={!!selecionado}
        aoFechar={() => setSelecionado(null)}
        aoMudar={carregar}
      />

      <AbrirSolicitacaoDialog
        aberto={abrindo}
        aoFechar={() => setAbrindo(false)}
        aoCriar={(id) => {
          carregar();
          if (id) setSelecionado(id);
        }}
      />
    </div>
  );
}
