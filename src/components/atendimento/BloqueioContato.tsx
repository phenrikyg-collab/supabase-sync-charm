import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chamarRpc } from "@/lib/supabaseRpc";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Ban, Search, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type EscopoBloqueio = "total" | "automacoes";

export type Bloqueio = {
  bloqueado: boolean;
  escopo: EscopoBloqueio | null;
  motivo?: string | null;
  origem?: string | null;
  por?: string | null;
  desde?: string | null;
};

export type LinhaBloqueio = {
  telefone: string;
  escopo: EscopoBloqueio;
  motivo: string | null;
  origem: string | null;
  por: string | null;
  desde: string | null;
  nome: string | null;
  conversa_id: number | string | null;
};

export const ROTULO_ESCOPO: Record<EscopoBloqueio, string> = {
  total: "Bloqueio total",
  automacoes: "Fora das automações",
};

function formatarQuando(valor?: string | null): string {
  if (!valor) return "-";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Lê a mensagem pronta do servidor quando o envio é barrado por bloqueio. */
export async function extrairErroBloqueio(error: unknown): Promise<string | null> {
  try {
    const resp = (error as { context?: { json?: () => Promise<unknown>; clone?: () => Response } })?.context;
    if (resp && typeof resp.clone === "function") {
      const corpo = (await resp.clone().json()) as { error?: string; mensagem?: string };
      if (corpo?.error === "contato_bloqueado") {
        return corpo.mensagem || "Esse contato está bloqueado: nada é enviado para ela.";
      }
    }
  } catch {
    /* ignora */
  }
  return null;
}

/** Bloqueio da conversa aberta. */
export function useBloqueioConversa(conversaId?: number | string | null) {
  return useQuery({
    queryKey: ["whatsapp-bloqueio-conversa", String(conversaId ?? "")],
    enabled: !!conversaId,
    queryFn: async (): Promise<Bloqueio> => {
      const { data } = await chamarRpc<Bloqueio>("whatsapp_conversa_bloqueio" as never, {
        p_conversa_id: Number(conversaId),
      });
      const linha = (Array.isArray(data) ? data[0] : data) as Bloqueio | null;
      return linha ?? { bloqueado: false, escopo: null };
    },
  });
}

/** Lista de bloqueios, também usada para o selo dos cards. */
export function useBloqueios(busca = "", limite = 500) {
  return useQuery({
    queryKey: ["whatsapp-bloqueios", busca, limite],
    queryFn: async (): Promise<LinhaBloqueio[]> => {
      const { data } = await chamarRpc<LinhaBloqueio[]>("whatsapp_bloqueios_listar" as never, {
        p_busca: busca || null,
        p_limite: limite,
      });
      return (data ?? []) as LinhaBloqueio[];
    },
  });
}

/** Conjuntos de telefones e conversas bloqueadas, por escopo. */
export function useMapaBloqueios() {
  const { data = [] } = useBloqueios("", 1000);
  return useMemo(() => {
    const porConversa = new Map<string, EscopoBloqueio>();
    const porTelefone = new Map<string, EscopoBloqueio>();
    for (const b of data) {
      if (b.conversa_id != null) porConversa.set(String(b.conversa_id), b.escopo);
      if (b.telefone) porTelefone.set(String(b.telefone).replace(/\D/g, ""), b.escopo);
    }
    return { porConversa, porTelefone };
  }, [data]);
}

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["whatsapp-bloqueio-conversa"] });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-bloqueios"] });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversa"] });
  };
}

export function useDesbloquear() {
  const { user } = useAuth();
  const invalidar = useInvalidar();
  const [salvando, setSalvando] = useState(false);
  const desbloquear = async (telefone: string) => {
    setSalvando(true);
    const { data, error } = await chamarRpc<{ ok?: boolean; motivo?: string }>(
      "whatsapp_contato_desbloquear" as never,
      { p_telefone: telefone, p_por: user?.email ?? null },
    );
    setSalvando(false);
    const resposta = (Array.isArray(data) ? data[0] : data) as { ok?: boolean; motivo?: string } | null;
    if (error || resposta?.ok === false) {
      toast({
        title: "Não foi possível desbloquear",
        description: error?.message ?? resposta?.motivo ?? "-",
        variant: "destructive",
      });
      return false;
    }
    invalidar();
    toast({ title: "Contato desbloqueado" });
    return true;
  };
  return { desbloquear, salvando };
}

export function DialogBloquearContato({
  aberto, onOpenChange, telefone,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  telefone: string | null;
}) {
  const { user } = useAuth();
  const invalidar = useInvalidar();
  const [escopo, setEscopo] = useState<EscopoBloqueio>("total");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    if (!telefone) return;
    setSalvando(true);
    const { data, error } = await chamarRpc<{ ok?: boolean; motivo?: string }>(
      "whatsapp_contato_bloquear" as never,
      {
        p_telefone: telefone,
        p_escopo: escopo,
        p_motivo: motivo.trim() || null,
        p_por: user?.email ?? null,
        p_origem: "painel",
      },
    );
    setSalvando(false);
    const resposta = (Array.isArray(data) ? data[0] : data) as { ok?: boolean; motivo?: string } | null;
    if (error || resposta?.ok === false) {
      toast({
        title: "Não foi possível bloquear",
        description: error?.message ?? resposta?.motivo ?? "-",
        variant: "destructive",
      });
      return;
    }
    invalidar();
    onOpenChange(false);
    setMotivo("");
    toast({
      title: escopo === "total" ? "Contato bloqueado" : "Contato fora das automações",
      description:
        escopo === "total"
          ? "Nada mais é enviado para essa cliente."
          : "Campanhas, fluxos e régua não alcançam mais essa cliente.",
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="font-whatsapp">
        <DialogHeader>
          <DialogTitle>Bloquear contato</DialogTitle>
          <DialogDescription>Escolha até onde vai o bloqueio dessa cliente.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={escopo} onValueChange={(v) => setEscopo(v as EscopoBloqueio)} className="gap-3">
          <div className="flex items-start gap-3 rounded-md border border-border p-3">
            <RadioGroupItem value="total" id="bloqueio-total" className="mt-1" />
            <Label htmlFor="bloqueio-total" className="cursor-pointer font-normal">
              <span className="block text-sm font-medium">Bloquear tudo</span>
              <span className="block text-xs text-muted-foreground">
                Ninguém fala mais com ela: nem a Anna, nem campanha, nem a atendente. As mensagens dela continuam
                chegando no painel.
              </span>
            </Label>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-border p-3">
            <RadioGroupItem value="automacoes" id="bloqueio-automacoes" className="mt-1" />
            <Label htmlFor="bloqueio-automacoes" className="cursor-pointer font-normal">
              <span className="block text-sm font-medium">Só não receber automações</span>
              <span className="block text-xs text-muted-foreground">
                Sai de campanha, fluxo e régua. O atendimento segue normal: a Anna responde e a atendente escreve à
                vontade.
              </span>
            </Label>
          </div>
        </RadioGroup>
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          rows={2}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void confirmar()} disabled={salvando || !telefone}>
            {salvando ? "Bloqueando..." : "Bloquear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Faixa fina no topo da conversa bloqueada. */
export function FaixaBloqueio({ bloqueio, telefone }: { bloqueio: Bloqueio; telefone: string | null }) {
  const { desbloquear, salvando } = useDesbloquear();
  if (!bloqueio?.bloqueado || !bloqueio.escopo) return null;
  const total = bloqueio.escopo === "total";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-xs",
        total ? "border-danger/30 bg-danger/10 text-danger" : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      {total ? <Ban className="h-3.5 w-3.5 shrink-0" /> : <ShieldOff className="h-3.5 w-3.5 shrink-0" />}
      <span className="min-w-0 flex-1 truncate" title={bloqueio.motivo ?? undefined}>
        {total
          ? "Contato bloqueado - nada é enviado para ela"
          : "Fora das automações - campanhas e fluxos não alcançam essa cliente"}
        {bloqueio.motivo ? ` · ${bloqueio.motivo}` : ""}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 shrink-0 px-2 text-[11px]"
        disabled={salvando || !telefone}
        onClick={() => telefone && void desbloquear(telefone)}
      >
        Desbloquear
      </Button>
    </div>
  );
}

/** Aba "Bloqueios" da tela de Atendimento. */
export function BloqueiosTab() {
  const [busca, setBusca] = useState("");
  const { data = [], isLoading } = useBloqueios(busca, 200);
  const { desbloquear, salvando } = useDesbloquear();

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="pl-8"
        />
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando bloqueios...</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum contato bloqueado.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Nome</th>
                <th className="px-3 py-2 text-left font-medium">Telefone</th>
                <th className="px-3 py-2 text-left font-medium">Nível</th>
                <th className="px-3 py-2 text-left font-medium">Motivo</th>
                <th className="px-3 py-2 text-left font-medium">Quem bloqueou</th>
                <th className="px-3 py-2 text-left font-medium">Desde</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={`${b.telefone}-${b.escopo}`} className="border-t border-border">
                  <td className="px-3 py-2">{b.nome || "-"}</td>
                  <td className="px-3 py-2">{b.telefone}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px]",
                        b.escopo === "total"
                          ? "border-danger/30 bg-danger/10 text-danger"
                          : "border-warning/30 bg-warning/10 text-warning",
                      )}
                    >
                      {ROTULO_ESCOPO[b.escopo] ?? b.escopo}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{b.motivo || "-"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{b.por || "-"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatarQuando(b.desde)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      disabled={salvando}
                      onClick={() => void desbloquear(b.telefone)}
                    >
                      Desbloquear
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
