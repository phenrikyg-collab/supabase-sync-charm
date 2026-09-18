import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";

type Edicao = {
  de?: string | null;
  para?: string | null;
  por?: string | null;
  em?: string | null;
  motivo?: string | null;
};

type Conferencia = {
  conversa_id: number | string;
  nome?: string | null;
  telefone?: string | null;
  telefone_real?: string | null;
  forma_atual?: string | null;
  forma_alternativa?: string | null;
  escreveu_para_nos?: boolean | null;
  kora_forma_atual?: boolean | null;
  kora_forma_alternativa?: boolean | null;
  formato_valido?: boolean | null;
  falhas?: number | null;
  ultima_falha?: string | null;
  ultimo_erro?: string | null;
  edicoes?: Edicao[] | null;
};

const digitos = (t?: string | null) => String(t ?? "").replace(/\D/g, "");

/** Máscara brasileira simples a partir dos dígitos digitados ou colados. */
export function mascaraTelefone(valor: string): string {
  const d = digitos(valor).slice(0, 13);
  if (d.length <= 2) return d;
  if (d.startsWith("55") && d.length > 11) {
    const ddd = d.slice(2, 4);
    const resto = d.slice(4);
    if (resto.length <= 4) return `+55 (${ddd}) ${resto}`;
    if (resto.length <= 8) return `+55 (${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
    return `+55 (${ddd}) ${resto.slice(0, 5)}-${resto.slice(5, 9)}`;
  }
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (!resto) return `(${ddd}`;
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  if (resto.length <= 8) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5, 9)}`;
}

function dataHora(valor?: string | null): string {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function LinhaEvidencia({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {ok ? (
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
      ) : (
        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{texto}</span>
    </div>
  );
}

export function ConferirNumeroDialog({
  open,
  onOpenChange,
  conversaId,
  autor,
  onAbrirConversa,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversaId: number | string;
  autor?: string | null;
  onAbrirConversa?: (id: number | string) => void;
}) {
  const queryClient = useQueryClient();
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [conversaExistente, setConversaExistente] = useState<number | string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-numero-conferencia", String(conversaId)],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_numero_conferencia" as any, {
        p_conversa_id: Number.isNaN(Number(conversaId)) ? conversaId : Number(conversaId),
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as Conferencia;
    },
  });

  useEffect(() => {
    if (!open) return;
    setErro(null);
    setConversaExistente(null);
    setMotivo("");
  }, [open]);

  useEffect(() => {
    if (open && data?.forma_atual) setValor(mascaraTelefone(String(data.forma_atual)));
  }, [open, data?.forma_atual]);

  const edicoes = Array.isArray(data?.edicoes) ? (data?.edicoes as Edicao[]) : [];

  const salvar = async () => {
    const novo = digitos(valor);
    if (!novo) return;
    setSalvando(true);
    setErro(null);
    setConversaExistente(null);
    const { data: resp, error } = await chamarRpc("whatsapp_telefone_editar" as any, {
      p_conversa_id: Number.isNaN(Number(conversaId)) ? conversaId : Number(conversaId),
      p_telefone_novo: novo,
      p_motivo: motivo.trim() || null,
      p_por: autor ?? null,
    });
    setSalvando(false);

    if (error) {
      setErro(error.message ?? "Não foi possível salvar o número.");
      return;
    }
    const r: any = Array.isArray(resp) ? resp[0] : resp;
    if (r?.ok) {
      if (r.resultado === "sem_mudanca") {
        toast({ title: "O número já era esse" });
      } else {
        toast({ title: "Número corrigido" });
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversa"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-numero-conferencia", String(conversaId)] });
      onOpenChange(false);
      return;
    }
    setErro(String(r?.erro ?? "Não foi possível salvar o número."));
    if (r?.conversa_existente != null) setConversaExistente(r.conversa_existente);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Conferir número</DialogTitle>
          <DialogDescription>
            Veja as evidências antes de corrigir o telefone desta cliente.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando
          </div>
        )}

        {data && (
          <div className="space-y-5">
            <section className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">O que temos</p>
              <p className="text-sm">
                Telefone cadastrado: <span className="font-medium">{data.telefone || "sem número"}</span>
              </p>
              {data.telefone_real && digitos(data.telefone_real) !== digitos(data.telefone) && (
                <p className="rounded-md border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success">
                  A Meta entrega neste: {data.telefone_real}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {qtdDigitos} dígito{qtdDigitos === 1 ? "" : "s"} no número atual.
              </p>
              {tamanhoEstranho && (
                <p className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Número com {qtdDigitos} dígitos. O padrão é 12 ou 13 (55 + DDD + número). Provavelmente falta um dígito.
                </p>
              )}
            </section>

            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Evidência</p>
              <LinhaEvidencia
                ok={!!data.escreveu_para_nos}
                texto={data.escreveu_para_nos ? "A cliente já escreveu deste número" : "Nunca escreveu deste número"}
              />
              <LinhaEvidencia
                ok={!!data.kora_forma_atual}
                texto={
                  data.kora_forma_atual
                    ? "Esse número aparece no histórico da Kora"
                    : "Não aparece no histórico da Kora"
                }
              />
              {data.forma_alternativa && (
                <LinhaEvidencia
                  ok={!!data.kora_forma_alternativa}
                  texto={
                    data.kora_forma_alternativa
                      ? `A forma ${data.forma_alternativa} aparece na Kora`
                      : `A forma ${data.forma_alternativa} não aparece na Kora`
                  }
                />
              )}
              {Number(data.falhas ?? 0) > 0 && (
                <p className="flex items-start gap-2 text-xs font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {data.falhas} mensagem{Number(data.falhas) === 1 ? "" : "ns"} não entregue
                  {Number(data.falhas) === 1 ? "" : "s"}
                  {data.ultima_falha ? `, a última em ${dataHora(data.ultima_falha)}` : ""}
                </p>
              )}
              {data.ultimo_erro && (
                <details className="rounded-md border border-border bg-muted/40 px-2 py-1.5">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Erro que a Meta devolveu
                  </summary>
                  <pre className="mt-1.5 whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                    {data.ultimo_erro}
                  </pre>
                </details>
              )}
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Check verde em qualquer linha da Kora ou em "já escreveu" significa que o número existe de verdade.
                Tudo cinza com falha vermelha significa número provavelmente errado.
              </p>
            </section>

            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Corrigir</p>
              <div className="space-y-1.5">
                <Label htmlFor="conferir-telefone" className="text-xs">Telefone</Label>
                <Input
                  id="conferir-telefone"
                  inputMode="tel"
                  value={valor}
                  onChange={(e) => setValor(mascaraTelefone(e.target.value))}
                  placeholder="+55 (11) 99999-9999"
                />
              </div>
              {data.forma_alternativa && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setValor(mascaraTelefone(String(data.forma_alternativa)))}
                >
                  Usar {data.forma_alternativa}
                </Button>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="conferir-motivo" className="text-xs">Motivo (opcional)</Label>
                <Input
                  id="conferir-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="cliente confirmou por telefone, veio do pedido na Tray"
                />
              </div>
              {erro && (
                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5">
                  <p className="text-xs font-medium text-destructive">{erro}</p>
                  {conversaExistente != null && onAbrirConversa && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        onOpenChange(false);
                        onAbrirConversa(conversaExistente);
                      }}
                    >
                      Abrir a outra conversa
                    </Button>
                  )}
                </div>
              )}
            </section>

            {edicoes.length > 0 && (
              <section className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Histórico</p>
                {edicoes.map((e, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">
                    {e.de} para {e.para}, por {e.por || "sem autor"}, em {dataHora(e.em)}.
                    {e.motivo ? ` ${e.motivo}` : ""}
                  </p>
                ))}
              </section>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !digitos(valor)}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar número
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
