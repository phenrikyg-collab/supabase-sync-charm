import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const ROTULO_STATUS: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  executando: "Enviando",
  pago: "Pago",
  falhou: "Falhou",
  cancelado: "Cancelado",
};
export const ORDEM_STATUS = Object.keys(ROTULO_STATUS);
export const rotuloStatus = (s?: string | null) => (s ? ROTULO_STATUS[s] ?? s : "-");
export const classeStatus = (s?: string | null) =>
  s === "aguardando_aprovacao"
    ? "border-warning/40 bg-warning/15 text-warning"
    : s === "pago"
      ? "border-success/40 bg-success/15 text-success"
      : "";

const ROTAS = [
  { v: "pix_chave", r: "Pix pelo Inter" },
  { v: "estorno_vindi", r: "Estorno na Vindi (manual)" },
  { v: "manual", r: "Manual" },
];
const TIPOS = ["cpf", "cnpj", "email", "telefone", "aleatoria"];

const brl = (v: any) =>
  Number.isFinite(Number(v)) ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-";
const dataHora = (v: any) => {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};
const agoraLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const corVeredito = (v?: string) =>
  v === "confere" ? "border-success/40 bg-success/10 text-success"
  : v === "parcial" ? "border-warning/40 bg-warning/10 text-warning"
  : v === "divergente" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border";

function desembrulhar(d: any) {
  if (Array.isArray(d)) d = d[0];
  if (d && typeof d === "object" && !("id" in d)) {
    const ks = Object.keys(d);
    if (ks.length === 1 && typeof d[ks[0]] === "object") return d[ks[0]];
  }
  return d;
}

async function lerErroFuncao(error: any): Promise<any> {
  try {
    const c = await error?.context?.json?.();
    if (c) return c;
  } catch { /* sem corpo */ }
  return { erro: error?.message ?? "Não deu certo" };
}

interface Props {
  reembolso: any;
  operador?: Record<string, any> | null;
  config?: Record<string, any> | null;
  aoAtualizar: (r: any) => void;
}

export function PainelReembolso({ reembolso: r, operador, config, aoAtualizar }: Props) {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const trava = useRef(false);

  const [valor, setValor] = useState("");
  const [rota, setRota] = useState("pix_chave");
  const [tipo, setTipo] = useState("cpf");
  const [chave, setChave] = useState("");
  const [obs, setObs] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [valorConferido, setValorConferido] = useState("");
  const [comprovante, setComprovante] = useState("");
  const [pagoEm, setPagoEm] = useState(agoraLocal());
  const [erroTitular, setErroTitular] = useState<{ erro?: string; dica?: string } | null>(null);

  useEffect(() => {
    setValor(r?.valor != null ? String(r.valor) : "");
    setRota(r?.rota ?? "pix_chave");
    if (r?.chave_pix) {
      setChave(r.chave_pix);
      setTipo(r.tipo_chave ?? "cpf");
    } else if (r?.cliente_documento) {
      setChave(String(r.cliente_documento));
      setTipo("cpf");
    } else {
      setChave("");
      setTipo(r?.tipo_chave ?? "cpf");
    }
    setObs(r?.obs ?? "");
    setJustificativa(r?.justificativa_titular ?? "");
    setErroTitular(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id, r?.status]);

  const concluir = (novo: any) => {
    if (novo && typeof novo === "object") aoAtualizar(novo);
    qc.invalidateQueries({ queryKey: ["trocas-reembolsos"] });
  };

  async function rpc(nome: string, args: Record<string, unknown>, ok: string) {
    if (trava.current) return;
    trava.current = true;
    setOcupado(nome);
    try {
      const { data, error } = await chamarRpc(nome, args);
      if (error) {
        toast.error(error.message ?? "Não deu certo");
        return;
      }
      concluir(desembrulhar(data));
      toast.success(ok);
    } finally {
      trava.current = false;
      setOcupado(null);
    }
  }

  async function funcao(acao: "verificar_titular" | "executar") {
    if (trava.current) return;
    trava.current = true;
    setOcupado(acao);
    try {
      const { data, error } = await supabase.functions.invoke("trocas-reembolso", {
        body: { acao, reembolso_id: r.id },
      });
      const corpo = error ? await lerErroFuncao(error) : data;
      if (corpo?.reembolso) concluir(corpo.reembolso);
      else qc.invalidateQueries({ queryKey: ["trocas-reembolsos"] });

      if (acao === "verificar_titular") {
        if (error || corpo?.erro) {
          setErroTitular({ erro: corpo?.erro ?? "Não deu certo", dica: corpo?.dica });
          toast.error(corpo?.erro ?? "Não foi possível verificar o titular");
        } else {
          setErroTitular(null);
          toast.success("Titular verificado");
        }
        return;
      }
      if (corpo?.resultado === "enviado") toast.success("Pix enviado");
      else if (corpo?.resultado === "incerto")
        toast.warning("Sem confirmação imediata; o status atualiza sozinho em até 10 minutos");
      else toast.error(corpo?.erro ?? "O Pix falhou");
    } finally {
      trava.current = false;
      setOcupado(null);
    }
  }

  const podeExecutar = !!operador?.pode_executar;
  const podeAprovar = !!operador?.pode_aprovar;
  const aprovaEste =
    podeAprovar && (!config?.aprovacao_dupla || (operador?.user_id && operador.user_id !== r?.criado_por));
  const alertaPix = Array.isArray(r?.alerta_pix_anterior) && r.alerta_pix_anterior.length > 0;
  const precisaJustificativa = (r?.titular_veredito && r.titular_veredito !== "confere") || alertaPix;
  const ehPix = (r?.rota ?? rota) === "pix_chave";

  const blocoTitular = r?.titular_veredito ? (
    <div className={`rounded-md border p-3 text-sm ${corVeredito(r.titular_veredito)}`}>
      <p className="font-medium">
        Titular no banco: {r.titular_banco ?? "-"}
        {r.titular_documento_masc ? ` · ${r.titular_documento_masc}` : ""}
      </p>
      <p className="text-xs">
        {r.titular_veredito === "confere" ? "Confere" : r.titular_veredito === "parcial" ? "Confere em parte" : "Divergente"}
        {r.titular_motivo ? ` · ${r.titular_motivo}` : ""}
      </p>
    </div>
  ) : null;

  return (
    <div className="space-y-4 border-t border-border pt-4">
      {r?.status === "rascunho" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Valor <span className="text-xs text-muted-foreground">(máx. {brl(r.valor_maximo)})</span></Label>
            <Input type="number" step="0.01" min="0" max={r.valor_maximo ?? undefined} value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Rota</Label>
            <Select value={rota} onValueChange={setRota}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROTAS.map((o) => <SelectItem key={o.v} value={o.v}>{o.r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {rota === "pix_chave" && (
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <div className="space-y-1">
                <Label>Tipo da chave</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Chave Pix</Label>
                <Input value={chave} onChange={(e) => setChave(e.target.value)} />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <Button
            size="sm"
            disabled={!!ocupado}
            onClick={() => {
              const n = Number(valor);
              if (!Number.isFinite(n) || n <= 0) return toast.error("Informe um valor válido");
              if (r.valor_maximo != null && n > Number(r.valor_maximo)) return toast.error(`O valor máximo é ${brl(r.valor_maximo)}`);
              if (rota === "pix_chave" && !chave.trim()) return toast.error("Informe a chave Pix");
              rpc("fn_reembolso_atualizar", {
                p_id: r.id,
                p_valor: n,
                p_rota: rota,
                p_chave_pix: rota === "pix_chave" ? chave.trim() : null,
                p_tipo_chave: rota === "pix_chave" ? tipo : null,
                p_obs: obs.trim() || null,
              }, "Reembolso salvo");
            }}
          >
            Salvar
          </Button>

          {r.rota === "pix_chave" && r.chave_pix && podeExecutar && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Envia R$ 0,01 para a chave e lê o nome do titular no banco.</p>
              <Button size="sm" variant="outline" disabled={!!ocupado} onClick={() => funcao("verificar_titular")}>
                {ocupado === "verificar_titular" ? "Verificando..." : "Verificar titular da chave"}
              </Button>
            </div>
          )}
          {erroTitular && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <p>{erroTitular.erro}</p>
              {erroTitular.dica && <p className="text-xs">{erroTitular.dica}</p>}
            </div>
          )}
          {blocoTitular}
          {alertaPix && <p className="text-sm text-destructive">Atenção: esta chave Pix já foi usada em outro reembolso.</p>}

          {precisaJustificativa && (
            <div className="space-y-1">
              <Label>Justificativa</Label>
              <Textarea rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!!ocupado || (r.rota === "pix_chave" && !r.titular_veredito) || (precisaJustificativa && !justificativa.trim())}
              onClick={() => rpc("fn_reembolso_solicitar_aprovacao", { p_id: r.id, p_justificativa_titular: justificativa.trim() || null }, "Enviado para aprovação")}
            >
              Enviar para aprovação
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!ocupado}
              onClick={() => {
                const m = window.prompt("Motivo do cancelamento:")?.trim();
                if (m) rpc("fn_reembolso_cancelar", { p_id: r.id, p_motivo: m }, "Reembolso cancelado");
              }}
            >
              Cancelar reembolso
            </Button>
          </div>
          {r.rota === "pix_chave" && !r.titular_veredito && (
            <p className="text-xs text-muted-foreground">Para Pix, verifique o titular antes de enviar para aprovação.</p>
          )}
        </div>
      )}

      {r?.status === "aguardando_aprovacao" && (
        <div className="space-y-3 text-sm">
          <p><span className="text-muted-foreground">Pedido por:</span> {r.criado_por_email ?? "-"}</p>
          {r.justificativa_titular && <p><span className="text-muted-foreground">Justificativa:</span> {r.justificativa_titular}</p>}
          {blocoTitular}
          {aprovaEste ? (
            <div className="space-y-2">
              <Label>Digite o valor para aprovar</Label>
              <Input type="number" step="0.01" value={valorConferido} onChange={(e) => setValorConferido(e.target.value)} />
              <Button
                size="sm"
                disabled={!!ocupado || !valorConferido}
                onClick={() => rpc("fn_reembolso_aprovar", { p_id: r.id, p_valor_conferido: Number(valorConferido) }, "Reembolso aprovado")}
              >
                Aprovar
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">Aguardando aprovação de outra pessoa</p>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={!!ocupado}
            onClick={() => {
              const m = window.prompt("Motivo para devolver ao rascunho:")?.trim();
              if (m) rpc("fn_reembolso_devolver", { p_id: r.id, p_motivo: m }, "Devolvido para rascunho");
            }}
          >
            Devolver para rascunho
          </Button>
        </div>
      )}

      {r?.status === "aprovado" && (
        <div className="space-y-3 text-sm">
          {blocoTitular}
          {ehPix && podeExecutar && (
            <Button
              disabled={!!ocupado}
              onClick={() => {
                const ok = window.confirm(
                  `O Pix sai na hora e não tem volta. Chave: ${r.chave_pix ?? "-"} · Titular: ${r.titular_banco ?? "-"}`,
                );
                if (ok) funcao("executar");
              }}
            >
              {ocupado === "executar" ? "Enviando..." : `Enviar Pix de ${brl(r.valor)}`}
            </Button>
          )}
          {!ehPix && podeExecutar && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Faça o estorno no painel da Vindi antes de registrar.</p>
              <div className="space-y-1">
                <Label>Comprovante</Label>
                <Input placeholder="Id do estorno na Vindi ou observação" value={comprovante} onChange={(e) => setComprovante(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Data e hora</Label>
                <Input type="datetime-local" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
              </div>
              <Button
                size="sm"
                disabled={!!ocupado || !comprovante.trim() || !pagoEm}
                onClick={() => rpc("fn_reembolso_registrar_manual", {
                  p_id: r.id,
                  p_comprovante: comprovante.trim(),
                  p_pago_em: new Date(pagoEm).toISOString(),
                }, "Estorno registrado")}
              >
                Registrar estorno feito
              </Button>
            </div>
          )}
          {!podeExecutar && <p className="text-muted-foreground">Aprovado. Aguardando quem pode executar o pagamento.</p>}
        </div>
      )}

      {r?.status === "executando" && (
        <p className="text-sm">Pix enviado, aguardando confirmação do banco{r.pix_status ? ` · ${r.pix_status}` : ""}</p>
      )}

      {r?.status === "pago" && (
        <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Pago em:</span> {dataHora(r.pago_em)}</p>
          {r.end_to_end && <p><span className="text-muted-foreground">End to end:</span> {r.end_to_end}</p>}
          {r.comprovante_manual && <p><span className="text-muted-foreground">Comprovante:</span> {r.comprovante_manual}</p>}
          {r.tray_nota_em && <p>Pedido marcado na Tray em {dataHora(r.tray_nota_em)}</p>}
        </div>
      )}

      {r?.status === "falhou" && <p className="text-sm text-destructive">{r.erro ?? "Falhou"}</p>}
      {r?.status === "cancelado" && (
        <p className="text-sm"><span className="text-muted-foreground">Motivo:</span> {r.cancelado_motivo ?? "-"}</p>
      )}
    </div>
  );
}
