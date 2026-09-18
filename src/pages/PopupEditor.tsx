import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowUp, ArrowDown, Copy, Trash2, History, Undo2, Redo2,
  ExternalLink, Save, Play, Pause, Plus, AlertTriangle, Monitor, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  popupsApi, desdeAgora, ehConflito, novoId, dataHoraBR,
  type Diagnostico, type ElementoPopup, type EtapaPopup, type Popup, type Validacao,
} from "@/lib/popups";
import { PreviaIframe } from "@/components/popups/PreviaIframe";
import { NotaCirculo } from "@/components/popups/NotaCirculo";
import { BoasPraticas } from "@/components/popups/BoasPraticas";
import { ConfigPopup, PropsElemento } from "@/components/popups/PainelPropriedades";
import { AbaRegras } from "@/components/popups/AbaRegras";
import { SeletorFigurinha } from "@/components/popups/SeletorFigurinha";
import { AbaResultados } from "@/components/popups/AbaResultados";

const PALETA: { grupo: string; itens: { tipo: string; nome: string; base?: any }[] }[] = [
  {
    grupo: "Conteúdo",
    itens: [
      { tipo: "titulo", nome: "Título", base: { texto: "Título", tamanho: 28, peso: 700, alinhar: "center" } },
      { tipo: "texto", nome: "Texto", base: { texto: "Escreva aqui", tamanho: 15, alinhar: "center" } },
      { tipo: "badge", nome: "Badge", base: { texto: "Oferta" } },
      { tipo: "imagem", nome: "Imagem", base: { src: "", largura: "100%" } },
      { tipo: "botao", nome: "Botão", base: { texto: "Quero meu cupom", acao: "enviar", largura: "total" } },
      { tipo: "link_fechar", nome: "Link de fechar", base: { texto: "Agora não" } },
      { tipo: "espaco", nome: "Espaço", base: { altura: 16 } },
      { tipo: "divisor", nome: "Divisor" },
      { tipo: "timer", nome: "Timer", base: { modo: "fim_campanha", rotulo: "Termina em" } },
      { tipo: "assinatura", nome: "Assinatura", base: { texto: "Com carinho, Mari 💛", tamanho: 21, alinhar: "center" } },
      { tipo: "nota", nome: "Nota", base: { texto: "Presente válido na primeira compra, uma vez por cliente.", alinhar: "center" } },
    ],
  },

  {
    grupo: "Campos",
    itens: [
      { tipo: "campo", nome: "Nome", base: { campo: "nome", rotulo: "Nome", placeholder: "Seu nome" } },
      { tipo: "campo", nome: "E-mail", base: { campo: "email", rotulo: "E-mail", placeholder: "seu@email.com", obrigatorio: true } },
      { tipo: "campo", nome: "WhatsApp", base: { campo: "telefone", rotulo: "WhatsApp", placeholder: "(11) 90000-0000" } },
      { tipo: "campo", nome: "Aniversário", base: { campo: "aniversario", rotulo: "Aniversário" } },
      { tipo: "consentimento", nome: "Consentimento", base: { texto: "Quero receber novidades e ofertas.", obrigatorio: true, link_privacidade: "/privacidade", texto_privacidade: "Política de privacidade" } },
    ],
  },
  {
    grupo: "Resultado",
    itens: [
      { tipo: "cupom", nome: "Cupom", base: { rotulo: "Seu cupom", texto_botao: "Copiar cupom" } },
      { tipo: "aviso", nome: "Aviso de erro" },
    ],
  },
];

function resumoElemento(e: ElementoPopup) {
  if (e.tipo === "campo") return `Campo: ${e.rotulo ?? e.campo}`;
  if (e.tipo === "espaco") return `Espaço de ${e.altura ?? 0}px`;
  if (e.tipo === "divisor") return "Divisor";
  if (e.tipo === "aviso") return "Aviso de erro";
  if (e.tipo === "cupom") return "Cupom";
  if (e.tipo === "timer") return "Timer";
  if (e.tipo === "imagem") return "Imagem";
  return String(e.texto ?? e.tipo).slice(0, 40) || e.tipo;
}

export default function PopupEditor() {
  const { id } = useParams();
  const popupId = Number(id);
  const navegar = useNavigate();
  const qc = useQueryClient();

  const [popup, setPopup] = useState<Popup | null>(null);
  const [validacao, setValidacao] = useState<Validacao | null>(null);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [etapaSel, setEtapaSel] = useState(0);
  const [elementoSel, setElementoSel] = useState<string | null>(null);
  const [dispositivo, setDispositivo] = useState<"desktop" | "mobile">("desktop");
  const [simularCupom, setSimularCupom] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [conflito, setConflito] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [praticasAberto, setPraticasAberto] = useState(false);
  const [confirmarAtivar, setConfirmarAtivar] = useState(false);
  const [arrastando, setArrastando] = useState<number | null>(null);

  const pilha = useRef<Popup[]>([]);
  const futuro = useRef<Popup[]>([]);
  const primeiraCarga = useRef(true);
  const alterouRef = useRef(false);

  const { data: original, isLoading, refetch } = useQuery({
    queryKey: ["popup", popupId],
    queryFn: () => popupsApi.obter(popupId),
    enabled: Number.isFinite(popupId),
  });

  useEffect(() => {
    if (!original) return;
    setPopup(original);
    setValidacao(original.validacao ?? null);
    setDiagnostico(original.diagnostico ?? null);
    setSalvoEm(original.atualizado_em ?? null);
    primeiraCarga.current = true;
    alterouRef.current = false;
    pilha.current = [];
    futuro.current = [];
  }, [original]);

  const mudar = useCallback((patch: Partial<Popup>) => {
    setPopup((atual) => {
      if (!atual) return atual;
      pilha.current = [...pilha.current.slice(-49), atual];
      futuro.current = [];
      alterouRef.current = true;
      return { ...atual, ...patch };
    });
  }, []);

  /* ---------- autosave ---------- */
  useEffect(() => {
    if (!popup || conflito) return;
    if (primeiraCarga.current) { primeiraCarga.current = false; return; }
    if (!alterouRef.current) return;
    const t = window.setTimeout(async () => {
      setSalvando(true);
      try {
        const salvo = await popupsApi.salvar(popup);
        alterouRef.current = false;
        setPopup((a) => (a ? { ...a, versao: salvo.versao, id: salvo.id } : a));
        setValidacao(salvo.validacao ?? null);
        setSalvoEm(salvo.atualizado_em ?? new Date().toISOString());
        qc.invalidateQueries({ queryKey: ["popups-listar"] });
      } catch (e: any) {
        if (ehConflito(e.message)) setConflito(true);
        else toast.error(e.message);
      } finally {
        setSalvando(false);
      }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [popup, conflito, qc]);

  /* ---------- diagnóstico ao vivo ---------- */
  useEffect(() => {
    if (!popup) return;
    const t = window.setTimeout(async () => {
      try {
        const r = await popupsApi.diagnostico(popup);
        setDiagnostico(r.diagnostico ?? null);
        setValidacao(r.validacao ?? null);
      } catch {
        /* diagnóstico é orientação, falha silenciosa */
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [popup]);

  const etapas: EtapaPopup[] = useMemo(() => popup?.design?.etapas ?? [], [popup]);
  const etapa = etapas[Math.min(etapaSel, Math.max(0, etapas.length - 1))];
  const elemento = etapa?.elementos?.find((e) => e.id === elementoSel) ?? null;

  function setEtapas(novas: EtapaPopup[]) {
    mudar({ design: { ...(popup?.design ?? {}), etapas: novas } });
  }

  function setElementos(novos: ElementoPopup[]) {
    const copia = etapas.map((e, i) => (i === etapaSel ? { ...e, elementos: novos } : e));
    setEtapas(copia);
  }

  function adicionar(tipo: string, base: any) {
    const novo: ElementoPopup = { id: novoId("el"), tipo: tipo as any, margem: 12, visivel: "todos", ...(base ?? {}) };
    setElementos([...(etapa?.elementos ?? []), novo]);
    setElementoSel(novo.id);
  }

  function desfazer() {
    const anterior = pilha.current.pop();
    if (!anterior || !popup) return;
    futuro.current.push(popup);
    alterouRef.current = true;
    setPopup(anterior);
  }

  function refazer() {
    const prox = futuro.current.pop();
    if (!prox || !popup) return;
    pilha.current.push(popup);
    alterouRef.current = true;
    setPopup(prox);
  }

  async function salvarAgora() {
    if (!popup) return;
    setSalvando(true);
    try {
      const salvo = await popupsApi.salvar(popup);
      alterouRef.current = false;
      setPopup((a) => (a ? { ...a, versao: salvo.versao } : a));
      setValidacao(salvo.validacao ?? null);
      setSalvoEm(salvo.atualizado_em ?? new Date().toISOString());
      toast.success("Salvo.");
    } catch (e: any) {
      if (ehConflito(e.message)) setConflito(true);
      else toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function mudarStatus(status: "ativo" | "pausado") {
    try {
      const r = await popupsApi.alterarStatus(popupId, status);
      if (!r.ok) {
        toast.error((r.validacao?.erros ?? ["Não foi possível ativar."])[0]);
        setValidacao(r.validacao ?? null);
        return;
      }
      setPopup((a) => (a ? { ...a, status } : a));
      qc.invalidateQueries({ queryKey: ["popups-listar"] });
      toast.success(
        status === "ativo"
          ? "Popup ativado. Ele aparece no site em até 5 minutos."
          : "Popup pausado. O site pode levar até 5 minutos para parar de mostrar."
      );
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function abrirPrevia() {
    try {
      const r = await popupsApi.linkPrevia(popupId);
      window.open(r.url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function criarVariacao() {
    if (!popup) return;
    try {
      const grupo = popup.teste_ab_grupo || popup.nome;
      await popupsApi.salvar({ ...popup, teste_ab_grupo: grupo, peso: 50 });
      const copia = await popupsApi.duplicar(popupId);
      await popupsApi.salvar({ ...copia, teste_ab_grupo: grupo, peso: 50 });
      toast.success("Variação criada.");
      navegar(`/popups/${copia.id}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading || !popup) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  const erros = validacao?.erros ?? [];
  const avisos = validacao?.avisos ?? [];
  const podeAtivar = erros.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Barra superior */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2">
        <Button variant="ghost" size="icon" onClick={() => navegar("/popups")}><ArrowLeft className="h-4 w-4" /></Button>
        <Input
          value={popup.nome}
          onChange={(e) => mudar({ nome: e.target.value })}
          className="h-9 w-64 border-transparent bg-transparent text-base font-semibold focus-visible:border-input"
        />
        <NotaCirculo nota={diagnostico?.nota} tamanho="sm" onClick={() => setPraticasAberto(true)} titulo="Ver boas práticas" />
        <Badge variant="outline" className="capitalize">{popup.status ?? "rascunho"}</Badge>
        <span className="text-xs text-muted-foreground">
          {salvando ? "Salvando..." : `Salvo ${desdeAgora(salvoEm)}`}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="icon" title="Desfazer" onClick={desfazer}><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" title="Refazer" onClick={refazer}><Redo2 className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setHistoricoAberto(true)}>
            <History className="mr-2 h-4 w-4" />Histórico
          </Button>
          <Button variant="outline" size="sm" onClick={abrirPrevia}>
            <ExternalLink className="mr-2 h-4 w-4" />Prévia no site
          </Button>
          <Button variant="outline" size="sm" onClick={salvarAgora} disabled={salvando}>
            <Save className="mr-2 h-4 w-4" />Salvar
          </Button>
          {popup.status === "ativo" ? (
            <Button size="sm" variant="secondary" onClick={() => mudarStatus("pausado")}>
              <Pause className="mr-2 h-4 w-4" />Pausar
            </Button>
          ) : podeAtivar ? (
            <Button size="sm" onClick={() => setConfirmarAtivar(true)}>
              <Play className="mr-2 h-4 w-4" />Ativar
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" disabled><Play className="mr-2 h-4 w-4" />Ativar</Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Corrija os erros abaixo para ativar.</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {conflito && (
        <div className="flex items-center gap-2 border-b border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          <AlertTriangle className="h-4 w-4" />
          Este popup foi alterado por outra pessoa. Recarregue antes de salvar.
          <Button size="sm" variant="outline" className="ml-2" onClick={() => { setConflito(false); refetch(); }}>
            Recarregar
          </Button>
        </div>
      )}

      {(erros.length > 0 || avisos.length > 0) && (
        <div className="space-y-1 border-b border-border bg-muted/40 px-4 py-2 text-xs">
          {erros.map((e, i) => <p key={`e${i}`} className="text-danger">{e}</p>)}
          {avisos.map((a, i) => <p key={`a${i}`} className="text-warning">{a}</p>)}
        </div>
      )}

      <Tabs defaultValue="design" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-2 w-fit">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
          <TabsTrigger value="resultados">Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0">
            {/* Esquerda */}
            <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Etapas</p>
              <div className="space-y-1">
                {etapas.map((et, i) => (
                  <div
                    key={et.id}
                    className={cn(
                      "flex items-center gap-1 rounded-md border p-1.5",
                      i === etapaSel ? "border-primary bg-primary/5" : "border-border"
                    )}
                    onClick={() => { setEtapaSel(i); setElementoSel(null); }}
                  >
                    <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                    <Input
                      value={et.nome}
                      onChange={(e) => setEtapas(etapas.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                      className="h-7 flex-1 border-transparent bg-transparent px-1 text-xs focus-visible:border-input"
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Duplicar"
                      onClick={(ev) => { ev.stopPropagation(); const c = { ...et, id: novoId("et"), nome: `${et.nome} (cópia)` }; setEtapas([...etapas.slice(0, i + 1), c, ...etapas.slice(i + 1)]); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Subir" disabled={i === 0}
                      onClick={(ev) => { ev.stopPropagation(); const n = [...etapas]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setEtapas(n); setEtapaSel(i - 1); }}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Descer" disabled={i === etapas.length - 1}
                      onClick={(ev) => { ev.stopPropagation(); const n = [...etapas]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setEtapas(n); setEtapaSel(i + 1); }}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Excluir" disabled={etapas.length <= 1}
                      onClick={(ev) => { ev.stopPropagation(); setEtapas(etapas.filter((_, j) => j !== i)); setEtapaSel(0); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline" size="sm" className="mt-2 w-full"
                onClick={() => setEtapas([...etapas, { id: novoId("et"), nome: `Etapa ${etapas.length + 1}`, elementos: [] }])}
              >
                <Plus className="mr-2 h-4 w-4" />Etapa
              </Button>

              <div className="mt-4 space-y-2 rounded-md border border-border p-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Figurinha da Mari</p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Sai pelo topo do cartão na etapa {etapaSel + 1}.
                </p>
                <SeletorFigurinha
                  rotulo="Figurinha"
                  valor={etapa?.figura?.src ?? ""}
                  popupId={popup.id ?? "novo"}
                  aoMudar={(url) =>
                    setEtapas(
                      etapas.map((x, j) =>
                        j === etapaSel
                          ? { ...x, figura: url ? { ...(x.figura ?? {}), src: url } : undefined }
                          : x
                      )
                    )
                  }
                />
                {etapa?.figura?.src && (
                  <div className="space-y-2">
                    <Label className="text-[11px]">Largura no computador</Label>
                    <Input
                      type="number" min={60} max={260}
                      value={etapa.figura.largura ?? 140}
                      onChange={(e) =>
                        setEtapas(etapas.map((x, j) => j === etapaSel
                          ? { ...x, figura: { ...(x.figura ?? { src: "" }), largura: Math.min(260, Math.max(60, Number(e.target.value) || 0)) } }
                          : x))
                      }
                      className="h-8"
                    />
                    <Label className="text-[11px]">Largura no celular</Label>
                    <Input
                      type="number" min={50} max={200}
                      value={etapa.figura.largura_mobile ?? 110}
                      onChange={(e) =>
                        setEtapas(etapas.map((x, j) => j === etapaSel
                          ? { ...x, figura: { ...(x.figura ?? { src: "" }), largura_mobile: Math.min(200, Math.max(50, Number(e.target.value) || 0)) } }
                          : x))
                      }
                      className="h-8"
                    />
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2 rounded-md border border-border p-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fluxo depois de enviar</p>
                <div className="space-y-1">
                  <Label className="text-[11px]">Quando der certo, ir para</Label>
                  <Select
                    value={popup.design?.fluxo?.sucesso ?? ""}
                    onValueChange={(v) => mudar({ design: { ...popup.design, fluxo: { ...(popup.design?.fluxo ?? {}), sucesso: v } } })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolher etapa" /></SelectTrigger>
                    <SelectContent>{etapas.map((e, i) => <SelectItem key={e.id} value={e.id}>{i + 1}. {e.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Quando já for cliente, ir para</Label>
                  <Select
                    value={popup.design?.fluxo?.ja_cliente ?? "mesma"}
                    onValueChange={(v) => mudar({ design: { ...popup.design, fluxo: { ...(popup.design?.fluxo ?? {}), ja_cliente: v === "mesma" ? null : v } } })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mesma">Mesma de sucesso</SelectItem>
                      {etapas.map((e, i) => <SelectItem key={e.id} value={e.id}>{i + 1}. {e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Elementos</p>
              <div className="space-y-1">
                {(etapa?.elementos ?? []).map((el, i) => (
                  <div
                    key={el.id}
                    draggable
                    onDragStart={() => setArrastando(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (arrastando === null || arrastando === i) return;
                      const n = [...(etapa?.elementos ?? [])];
                      const [mov] = n.splice(arrastando, 1);
                      n.splice(i, 0, mov);
                      setElementos(n);
                      setArrastando(null);
                    }}
                    onClick={() => setElementoSel(el.id)}
                    className={cn(
                      "flex cursor-grab items-center gap-1 rounded-md border p-1.5 text-xs",
                      elementoSel === el.id ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <span className="flex-1 truncate">{resumoElemento(el)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6"
                      onClick={(ev) => { ev.stopPropagation(); const n = [...(etapa?.elementos ?? [])]; n.splice(i + 1, 0, { ...el, id: novoId("el") }); setElementos(n); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6"
                      onClick={(ev) => { ev.stopPropagation(); setElementos((etapa?.elementos ?? []).filter((_, j) => j !== i)); setElementoSel(null); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {!(etapa?.elementos ?? []).length && (
                  <p className="text-xs text-muted-foreground">Etapa vazia. Adicione um título e um campo de e-mail.</p>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {PALETA.map((g) => (
                  <div key={g.grupo}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.grupo}</p>
                    <div className="flex flex-wrap gap-1">
                      {g.itens.map((it) => (
                        <Button key={it.nome} variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => adicionar(it.tipo, it.base)}>
                          {it.nome}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            {/* Centro */}
            <div className="min-w-0 flex-1 overflow-y-auto bg-muted/30 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex rounded-md border border-border">
                  <Button variant={dispositivo === "desktop" ? "secondary" : "ghost"} size="sm" onClick={() => setDispositivo("desktop")}>
                    <Monitor className="mr-2 h-4 w-4" />Desktop
                  </Button>
                  <Button variant={dispositivo === "mobile" ? "secondary" : "ghost"} size="sm" onClick={() => setDispositivo("mobile")}>
                    <Smartphone className="mr-2 h-4 w-4" />Celular
                  </Button>
                </div>
                <Select value={String(etapaSel)} onValueChange={(v) => setEtapaSel(Number(v))}>
                  <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>{etapas.map((e, i) => <SelectItem key={e.id} value={String(i)}>{i + 1}. {e.nome}</SelectItem>)}</SelectContent>
                </Select>
                <div className="ml-auto flex items-center gap-2">
                  <Label className="text-xs">Simular cupom gerado</Label>
                  <Switch checked={simularCupom} onCheckedChange={setSimularCupom} />
                </div>
              </div>

              <div className={cn("mx-auto", dispositivo === "mobile" ? "w-[390px] rounded-[2rem] border-8 border-foreground/80 p-1" : "w-full")}>
                <PreviaIframe
                  popup={popup}
                  etapa={etapaSel}
                  dispositivo={dispositivo}
                  convertido={simularCupom}
                  onEtapa={(idx) => setEtapaSel(idx)}
                />
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                A prévia não gera cupom, não conta impressão e não grava lead.
              </p>
            </div>

            {/* Direita */}
            <aside className="w-[340px] shrink-0 overflow-y-auto border-l border-border p-3">
              {elemento ? (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{elemento.tipo}</p>
                    <Button variant="ghost" size="sm" onClick={() => setElementoSel(null)}>Fechar</Button>
                  </div>
                  <PropsElemento
                    elemento={elemento}
                    etapas={etapas}
                    popupId={popup.id ?? "novo"}
                    mudar={(patch) =>
                      setElementos((etapa?.elementos ?? []).map((e) => (e.id === elemento.id ? { ...e, ...patch } : e)))
                    }
                  />
                </>
              ) : (
                <ConfigPopup popup={popup} mudar={mudar} />
              )}
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="regras" className="min-h-0 flex-1 overflow-y-auto">
          <AbaRegras popup={popup} mudar={mudar} />
        </TabsContent>

        <TabsContent value="resultados" className="min-h-0 flex-1 overflow-y-auto">
          <AbaResultados popupId={popupId} diagnostico={diagnostico} />
        </TabsContent>
      </Tabs>

      <BoasPraticas
        aberto={praticasAberto}
        aoFechar={() => setPraticasAberto(false)}
        diagnostico={diagnostico}
        aoCriarVariacao={criarVariacao}
      />

      <HistoricoDrawer
        aberto={historicoAberto}
        aoFechar={() => setHistoricoAberto(false)}
        popupId={popupId}
        aoRestaurar={async (versao) => {
          try {
            const p = await popupsApi.restaurar(popupId, versao);
            setPopup(p);
            setSalvoEm(p.atualizado_em ?? null);
            alterouRef.current = false;
            primeiraCarga.current = true;
            setHistoricoAberto(false);
            toast.success(`Versão ${versao} restaurada.`);
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />

      <AlertDialog open={confirmarAtivar} onOpenChange={setConfirmarAtivar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar este popup?</AlertDialogTitle>
            <AlertDialogDescription>
              Este popup vai aparecer para as clientes no site em até 5 minutos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { mudarStatus("ativo"); setConfirmarAtivar(false); }}>Ativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HistoricoDrawer({
  aberto, aoFechar, popupId, aoRestaurar,
}: {
  aberto: boolean; aoFechar: () => void; popupId: number; aoRestaurar: (versao: number) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["popups-historico", popupId],
    queryFn: () => popupsApi.historico(popupId),
    enabled: aberto,
  });

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-[380px] overflow-y-auto sm:max-w-[380px]">
        <SheetHeader><SheetTitle>Histórico</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-2 pb-8">
          {isLoading && <Skeleton className="h-40 w-full" />}
          {(data ?? []).map((v) => (
            <div key={v.versao} className="flex items-center justify-between rounded-md border border-border p-2">
              <div>
                <p className="text-sm font-medium">Versão {v.versao}</p>
                <p className="text-xs text-muted-foreground">{v.nome} · {dataHoraBR(v.salvo_em)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => aoRestaurar(v.versao)}>Restaurar</Button>
            </div>
          ))}
          {!isLoading && !(data ?? []).length && (
            <p className="text-sm text-muted-foreground">Ainda não há versões salvas.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
