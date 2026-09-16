import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, AlertTriangle, Loader2, Send, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { chamarRpc } from "@/lib/supabaseRpc";
import BalaoWhats from "./BalaoWhats";
import ConstrutorPublicoWpp, { montarFiltro, type Regra, type Simulacao } from "./ConstrutorPublicoWpp";

/** Campos que mudam de cliente para cliente. */
const CAMPOS_CLIENTE = [
  { valor: "primeiro_nome", rotulo: "Primeiro nome" },
  { valor: "nome", rotulo: "Nome completo" },
  { valor: "segmento_rfm", rotulo: "Segmento RFM" },
  { valor: "tamanho_principal", rotulo: "Tamanho principal" },
  { valor: "qtd_pedidos", rotulo: "Quantidade de pedidos" },
  { valor: "dias_sem_comprar", rotulo: "Dias sem comprar" },
  { valor: "ltv", rotulo: "Total gasto (LTV)" },
  { valor: "ticket_medio", rotulo: "Ticket médio" },
];

type ItemSpec = { tipo: "texto"; valor: string } | { tipo: "campo"; campo: string };

type Variavel = { indice: number; rotulo: string; exemplo?: string };

type DetalheTemplate = {
  template_id: number;
  nome: string;
  categoria?: string;
  status_aprovacao?: string;
  corpo_texto?: string;
  botoes?: { type?: string; text?: string; url?: string }[];
  total_variaveis?: number;
  variaveis?: Variavel[];
};

const TituloPasso = ({ n, titulo }: { n: number; titulo: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
      {n}
    </span>
    <h2 className="font-medium">{titulo}</h2>
  </div>
);

export default function NovaCampanha({ onVoltar }: { onVoltar: () => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [spec, setSpec] = useState<ItemSpec[]>([]);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const [amostras, setAmostras] = useState<any[] | null>(null);
  const [slug, setSlug] = useState("");
  const [destino, setDestino] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [disparada, setDisparada] = useState(false);

  const filtro = useMemo(() => montarFiltro(regras), [regras]);

  /* ---------- passo 1 ---------- */
  const { data: templates = [] } = useQuery({
    queryKey: ["wpp-templates"],
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_templates_listar" as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const aprovados = templates.filter(
    (t: any) => String(t.status_aprovacao ?? "").toLowerCase() === "aprovado",
  );

  const { data: detalhe, isFetching: carregandoDetalhe } = useQuery({
    queryKey: ["wpp-template-variaveis", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_template_variaveis" as any, {
        p_template_id: Number(templateId),
      });
      if (error) throw error;
      const raiz = (Array.isArray(data) ? data[0] ?? {} : data ?? {}) as DetalheTemplate;
      setSpec(
        (raiz.variaveis ?? []).map(() => ({ tipo: "texto", valor: "" }) as ItemSpec),
      );
      setAmostras(null);
      return raiz;
    },
  });

  const variaveis = detalhe?.variaveis ?? [];
  const botoesUrl = (detalhe?.botoes ?? []).filter((b) => String(b.type).toUpperCase() === "URL");
  const temBotaoUrl = botoesUrl.length > 0;
  const marketing = String(detalhe?.categoria ?? "").toUpperCase() === "MARKETING";

  /* ---------- passo 2 ---------- */
  const mudarSpec = (i: number, item: ItemSpec) =>
    setSpec((prev) => prev.map((x, idx) => (idx === i ? item : x)));

  const textoPrevia = useMemo(() => {
    let txt = detalhe?.corpo_texto ?? "";
    variaveis.forEach((v, i) => {
      const item = spec[i];
      const valor =
        item?.tipo === "campo"
          ? v.exemplo || item.campo
          : (item as any)?.valor || `{{${v.rotulo}}}`;
      txt = txt.split(`{{${v.indice}}}`).join(valor);
    });
    return txt;
  }, [detalhe, spec, variaveis]);

  /* ---------- passo 3 ---------- */
  const simular = useMutation({
    mutationFn: async () => {
      const { data, error } = await chamarRpc("campanhas_whatsapp_simular" as any, { p_filtro: filtro });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] ?? {} : data ?? {}) as Simulacao;
    },
    onSuccess: setSimulacao,
    onError: (e: any) => toast({ title: "Erro ao conferir público", description: e.message, variant: "destructive" }),
  });

  /* ---------- passo 4 ---------- */
  const previa = useMutation({
    mutationFn: async () => {
      const { data, error } = await chamarRpc("campanhas_whatsapp_previa" as any, {
        p_template_id: Number(templateId),
        p_spec: spec,
        p_filtro: filtro,
        p_quantos: 3,
      });
      if (error) throw error;
      const raiz = (Array.isArray(data) ? data[0] ?? {} : data ?? {}) as any;
      return (raiz.amostras ?? []) as any[];
    },
    onSuccess: setAmostras,
    onError: (e: any) => toast({ title: "Erro ao gerar a prévia", description: e.message, variant: "destructive" }),
  });

  const criarEDisparar = useMutation({
    mutationFn: async () => {
      const { data: id, error } = await chamarRpc("campanhas_whatsapp_criar" as any, {
        p_nome: nome,
        p_template_id: Number(templateId),
        p_lista_id: null,
        p_variaveis_fixas: spec,
        p_link_slug: temBotaoUrl ? slug || null : null,
        p_link_destino: temBotaoUrl ? destino || null : null,
        p_publico_filtro: filtro,
        p_permite_fim_semana: false,
      });
      if (error) throw error;
      const campanhaId = Array.isArray(id) ? id[0] : id;
      const { data: total, error: erroPreparar } = await chamarRpc(
        "campanhas_whatsapp_preparar_envio" as any,
        { p_campanha_id: campanhaId },
      );
      if (erroPreparar) throw erroPreparar;
      return Array.isArray(total) ? total[0] : total;
    },
    onSuccess: (total: any) => {
      setDisparada(true);
      setConfirmando(false);
      queryClient.invalidateQueries({ queryKey: ["wpp-campanhas"] });
      toast({
        title: "Campanha criada e em fila de envio",
        description: `${Number(total ?? 0).toLocaleString("pt-BR")} destinatários. O envio começa em até um minuto.`,
      });
    },
    onError: (e: any) => {
      setConfirmando(false);
      toast({ title: "Erro ao criar campanha", description: e.message, variant: "destructive" });
    },
  });

  const alvo = Number(simulacao?.alvo ?? 0);
  const faltaLink = temBotaoUrl && (!slug || !/^https:\/\//i.test(destino));
  const podeDisparar = !!nome && !!templateId && !faltaLink && !disparada && !criarEDisparar.isPending;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1" onClick={onVoltar}>
          <ArrowLeft className="h-4 w-4" /> Campanhas
        </Button>
        <h1 className="font-serif text-xl">Nova campanha de WhatsApp</h1>
      </div>

      {/* passo 1 */}
      <Card className="p-4">
        <TituloPasso n={1} titulo="Template" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nome da campanha</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Oferta do dia 17/09" />
          </div>
          <div>
            <Label className="text-xs">Template aprovado</Label>
            {aprovados.length === 0 ? (
              <p className="text-sm text-destructive flex items-center gap-2 mt-1">
                <AlertTriangle className="h-4 w-4" /> Nenhum template aprovado ainda
              </p>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {aprovados.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        {carregandoDetalhe && <Loader2 className="h-4 w-4 animate-spin mt-3" />}
        {detalhe && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{detalhe.categoria}</Badge>
            <Badge variant="outline">{detalhe.total_variaveis ?? variaveis.length} variáveis</Badge>
            {marketing && (
              <span className="text-xs text-muted-foreground">
                Template de marketing sai só dentro do horário comercial. O banco cuida disso.
              </span>
            )}
          </div>
        )}
      </Card>

      {/* passo 2 */}
      <Card className="p-4">
        <TituloPasso n={2} titulo="Preencher as variáveis" />
        {!detalhe ? (
          <p className="text-sm text-muted-foreground">Escolha o template para ver as variáveis.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
            <div className="space-y-3">
              {variaveis.map((v, i) => {
                const item = spec[i];
                return (
                  <div key={v.indice} className="space-y-1.5">
                    <Label className="text-xs font-bold">{`{{${v.rotulo}}}`}</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {item?.tipo === "campo" ? (
                        <Badge variant="secondary" className="gap-1">
                          {CAMPOS_CLIENTE.find((c) => c.valor === item.campo)?.rotulo ?? item.campo}
                          <button
                            type="button"
                            aria-label="Voltar para texto fixo"
                            onClick={() => mudarSpec(i, { tipo: "texto", valor: "" })}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : (
                        <Input
                          className="flex-1 min-w-[220px]"
                          placeholder="Digite o texto fixo para todos os contatos"
                          value={(item as any)?.valor ?? ""}
                          onChange={(e) => mudarSpec(i, { tipo: "texto", valor: e.target.value })}
                        />
                      )}
                      <Select
                        value={item?.tipo === "campo" ? item.campo : ""}
                        onValueChange={(campo) => mudarSpec(i, { tipo: "campo", campo })}
                      >
                        <SelectTrigger className="w-48"><SelectValue placeholder="Inserir variável" /></SelectTrigger>
                        <SelectContent>
                          {CAMPOS_CLIENTE.map((c) => (
                            <SelectItem key={c.valor} value={c.valor}>{c.rotulo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {v.exemplo && (
                      <p className="text-[11px] text-muted-foreground">Exemplo: {v.exemplo}</p>
                    )}
                  </div>
                );
              })}
              {variaveis.length === 0 && (
                <p className="text-sm text-muted-foreground">Este template não tem variáveis.</p>
              )}
            </div>
            <div className="lg:sticky lg:top-4 lg:self-start">
              <p className="text-xs text-muted-foreground mb-2">Como a cliente vê</p>
              <BalaoWhats texto={textoPrevia} botoes={detalhe.botoes} />
            </div>
          </div>
        )}
      </Card>

      {/* passo 3 */}
      <Card className="p-4">
        <TituloPasso n={3} titulo="Público" />
        <ConstrutorPublicoWpp
          regras={regras}
          onRegras={(r) => { setRegras(r); setSimulacao(null); setAmostras(null); }}
          simulacao={simulacao}
          onSimular={() => simular.mutate()}
          simulando={simular.isPending}
        />
      </Card>

      {/* passo 4 */}
      <Card className="p-4 space-y-4">
        <TituloPasso n={4} titulo="Conferir e disparar" />

        {temBotaoUrl && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Porta</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ir" />
            </div>
            <div>
              <Label className="text-xs">Link de destino</Label>
              <Input
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder="https://www.usemarianacardoso.com.br/novidades"
              />
              {destino && !/^https:\/\//i.test(destino) && (
                <p className="text-xs text-destructive mt-1">O link precisa começar com https://</p>
              )}
            </div>
          </div>
        )}

        {marketing && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Template de marketing: as mensagens saem só dentro do horário comercial.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => previa.mutate()}
            disabled={!templateId || previa.isPending}
          >
            {previa.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Ver prévia com clientes reais
          </Button>
          <Button onClick={() => setConfirmando(true)} disabled={!podeDisparar}>
            <Send className="h-4 w-4 mr-2" /> Criar e disparar
          </Button>
          {disparada && (
            <span className="text-xs text-muted-foreground">
              Campanha já em fila. Acompanhe na lista de campanhas.
            </span>
          )}
        </div>

        {amostras && amostras.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {amostras.map((a, i) => (
              <div key={i} className="space-y-1">
                <BalaoWhats texto={a.mensagem} botoes={detalhe?.botoes} nome={`${a.nome} • ${a.telefone}`} />
              </div>
            ))}
          </div>
        )}
        {amostras && amostras.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma cliente no filtro atual, então não há prévia para mostrar.
          </p>
        )}
      </Card>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disparar esta campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              {alvo > 0
                ? `${alvo.toLocaleString("pt-BR")} clientes vão receber esta mensagem. `
                : "O público ainda não foi conferido nesta tela. "}
              O envio começa em seguida e não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); criarEDisparar.mutate(); }}
              disabled={criarEDisparar.isPending}
            >
              {criarEDisparar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar e disparar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
