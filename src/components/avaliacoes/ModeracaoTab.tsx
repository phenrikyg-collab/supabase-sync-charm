import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, RefreshCw, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { avalModerar, avalPendentes, texto, type PainelPendentes } from "@/lib/avaliacoes";

function Estrelas({ nota }: { nota: any }) {
  const n = Number(nota ?? 0);
  if (!n) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-0.5" title={`${n} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= n ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

export function ModeracaoTab() {
  const { toast } = useToast();
  const [dados, setDados] = useState<PainelPendentes>({});
  const [carregando, setCarregando] = useState(true);
  const [agindo, setAgindo] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      setDados(await avalPendentes());
    } catch (e: any) {
      toast({ title: "Não foi possível carregar", description: e.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moderar(
    id: any,
    tipo: "midia" | "produto" | "loja",
    status: "publicada" | "rejeitada",
  ) {
    setAgindo(`${tipo}-${id}-${status}`);
    try {
      await avalModerar(id, tipo, status);
      toast({ title: status === "publicada" ? "Publicada" : "Rejeitada" });
      await carregar();
    } catch (e: any) {
      toast({ title: "Não foi possível moderar", description: e.message, variant: "destructive" });
    } finally {
      setAgindo(null);
    }
  }

  const fotos = (dados.midias ?? dados.fotos ?? []) as Array<Record<string, any>>;
  const textosProduto = (dados.textos_produto ?? []) as Array<Record<string, any>>;
  const textosLoja = (dados.textos_loja ?? []) as Array<Record<string, any>>;
  const textosGerais = (dados.textos ?? []) as Array<Record<string, any>>;
  const textos = [
    ...textosGerais,
    ...textosProduto.map((t) => ({ ...t, tipo: t.tipo ?? "produto" })),
    ...textosLoja.map((t) => ({ ...t, tipo: t.tipo ?? "loja" })),
  ];

  const vazio = !carregando && !fotos.length && !textos.length;

  return (
    <div className="space-y-5 pt-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
          <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {carregando && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {vazio && (
        <Card className="p-12 text-center text-muted-foreground">Nada para moderar.</Card>
      )}

      {!carregando && fotos.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-serif text-lg">Fotos aguardando aprovação</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {fotos.map((f, i) => {
              const url = f.url ?? f.foto_url ?? f.midia_url ?? f.imagem;
              const id = f.id ?? f.midia_id;
              return (
                <Card key={String(id ?? i)} className="overflow-hidden">
                  {url ? (
                    <button
                      type="button"
                      onClick={() => setFoto(String(url))}
                      className="block w-full"
                    >
                      <img
                        src={String(url)}
                        alt={texto(f.produto ?? f.produto_nome)}
                        className="h-48 w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-muted text-sm text-muted-foreground">
                      Sem imagem
                    </div>
                  )}
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-1 text-sm font-medium">
                      {texto(f.produto ?? f.produto_nome)}
                    </p>
                    <Estrelas nota={f.nota} />
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {texto(f.texto ?? f.comentario)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {texto(f.cliente ?? f.cliente_nome)}
                    </p>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={!!agindo}
                        onClick={() => moderar(id, "midia", "publicada")}
                      >
                        Publicar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={!!agindo}
                        onClick={() => moderar(id, "midia", "rejeitada")}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {!carregando && textos.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-serif text-lg">Textos retidos</h3>
          <div className="space-y-3">
            {textos.map((t, i) => {
              const id = t.id ?? t.avaliacao_id;
              const tipo = (t.tipo === "loja" ? "loja" : "produto") as "loja" | "produto";
              return (
                <Card key={`${tipo}-${String(id ?? i)}`} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{tipo === "loja" ? "Loja" : "Produto"}</Badge>
                        <Badge variant="outline" className="text-warning">
                          {texto(t.motivo ?? t.motivo_retencao)}
                        </Badge>
                        <Estrelas nota={t.nota} />
                      </div>
                      <p className="text-sm">{texto(t.texto ?? t.comentario)}</p>
                      <p className="text-xs text-muted-foreground">
                        {texto(t.cliente ?? t.cliente_nome)}
                        {t.produto || t.produto_nome ? ` · ${texto(t.produto ?? t.produto_nome)}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={!!agindo}
                        onClick={() => moderar(id, tipo, "publicada")}
                      >
                        Publicar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!agindo}
                        onClick={() => moderar(id, tipo, "rejeitada")}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <Dialog open={!!foto} onOpenChange={(o) => !o && setFoto(null)}>
        <DialogContent className="max-w-3xl p-2">
          {foto && <img src={foto} alt="Foto da avaliação" className="max-h-[80vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
