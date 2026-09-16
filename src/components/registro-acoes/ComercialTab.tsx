import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp } from "lucide-react";
import {
  CLASSE_FRENTE, CLASSE_SINAL, ROTULO_FRENTE, acoesComerciais, brl, dec, ddmm, inteiro,
  isNil, n, pct, rotuloDe, type AcoesOpcoes,
} from "@/lib/registroAcoes";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const TODAS = "__todas__";

type Props = {
  opcoes: AcoesOpcoes;
  onAbrirAcao: (a: any) => void;
  onNovaAcao: () => void;
};

/* ---------- pedacinhos ---------- */

function Variacao({ valor, cinza }: { valor: any; cinza?: boolean }) {
  if (isNil(valor)) return <span className="text-muted-foreground text-xs">sem base</span>;
  const v = n(valor);
  if (cinza) {
    return <span className="text-xs text-muted-foreground">{dec(v, 2)}%</span>;
  }
  const sobe = v >= 0;
  const Icone = sobe ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${sobe ? "text-emerald-600" : "text-red-600"}`}>
      <Icone className="h-3 w-3" />
      {dec(Math.abs(v), 2)}%
    </span>
  );
}

function ChipFrente({ acao, onClick }: { acao: any; onClick?: () => void }) {
  const chave = acao.incidente ? "incidente" : String(acao.frente ?? "");
  const classe = CLASSE_FRENTE[chave] ?? CLASSE_FRENTE.acao_comercial;
  return (
    <Badge
      variant="outline"
      className={`text-[10px] border ${classe} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {acao.incidente ? "Incidente" : ROTULO_FRENTE[chave] ?? chave}
    </Badge>
  );
}

function CardResumo({ titulo, valor }: { titulo: string; valor: any }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-2xl font-semibold mt-1">{inteiro(valor)}</p>
    </Card>
  );
}

function NumeroVendas({
  titulo, valor, abaixo, variacao,
}: { titulo: string; valor: string; abaixo?: string; variacao?: any }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{titulo}</p>
      <p className="text-base font-semibold">{valor}</p>
      {!isNil(variacao) && (
        <p className="text-[11px]">
          vs média 28 dias: <Variacao valor={variacao} />
        </p>
      )}
      {abaixo && <p className="text-[11px] text-muted-foreground">{abaixo}</p>}
    </div>
  );
}

function LinhaCanal({
  nome, quantidade, detalhe, titulos,
}: { nome: string; quantidade: number; detalhe?: string; titulos?: string[] }) {
  const [aberto, setAberto] = useState(false);
  const vazio = quantidade <= 0;
  const lista = titulos ?? [];
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 py-1.5 text-left"
        onClick={() => lista.length && setAberto((v) => !v)}
      >
        <span className={`text-xs ${vazio ? "text-muted-foreground" : "font-medium"}`}>{nome}</span>
        <span className={`text-xs ${vazio ? "text-muted-foreground" : ""} flex items-center gap-1`}>
          {vazio ? "nada registrado" : detalhe}
          {lista.length > 0 && (aberto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </span>
      </button>
      {aberto && lista.length > 0 && (
        <ul className="pb-2 pl-3 space-y-0.5">
          {lista.map((t, i) => (
            <li key={i} className="text-[11px] text-muted-foreground">{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CardAcao({
  acao, opcoes, onAbrirAcao, refCard,
}: { acao: any; opcoes: AcoesOpcoes; onAbrirAcao: (a: any) => void; refCard: (el: HTMLDivElement | null) => void }) {
  const [expandido, setExpandido] = useState(false);
  const v = acao.vendas_periodo ?? {};
  const at = acao.ativacoes ?? {};
  const rfm = at.disparo_rfm ?? {};
  const vip = at.grupo_vip ?? {};
  const mail = at.email ?? {};
  const midia = at.midia_paga ?? {};
  const insta = at.instagram ?? {};

  const periodo = acao.periodo_fim && String(acao.periodo_fim).slice(0, 10) !== String(acao.data_inicio).slice(0, 10)
    ? `${ddmm(acao.data_inicio)} a ${ddmm(acao.periodo_fim)}`
    : ddmm(acao.data_inicio);

  const canais: string[] = Array.isArray(acao.canais)
    ? acao.canais.map((c: any) => rotuloDe(opcoes.canais, c, String(c)))
    : [];

  return (
    <Card ref={refCard as any} className="p-4 space-y-3 scroll-mt-24">
      <div className="flex flex-wrap items-center gap-2">
        <ChipFrente acao={acao} />
        <span className="font-medium text-sm">{acao.titulo}</span>
        <span className="text-xs text-muted-foreground">{periodo}</span>
        {acao.produto_foco && (
          <Badge variant="secondary" className="text-[10px]">{acao.produto_foco}</Badge>
        )}
        {canais.map((c, i) => (
          <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>
        ))}
      </div>

      {acao.descricao && (
        <div>
          <p className={`text-xs text-muted-foreground ${expandido ? "" : "line-clamp-2"}`}>
            {acao.descricao}
          </p>
          <button
            type="button"
            className="text-[11px] text-primary mt-0.5"
            onClick={() => setExpandido((x) => !x)}
          >
            {expandido ? "ver menos" : "ver mais"}
          </button>
        </div>
      )}
      {acao.hipotese && <p className="text-xs italic text-muted-foreground">{acao.hipotese}</p>}

      <Separator />

      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-medium">Vendas no período</p>
          {v.periodo_em_curso && (
            <Badge variant="outline" className="text-[10px] border-blue-200 bg-blue-100 text-blue-800">
              em andamento
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <NumeroVendas
            titulo="Receita por dia"
            valor={brl(v.receita_dia)}
            variacao={v.receita_dia_vs_base_pct}
          />
          <NumeroVendas
            titulo="Pedidos por dia"
            valor={dec(v.pedidos_dia, 1)}
            abaixo={`média 28 dias: ${dec(v.pedidos_dia_base_28d, 1)}`}
          />
          <NumeroVendas
            titulo="Ticket"
            valor={brl(v.ticket)}
            variacao={v.ticket_vs_base_pct}
          />
          <NumeroVendas
            titulo="Clientes novos"
            valor={`${inteiro(v.pedidos_novos)} de ${inteiro(v.pedidos)}`}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Vendas da loja inteira no período, não só da ação. Ações no mesmo dia dividem o mesmo número.
        </p>
      </div>

      <Separator />

      <div>
        <p className="text-xs font-medium mb-1">Ativação nos canais</p>
        <LinhaCanal
          nome="Instagram"
          quantidade={n(insta.acoes)}
          detalhe={`${inteiro(insta.acoes)} ações`}
          titulos={insta.titulos}
        />
        <LinhaCanal
          nome="Anúncios (Mídia Paga)"
          quantidade={n(midia.acoes)}
          detalhe={`${inteiro(midia.acoes)} ações`}
          titulos={midia.titulos}
        />
        <LinhaCanal
          nome="Grupo VIP WhatsApp"
          quantidade={n(vip.mensagens)}
          detalhe={`${inteiro(vip.mensagens)} mensagens, ${inteiro(vip.cliques)} cliques`}
        />
        <LinhaCanal
          nome="Disparo RFM (CRM)"
          quantidade={n(rfm.acoes)}
          detalhe={`${inteiro(rfm.acoes)} disparos, ${inteiro(rfm.destinatarios)} pessoas, ${brl(rfm.receita_atribuida)} atribuída pela Kora`}
          titulos={rfm.titulos}
        />
        <LinhaCanal
          nome="E-mail"
          quantidade={n(mail.acoes)}
          detalhe={`${inteiro(mail.acoes)} envios, ${inteiro(mail.enviados)} e-mails`}
          titulos={mail.titulos}
        />
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {acao.sinal && (
            <Badge variant="outline" className={`text-[10px] border ${CLASSE_SINAL[String(acao.sinal)] ?? CLASSE_SINAL.sem_base}`}>
              {rotuloDe(opcoes.sinais, acao.sinal)}
            </Badge>
          )}
          {acao.driver_nome && (
            <span className="text-xs text-muted-foreground">
              {acao.driver_nome}
              {!isNil(acao.delta_base_pct) && ` (${dec(acao.delta_base_pct, 2)}% vs base)`}
            </span>
          )}
          {acao.leitura && (
            <span className="text-xs text-muted-foreground">
              Leitura: {rotuloDe(opcoes.leituras, acao.leitura, String(acao.leitura))}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => onAbrirAcao(acao)}>Abrir</Button>
      </div>
    </Card>
  );
}

/* ---------- aba ---------- */

export default function ComercialTab({ opcoes, onAbrirAcao, onNovaAcao }: Props) {
  const hoje = new Date();
  const inicioPadrao = new Date(hoje);
  inicioPadrao.setDate(inicioPadrao.getDate() - 90);

  const [inicio, setInicio] = useState(iso(inicioPadrao));
  const [fim, setFim] = useState(iso(hoje));
  const [frente, setFrente] = useState(TODAS);
  const [mostrarIncidentes, setMostrarIncidentes] = useState(false);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["acoes", "comerciais", inicio, fim],
    queryFn: async () => {
      const d = await acoesComerciais(inicio, fim);
      return (Array.isArray(d) ? d[0] ?? {} : d ?? {}) as any;
    },
  });

  const resumo = data?.resumo ?? {};
  const semanas: any[] = useMemo(
    () => [...(data?.semanas ?? [])].sort((a, b) => String(b.semana_inicio).localeCompare(String(a.semana_inicio))),
    [data],
  );

  const filtrar = (a: any) => {
    if (!mostrarIncidentes && a.incidente) return false;
    if (frente !== TODAS && String(a.frente) !== frente) return false;
    return true;
  };

  const acoes: any[] = useMemo(
    () =>
      [...(data?.acoes ?? [])]
        .filter(filtrar)
        .sort((a, b) => String(b.data_inicio).localeCompare(String(a.data_inicio))),
    [data, frente, mostrarIncidentes],
  );

  const rolarAte = (id: any) => {
    const el = refs.current[String(id)];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-5">
      <Card className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <Label className="text-xs">Início</Label>
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Fim</Label>
          <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Frente</Label>
          <Select value={frente} onValueChange={setFrente}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas</SelectItem>
              <SelectItem value="lancamento">Lançamentos</SelectItem>
              <SelectItem value="acao_comercial">Ações comerciais</SelectItem>
              <SelectItem value="oferta_preco">Ofertas e preço</SelectItem>
              <SelectItem value="live">Lives</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch checked={mostrarIncidentes} onCheckedChange={setMostrarIncidentes} id="incidentes" />
          <Label htmlFor="incidentes" className="text-xs">Mostrar incidentes</Label>
        </div>
      </Card>

      {isLoading && <Skeleton className="h-96 w-full" />}
      {error && (
        <Card className="p-6 text-sm text-destructive">
          Não deu para carregar: {(error as Error).message}
        </Card>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <CardResumo titulo="Lançamentos" valor={resumo.lancamentos} />
            <CardResumo titulo="Ações comerciais" valor={resumo.acoes_comerciais} />
            <CardResumo titulo="Ofertas e preço" valor={resumo.ofertas_preco} />
            <CardResumo titulo="Lives" valor={resumo.lives} />
            <CardResumo titulo="Semanas com ação" valor={resumo.semanas_com_acao} />
          </div>
          {n(resumo.incidentes) > 0 && (
            <Card className="p-3 inline-block border-amber-200 bg-amber-50">
              <p className="text-[11px] text-amber-800">Incidentes</p>
              <p className="text-lg font-semibold text-amber-900">{inteiro(resumo.incidentes)}</p>
            </Card>
          )}

          <Card className="p-4 space-y-3">
            <p className="text-sm font-medium">Linha do tempo por semana</p>
            {semanas.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem semanas no período.</p>
            )}
            {semanas.map((s) => (
              <div key={s.semana_inicio} className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b last:border-b-0 pb-2">
                <span className="text-xs font-medium w-28">{ddmm(s.semana_inicio)} a {ddmm(s.semana_fim)}</span>
                <span className="text-xs">{brl(s.receita_faturada)}</span>
                <span className="flex items-center gap-1">
                  <Variacao valor={s.receita_wow_pct} cinza={!!s.parcial} />
                  {s.parcial && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">semana em curso</Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{inteiro(s.pedidos_faturados)} pedidos</span>
                <span className="text-xs text-muted-foreground">ticket {brl(s.ticket_medio)}</span>
                <span className="text-xs text-muted-foreground">conversão {pct(s.taxa_conversao, 2)}</span>
                <span className="flex flex-wrap items-center gap-1 ml-auto">
                  {(s.acoes ?? []).filter(filtrar).map((a: any) => (
                    <Badge
                      key={a.id}
                      variant="outline"
                      className={`text-[10px] border cursor-pointer ${CLASSE_FRENTE[a.incidente ? "incidente" : String(a.frente)] ?? CLASSE_FRENTE.acao_comercial}`}
                      onClick={() => rolarAte(a.id)}
                    >
                      {a.titulo}
                    </Badge>
                  ))}
                </span>
              </div>
            ))}
          </Card>

          <div className="space-y-3">
            <p className="text-sm font-medium">O que foi feito</p>
            {acoes.length === 0 ? (
              <Card className="p-8 text-center border-dashed space-y-3">
                <p className="text-sm text-muted-foreground">
                  Nenhuma ação comercial ou lançamento no período.
                </p>
                <Button size="sm" onClick={onNovaAcao}>Nova ação</Button>
              </Card>
            ) : (
              acoes.map((a) => (
                <CardAcao
                  key={a.id}
                  acao={a}
                  opcoes={opcoes}
                  onAbrirAcao={onAbrirAcao}
                  refCard={(el) => { refs.current[String(a.id)] = el; }}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
