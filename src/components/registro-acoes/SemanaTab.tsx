import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowDown, ArrowUp, ChevronDown, Info, Ruler } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  CLASSE_SINAL, acoesCustosSemana, acoesPainelSemana, brl, corDriver, dec, ddmm,
  inteiro, isNil, ORIGENS_AUTOMATICAS, rotuloDe, valorPorUnidade, type AcoesOpcoes,
} from "@/lib/registroAcoes";

type Props = {
  semana: string;
  opcoes: AcoesOpcoes;
  onAbrirAcao: (acao: any) => void;
  onNovaAcao: () => void;
  onDados?: (d: any) => void;
};

export default function SemanaTab({ semana, opcoes, onAbrirAcao, onNovaAcao, onDados }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogCustos, setDialogCustos] = useState(false);
  const [vip, setVip] = useState("");
  const [imp, setImp] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["acoes", "painel-semana", semana],
    queryFn: async () => {
      const d = await acoesPainelSemana(semana);
      const raiz = Array.isArray(d) ? d[0] ?? {} : d ?? {};
      onDados?.(raiz);
      return raiz;
    },
    enabled: !!semana,
  });

  const resumo = data?.semana ?? {};
  const qualidade = resumo?.qualidade ?? {};
  const drivers: any[] = useMemo(
    () => [...(data?.drivers ?? [])].sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0)),
    [data],
  );

  const grupos = useMemo(() => {
    const acoes: any[] = data?.acoes ?? [];
    const ordem = opcoes.drivers.map((d) => d.valor);
    const lista = ordem
      .map((chave) => ({
        chave,
        nome: rotuloDe(opcoes.drivers, chave),
        itens: acoes.filter((a) => String(a.driver_alvo ?? "") === chave),
      }))
      .filter((g) => g.itens.length > 0);
    const semDriver = acoes.filter((a) => !ordem.includes(String(a.driver_alvo ?? "")));
    if (semDriver.length) lista.push({ chave: "", nome: "Sem driver", itens: semDriver });
    return lista;
  }, [data, opcoes.drivers]);

  const salvarCustos = useMutation({
    mutationFn: () =>
      acoesCustosSemana(
        semana,
        vip === "" ? null : Number(vip),
        imp === "" ? null : Number(imp),
      ),
    onSuccess: () => {
      toast({ title: "Valores da semana lançados" });
      qc.invalidateQueries({ queryKey: ["acoes"] });
      setDialogCustos(false);
    },
    onError: (e: any) =>
      toast({ title: "Não deu para lançar", description: e.message, variant: "destructive" }),
  });

  const abrirCustos = () => {
    const dv = drivers.find((d) => d.chave === "invest_vip" || d.driver === "invest_vip");
    const di = drivers.find((d) => d.chave === "invest_imp" || d.driver === "invest_imp");
    setVip(isNil(dv?.valor) ? "" : String(dv.valor));
    setImp(isNil(di?.valor) ? "" : String(di.valor));
    setDialogCustos(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return <Card className="p-6 text-sm text-destructive">Não deu para carregar a semana: {(error as Error).message}</Card>;
  }

  return (
    <div className="space-y-6">
      {resumo?.parcial && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Semana em curso. Os números ainda vão mudar.
        </div>
      )}
      {qualidade?.ga4_incompleto && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          GA4 cobre {inteiro(qualidade.sessoes_dias_cobertos)} dias; conversão e CPS consideram só esses dias.
        </div>
      )}

      {/* FAIXA A */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Receita faturada</div>
          <div className="text-xl font-semibold">{brl(resumo.receita_faturada)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pedidos faturados</div>
          <div className="text-xl font-semibold">{inteiro(resumo.pedidos_faturados)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">ROAS</div>
          <div className="text-xl font-semibold">{isNil(resumo.roas) ? "sem dados" : dec(resumo.roas, 2)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">CAC novos</div>
          <div className="text-xl font-semibold">{isNil(resumo.cac_novos) ? "sem dados" : brl(resumo.cac_novos)}</div>
        </Card>
      </div>

      {/* FAIXA B */}
      <TooltipProvider>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {drivers.map((d: any) => {
            const chave = String(d.chave ?? d.driver ?? "");
            const meta = opcoes.drivers.find((o) => o.valor === chave);
            const sentido = isNil(d.sentido) ? meta?.sentido : d.sentido;
            const cor = corDriver(sentido, d.z);
            const delta = d.delta_base_pct;
            const ehVip = chave === "invest_vip";
            const ehImp = chave === "invest_imp";
            const fonte = ehVip ? qualidade.fonte_invest_vip : ehImp ? qualidade.fonte_invest_imp : null;
            return (
              <Card key={chave} className="p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{d.nome ?? meta?.rotulo ?? chave}</div>
                  {(meta?.definicao || d.definicao) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {meta?.definicao ?? d.definicao}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className={`text-2xl font-semibold ${cor.classe}`}>
                  {valorPorUnidade(d.valor, d.unidade ?? meta?.unidade)}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                  <span>Base 4 sem: {valorPorUnidade(d.media_4s, d.unidade ?? meta?.unidade)}</span>
                  {!isNil(delta) && (
                    <span className={`inline-flex items-center gap-0.5 ${cor.classe}`}>
                      {Number(delta) >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {dec(delta, 2)}%
                    </span>
                  )}
                </div>
                {!isNil(d.plano) && (
                  <div className="text-xs text-muted-foreground">
                    Plano: {valorPorUnidade(d.plano, d.unidade ?? meta?.unidade)}
                  </div>
                )}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {cor.etiqueta && <Badge variant="outline" className="text-[10px]">{cor.etiqueta}</Badge>}
                  {fonte === "modulo_vip" && <Badge variant="outline" className="text-[10px]">módulo VIP</Badge>}
                  {fonte === "rateio_plano" && <Badge variant="outline" className="text-[10px]">estimado</Badge>}
                  {fonte === "manual" && <Badge variant="outline" className="text-[10px]">manual</Badge>}
                </div>
                {(ehVip || ehImp) && (
                  <button
                    className="text-xs text-primary underline underline-offset-2"
                    onClick={abrirCustos}
                  >
                    Lançar valor da semana
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      </TooltipProvider>

      {/* FAIXA C */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg">Ações da semana</h2>
          <Button size="sm" onClick={onNovaAcao}>Nova ação</Button>
        </div>

        {grupos.length === 0 && (
          <Card className="p-8 text-center space-y-3 border-dashed">
            <div className="text-sm text-muted-foreground">Nenhuma ação registrada nesta semana.</div>
            <Button onClick={onNovaAcao}>Nova ação</Button>
          </Card>
        )}

        {grupos.map((g) => {
          const manuais = g.itens.filter((a) => !ORIGENS_AUTOMATICAS.includes(String(a.origem ?? "")));
          const automaticas = g.itens.filter((a) => ORIGENS_AUTOMATICAS.includes(String(a.origem ?? "")));
          return (
            <Card key={g.chave || "sem-driver"} className="p-4 space-y-2">
              <div className="text-sm font-medium">{g.nome}</div>
              <div className="divide-y">
                {manuais.map((a) => <LinhaAcao key={a.id} acao={a} opcoes={opcoes} onAbrir={onAbrirAcao} />)}
              </div>
              {automaticas.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground pt-2">
                    <ChevronDown className="h-3.5 w-3.5" />
                    Rotina automática ({automaticas.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="divide-y">
                    {automaticas.map((a) => <LinhaAcao key={a.id} acao={a} opcoes={opcoes} onAbrir={onAbrirAcao} />)}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogCustos} onOpenChange={setDialogCustos}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Lançar valor da semana</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Investimento no Grupo VIP</Label>
              <Input type="number" step="0.01" value={vip} onChange={(e) => setVip(e.target.value)} />
            </div>
            <div>
              <Label>Investimento em impulsionamento</Label>
              <Input type="number" step="0.01" value={imp} onChange={(e) => setImp(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCustos(false)}>Cancelar</Button>
            <Button disabled={salvarCustos.isPending} onClick={() => salvarCustos.mutate()}>
              {salvarCustos.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function LinhaAcao({
  acao, opcoes, onAbrir,
}: { acao: any; opcoes: AcoesOpcoes; onAbrir: (a: any) => void }) {
  const sinal = String(acao.sinal ?? "");
  return (
    <TooltipProvider>
      <button
        onClick={() => onAbrir(acao)}
        className="w-full text-left py-2 flex flex-wrap items-center gap-2 hover:bg-muted/50 px-1 rounded"
      >
        <span className="text-xs text-muted-foreground w-12 shrink-0">
          {ddmm(acao.data_inicio ?? acao.data)}
        </span>
        <span className="text-sm font-medium">{acao.titulo}</span>
        {(acao.canais ?? []).map((c: string) => (
          <Badge key={c} variant="outline" className="text-[10px]">{rotuloDe(opcoes.canais, c)}</Badge>
        ))}
        {acao.tipo && <Badge variant="secondary" className="text-[10px]">{rotuloDe(opcoes.tipos, acao.tipo)}</Badge>}
        {sinal && (
          <Badge className={`text-[10px] border ${CLASSE_SINAL[sinal] ?? CLASSE_SINAL.sem_base}`} variant="outline">
            {rotuloDe(opcoes.sinais, sinal)}
          </Badge>
        )}
        {Number(acao.acoes_concorrentes ?? 0) > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {inteiro(acao.acoes_concorrentes)} concorrentes
          </span>
        )}
        {acao.semana_com_mudanca_medicao && (
          <Tooltip>
            <TooltipTrigger asChild><Ruler className="h-3.5 w-3.5 text-amber-600" /></TooltipTrigger>
            <TooltipContent>
              Houve mudança de medição nesta semana; leia o efeito com cuidado
            </TooltipContent>
          </Tooltip>
        )}
        {acao.leitura_humana && (
          <span className="text-[11px] text-muted-foreground w-full">{acao.leitura_humana}</span>
        )}
      </button>
    </TooltipProvider>
  );
}
