import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { CarregandoTabela, EstadoErro, EstadoVazio } from "./Estados";
import { inteiro, listaDe, numero, objetoDe, rpcAviseMe, type Linha } from "@/lib/aviseMe";
import type { Grade } from "./OrdemCorteTab";

export function DisparoTab({
  gradeInicial,
  onDisparado,
}: {
  gradeInicial?: Grade | null;
  onDisparado?: () => void;
}) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [grade, setGrade] = useState<Grade | null>(null);
  const [previa, setPrevia] = useState<Record<string, any> | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [erroPrevia, setErroPrevia] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [motor, setMotor] = useState<{ modo_teste?: boolean; envio_ativo?: boolean }>({});

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await rpcAviseMe("avise_me_demanda", {
        p_busca: null,
        p_so_voltaram: true,
        p_limite: 100,
        p_offset: 0,
      });
      setLinhas(listaDe(r).filter((l) => !!l.voltou));
    } catch (e: any) {
      setErro(e?.message ?? "Erro inesperado");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    if (gradeInicial) abrir(gradeInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeInicial?.produto_id, gradeInicial?.cor, gradeInicial?.tamanho]);

  async function abrir(g: Grade) {
    setGrade(g);
    setPrevia(null);
    setErroPrevia(null);
    setCarregandoPrevia(true);
    try {
      const r = await rpcAviseMe("avise_me_disparo_previa", {
        p_produto_id: g.produto_id,
        p_cor: g.cor ?? null,
        p_tamanho: g.tamanho ?? null,
      });
      const p = objetoDe(r);
      setPrevia(p);
      setMotor({ modo_teste: p.modo_teste, envio_ativo: p.envio_ativo });
    } catch (e: any) {
      setErroPrevia(e?.message ?? "Erro inesperado");
    } finally {
      setCarregandoPrevia(false);
    }
  }

  const quantos = numero(previa?.serao_avisadas ?? previa?.pessoas ?? previa?.total);
  const podeDisparar = !!previa?.pode_disparar && quantos > 0;

  async function enfileirar() {
    if (!grade) return;
    setEnviando(true);
    try {
      const r = await rpcAviseMe("avise_me_disparo_enfileirar", {
        p_produto_id: grade.produto_id,
        p_cor: grade.cor ?? null,
        p_tamanho: grade.tamanho ?? null,
        p_simular: false,
      });
      const res = objetoDe(r);
      setMotor((m) => ({
        modo_teste: res.modo_teste ?? m.modo_teste,
        envio_ativo: res.envio_ativo ?? m.envio_ativo,
      }));
      const enfileirados = numero(res.enfileirados);
      const jaTinham = numero(res.ja_tinham_envio);
      toast.success(`${inteiro(enfileirados)} e-mails na fila`, {
        description:
          jaTinham > 0
            ? `${inteiro(jaTinham)} pessoas ficaram de fora porque já tinham um envio na fila para esta mesma grade.`
            : undefined,
      });
      setConfirmar(false);
      setGrade(null);
      carregar();
      onDisparado?.();
    } catch (e: any) {
      toast.error("Não foi possível enfileirar", { description: e?.message });
    } finally {
      setEnviando(false);
    }
  }

  const foraDe: { rotulo: string; chaves: string[] }[] = [
    { rotulo: "Já avisados", chaves: ["ja_avisados", "fora_ja_avisados"] },
    { rotulo: "Descadastrados", chaves: ["descadastrados", "fora_descadastrados"] },
    { rotulo: "Sem contato na base", chaves: ["sem_contato", "fora_sem_contato"] },
  ];

  const amostra: string[] = (previa?.amostra ?? previa?.amostra_emails ?? []) as string[];

  return (
    <div className="space-y-4 pt-4">
      {motor.envio_ativo === false && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          Envio desligado nas configurações do motor, os e-mails ficam na fila
        </div>
      )}
      {motor.modo_teste === true && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          Motor em modo teste, os e-mails vão para os endereços de teste
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={carregar}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      {erro ? (
        <Card><EstadoErro mensagem={erro} onTentar={carregar} /></Card>
      ) : carregando ? (
        <Card><CarregandoTabela /></Card>
      ) : !linhas.length ? (
        <Card>
          <EstadoVazio
            titulo="Nenhuma grade voltou ao estoque"
            descricao="Assim que uma grade com fila voltar, ela aparece aqui pronta para disparo."
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {linhas.map((l, i) => (
            <Card
              key={`${l.produto_id}-${l.cor}-${l.tamanho}-${i}`}
              className="cursor-pointer p-4 transition-shadow hover:shadow-md"
              onClick={() => abrir({ produto_id: l.produto_id, produto: l.produto, cor: l.cor, tamanho: l.tamanho })}
            >
              <p className="font-medium">{l.produto ?? ""}</p>
              <p className="text-xs text-muted-foreground">
                {[l.cor, l.tamanho].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Badge className="bg-success/15 text-success hover:bg-success/15">
                  {inteiro(l.esperando)} esperando
                </Badge>
                <span className="text-xs text-muted-foreground">
                  estoque {inteiro(l.estoque_hoje ?? l.estoque)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!grade} onOpenChange={(a) => !a && setGrade(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{grade?.produto ?? "Grade"}</SheetTitle>
            <SheetDescription>
              {[grade?.cor, grade?.tamanho].filter(Boolean).join(" · ")}
            </SheetDescription>
          </SheetHeader>

          {erroPrevia ? (
            <EstadoErro mensagem={erroPrevia} onTentar={() => grade && abrir(grade)} />
          ) : carregandoPrevia || !previa ? (
            <CarregandoTabela linhas={5} />
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Estoque da grade</p>
                  <p className="font-serif text-xl">{inteiro(previa.estoque ?? previa.estoque_hoje)}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Serão avisadas</p>
                  <p className="font-serif text-xl text-success">{inteiro(quantos)}</p>
                </Card>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Ficaram de fora
                </p>
                <div className="space-y-1 text-sm">
                  {foraDe.map((f) => {
                    const chave = f.chaves.find((k) => previa?.[k] != null);
                    return (
                      <div key={f.rotulo} className="flex justify-between">
                        <span className="text-muted-foreground">{f.rotulo}</span>
                        <span>{inteiro(chave ? previa[chave] : 0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {amostra.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Primeiros e-mails
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {amostra.slice(0, 10).map((e, i) => (
                      <li key={i} className="truncate">{typeof e === "string" ? e : (e as any)?.email}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                className="w-full"
                disabled={!podeDisparar}
                onClick={() => setConfirmar(true)}
              >
                Enfileirar {inteiro(quantos)} e-mails
              </Button>
              {!podeDisparar && (
                <p className="text-xs text-muted-foreground">
                  Esta grade ainda não pode ser disparada.
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enfileirar {inteiro(quantos)} e-mails</AlertDialogTitle>
            <AlertDialogDescription>
              {inteiro(quantos)} pessoas entram na fila de envio desta grade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={enviando} onClick={enfileirar}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
