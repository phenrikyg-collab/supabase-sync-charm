import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Loader2, Copy, Check, Info, ExternalLink } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip,
} from "recharts";
import {
  crmDestinosListar, crmDestinoDefinir, crmDestinoMetricas, avisoDestino, CrmPorta,
} from "@/lib/crmLinks";

function fmtDataHora(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function BotaoCopiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(texto);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
    >
      {ok ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function NovaPortaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [destino, setDestino] = useState("");
  const aviso = avisoDestino(destino);

  const criar = useMutation({
    mutationFn: () => crmDestinoDefinir({ slug, destino, nome }),
    onSuccess: () => {
      toast({ title: "Porta criada" });
      qc.invalidateQueries({ queryKey: ["crm-portas"] });
      onOpenChange(false);
      setNome(""); setSlug(""); setDestino("");
    },
    onError: (e: any) => toast({ title: "Erro ao criar porta", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Criar porta</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Cada porta nova exige um template novo aprovado na Meta, porque a URL do botão é
              estática. Não é para criar uma porta por campanha — o normal é reaproveitar a mesma.
            </AlertDescription>
          </Alert>
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Oferta principal" />
          </div>
          <div>
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="ir"
            />
            <p className="text-xs text-muted-foreground mt-1">
              A URL final fica https://oferta.usemarianacardoso.com.br/{slug || "slug"}
            </p>
          </div>
          <div>
            <Label>Destino inicial</Label>
            <Input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="https://www.usemarianacardoso.com.br/sale-elegant"
            />
            {aviso && <p className="text-xs text-amber-600 mt-1">{aviso}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => criar.mutate()} disabled={!slug || !destino || criar.isPending}>
            {criar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar porta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PainelMetricas({ porta, onOpenChange }: { porta: CrmPorta | null; onOpenChange: (v: boolean) => void }) {
  const [dias, setDias] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ["crm-porta-metricas", porta?.slug, dias],
    queryFn: () => crmDestinoMetricas(porta!.slug, dias),
    enabled: !!porta,
  });

  const serie = (data?.por_dia ?? []).map((d) => ({
    dia: String(d.dia ?? d.data ?? "").slice(5),
    cliques: Number(d.cliques ?? 0),
    visitantes: Number(d.visitantes ?? 0),
  }));

  return (
    <Dialog open={!!porta} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{porta?.nome || porta?.slug} — desempenho</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>
              {d} dias
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Destino atual:{" "}
              {data?.destino_atual ? (
                <a href={data.destino_atual} target="_blank" rel="noreferrer" className="underline">
                  {data.destino_atual}
                </a>
              ) : "—"}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3">
                <p className="text-[11px] uppercase text-muted-foreground">Cliques</p>
                <p className="text-2xl font-serif">{data?.cliques ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">inclui recarga e clique repetido</p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] uppercase text-muted-foreground">Visitantes únicos</p>
                <p className="text-2xl font-serif">{data?.visitantes ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">pessoas distintas pelo cookie</p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] uppercase text-muted-foreground">Mobile</p>
                <p className="text-2xl font-serif">
                  {data?.mobile != null ? `${Number(data.mobile).toFixed(0)}%` : "—"}
                </p>
              </Card>
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="dia" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <RTooltip />
                  <Bar dataKey="cliques" name="Cliques" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="visitantes" name="Visitantes únicos" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LinhaDestinoEditavel({ porta }: { porta: CrmPorta }) {
  const qc = useQueryClient();
  const [valor, setValor] = useState(porta.destino ?? "");
  const [editando, setEditando] = useState(false);
  const aviso = avisoDestino(valor);

  const salvar = useMutation({
    mutationFn: () => crmDestinoDefinir({ slug: porta.slug, destino: valor, nome: porta.nome }),
    onSuccess: () => {
      toast({ title: "Destino atualizado", description: `A porta /${porta.slug} agora aponta para o novo endereço.` });
      qc.invalidateQueries({ queryKey: ["crm-portas"] });
      setEditando(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (!editando) {
    return (
      <div className="flex items-center gap-2">
        {porta.destino ? (
          <a
            href={porta.destino}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline max-w-[280px] truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {porta.destino}
          </a>
        ) : <span className="text-sm text-muted-foreground">—</span>}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => { e.stopPropagation(); setEditando(true); }}
        >
          Trocar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex gap-2">
        <Input value={valor} onChange={(e) => setValor(e.target.value)} className="h-8 text-sm" />
        <Button size="sm" className="h-8" onClick={() => salvar.mutate()} disabled={!valor || salvar.isPending}>
          {salvar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={() => { setValor(porta.destino ?? ""); setEditando(false); }}>
          Cancelar
        </Button>
      </div>
      {aviso && <p className="text-xs text-amber-600">{aviso}</p>}
    </div>
  );
}

export function PortasTab() {
  const [nova, setNova] = useState(false);
  const [detalhe, setDetalhe] = useState<CrmPorta | null>(null);

  const { data: portas = [], isLoading } = useQuery({
    queryKey: ["crm-portas"],
    queryFn: crmDestinosListar,
  });

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          A URL do botão da mensagem nunca muda — quem muda é para onde ela aponta. Cada porta é um
          endereço fixo aprovado uma vez na Meta; a campanha só troca o destino por trás.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button onClick={() => setNova(true)}><Plus className="h-4 w-4 mr-2" /> Criar porta</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : portas.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhuma porta cadastrada ainda.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Porta</TableHead>
                <TableHead>URL fixa</TableHead>
                <TableHead>Destino atual</TableHead>
                <TableHead>Em uso por</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead>Última alteração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portas.map((p) => (
                <TableRow
                  key={p.slug}
                  className="cursor-pointer"
                  onClick={() => setDetalhe(p)}
                >
                  <TableCell>
                    <p className="font-medium">{p.nome || p.slug}</p>
                    <p className="text-xs text-muted-foreground">/{p.slug}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono max-w-[220px] truncate">{p.url ?? "—"}</span>
                      {p.url && <BotaoCopiar texto={p.url} />}
                    </div>
                  </TableCell>
                  <TableCell><LinhaDestinoEditavel porta={p} /></TableCell>
                  <TableCell>
                    {p.campanha ? <Badge variant="secondary">{p.campanha}</Badge> : <span className="text-xs text-muted-foreground">livre</span>}
                  </TableCell>
                  <TableCell className="text-right">{p.cliques ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDataHora(p.atualizado_em)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <ExternalLink className="h-3 w-3" />
        Trocar o destino aqui vale imediatamente para quem clicar — use para régua e disparo avulso,
        fora de campanha.
      </p>

      <NovaPortaDialog open={nova} onOpenChange={setNova} />
      <PainelMetricas porta={detalhe} onOpenChange={(v) => !v && setDetalhe(null)} />
    </div>
  );
}
