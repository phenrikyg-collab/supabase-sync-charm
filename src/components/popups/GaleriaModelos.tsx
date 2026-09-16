import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { popupsApi, ROTULO_FORMATO, ROTULO_OFERTA, type Modelo } from "@/lib/popups";
import { PreviaIframe } from "./PreviaIframe";
import { NotaCirculo } from "./NotaCirculo";

export function GaleriaModelos({
  aberto,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: (id: number) => void;
}) {
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [criando, setCriando] = useState<string | null>(null);

  const { data: modelos, isLoading } = useQuery({
    queryKey: ["popups-modelos"],
    queryFn: () => popupsApi.modelos(),
    enabled: aberto,
  });

  async function usar(m: Modelo) {
    setCriando(m.chave);
    try {
      const novo = await popupsApi.criarDeModelo(m.chave, nomes[m.chave]?.trim() || undefined);
      toast.success("Popup criado em rascunho.");
      aoCriar(Number(novo.id));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCriando(null);
    }
  }

  async function emBranco() {
    setCriando("branco");
    try {
      const novo = await popupsApi.salvar({
        nome: "Novo popup",
        design: { etapas: [{ id: "e1", nome: "Etapa 1", elementos: [] }] },
      });
      aoCriar(Number(novo.id));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCriando(null);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Escolha um modelo</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-semibold">Estratégia de e-commerce que funciona</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Cupom de primeira compra por engajamento ou saída.</li>
            <li>Na saída, uma oferta diferente da entrada: ajuda, não mais desconto.</li>
            <li>Barra para campanha com prazo.</li>
            <li>Popup por clique para banners.</li>
          </ol>
          <p className="mt-2 font-medium">Um popup por visita: a prioridade decide qual abre.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 w-full" />)}

          {(modelos ?? []).map((m) => (
            <Card key={m.chave} className="overflow-hidden">
              <div className="h-48 overflow-hidden border-b border-border bg-muted">
                <PreviaIframe
                  popup={{ nome: m.nome, formato: m.formato, design: m.design, regras: m.regras, oferta: m.oferta }}
                  etapa={0}
                  escala={0.5}
                  interativo={false}
                  alturaMinima={380}
                  className="w-full border-0"
                />
              </div>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-serif text-lg font-semibold">{m.nome}</p>
                    <p className="text-xs text-muted-foreground">{m.objetivo}</p>
                  </div>
                  <NotaCirculo nota={m.nota} tamanho="sm" />
                </div>
                <div className="flex flex-wrap gap-1">
                  {m.formato && <Badge variant="secondary">{ROTULO_FORMATO[m.formato] ?? m.formato}</Badge>}
                  {m.oferta_tipo && <Badge variant="outline">{ROTULO_OFERTA[m.oferta_tipo] ?? m.oferta_tipo}</Badge>}
                </div>
                {m.quando_usar && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Quando usar:</span> {m.quando_usar}
                  </p>
                )}
                {m.como_convive && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Como convive:</span> {m.como_convive}
                  </p>
                )}
                <Input
                  placeholder={`Nome do popup (padrão: ${m.nome})`}
                  value={nomes[m.chave] ?? ""}
                  onChange={(e) => setNomes((s) => ({ ...s, [m.chave]: e.target.value }))}
                />
                <Button className="w-full" disabled={criando !== null} onClick={() => usar(m)}>
                  {criando === m.chave ? "Criando..." : "Usar este modelo"}
                </Button>
              </CardContent>
            </Card>
          ))}

          <Card className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="font-serif text-lg font-semibold">Em branco</p>
            <p className="text-xs text-muted-foreground">Comece do zero, com uma etapa vazia.</p>
            <Button variant="outline" disabled={criando !== null} onClick={emBranco}>
              {criando === "branco" ? "Criando..." : "Criar em branco"}
            </Button>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
