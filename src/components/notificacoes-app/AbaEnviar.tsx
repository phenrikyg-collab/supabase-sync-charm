import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Bell, Loader2, Search, Send, Users } from "lucide-react";
import {
  pushApi, semTravessao, ROTULO_SITUACAO, ROTULO_PLATAFORMA, nBR,
  type Plataforma, type PublicoPush, type SituacaoRastreio, type TipoPublico,
} from "./api";

const SITUACOES: SituacaoRastreio[] = [
  "em_transito",
  "saiu_para_entrega",
  "entregue",
  "aguardando_retirada",
  "tentativa_falhou",
];

const PLATAFORMAS: Plataforma[] = ["android", "ios", "outro"];

function PreviaNotificacao({
  titulo, corpo, imagem, aparelho,
}: { titulo: string; corpo: string; imagem: string; aparelho: "android" | "ios" }) {
  const t = titulo.trim() || "Título do aviso";
  const c = (corpo.trim() || "A mensagem aparece aqui.").replace(/\{primeiro_nome\}/g, "Ana");
  return (
    <div className="rounded-2xl bg-muted/60 p-4">
      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-xs font-medium text-muted-foreground">Minha MC</p>
              <span className="shrink-0 text-[10px] text-muted-foreground">agora</span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-card-foreground">{t}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">{c}</p>
          </div>
        </div>
        {aparelho === "android" && imagem.trim() && (
          <img
            src={imagem}
            alt="Imagem do aviso"
            loading="lazy"
            decoding="async"
            className="mt-3 max-h-40 w-full rounded-lg object-cover"
          />
        )}
      </div>
      {aparelho === "ios" && imagem.trim() && (
        <p className="mt-2 text-xs text-muted-foreground">No iPhone a imagem não aparece.</p>
      )}
    </div>
  );
}

export function AbaEnviar({ podeEnviar }: { podeEnviar: boolean }) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [destino, setDestino] = useState<"inicio" | "rastreio" | "outro">("inicio");
  const [urlOutro, setUrlOutro] = useState("");
  const [imagem, setImagem] = useState("");
  const [tipo, setTipo] = useState<TipoPublico>("todos");
  const [situacoes, setSituacoes] = useState<SituacaoRastreio[]>([]);
  const [plataformas, setPlataformas] = useState<Plataforma[]>([...PLATAFORMAS]);
  const [comCpf, setComCpf] = useState(false);
  const [buscaTeste, setBuscaTeste] = useState("");
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [quando, setQuando] = useState<"agora" | "agendar">("agora");
  const [agendado, setAgendado] = useState("");
  const [aparelho, setAparelho] = useState<"android" | "ios">("android");
  const [confirmar, setConfirmar] = useState(false);

  const url = destino === "inicio" ? "/" : destino === "rastreio" ? "/rastreio" : urlOutro.trim();

  const publico: PublicoPush = useMemo(
    () => ({
      tipo,
      plataformas,
      com_cpf: comCpf,
      instalado: null,
      situacoes: tipo === "situacao" ? situacoes : [],
      cpfs: [],
      inscricao_ids: tipo === "teste" ? selecionadas : [],
    }),
    [tipo, plataformas, comCpf, situacoes, selecionadas],
  );

  const [publicoAdiado, setPublicoAdiado] = useState(publico);
  useEffect(() => {
    const t = setTimeout(() => setPublicoAdiado(publico), 500);
    return () => clearTimeout(t);
  }, [publico]);

  const { data: total, isFetching: contando } = useQuery({
    queryKey: ["app-push-contar", publicoAdiado],
    queryFn: () => pushApi.contarPublico(publicoAdiado),
    staleTime: 15_000,
  });

  const { data: inscritas = [] } = useQuery({
    queryKey: ["app-push-inscricoes-teste", buscaTeste],
    queryFn: () => pushApi.listarInscricoes(buscaTeste, 50),
    enabled: tipo === "teste",
  });

  const alvo = total ?? 0;

  function corpoEnvio(status: "rascunho" | "pronto") {
    return {
      titulo: semTravessao(titulo).slice(0, 80),
      corpo: semTravessao(corpo).slice(0, 240),
      url: url || null,
      imagem: imagem.trim() || null,
      publico,
      origem: tipo === "teste" ? "teste" : "manual",
      status: status === "rascunho" ? "rascunho" : undefined,
      agendado_para: quando === "agendar" && agendado ? agendado : null,
    };
  }

  const salvar = useMutation({
    mutationFn: () => pushApi.salvarEnvio(corpoEnvio("rascunho")),
    onSuccess: () => {
      toast.success("Rascunho salvo");
      qc.invalidateQueries({ queryKey: ["app-push-envios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enviar = useMutation({
    mutationFn: async () => {
      const salvo = await pushApi.salvarEnvio(corpoEnvio("pronto"));
      const r = await pushApi.disparar(salvo.id);
      if (!r?.ok) throw new Error(r?.erro || "Não foi possível enviar o aviso.");
      return r;
    },
    onSuccess: (r) => {
      toast.success(r.agendado_para ? "Aviso agendado" : "Aviso enviado");
      setConfirmar(false);
      qc.invalidateQueries({ queryKey: ["app-push-envios"] });
      qc.invalidateQueries({ queryKey: ["app-push-resumo"] });
    },
    onError: (e: Error) => {
      setConfirmar(false);
      toast.error(e.message, { duration: 10000 });
    },
  });

  const faltando =
    !titulo.trim() ||
    !corpo.trim() ||
    (destino === "outro" && !urlOutro.trim()) ||
    (tipo === "situacao" && situacoes.length === 0) ||
    (tipo === "teste" && selecionadas.length === 0) ||
    plataformas.length === 0 ||
    (quando === "agendar" && !agendado);

  function alternar<T>(lista: T[], valor: T, set: (v: T[]) => void) {
    set(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="push-titulo">Título</Label>
                <span className="text-xs text-muted-foreground">{titulo.length}/80</span>
              </div>
              <Input
                id="push-titulo"
                value={titulo}
                maxLength={80}
                onChange={(e) => setTitulo(semTravessao(e.target.value))}
                placeholder="Seu pedido está a caminho 💛"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="push-corpo">Mensagem</Label>
                <span className="text-xs text-muted-foreground">{corpo.length}/240</span>
              </div>
              <Textarea
                id="push-corpo"
                value={corpo}
                maxLength={240}
                rows={3}
                onChange={(e) => setCorpo(semTravessao(e.target.value))}
                placeholder="Oi {primeiro_nome}, toque para acompanhar."
              />
              <p className="text-xs text-muted-foreground">
                Curto funciona melhor: o celular corta depois de umas 2 linhas. Use {"{primeiro_nome}"} para chamar a cliente pelo nome.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Ao tocar, abrir</Label>
                <Select value={destino} onValueChange={(v) => setDestino(v as typeof destino)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inicio">Início (/)</SelectItem>
                    <SelectItem value="rastreio">Meus pedidos (/rastreio)</SelectItem>
                    <SelectItem value="outro">Outro link</SelectItem>
                  </SelectContent>
                </Select>
                {destino === "outro" && (
                  <Input
                    value={urlOutro}
                    onChange={(e) => setUrlOutro(e.target.value)}
                    placeholder="/cashback ou https://..."
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="push-imagem">Imagem (opcional)</Label>
                <Input
                  id="push-imagem"
                  value={imagem}
                  onChange={(e) => setImagem(e.target.value)}
                  placeholder="https://..."
                />
                <p className="text-xs text-muted-foreground">Aparece grande no Android. No iPhone não aparece.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <Label>Público</Label>
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as TipoPublico)} className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="todos" id="pub-todos" />
                <Label htmlFor="pub-todos" className="font-normal">Todas</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="situacao" id="pub-situacao" />
                <Label htmlFor="pub-situacao" className="font-normal">Por situação do pedido</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="teste" id="pub-teste" />
                <Label htmlFor="pub-teste" className="font-normal">Teste</Label>
              </div>
            </RadioGroup>

            {tipo === "situacao" && (
              <div className="flex flex-wrap gap-4 rounded-lg border p-3">
                {SITUACOES.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={situacoes.includes(s)}
                      onCheckedChange={() => alternar(situacoes, s, setSituacoes)}
                    />
                    {ROTULO_SITUACAO[s]}
                  </label>
                ))}
              </div>
            )}

            {tipo === "teste" && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={buscaTeste}
                    onChange={(e) => setBuscaTeste(e.target.value)}
                    placeholder="Buscar por nome ou CPF"
                    className="pl-8"
                  />
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {inscritas.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma inscrita encontrada.</p>
                  )}
                  {inscritas.map((i) => (
                    <label key={i.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/60">
                      <Checkbox
                        checked={selecionadas.includes(i.id)}
                        onCheckedChange={() => alternar(selecionadas, i.id, setSelecionadas)}
                      />
                      <span className="truncate">{i.nome || "Sem nome"}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{i.cpf || "-"}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 border-t pt-3">
              {PLATAFORMAS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={plataformas.includes(p)}
                    onCheckedChange={() => alternar(plataformas, p, setPlataformas)}
                  />
                  {ROTULO_PLATAFORMA[p]}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={comCpf} onCheckedChange={(v) => setComCpf(v === true)} />
                Só quem tem CPF salvo
              </label>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              {contando ? (
                <span className="text-muted-foreground">Contando...</span>
              ) : (
                <span>Vai para <strong>{nBR(alvo)}</strong> pessoas</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <Label>Quando</Label>
            <RadioGroup value={quando} onValueChange={(v) => setQuando(v as typeof quando)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agora" id="q-agora" />
                <Label htmlFor="q-agora" className="font-normal">Agora</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agendar" id="q-agendar" />
                <Label htmlFor="q-agendar" className="font-normal">Agendar</Label>
              </div>
            </RadioGroup>
            {quando === "agendar" && (
              <div className="space-y-1.5">
                <Input
                  type="datetime-local"
                  value={agendado}
                  onChange={(e) => setAgendado(e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">Horário de São Paulo.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => salvar.mutate()} disabled={salvar.isPending || !titulo.trim()}>
            {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar rascunho
          </Button>
          <Button
            onClick={() => setConfirmar(true)}
            disabled={faltando || alvo === 0 || enviar.isPending || !podeEnviar}
          >
            <Send className="mr-2 h-4 w-4" />
            {quando === "agendar" ? "Agendar" : "Enviar"}
          </Button>
        </div>
        {!podeEnviar && (
          <p className="text-sm text-warning">Os avisos estão desligados. Ligue no canto da página para enviar.</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={aparelho === "android" ? "default" : "outline"}
            onClick={() => setAparelho("android")}
          >
            Android
          </Button>
          <Button
            size="sm"
            variant={aparelho === "ios" ? "default" : "outline"}
            onClick={() => setAparelho("ios")}
          >
            iPhone
          </Button>
        </div>
        <PreviaNotificacao titulo={titulo} corpo={corpo} imagem={imagem} aparelho={aparelho} />
      </div>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar para {nBR(alvo)} pessoas?</AlertDialogTitle>
            <AlertDialogDescription>Não dá para desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); enviar.mutate(); }} disabled={enviar.isPending}>
              {enviar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
