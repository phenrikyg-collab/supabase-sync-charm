import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, RefreshCw, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";
import {
  vipProvaPedir,
  vipProvaRegistrar,
  vipProvaResponder,
  vipProvaRevogar,
  vipProvaSignedUrl,
  vipProvaUpload,
  vipProvasListar,
  vipProvasPainel,
  type VipProva,
} from "@/lib/vip";

const STATUS_FILTROS = [
  { valor: "todas", label: "Todas" },
  { valor: "registrada", label: "Registradas" },
  { valor: "pedida", label: "Aguardando resposta" },
  { valor: "autorizada", label: "Autorizadas" },
  { valor: "recusada", label: "Recusadas" },
  { valor: "revogada", label: "Revogadas" },
];

const CORES_STATUS: Record<string, string> = {
  autorizada: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  pedida: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  recusada: "bg-destructive/15 text-destructive border-destructive/30",
  revogada: "bg-destructive/15 text-destructive border-destructive/30",
};

function dias(desde?: string | null) {
  if (!desde) return null;
  const d = new Date(desde).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 86400000);
}

function textoSugerido(p: VipProva) {
  return `Oi${p.cliente_nome ? `, ${p.cliente_nome.split(" ")[0]}` : ""}! Amei a sua foto com ${
    p.produto_nome ?? "a peça"
  } 😍 Posso compartilhar ela no nosso grupo VIP? Se preferir, publico sem o seu nome. Pode me responder aqui mesmo com um sim ou não.`;
}

export function ProvaSocialTab() {
  const [painel, setPainel] = useState<any>(null);
  const [provas, setProvas] = useState<VipProva[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState("todas");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [novoAberto, setNovoAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [whats, setWhats] = useState("");
  const [peca, setPeca] = useState("");
  const [depoimento, setDepoimento] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [pedindo, setPedindo] = useState<VipProva | null>(null);
  const [textoPedido, setTextoPedido] = useState("");
  const [respondendo, setRespondendo] = useState<VipProva | null>(null);
  const [autorizada, setAutorizada] = useState("sim");
  const [comNome, setComNome] = useState<string>("");
  const [resposta, setResposta] = useState("");
  const [validade, setValidade] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [pn, lista] = await Promise.all([
        vipProvasPainel().catch(() => null),
        vipProvasListar().catch((e) => {
          setErro(e.message ?? "Falha ao ler o acervo");
          return [] as VipProva[];
        }),
      ]);
      setPainel(pn);
      setProvas(lista);
      const pares = await Promise.all(
        lista.map(async (p) => [p.id, p.imagem_url ?? (await vipProvaSignedUrl(p.imagem_path))] as const),
      );
      setUrls(Object.fromEntries(pares.filter(([, u]) => !!u) as [string, string][]));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const visiveis = useMemo(
    () => (filtro === "todas" ? provas : provas.filter((p) => (p.status ?? "") === filtro)),
    [provas, filtro],
  );

  const registrar = async () => {
    if (!arquivo) {
      toast.error("Escolha a imagem da cliente.");
      return;
    }
    setSalvando(true);
    try {
      const path = await vipProvaUpload(arquivo);
      await vipProvaRegistrar({
        imagem_path: path,
        cliente_nome: nome || null,
        cliente_whatsapp: whats || null,
        produto_nome: peca || null,
        depoimento: depoimento || null,
      });
      toast.success("Prova registrada.");
      setNovoAberto(false);
      setArquivo(null);
      setNome("");
      setWhats("");
      setPeca("");
      setDepoimento("");
      carregar();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao registrar");
    } finally {
      setSalvando(false);
    }
  };

  const confirmarPedido = async () => {
    if (!pedindo) return;
    try {
      await vipProvaPedir(pedindo.id, textoPedido);
      toast.success("Pedido registrado.");
      setPedindo(null);
      carregar();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao registrar o pedido");
    }
  };

  const confirmarResposta = async () => {
    if (!respondendo) return;
    const autoriza = autorizada === "sim";
    if (autoriza && comNome === "") {
      toast.error("Informe se a cliente pode aparecer com o nome.");
      return;
    }
    try {
      await vipProvaResponder(
        respondendo.id,
        autoriza,
        autoriza ? comNome === "sim" : null,
        resposta || null,
        validade || null,
      );
      toast.success("Resposta registrada.");
      setRespondendo(null);
      setResposta("");
      setComNome("");
      setValidade("");
      carregar();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao registrar a resposta");
    }
  };

  const revogar = async (p: VipProva) => {
    const motivo = prompt(
      "Motivo da revogação?\n\nA foto sai automaticamente de todas as mensagens que ainda não foram enviadas.",
    );
    if (motivo === null) return;
    try {
      await vipProvaRevogar(p.id, motivo);
      toast.success("Autorização revogada.");
      carregar();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao revogar");
    }
  };

  const porStatus: Record<string, number> = painel?.por_status ?? {};

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(porStatus).map(([s, n]) => (
          <Card key={s}>
            <CardContent className="py-4">
              <div className="text-xs uppercase text-muted-foreground">{s}</div>
              <div className="text-2xl font-semibold">{Number(n)}</div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase text-muted-foreground">Nunca pedidas</div>
            <div className="text-2xl font-semibold">{painel?.nunca_pedidas ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase text-muted-foreground">Vencem em 30 dias</div>
            <div className="text-2xl font-semibold">{painel?.vencendo_em_30d ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase text-muted-foreground">Mensagens travadas</div>
            <div className="text-2xl font-semibold text-amber-600">{painel?.mensagens_travadas ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {Array.isArray(painel?.aguardando_resposta) && painel.aguardando_resposta.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Esperando resposta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {painel.aguardando_resposta.map((a: any, i: number) => (
              <div key={i} className="flex justify-between border-b py-1 last:border-0">
                <span>{a.cliente_nome ?? a.nome ?? "Cliente"}</span>
                <span className="text-muted-foreground">
                  {a.dias ?? a.dias_esperando ?? dias(a.pedido_em) ?? "—"} dia(s)
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTROS.map((f) => (
          <Button key={f.valor} size="sm" variant={filtro === f.valor ? "default" : "outline"} onClick={() => setFiltro(f.valor)}>
            {f.label}
          </Button>
        ))}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={carregar}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Atualizar
        </Button>
        <Button size="sm" onClick={() => setNovoAberto(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Registrar prova
        </Button>
      </div>

      {carregando && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visiveis.map((p) => {
          const espera = p.dias_esperando ?? dias(p.pedido_em ?? p.criado_em);
          const status = p.status ?? "registrada";
          return (
            <Card key={p.id}>
              <CardContent className="flex gap-3 py-4">
                {urls[p.id] ? (
                  <img src={urls[p.id]} alt="" className="h-28 w-24 rounded object-cover" />
                ) : (
                  <div className="h-28 w-24 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <div className="font-medium">{p.cliente_nome ?? "Cliente"}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.produto_nome ?? "—"}</div>
                  <Badge variant="outline" className={CORES_STATUS[status] ?? ""}>{status}</Badge>
                  {espera !== null && (
                    <div className="text-[11px] text-muted-foreground">esperando há {espera} dia(s)</div>
                  )}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {status !== "autorizada" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => { setPedindo(p); setTextoPedido(textoSugerido(p)); }}
                      >
                        Pedir autorização
                      </Button>
                    )}
                    {status !== "autorizada" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setRespondendo(p)}
                      >
                        <ShieldCheck className="mr-1 h-3 w-3" /> Registrar resposta
                      </Button>
                    )}
                    {status === "autorizada" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => revogar(p)}>
                        <ShieldX className="mr-1 h-3 w-3" /> Revogar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!carregando && visiveis.length === 0 && !erro && (
          <p className="text-sm text-muted-foreground">Nenhuma prova neste filtro.</p>
        )}
      </div>

      {/* Registrar */}
      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Registrar prova</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Imagem</Label>
              <Input type="file" accept="image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <Label>Nome da cliente</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={whats} onChange={(e) => setWhats(e.target.value)} />
            </div>
            <div>
              <Label>Peça</Label>
              <Input value={peca} onChange={(e) => setPeca(e.target.value)} />
            </div>
            <div>
              <Label>Depoimento (opcional)</Label>
              <Textarea rows={3} value={depoimento} onChange={(e) => setDepoimento(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoAberto(false)}>Cancelar</Button>
            <Button disabled={salvando} onClick={registrar}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pedir autorização */}
      <Dialog open={!!pedindo} onOpenChange={(o) => !o && setPedindo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Pedir autorização</DialogTitle>
          </DialogHeader>
          <Textarea rows={6} value={textoPedido} onChange={(e) => setTextoPedido(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Copie o texto, mande no privado da cliente e confirme aqui. O texto exato fica guardado.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(textoPedido);
                toast.success("Texto copiado.");
              }}
            >
              Copiar
            </Button>
            <Button onClick={confirmarPedido}>Já enviei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar resposta */}
      <Dialog open={!!respondendo} onOpenChange={(o) => !o && setRespondendo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Registrar resposta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>A cliente autorizou?</Label>
              <RadioGroup value={autorizada} onValueChange={setAutorizada} className="mt-1 flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sim" id="a-sim" /> <Label htmlFor="a-sim">Sim</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao" id="a-nao" /> <Label htmlFor="a-nao">Não</Label>
                </div>
              </RadioGroup>
            </div>
            {autorizada === "sim" && (
              <div>
                <Label>Pode aparecer com o nome? *</Label>
                <RadioGroup value={comNome} onValueChange={setComNome} className="mt-1 flex gap-6">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sim" id="n-sim" /> <Label htmlFor="n-sim">Sim</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="nao" id="n-nao" /> <Label htmlFor="n-nao">Não</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            <div>
              <Label>Resposta da cliente (opcional)</Label>
              <Textarea rows={3} value={resposta} onChange={(e) => setResposta(e.target.value)} />
            </div>
            <div>
              <Label>Validade (opcional)</Label>
              <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondendo(null)}>Cancelar</Button>
            <Button onClick={confirmarResposta}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
