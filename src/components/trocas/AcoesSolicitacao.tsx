import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2 } from "lucide-react";

/* ───────── helpers ───────── */

const brl = (v: any) =>
  Number.isFinite(Number(v))
    ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";

const dataHoraBR = (v: any) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? String(v)
    : `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

type Acao =
  | "cotar"
  | "autorizar"
  | "marcar_postado"
  | "marcar_entregue"
  | "cancelar_autorizacao"
  | "comentar"
  | "emitir_vale"
  | "reembolsar";

const ROTULO_ACAO: Record<string, string> = {
  autorizar: "Autorizar postagem",
  marcar_postado: "Registrar postagem",
  marcar_entregue: "Registrar entrega",
  cancelar_autorizacao: "Cancelar autorização",
  comentar: "Comentar",
  emitir_vale: "Emitir vale-trocas",
  reembolsar: "Finalizar reembolso",
};

/* ───────── ações do painel (aba) ───────── */

export function AcoesDoPainel({ requestId }: { requestId: any }) {
  const q = useQuery({
    queryKey: ["trocas-acoes", requestId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_trocas_acoes" as any, { p_request_id: requestId });
      if (error) throw error;
      return data as any;
    },
    enabled: requestId !== undefined && requestId !== null,
  });

  if (q.isLoading) return <p className="text-xs text-muted-foreground">Carregando ações…</p>;
  if (q.error) return <p className="text-xs text-destructive">Erro ao carregar ações do painel.</p>;

  const raw: any = q.data;
  const linhas: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.acoes) ? raw.acoes : Array.isArray(raw?.linhas) ? raw.linhas : [];

  if (!linhas.length)
    return <p className="text-xs text-muted-foreground">Nenhuma ação executada por este painel.</p>;

  return (
    <div className="space-y-2">
      {linhas.map((a, i) => (
        <div key={a.id ?? i} className="rounded-md border bg-background p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{ROTULO_ACAO[String(a.acao)] ?? a.acao_rotulo ?? a.acao ?? "—"}</span>
            <Badge variant={a.sucesso === false ? "destructive" : "outline"} className="text-[10px]">
              {a.sucesso === false ? "falhou" : "ok"}
            </Badge>
            <span className="text-muted-foreground">{dataHoraBR(a.criado_em ?? a.created_at ?? a.data)}</span>
            {(a.usuario ?? a.autor ?? a.email) && (
              <span className="text-muted-foreground">· {a.usuario ?? a.autor ?? a.email}</span>
            )}
          </div>
          {a.erro && <p className="mt-1 text-destructive">{String(a.erro)}</p>}
        </div>
      ))}
    </div>
  );
}

/* ───────── barra de ações ───────── */

export default function AcoesSolicitacao({ linha }: { linha: any }) {
  const qc = useQueryClient();
  const requestId = linha.request_id ?? linha.id;
  const est = String(linha.estagio ?? "");
  const finalizada = est === "concluida" || est === "cancelada";

  const [aberta, setAberta] = useState<Acao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [cotando, setCotando] = useState(false);
  const [cotacao, setCotacao] = useState<{ opcoes: any[]; recomendada: any } | null>(null);
  const [travaAte, setTravaAte] = useState<number>(0);
  const [avisoTrava, setAvisoTrava] = useState<string | null>(null);

  // comentário inline
  const [mostrarComentario, setMostrarComentario] = useState(false);
  const [comentario, setComentario] = useState("");

  // campos dos modais
  const [tracking, setTracking] = useState(linha.rastreio ?? linha.codigo_rastreio ?? "");
  const [postadoEm, setPostadoEm] = useState("");
  const [entregueEm, setEntregueEm] = useState("");
  const [motivo, setMotivo] = useState("");
  const [valor, setValor] = useState(String(n(linha.valor ?? linha.valor_total)));
  const [validade, setValidade] = useState("");
  const [freteGratis, setFreteGratis] = useState(false);
  const [metodo, setMetodo] = useState<"money" | "voucher" | "credit_card" | "product">("money");
  const [pixBanco, setPixBanco] = useState("");
  const [pixTipo, setPixTipo] = useState("cpf");
  const [pixChave, setPixChave] = useState("");
  const [pixObs, setPixObs] = useState("");
  const [cienteNotificacao, setCienteNotificacao] = useState(false);

  const travado = travaAte > Date.now();
  const paradaHaDias = n(linha.parada_ha_dias);

  const fechar = () => {
    setAberta(null);
    setCienteNotificacao(false);
  };

  const executar = async (acao: Acao, dados: any, toastSucesso?: (r: any) => { titulo: string; descricao?: string }) => {
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("troque-devolva-acao", {
        body: { acao, request_id: requestId, dados },
      });

      // erros HTTP (400 validação / 429 trava de lote)
      if (error) {
        let corpo: any = null;
        try {
          corpo = await (error as any)?.context?.json?.();
        } catch { /* corpo não json */ }
        const status = (error as any)?.context?.status;
        const msg = corpo?.erro ?? corpo?.message ?? error.message ?? "Falha ao executar a ação.";
        if (status === 429 || corpo?.trava) {
          setAvisoTrava(String(msg));
          setTravaAte(Date.now() + 60_000);
          setTimeout(() => setTravaAte(0), 60_000);
          toast.error(String(msg));
        } else {
          toast.error(String(msg));
        }
        return false;
      }

      const r: any = data ?? {};
      if (r.ok === false) {
        toast.error(r?.resposta?.erro ?? r?.resposta?.message ?? r.erro ?? "A ação não foi concluída.", {
          description: r.aviso ? String(r.aviso) : undefined,
        });
        return false;
      }

      const t = toastSucesso
        ? toastSucesso(r)
        : { titulo: `${ROTULO_ACAO[acao] ?? "Ação"} concluída.`, descricao: r.aviso ? String(r.aviso) : undefined };
      toast.success(t.titulo, { description: t.descricao });
      qc.invalidateQueries({ queryKey: ["trocas-solicitacoes"] });
      qc.invalidateQueries({ queryKey: ["trocas-acoes", requestId] });
      qc.invalidateQueries({ queryKey: ["trocas-dashboard"] });
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "Erro inesperado ao executar a ação.");
      return false;
    } finally {
      setEnviando(false);
    }
  };

  const rodar = async (
    acao: Acao,
    dados: any,
    aoConcluir?: () => void,
    toastSucesso?: (r: any) => { titulo: string; descricao?: string },
  ) => {
    const ok = await executar(acao, dados, toastSucesso);
    if (ok) {
      aoConcluir?.();
      fechar();
    }
  };

  /* ── cotação + autorização ── */
  const cotarEAbrir = async () => {
    setCotando(true);
    setCotacao(null);
    try {
      const { data, error } = await supabase.functions.invoke("troque-devolva-acao", {
        body: { acao: "cotar", request_id: requestId, dados: {} },
      });
      let corpo: any = null;
      if (error) {
        try {
          corpo = await (error as any)?.context?.json?.();
        } catch { /* não json */ }
        toast.error(String(corpo?.erro ?? corpo?.message ?? error.message ?? "Falha ao cotar o frete."));
        return;
      }
      const r: any = data ?? {};
      const resp = r.resposta ?? r;
      const opcoes: any[] = Array.isArray(resp?.opcoes) ? resp.opcoes : [];
      if (r.ok === false || !opcoes.length) {
        toast.error(String(resp?.erro ?? resp?.message ?? r.erro ?? "Nenhuma opção de frete disponível para esta solicitação."));
        return;
      }
      const recRaw = resp.recomendada;
      const recomendada =
        recRaw && typeof recRaw === "object"
          ? recRaw
          : opcoes.find((o) => String(o.servico).toLowerCase() === String(recRaw).toLowerCase()) ?? opcoes[0];
      setCotacao({ opcoes, recomendada });
      setAberta("autorizar");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro inesperado ao cotar o frete.");
    } finally {
      setCotando(false);
    }
  };

  const toastAutorizar = (r: any) => {
    const resp = r.resposta ?? r;
    const esc = resp?.escolhida;
    if (!esc) return { titulo: "Postagem autorizada.", descricao: r.aviso ? String(r.aviso) : undefined };
    const comparadas: any[] = Array.isArray(resp?.comparadas) ? resp.comparadas : [];
    const maisCara = comparadas
      .filter((c) => String(c.servico).toLowerCase() !== String(esc.servico).toLowerCase())
      .sort((a, b) => n(b.preco) - n(a.preco))[0];
    const economia = maisCara ? n(maisCara.preco) - n(esc.preco) : 0;
    const partes = [
      `${String(esc.servico).toUpperCase()} ${brl(esc.preco)}${esc.prazo_dias ? `, ${esc.prazo_dias} dias` : ""}.`,
    ];
    if (economia > 0 && maisCara) {
      partes.push(`Economia de ${brl(economia)} sobre o ${String(maisCara.servico).toUpperCase()}.`);
    }
    if (r.aviso) partes.push(String(r.aviso));
    return { titulo: "Autorizado", descricao: partes.join(" ") };
  };

  const autorizar = (servico?: string) =>
    rodar("autorizar", servico ? { servico } : {}, undefined, toastAutorizar);

  const botoesEstagio: Acao[] =
    est === "aguardando_aprovacao"
      ? ["autorizar"]
      : est === "aguardando_postagem"
      ? ["cancelar_autorizacao", "marcar_postado"]
      : est === "em_transito"
      ? ["marcar_entregue", "cancelar_autorizacao"]
      : est === "recebida"
      ? ["emitir_vale", "reembolsar"]
      : [];

  const notifica = (a: Acao) => a === "emitir_vale" || a === "reembolsar" || a === "autorizar";

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Ações</p>

      {avisoTrava && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500 bg-amber-500/10 p-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
          <span>{avisoTrava}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {finalizada && <span className="text-xs text-muted-foreground">Solicitação encerrada — apenas histórico.</span>}
        {botoesEstagio.map((a) => (
          <Button
            key={a}
            size="sm"
            variant={a === "cancelar_autorizacao" ? "outline" : "default"}
            disabled={enviando || (notifica(a) && travado)}
            onClick={() => setAberta(a)}
          >
            {ROTULO_ACAO[a]}
          </Button>
        ))}
        <Button size="sm" variant="secondary" onClick={() => setMostrarComentario((v) => !v)}>
          Comentar
        </Button>
      </div>

      {mostrarComentario && (
        <div className="space-y-2">
          <Textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Escreva um comentário interno para esta solicitação"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={enviando || !comentario.trim()}
              onClick={async () => {
                const ok = await executar("comentar", { comment: comentario.trim() });
                if (ok) {
                  setComentario("");
                  setMostrarComentario(false);
                }
              }}
            >
              {enviando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Enviar comentário
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMostrarComentario(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* ── Registrar postagem ── */}
      <Dialog open={aberta === "marcar_postado"} onOpenChange={(o) => !o && fechar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar postagem</DialogTitle>
            <DialogDescription>Informe o código de rastreio da postagem feita pela cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Código de rastreio</Label>
              <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="AA000000000BR" />
            </div>
            <div className="space-y-1">
              <Label>Data da postagem (opcional)</Label>
              <Input type="date" value={postadoEm} onChange={(e) => setPostadoEm(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={fechar}>Cancelar</Button>
            <Button
              disabled={enviando || !tracking.trim()}
              onClick={() =>
                rodar("marcar_postado", {
                  tracking_code: tracking.trim(),
                  ...(postadoEm ? { posted_at: postadoEm } : {}),
                })
              }
            >
              {enviando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Registrar entrega ── */}
      <Dialog open={aberta === "marcar_entregue"} onOpenChange={(o) => !o && fechar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar entrega</DialogTitle>
            <DialogDescription>Confirma que a peça chegou na loja.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Data da entrega (opcional)</Label>
            <Input type="date" value={entregueEm} onChange={(e) => setEntregueEm(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={fechar}>Cancelar</Button>
            <Button
              disabled={enviando}
              onClick={() =>
                rodar("marcar_entregue", {
                  authorization_id: linha.authorization_id ?? linha.autorizacao_id ?? null,
                  ...(entregueEm ? { delivered_at: entregueEm } : {}),
                })
              }
            >
              {enviando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancelar autorização ── */}
      <Dialog open={aberta === "cancelar_autorizacao"} onOpenChange={(o) => !o && fechar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar autorização</DialogTitle>
            <DialogDescription>O motivo é obrigatório e fica registrado na solicitação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={fechar}>Voltar</Button>
            <Button
              variant="destructive"
              disabled={enviando || !motivo.trim()}
              onClick={() => rodar("cancelar_autorizacao", { reason: motivo.trim() }, () => setMotivo(""))}
            >
              {enviando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Cancelar autorização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Emitir vale-trocas ── */}
      <Dialog open={aberta === "emitir_vale"} onOpenChange={(o) => !o && fechar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir vale-trocas</DialogTitle>
            <DialogDescription>
              {linha.cliente ?? "Cliente"} · pedido {linha.pedido ?? linha.numero_pedido ?? "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Sugerido: {brl(linha.valor ?? linha.valor_total)}</p>
            </div>
            <div className="space-y-1">
              <Label>Válido até (opcional)</Label>
              <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={freteGratis} onCheckedChange={(v) => setFreteGratis(v === true)} />
              Incluir frete grátis
            </label>
            <AvisoNotificacao paradaHaDias={paradaHaDias} />
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={cienteNotificacao} onCheckedChange={(v) => setCienteNotificacao(v === true)} />
              Entendi que a cliente será notificada
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={fechar}>Cancelar</Button>
            <Button
              disabled={enviando || !cienteNotificacao || !(Number(valor) > 0) || travado}
              onClick={() =>
                rodar("emitir_vale", {
                  amount: Number(valor),
                  ...(validade ? { valid_until: validade } : {}),
                  free_shipping: freteGratis,
                })
              }
            >
              {enviando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Emitir vale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reembolsar ── */}
      <Dialog open={aberta === "reembolsar"} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar reembolso</DialogTitle>
            <DialogDescription>
              {linha.cliente ?? "Cliente"} · pedido {linha.pedido ?? linha.numero_pedido ?? "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Forma de reembolso</Label>
              <Select value={metodo} onValueChange={(v) => setMetodo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="money">Dinheiro (PIX)</SelectItem>
                  <SelectItem value="voucher">Vale-compras</SelectItem>
                  <SelectItem value="credit_card">Estorno no cartão</SelectItem>
                  <SelectItem value="product">Envio de produto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Sugerido: {brl(linha.valor ?? linha.valor_total)}</p>
            </div>

            {metodo === "money" && (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-medium">Dados do PIX</p>
                <div className="space-y-1">
                  <Label>Banco</Label>
                  <Input value={pixBanco} onChange={(e) => setPixBanco(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Tipo de chave</Label>
                  <Select value={pixTipo} onValueChange={setPixTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="random">Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Chave PIX</Label>
                  <Input value={pixChave} onChange={(e) => setPixChave(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Observação (opcional)</Label>
                  <Input value={pixObs} onChange={(e) => setPixObs(e.target.value)} />
                </div>
              </div>
            )}

            {metodo === "voucher" && (
              <div className="space-y-1">
                <Label>Válido até (opcional)</Label>
                <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
              </div>
            )}

            <AvisoNotificacao paradaHaDias={paradaHaDias} />
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={cienteNotificacao} onCheckedChange={(v) => setCienteNotificacao(v === true)} />
              Entendi que a cliente será notificada
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={fechar}>Cancelar</Button>
            <Button
              disabled={
                enviando ||
                !cienteNotificacao ||
                travado ||
                !(Number(valor) > 0) ||
                (metodo === "money" && (!pixBanco.trim() || !pixChave.trim()))
              }
              onClick={() =>
                rodar("reembolsar", {
                  method: metodo,
                  amount: Number(valor),
                  ...(metodo === "money"
                    ? {
                        money: {
                          bank: pixBanco.trim(),
                          account_pix_type: pixTipo,
                          account_pix_key: pixChave.trim(),
                          comment: pixObs.trim(),
                        },
                      }
                    : {}),
                  ...(metodo === "voucher" && validade ? { voucher: { code: "", valid_until: validade } } : {}),
                })
              }
            >
              {enviando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Confirmar reembolso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AvisoNotificacao({ paradaHaDias }: { paradaHaDias: number }) {
  return (
    <>
      <div className="rounded-md bg-muted p-2 text-xs font-medium">
        A cliente recebe e-mail e WhatsApp automáticos avisando que o reembolso foi processado.
      </div>
      {paradaHaDias > 60 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500 bg-amber-500/10 p-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
          <span>
            Esta solicitação está parada há {paradaHaDias.toLocaleString("pt-BR")} dias. Confirme com o atendimento se a
            cliente já recebeu o crédito por fora antes de encerrar.
          </span>
        </div>
      )}
    </>
  );
}
