import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Bold, ChevronDown, ImageIcon, Italic, Loader2, Plus, Search, Send, Strikethrough, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/financeiroFormat";
import { uploadMidia } from "@/components/social-commerce/midiaUpload";
import {
  alertaBloqueante,
  normalizarAlertas,
  textoAlerta,
  vipEnviarTeste,
  vipEstoqueTamanho,
  vipGruposListar,
  vipMensagemAvulsa,
  vipMensagemSalvar,
  vipMensagemValidar,
  vipMensagensStatus,
  vipVarianteSalvar,
  vipProdutosBuscar,
  whatsappParaHtml,
  type VipAlerta,
  type VipEstoqueTamanho,
  type VipGrupo,
  type VipProduto,
  type VipVariante,
} from "@/lib/vip";
import { SeletorProva } from "./SeletorProva";
import { ClassificacaoBloco } from "./ClassificacaoBloco";

type Publico = "todos" | "listas" | "comunidade";

const CAMADAS = [
  { campo: "tema", label: "Tema" },
  { campo: "tipo", label: "Tipo" },
  { campo: "persona", label: "Persona" },
  { campo: "pilar", label: "Pilar" },
  { campo: "jornada", label: "Jornada" },
  { campo: "objetivo", label: "Objetivo" },
  { campo: "midia_sugerida", label: "Mídia sugerida" },
] as const;

function perfilDoGrupo(g: VipGrupo): Publico {
  return g.perfil === "comunidade" ? "comunidade" : "listas";
}

export function NovaMensagemTab() {
  const hoje = new Date().toISOString().slice(0, 10);

  const [grupos, setGrupos] = useState<VipGrupo[]>([]);
  const [publico, setPublico] = useState<Publico>("todos");
  const [gruposAlvo, setGruposAlvo] = useState<string[]>([]);

  const [quando, setQuando] = useState<"agora" | "agendar">("agora");
  const [dataEnvio, setDataEnvio] = useState(hoje);
  const [horario, setHorario] = useState("20:30");

  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<VipProduto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [produto, setProduto] = useState<VipProduto | null>(null);
  const [grade, setGrade] = useState<VipEstoqueTamanho[]>([]);

  const [headline, setHeadline] = useState("");
  const [corpo, setCorpo] = useState("");
  const [cta, setCta] = useState("");
  const corpoRef = useRef<HTMLTextAreaElement | null>(null);

  const [abaImagem, setAbaImagem] = useState("produto");
  const [midiaUrl, setMidiaUrl] = useState("");
  const [provaId, setProvaId] = useState<string | null>(null);
  const [provaAutorizada, setProvaAutorizada] = useState(true);
  const [subindo, setSubindo] = useState(false);

  const [enqueteAtiva, setEnqueteAtiva] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [opcoes, setOpcoes] = useState<string[]>(["", ""]);

  const [camadas, setCamadas] = useState<Record<string, string>>({});
  const [raciocinio, setRaciocinio] = useState("");

  const [linkDestino, setLinkDestino] = useState<string | null>(null);
  const [varianteComunidade, setVarianteComunidade] = useState<VipVariante | null>(null);
  const [abaTexto, setAbaTexto] = useState("listas");

  const [mensagemId, setMensagemId] = useState<string | null>(null);
  /** Snapshot do payload na última gravação — garante que o teste usa o id do texto atual. */
  const [snapshotSalvo, setSnapshotSalvo] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<VipAlerta[]>([]);
  const [validando, setValidando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(false);
  const [numeroTeste, setNumeroTeste] = useState("");
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  /** Confirmação do que saiu no último teste ("Enviado: <headline>"). */
  const [ultimoTeste, setUltimoTeste] = useState<string | null>(null);

  /* ---------------- grupos ---------------- */

  useEffect(() => {
    vipGruposListar()
      .then((g) => {
        const ativos = (g ?? []).filter((x) => x.ativo !== false);
        setGrupos(ativos);
        setGruposAlvo(ativos.map((x) => x.id));
      })
      .catch((e) => toast.error(e.message ?? "Falha ao listar grupos"));
  }, []);

  const gruposDoPublico = useMemo(
    () => grupos.filter((g) => publico === "todos" || perfilDoGrupo(g) === publico),
    [grupos, publico],
  );

  useEffect(() => {
    setGruposAlvo(gruposDoPublico.map((g) => g.id));
  }, [gruposDoPublico]);

  const pessoas = useMemo(
    () =>
      gruposDoPublico
        .filter((g) => gruposAlvo.includes(g.id))
        .reduce((s, g) => s + Number(g.membros ?? 0), 0),
    [gruposDoPublico, gruposAlvo],
  );

  /* ---------------- produto ---------------- */

  useEffect(() => {
    if (busca.trim().length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        setResultados(await vipProdutosBuscar(busca));
      } catch (e: any) {
        toast.error(e.message ?? "Falha ao buscar peças");
      } finally {
        setBuscando(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  const escolherProduto = async (p: VipProduto) => {
    setProduto(p);
    setResultados([]);
    setBusca(p.nome ?? "");
    setLinkDestino(p.link ?? null);
    if (p.imagem && !midiaUrl) {
      setMidiaUrl(p.imagem);
      setAbaImagem("produto");
    }
    try {
      setGrade(await vipEstoqueTamanho(p.produto_id));
    } catch {
      setGrade([]);
    }
  };

  const gradePorCor = useMemo(() => {
    const mapa = new Map<string, VipEstoqueTamanho[]>();
    grade.forEach((g) => {
      const cor = g.cor ?? "Única";
      mapa.set(cor, [...(mapa.get(cor) ?? []), g]);
    });
    return Array.from(mapa.entries());
  }, [grade]);

  /* ---------------- formatação ---------------- */

  const envolver = (marca: string) => {
    const el = corpoRef.current;
    if (!el) return;
    const ini = el.selectionStart ?? 0;
    const fim = el.selectionEnd ?? 0;
    const sel = corpo.slice(ini, fim) || "texto";
    const novo = `${corpo.slice(0, ini)}${marca}${sel}${marca}${corpo.slice(fim)}`;
    setCorpo(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + 1, ini + 1 + sel.length);
    });
  };

  /** Marcadores do WhatsApp que a enquete NÃO formata — sairiam crus para a cliente. */
  const TEM_MARCACAO = /[*_~]/;
  const limparMarcacao = (t: string) => t.replace(/[*_~]/g, "");

  const opcoesValidas = useMemo(() => opcoes.map((o) => o.trim()).filter(Boolean), [opcoes]);

  // O banco monta o campo `mensagem` a partir de headline/corpo/cta.
  // Nunca montar a string aqui nem enviar `mensagem` — foi isso que apagava o corpo.
  const payload = useMemo(
    () => ({
      headline,
      corpo,
      cta,
      produto_id: produto?.produto_id ?? null,
      publico,
      grupos_alvo: gruposAlvo,
      quando,
      data_envio: quando === "agora" ? hoje : dataEnvio,
      horario: quando === "agora" ? new Date().toTimeString().slice(0, 5) : horario,
      // Enquete é um balão separado: não carrega imagem nem link.
      midia_url: enqueteAtiva ? null : (midiaUrl || null),
      prova_id: enqueteAtiva ? null : provaId,
      link_destino: enqueteAtiva ? null : (linkDestino || produto?.link || null),
      tipo_envio: enqueteAtiva ? "enquete" : midiaUrl ? "imagem" : "texto",
      enquete_pergunta: enqueteAtiva ? pergunta : null,
      enquete_opcoes: enqueteAtiva ? opcoesValidas : null,
      variante_comunidade:
        varianteComunidade &&
        (varianteComunidade.headline || varianteComunidade.corpo || varianteComunidade.cta)
          ? {
              headline: varianteComunidade.headline ?? null,
              corpo: varianteComunidade.corpo ?? null,
              cta: varianteComunidade.cta ?? null,
            }
          : null,
      ...camadas,
    }),
    [headline, corpo, cta, produto, publico, gruposAlvo, quando, dataEnvio, horario, hoje, midiaUrl, provaId, linkDestino, enqueteAtiva, pergunta, opcoesValidas, camadas, varianteComunidade],
  );


  /** Formulário editado depois da última gravação — precisa salvar de novo antes de testar. */
  const editadoAposSalvar = mensagemId != null && snapshotSalvo !== JSON.stringify(payload);

  /* ---------------- validação (debounce 800ms) ---------------- */

  const validar = useCallback(async (id: string) => {
    setValidando(true);
    try {
      setAlertas(normalizarAlertas(await vipMensagemValidar(id)));
    } catch {
      /* validação é auxiliar — não bloqueia a escrita */
    } finally {
      setValidando(false);
    }
  }, []);

  useEffect(() => {
    if (!mensagemId) return;
    const t = setTimeout(() => validar(mensagemId), 800);
    return () => clearTimeout(t);
  }, [mensagemId, headline, corpo, cta, midiaUrl, provaId, gruposAlvo, enqueteAtiva, pergunta, opcoesValidas, validar]);

  // Qualquer edição invalida a confirmação do teste anterior
  useEffect(() => {
    setUltimoTeste(null);
  }, [payload]);

  /** Regras da enquete conferidas na hora — as mesmas de vip_mensagem_validar. */
  const alertasEnquete = useMemo<VipAlerta[]>(() => {
    if (!enqueteAtiva) return [];
    const l: VipAlerta[] = [];
    if (!pergunta.trim()) l.push({ bloqueia: true, texto: "Enquete sem pergunta." } as VipAlerta);
    if (!corpo.trim()) {
      l.push({ bloqueia: true, texto: "Enquete sem corpo — o balão de texto sairia só com a headline." } as VipAlerta);
    }
    if (opcoesValidas.length < 2) {
      l.push({ bloqueia: true, texto: "Enquete precisa de pelo menos 2 opções." } as VipAlerta);
    }
    opcoesValidas.forEach((o, i) => {
      if (TEM_MARCACAO.test(o)) {
        l.push({ bloqueia: true, texto: `Opção ${i + 1} tem * _ ou ~ — a enquete não formata e a cliente lê o símbolo.` } as VipAlerta);
      }
      if (o.length > 100) {
        l.push({ bloqueia: true, texto: `Opção ${i + 1} tem ${o.length} caracteres — o WhatsApp corta em 100.` } as VipAlerta);
      }
    });
    return l;
  }, [enqueteAtiva, pergunta, corpo, opcoesValidas]);

  const travas = [...alertas.filter(alertaBloqueante), ...alertasEnquete];
  const avisos = alertas.filter((a) => !alertaBloqueante(a));
  const provaSemAutorizacao = !enqueteAtiva && abaImagem === "prova" && !!provaId && !provaAutorizada;
  const travado = travas.length > 0 || provaSemAutorizacao;


  // Preview segue a aba de texto selecionada. O campo "corpo" já termina com o
  // CTA — nunca concatenar o campo cta separado (existe só para métrica/edição).
  const textoFinal =
    abaTexto === "comunidade"
      ? [varianteComunidade?.headline, varianteComunidade?.corpo].filter(Boolean).join("\n\n")
      : [headline, corpo].filter(Boolean).join("\n\n");

  /* ---------------- salvar ---------------- */

  const salvar = async (aprovar: boolean) => {
    if (!headline.trim() && !corpo.trim()) {
      toast.error("Escreva ao menos a headline e o corpo.");
      return null;
    }
    if (gruposAlvo.length === 0) {
      toast.error("Selecione ao menos um grupo.");
      return null;
    }
    setSalvando(true);
    try {
      let id = mensagemId;
      if (id) {
        // Já existe: ATUALIZA em vez de criar duplicado.
        await vipMensagemSalvar(id, payload as any, "painel");
        if (payload.variante_comunidade) {
          await vipVarianteSalvar(id, "comunidade", payload.variante_comunidade, "painel");
        }
      } else {
        const r: any = await vipMensagemAvulsa(payload as any, "painel");
        id = r?.id ?? r?.mensagem_id;
        if (!id) throw new Error("O backend não devolveu o id da mensagem.");
        setAlertas(normalizarAlertas(r?.alertas ?? []));
      }
      setMensagemId(id);
      setSnapshotSalvo(JSON.stringify(payload));
      if (aprovar) {
        await vipMensagensStatus([id], "aprovada");
        toast.success("Mensagem aprovada — entra na fila no horário marcado.");
      } else {
        toast.success("Rascunho salvo.");
      }
      return id as string;
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar a mensagem");
      return null;
    } finally {
      setSalvando(false);
    }
  };

  const confirmarAprovacao = async () => {
    if (avisos.length > 0) {
      const ok = confirm(
        `Você está ignorando ${avisos.length} alerta(s) da validação. Aprovar mesmo assim?`,
      );
      if (!ok) return;
    }
    const id = await salvar(true);
    if (id) setResumoAberto(false);
  };

  const enviarTeste = async () => {
    // Só testa o id devolvido pela ÚLTIMA gravação deste formulário —
    // nunca um id antigo nem o de outra mensagem do calendário.
    const id = mensagemId;
    if (!id) {
      toast.error("Salve o rascunho antes de testar.");
      return;
    }
    if (editadoAposSalvar) {
      toast.error("Você editou depois de salvar — salve de novo antes de testar.");
      return;
    }
    if (!numeroTeste.trim()) {
      toast.error("Informe o número ou o jid do grupo de teste.");
      return;
    }
    setEnviandoTeste(true);
    setUltimoTeste(null);
    try {
      const r: any = await vipEnviarTeste(id, numeroTeste.trim());
      if (r?.ok === false) {
        toast.error(r?.erro ?? "O backend recusou o teste.", { duration: 10000 });
      } else {
        const headlineEnviada = r?.enviei?.headline;
        setUltimoTeste(headlineEnviada ?? null);
        toast.success(
          headlineEnviada ? `Enviado: ${headlineEnviada}` : "Teste enviado.",
        );
      }
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar o teste");
    } finally {
      setEnviandoTeste(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {/* Para quem */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Para quem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {([
                ["todos", "Todos os grupos"],
                ["listas", "Só as listas (broadcast)"],
                ["comunidade", "Só a comunidade (Cria Comigo)"],
              ] as [Publico, string][]).map(([v, l]) => (
                <Button key={v} size="sm" variant={publico === v ? "default" : "outline"} onClick={() => setPublico(v)}>
                  {l}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {gruposDoPublico.map((g) => {
                const on = gruposAlvo.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setGruposAlvo(on ? gruposAlvo.filter((x) => x !== g.id) : [...gruposAlvo, g.id])
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
                    }`}
                  >
                    {g.nome ?? "Grupo"} · {Number(g.membros ?? 0).toLocaleString("pt-BR")}
                  </button>
                );
              })}
              {gruposDoPublico.length === 0 && (
                <span className="text-xs text-destructive">Nenhum grupo ativo compatível com essa seleção.</span>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium">
              <Users className="h-4 w-4 text-muted-foreground" />
              {pessoas.toLocaleString("pt-BR")} pessoas vão receber
            </div>
          </CardContent>
        </Card>

        {/* Quando */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Quando</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RadioGroup value={quando} onValueChange={(v) => setQuando(v as any)} className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agora" id="q-agora" />
                <Label htmlFor="q-agora">Enviar agora</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agendar" id="q-agendar" />
                <Label htmlFor="q-agendar">Agendar</Label>
              </div>
            </RadioGroup>
            {quando === "agora" ? (
              <p className="text-xs text-muted-foreground">Sai em até 1 minuto, um grupo a cada 5 segundos.</p>
            ) : (
              <div className="flex gap-3">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className="w-32" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Peça */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Peça (opcional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar peça pelo nome"
                className="pl-8"
              />
              {buscando && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
              {resultados.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover shadow">
                  {resultados.map((p) => (
                    <button
                      key={p.produto_id}
                      type="button"
                      onClick={() => escolherProduto(p)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {p.imagem && <img src={p.imagem} alt="" className="h-9 w-9 rounded object-cover" />}
                      <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                      <span className="text-xs text-muted-foreground">{brl(Number(p.preco_cheio ?? 0))}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {produto && (
              <div className="flex gap-3 rounded-lg border p-3">
                {produto.imagem && (
                  <img src={produto.imagem} alt={produto.nome ?? ""} className="h-28 w-24 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <div className="font-medium">{produto.nome}</div>
                  <div>
                    {brl(Number(produto.preco_cheio ?? 0))}
                    {produto.preco_promocional_vigente ? (
                      <span className="ml-2 text-emerald-600">
                        Sale {brl(Number(produto.preco_promocional_vigente))}
                        {produto.end_promotion ? ` até ${produto.end_promotion.split("-").reverse().join("/")}` : ""}
                      </span>
                    ) : null}
                  </div>
                  {produto.link && (
                    <a href={produto.link} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary underline">
                      {produto.link}
                    </a>
                  )}
                  <div className="space-y-1 pt-1">
                    {gradePorCor.map(([cor, itens]) => (
                      <div key={cor} className="text-xs">
                        <span className="text-muted-foreground">{cor}: </span>
                        {itens
                          .map((i) => `${i.tamanho ?? "—"} ${Number(i.estoque_tamanho ?? 0)}`)
                          .join(" · ")}
                      </div>
                    ))}
                    {grade.length === 0 && <div className="text-xs text-muted-foreground">Sem grade por tamanho.</div>}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-0 text-xs" onClick={() => { setProduto(null); setGrade([]); setBusca(""); setLinkDestino(null); setVarianteComunidade(null); }}>
                    Remover peça
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Texto */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Texto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={abaTexto} onValueChange={setAbaTexto}>
              <TabsList>
                <TabsTrigger value="listas">Listas VIP</TabsTrigger>
                <TabsTrigger value="comunidade">Cria Comigo</TabsTrigger>
              </TabsList>
              <TabsContent value="listas" className="space-y-3 pt-2">
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Headline</Label>
                    <span className="text-[11px] text-muted-foreground">{headline.length} caracteres</span>
                  </div>
                  <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    É o que aparece na notificação. Não comece com saudação.
                  </p>
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-1">
                    <Label className="flex-1">Corpo</Label>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => envolver("*")}>
                      <Bold className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => envolver("_")}>
                      <Italic className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => envolver("~")}>
                      <Strikethrough className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea ref={corpoRef} rows={7} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
                </div>
                <div>
                  <Label>CTA</Label>
                  <Input value={cta} onChange={(e) => setCta(e.target.value)} />
                </div>
              </TabsContent>
              <TabsContent value="comunidade" className="space-y-3 pt-2">
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Headline (comunidade)</Label>
                    <span className="text-[11px] text-muted-foreground">{(varianteComunidade?.headline ?? "").length} caracteres</span>
                  </div>
                  <Input value={varianteComunidade?.headline ?? ""} onChange={(e) => setVarianteComunidade((v) => ({ ...(v ?? {}), headline: e.target.value }))} />
                </div>
                <div>
                  <Label>Corpo (comunidade)</Label>
                  <Textarea rows={5} value={varianteComunidade?.corpo ?? ""} onChange={(e) => setVarianteComunidade((v) => ({ ...(v ?? {}), corpo: e.target.value }))} />
                </div>
                <div>
                  <Label>CTA (comunidade)</Label>
                  <Input value={varianteComunidade?.cta ?? ""} onChange={(e) => setVarianteComunidade((v) => ({ ...(v ?? {}), cta: e.target.value }))} />
                </div>
                <div>
                  <Label>Link de destino</Label>
                  <Input value={linkDestino ?? ""} onChange={(e) => setLinkDestino(e.target.value || null)} placeholder={produto?.link ?? "https://..."} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Imagem — enquete não carrega imagem, então o bloco some */}
        {!enqueteAtiva && (
        <Card>

          <CardHeader className="py-3">
            <CardTitle className="text-sm">Imagem</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={abaImagem} onValueChange={setAbaImagem}>
              <TabsList>
                <TabsTrigger value="produto">Foto do produto</TabsTrigger>
                <TabsTrigger value="arquivo">Enviar arquivo</TabsTrigger>
                <TabsTrigger value="prova">Prova social de cliente</TabsTrigger>
              </TabsList>
              <TabsContent value="produto" className="pt-3">
                {produto?.imagem ? (
                  <div className="flex items-center gap-3">
                    <img src={produto.imagem} alt="" className="h-24 w-20 rounded object-cover" />
                    <Button
                      size="sm"
                      variant={midiaUrl === produto.imagem ? "default" : "outline"}
                      onClick={() => { setMidiaUrl(produto.imagem!); setProvaId(null); }}
                    >
                      Usar foto oficial
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Escolha uma peça para usar a foto oficial.</p>
                )}
              </TabsContent>
              <TabsContent value="arquivo" className="space-y-2 pt-3">
                <Input
                  type="file"
                  accept="image/*"
                  disabled={subindo}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setSubindo(true);
                    try {
                      const url = await uploadMidia(f, "vip-avulsa");
                      setMidiaUrl(url);
                      setProvaId(null);
                      toast.success("Imagem enviada.");
                    } catch (err: any) {
                      toast.error(err.message ?? "Falha no upload");
                    } finally {
                      setSubindo(false);
                    }
                  }}
                />
                {subindo && <p className="text-xs text-muted-foreground">Enviando…</p>}
              </TabsContent>
              <TabsContent value="prova" className="pt-3">
                <SeletorProva
                  provaId={provaId}
                  onEscolher={(p, url, autorizada) => {
                    setProvaId(p);
                    setMidiaUrl(url ?? "");
                    setProvaAutorizada(autorizada);
                  }}
                />
              </TabsContent>
            </Tabs>
            {midiaUrl && (
              <p className="mt-3 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <ImageIcon className="h-3 w-3" /> {midiaUrl}
              </p>
            )}
          </CardContent>
        </Card>
        )}


        {/* Enquete */}
        <Collapsible>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="flex-row cursor-pointer items-center justify-between py-3">
                <CardTitle className="text-sm">Enquete (opcional)</CardTitle>
                <ChevronDown className="h-4 w-4" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch checked={enqueteAtiva} onCheckedChange={setEnqueteAtiva} id="enq" />
                  <Label htmlFor="enq">Enviar como enquete</Label>
                </div>
                {enqueteAtiva && (
                  <>
                    <p className="text-[11px] text-muted-foreground">Enquete não carrega link de destino.</p>
                    <div>
                      <Label>Pergunta</Label>
                      <Input value={pergunta} onChange={(e) => setPergunta(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      {opcoes.map((o, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={o}
                            placeholder={`Opção ${i + 1}`}
                            onChange={(e) => setOpcoes(opcoes.map((x, j) => (j === i ? e.target.value : x)))}
                          />
                          {opcoes.length > 2 && (
                            <Button variant="ghost" size="icon" onClick={() => setOpcoes(opcoes.filter((_, j) => j !== i))}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {opcoes.length < 12 && (
                        <Button variant="outline" size="sm" onClick={() => setOpcoes([...opcoes, ""])}>
                          <Plus className="mr-1 h-3.5 w-3.5" /> Opção
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Classificação */}
        <ClassificacaoBloco
          camadas={camadas}
          setCamadas={setCamadas}
          produtoId={produto?.produto_id ?? null}
          publico={publico}
          onGerado={(r) => {
            if (r.headline) setHeadline(r.headline);
            if (r.corpo) setCorpo(r.corpo);
            if (r.cta) setCta(r.cta);
            if (r.midia_sugerida) setCamadas({ ...camadas, midia_sugerida: r.midia_sugerida });
            if (r.midia_url) {
              setMidiaUrl(r.midia_url);
              setAbaImagem("produto");
            }
            if (r.link_destino) setLinkDestino(r.link_destino);
            if (r.variante_comunidade) {
              setVarianteComunidade(r.variante_comunidade);
              setAbaTexto("comunidade");
            }
            if (r.raciocinio) setRaciocinio(r.raciocinio);
          }}
        />
        {raciocinio && (
          <p className="text-xs text-muted-foreground">
            <b>Raciocínio da IA:</b> {raciocinio}
          </p>
        )}

      </div>

      {/* Coluna direita: preview + validação */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Preview do WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Visualizando: {abaTexto === "comunidade" ? "Cria Comigo (comunidade)" : "Listas VIP"}
            </p>
            <div className="rounded-xl bg-[#0b141a] p-3">
              <div className="max-w-[300px] rounded-lg rounded-tl-none bg-[#005c4b] p-2 text-sm text-white">
                {midiaUrl && (
                  <img src={midiaUrl} alt="" className="mb-2 max-h-56 w-full rounded object-cover" />
                )}
                <div dangerouslySetInnerHTML={{ __html: whatsappParaHtml(textoFinal) || "<em>Sem texto</em>" }} />
                {enqueteAtiva && (
                  <div className="mt-2 rounded bg-black/20 p-2 text-xs">
                    <div className="font-medium">{pergunta || "Pergunta da enquete"}</div>
                    {opcoes.filter(Boolean).map((o, i) => (
                      <div key={i}>• {o}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              Validação {validando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!mensagemId && (
              <p className="text-xs text-muted-foreground">
                Salve o rascunho para o sistema validar o texto contra as regras da marca e o estoque real.
              </p>
            )}
            {mensagemId && alertas.length === 0 && !validando && (
              <p className="text-xs text-emerald-600">Nenhum alerta.</p>
            )}
            {provaSemAutorizacao && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Trava</AlertTitle>
                <AlertDescription>Imagem de cliente sem autorização registrada.</AlertDescription>
              </Alert>
            )}
            {travas.map((a, i) => (
              <Alert key={`t${i}`} variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{textoAlerta(a)}</AlertDescription>
              </Alert>
            ))}
            {avisos.map((a, i) => (
              <Alert key={`a${i}`} className="border-amber-500/40 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{textoAlerta(a)}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 py-4">
            <Button className="w-full" variant="outline" disabled={salvando} onClick={() => salvar(false)}>
              Salvar rascunho
            </Button>
            <Button
              className={`w-full ${avisos.length > 0 && !travado ? "bg-amber-500 text-white hover:bg-amber-600" : ""}`}
              disabled={salvando || travado || gruposAlvo.length === 0}
              onClick={() => setResumoAberto(true)}
            >
              <Send className="mr-1 h-4 w-4" /> Aprovar para envio
            </Button>
            {travado && (
              <p className="text-[11px] text-destructive">
                {provaSemAutorizacao
                  ? "Imagem de cliente sem autorização registrada — resolva na aba Prova social."
                  : travas.map(textoAlerta).join(" · ")}
              </p>
            )}
            <Separator className="my-2" />
            <Label className="text-xs">Enviar teste</Label>
            <div className="flex gap-2">
              <Input
                value={numeroTeste}
                onChange={(e) => setNumeroTeste(e.target.value)}
                placeholder="11951552693 ou jid do grupo"
              />
              <Button
                variant="outline"
                disabled={enviandoTeste || !mensagemId || editadoAposSalvar}
                onClick={enviarTeste}
              >
                {enviandoTeste ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar"}
              </Button>
            </div>
            {!mensagemId && (
              <p className="text-[11px] text-muted-foreground">Salve o rascunho antes de testar.</p>
            )}
            {mensagemId && editadoAposSalvar && (
              <p className="text-[11px] text-amber-600">
                Você editou depois de salvar — salve de novo antes de testar.
              </p>
            )}
            {ultimoTeste && (
              <p className="text-[11px] text-emerald-700">
                Enviado: {ultimoTeste}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={resumoAberto} onOpenChange={setResumoAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Conferir antes de aprovar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Grupos: </span>
              {gruposDoPublico.filter((g) => gruposAlvo.includes(g.id)).map((g) => g.nome).join(" · ") || "—"}
            </div>
            <div className="font-medium">{pessoas.toLocaleString("pt-BR")} pessoas vão receber</div>
            <div>
              <span className="text-muted-foreground">Quando: </span>
              {quando === "agora"
                ? "Agora (em até 1 minuto)"
                : `${dataEnvio.split("-").reverse().join("/")} às ${horario}`}
            </div>
            {avisos.length > 0 && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                {avisos.length} alerta(s) serão ignorados
              </Badge>
            )}
            <div className="rounded-xl bg-[#0b141a] p-3">
              <div className="rounded-lg bg-[#005c4b] p-2 text-sm text-white">
                {midiaUrl && <img src={midiaUrl} alt="" className="mb-2 max-h-48 w-full rounded object-cover" />}
                <div dangerouslySetInnerHTML={{ __html: whatsappParaHtml(textoFinal) }} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResumoAberto(false)}>Voltar</Button>
            <Button disabled={salvando} onClick={confirmarAprovacao}>Aprovar para envio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
