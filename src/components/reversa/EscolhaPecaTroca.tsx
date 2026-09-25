import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { funcaoTroca, mensagemBackend, moeda, texto } from "@/lib/reversaPainel";

type Variacao = { tray_variant_id: any; tamanho?: string; cor?: string; estoque?: number };
type ProdutoCat = {
  produto?: string;
  imagem?: string;
  preco?: number;
  preco_br?: string;
  tray_product_id?: any;
  variacoes?: Variacao[];
};

async function rpc(nome: string, args: Record<string, any>) {
  const { data, error } = await (supabase as any).rpc(nome, args);
  if (error) throw new Error(error.message);
  return data;
}

function saldoTexto(diferenca: any, diferencaBr: any) {
  const n = Number(diferenca);
  if (diferenca == null || Number.isNaN(n)) return null;
  if (n < 0) return `sobra ${texto(diferencaBr)} de crédito`;
  if (n > 0) return `falta ${texto(diferencaBr)}`;
  return "crédito fecha exato";
}

export function EscolhaPecaTroca({
  s,
  aoMudar,
  abrirConverter,
}: {
  s: Record<string, any>;
  aoMudar: () => Promise<void> | void;
  abrirConverter: () => void;
}) {
  const { toast } = useToast();
  const escolha: Record<string, any> | null = s.troca_escolha ?? null;
  const semPedido = !s.pedido_novo_origem;
  const ehTroca = String(s.preferencia ?? "").toLowerCase() === "troca";
  const ehReembolso = String(s.preferencia ?? "").toLowerCase() === "reembolso";

  // Diálogo de escolha
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");
  const [opcoes, setOpcoes] = useState<Record<string, any> | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [sel, setSel] = useState<{ v: Variacao; p: ProdutoCat } | null>(null);
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Bling
  const [ocupado, setOcupado] = useState("");
  const [previa, setPrevia] = useState<Record<string, any> | null>(null);
  const [aviso409, setAviso409] = useState<{ msg: string; diferenca: any } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setBuscaDeb(busca.trim()), 400);
    return () => window.clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setCarregando(true);
    rpc("reversa_troca_opcoes_painel", { p_id: s.id, p_busca: buscaDeb || null })
      .then((d) => {
        if (!vivo) return;
        const r = Array.isArray(d) && d.length === 1 ? d[0] : d;
        setOpcoes(r?.reversa_troca_opcoes_painel ?? r ?? {});
      })
      .catch((e) => vivo && toast({ title: "Não deu certo", description: e.message, variant: "destructive" }))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, buscaDeb, s.id]);

  function abrir() {
    setBusca("");
    setBuscaDeb("");
    setSel(null);
    setObs("");
    setAberto(true);
  }

  async function salvar() {
    if (!sel) return;
    setSalvando(true);
    try {
      await rpc("reversa_troca_salvar_painel", {
        p_id: s.id,
        p_payload: { tipo: "peca", tray_variant_id: sel.v.tray_variant_id, observacao: obs.trim() || null },
      });
      setAberto(false);
      toast({ title: "Peça registrada" });
      await aoMudar();
    } catch (e: any) {
      toast({ title: "Não deu certo", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  async function simular() {
    setOcupado("simular");
    setAviso409(null);
    try {
      const { status, dados } = await funcaoTroca("reversa-troca-bling", { acao: "simular", solicitacao_id: s.id });
      if (status === 409) {
        setAviso409({ msg: mensagemBackend(dados), diferenca: dados?.diferenca ?? escolha?.diferenca });
        return;
      }
      if (status >= 400) {
        toast({ title: "Não deu certo", description: mensagemBackend(dados), variant: "destructive" });
        return;
      }
      setPrevia(dados ?? {});
    } catch (e: any) {
      toast({ title: "Não deu certo", description: e.message, variant: "destructive" });
    } finally {
      setOcupado("");
    }
  }

  async function criar() {
    setOcupado("criar");
    try {
      const { status, dados } = await funcaoTroca("reversa-troca-bling", { acao: "criar", solicitacao_id: s.id });
      if (status === 409) {
        setPrevia(null);
        setAviso409({ msg: mensagemBackend(dados), diferenca: dados?.diferenca ?? escolha?.diferenca });
        return;
      }
      if (status >= 400) {
        toast({ title: "Não deu certo", description: mensagemBackend(dados), variant: "destructive" });
        return;
      }
      setPrevia(null);
      toast({ title: `Pedido ${texto(dados?.numero)} criado no Bling` });
      await aoMudar();
    } catch (e: any) {
      toast({ title: "Não deu certo", description: e.message, variant: "destructive" });
    } finally {
      setOcupado("");
    }
  }

  const devolvidas: any[] = opcoes?.pecas_devolvidas ?? [];
  const catalogo: ProdutoCat[] = opcoes?.catalogo ?? [];
  const saldo = escolha ? saldoTexto(escolha.diferenca, escolha.diferenca_br) : null;
  const avisos: string[] = Array.isArray(previa?.avisos) ? previa!.avisos : [];

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <p className="text-sm font-medium">Peça nova</p>

      {!escolha ? (
        <p className="text-sm text-muted-foreground">Nenhuma peça escolhida ainda</p>
      ) : escolha.tipo === "cupom" ? (
        <p className="text-sm text-muted-foreground">A cliente prefere cupom de crédito</p>
      ) : escolha.tipo === "indeciso" ? (
        <p className="text-sm text-muted-foreground">A cliente ainda está indecisa</p>
      ) : (
        <div className="flex gap-3">
          {escolha.imagem && <img src={escolha.imagem} alt="" className="h-16 w-12 rounded object-cover" />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium truncate">{texto(escolha.produto)}</p>
            <p className="text-muted-foreground">
              {texto(escolha.cor)} / {texto(escolha.tamanho)} · {texto(escolha.preco_br ?? moeda(escolha.preco))}
            </p>
            {saldo && <p>{saldo}</p>}
            <p className="text-xs text-muted-foreground">
              {escolha.canal === "painel" ? "escolhido no painel" : "escolhido pela cliente"}
              {escolha.escolhido_em_br ? ` em ${escolha.escolhido_em_br}` : ""}
            </p>
            {escolha.observacao && <p className="text-xs text-muted-foreground">{escolha.observacao}</p>}
          </div>
        </div>
      )}

      {!semPedido && s.pedido_novo_origem === "bling" && (
        <p className="text-sm">
          Pedido {texto(s.pedido_novo_numero)} no Bling
          <span className="text-xs text-muted-foreground"> · id {texto(s.pedido_novo_bling_id)}</span>
        </p>
      )}

      {semPedido && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={abrir} disabled={!!ocupado}>
            {escolha ? "Trocar a peça escolhida" : "Escolher peça"}
          </Button>
          {escolha?.tipo === "peca" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button size="sm" disabled={!ehTroca || !!ocupado} onClick={simular}>
                      {ocupado === "simular" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Gerar pedido no Bling
                    </Button>
                  </span>
                </TooltipTrigger>
                {!ehTroca && (
                  <TooltipContent>Converta a solicitação em troca para gerar o pedido.</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      {aviso409 && (
        <p className="rounded border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
          {aviso409.msg}
          {aviso409.diferenca != null && ` (diferença de ${moeda(aviso409.diferenca)})`}
        </p>
      )}

      {/* Diálogo de escolha */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Escolher peça da troca</DialogTitle>
            <DialogDescription>Crédito disponível: {texto(opcoes?.credito_br)}</DialogDescription>
          </DialogHeader>

          {ehReembolso && (
            <p className="rounded border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
              Esta solicitação está como reembolso. Para gerar o pedido, converta em troca primeiro.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setAberto(false);
                  abrirConverter();
                }}
              >
                Converter em troca
              </button>
            </p>
          )}

          {devolvidas.length > 0 && (
            <div className="rounded border border-border bg-muted/40 p-2 text-xs space-y-0.5">
              <p className="font-medium">Peças devolvidas</p>
              {devolvidas.map((d, i) => (
                <p key={i} className="text-muted-foreground">
                  {texto(d.produto)} · {texto(d.cor)} · {texto(d.tamanho)}
                  {d.tamanho_desejado ? ` · quer ${d.tamanho_desejado}` : ""}
                </p>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar peça"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {carregando ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : catalogo.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma peça encontrada</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {catalogo.map((p, i) => (
                <div key={String(p.tray_product_id ?? i)} className="rounded border border-border p-2 space-y-1">
                  {p.imagem && <img src={p.imagem} alt="" className="aspect-[3/4] w-full rounded object-cover" />}
                  <p className="text-xs font-medium line-clamp-2">{texto(p.produto)}</p>
                  <p className="text-xs text-muted-foreground">{texto(p.preco_br ?? moeda(p.preco))}</p>
                  <div className="flex flex-wrap gap-1">
                    {(p.variacoes ?? []).map((v) => {
                      const ativo = sel?.v.tray_variant_id === v.tray_variant_id;
                      const zerado = Number(v.estoque ?? 0) <= 0;
                      return (
                        <button
                          key={String(v.tray_variant_id)}
                          type="button"
                          title={v.cor ?? undefined}
                          onClick={() => setSel({ v, p })}
                          className={`rounded border px-1.5 py-0.5 text-xs ${
                            ativo ? "border-primary bg-primary text-primary-foreground" : "border-border"
                          } ${zerado && !ativo ? "opacity-50" : ""}`}
                        >
                          {texto(v.tamanho)}
                          <span className="ml-1 text-[10px] opacity-70">{Number(v.estoque ?? 0)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {sel && (
            <div className="rounded border border-border p-2 text-sm space-y-1">
              <p>
                Escolhida: {texto(sel.p.produto)} · {texto(sel.v.cor)} · {texto(sel.v.tamanho)}
              </p>
              {Number(sel.v.estoque ?? 0) <= 0 && (
                <p className="text-xs text-warning">sem saldo no espelho da Tray, confirme com a expedição</p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="obs-escolha">Observação (opcional)</Label>
            <Textarea id="obs-escolha" value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} disabled={salvando}>
              Voltar
            </Button>
            <Button onClick={salvar} disabled={!sel || salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar peça
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação do Bling */}
      <Dialog open={!!previa} onOpenChange={(v) => !v && !ocupado && setPrevia(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Criar pedido no Bling?</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <p>Peça: {texto(typeof previa?.peca === "object" ? previa?.peca?.nome ?? previa?.peca?.produto : previa?.peca)}</p>
            <p>Cliente: {texto(previa?.contato_nome)}</p>
            <p>Total: {moeda(previa?.total)}</p>
            <p>Crédito aplicado: {moeda(previa?.credito)}</p>
            {previa?.diferenca != null && <p>Diferença: {moeda(previa?.diferenca)}</p>}
            {avisos.length > 0 && (
              <ul className="mt-2 list-disc rounded border border-warning/30 bg-warning/10 p-2 pl-6 text-xs text-warning">
                {avisos.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-muted-foreground">ver detalhes técnicos</summary>
              <pre className="mt-1 max-h-60 overflow-auto rounded bg-muted p-2">
                {JSON.stringify(previa?.pedido ?? {}, null, 2)}
              </pre>
            </details>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrevia(null)} disabled={!!ocupado}>
              Voltar
            </Button>
            <Button onClick={criar} disabled={!!ocupado}>
              {ocupado === "criar" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
