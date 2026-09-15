import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  acoesExcluir, acoesLeitura, brl, dec, ddmmyyyy, isNil, rotuloDe, valorPorUnidade,
  type AcoesOpcoes,
} from "@/lib/registroAcoes";

type Props = {
  acao: any | null;
  onOpenChange: (v: boolean) => void;
  opcoes: AcoesOpcoes;
  onEditar: (acao: any) => void;
};

const legivel = (chave: string) =>
  chave.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export default function AcaoPainel({ acao, onOpenChange, opcoes, onEditar }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [leitura, setLeitura] = useState<string>("");
  const [aprendizado, setAprendizado] = useState<string>("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  useEffect(() => {
    setLeitura(acao?.leitura ?? "");
    setAprendizado(acao?.aprendizado ?? "");
  }, [acao?.id]);

  const driver = opcoes.drivers.find((d) => d.valor === String(acao?.driver_alvo ?? ""));

  const salvarLeitura = useMutation({
    mutationFn: () => acoesLeitura(acao.id, leitura || null, aprendizado || null),
    onSuccess: () => {
      toast({ title: "Leitura salva" });
      qc.invalidateQueries({ queryKey: ["acoes"] });
    },
    onError: (e: any) =>
      toast({ title: "Não deu para salvar", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: () => acoesExcluir(acao.id),
    onSuccess: (r: any) => {
      const texto = typeof r === "string" ? r : r?.resultado ?? r?.status ?? "";
      if (String(texto).includes("cancelada")) {
        toast({ title: "Ação automática marcada como cancelada" });
      } else {
        toast({ title: "Ação excluída" });
      }
      qc.invalidateQueries({ queryKey: ["acoes"] });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Não deu para excluir", description: e.message, variant: "destructive" }),
  });

  const resultado = acao?.resultado_direto && typeof acao.resultado_direto === "object"
    ? acao.resultado_direto
    : null;
  const chavesResultado = resultado ? Object.keys(resultado).filter((k) => k !== "fonte") : [];

  const origemAutomatica =
    acao?.origem && !["manual", "doc_projeto"].includes(String(acao.origem));

  return (
    <>
      <Sheet open={!!acao} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {acao && (
            <>
              <SheetHeader>
                <SheetTitle className="font-serif text-left">{acao.titulo}</SheetTitle>
              </SheetHeader>

              <div className="space-y-5 mt-4">
                <div className="space-y-2 text-sm">
                  <div className="text-muted-foreground">
                    {ddmmyyyy(acao.data_inicio ?? acao.data)}
                    {acao.data_fim ? ` até ${ddmmyyyy(acao.data_fim)}` : ""}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {acao.tipo && <Badge variant="secondary">{rotuloDe(opcoes.tipos, acao.tipo)}</Badge>}
                    {(acao.canais ?? []).map((c: string) => (
                      <Badge key={c} variant="outline">{rotuloDe(opcoes.canais, c)}</Badge>
                    ))}
                    {acao.status && <Badge variant="outline">{rotuloDe(opcoes.status, acao.status)}</Badge>}
                    {origemAutomatica && <Badge variant="outline">Capturada automaticamente</Badge>}
                  </div>
                  {acao.publico && <div><span className="text-muted-foreground">Público: </span>{acao.publico}</div>}
                  {acao.produto_foco && (
                    <div><span className="text-muted-foreground">Produto foco: </span>{acao.produto_foco}</div>
                  )}
                  {acao.referencia && (
                    <div className="break-words"><span className="text-muted-foreground">Referência: </span>{acao.referencia}</div>
                  )}
                  {!isNil(acao.custo) && (
                    <div><span className="text-muted-foreground">Custo: </span>{brl(acao.custo)}</div>
                  )}
                </div>

                {(acao.descricao || acao.hipotese) && (
                  <>
                    <Separator />
                    <div className="space-y-3 text-sm">
                      {acao.descricao && (
                        <div>
                          <div className="font-medium">Descrição</div>
                          <p className="text-muted-foreground whitespace-pre-wrap">{acao.descricao}</p>
                        </div>
                      )}
                      {acao.hipotese && (
                        <div>
                          <div className="font-medium">Hipótese</div>
                          <p className="text-muted-foreground whitespace-pre-wrap">{acao.hipotese}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Separator />
                <div className="space-y-2">
                  <div className="font-medium text-sm">Efeito no driver alvo</div>
                  <div className="text-sm text-muted-foreground">
                    {driver?.rotulo ?? "Sem driver"}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">Valor da semana</div>
                      <div>{valorPorUnidade(acao.valor_semana, driver?.unidade)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Base 4 semanas</div>
                      <div>{valorPorUnidade(acao.base_4s, driver?.unidade)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Variação sobre a base</div>
                      <div>{isNil(acao.delta_base_pct) ? "sem base" : `${dec(acao.delta_base_pct, 2)}%`}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">z da semana</div>
                      <div>{isNil(acao.z_semana) ? "sem base" : dec(acao.z_semana, 2)}</div>
                    </div>
                  </div>
                  <div className="text-sm">
                    Semana seguinte: {valorPorUnidade(acao.valor_semana_seguinte, driver?.unidade)}
                    {!isNil(acao.delta_seguinte_pct) && ` (${dec(acao.delta_seguinte_pct, 2)}%)`}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    O sinal mostra se a semana saiu do normal. Não prova que foi esta ação.
                  </p>
                </div>

                {chavesResultado.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Resultado direto</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {chavesResultado.map((k) => (
                          <div key={k}>
                            <div className="text-muted-foreground text-xs">{legivel(k)}</div>
                            <div>{typeof resultado[k] === "object" ? JSON.stringify(resultado[k]) : String(resultado[k])}</div>
                          </div>
                        ))}
                      </div>
                      {resultado.fonte && (
                        <Badge variant="secondary">Fonte: {String(resultado.fonte)}</Badge>
                      )}
                    </div>
                  </>
                )}

                <Separator />
                <div className="space-y-3">
                  <div className="font-medium text-sm">Leitura</div>
                  <div>
                    <Label className="text-xs">Como foi</Label>
                    <Select value={leitura || ""} onValueChange={setLeitura}>
                      <SelectTrigger><SelectValue placeholder="Escolha a leitura" /></SelectTrigger>
                      <SelectContent>
                        {(opcoes.leituras.length
                          ? opcoes.leituras
                          : [
                              { valor: "funcionou", rotulo: "Funcionou" },
                              { valor: "neutro", rotulo: "Neutro" },
                              { valor: "nao_funcionou", rotulo: "Não funcionou" },
                              { valor: "inconclusivo", rotulo: "Inconclusivo" },
                            ]
                        ).map((l) => (
                          <SelectItem key={l.valor} value={l.valor}>{l.rotulo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">O que aprendemos</Label>
                    <Textarea rows={3} value={aprendizado} onChange={(e) => setAprendizado(e.target.value)} />
                  </div>
                  <Button size="sm" disabled={salvarLeitura.isPending} onClick={() => salvarLeitura.mutate()}>
                    {salvarLeitura.isPending ? "Salvando..." : "Salvar leitura"}
                  </Button>
                </div>

                <Separator />
                <div className="flex gap-2 pb-8">
                  <Button variant="outline" onClick={() => onEditar(acao)}>Editar</Button>
                  <Button variant="destructive" onClick={() => setConfirmarExclusao(true)}>Excluir</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta ação?</AlertDialogTitle>
            <AlertDialogDescription>
              Ações capturadas automaticamente ficam marcadas como canceladas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluir.mutate()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
