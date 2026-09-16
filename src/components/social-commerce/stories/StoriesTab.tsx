import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BarChart3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CLASSE_STATUS_ROTEIRO, ROTULO_STATUS_ROTEIRO, dataHoraBR, listarRoteiros, resumoSlides,
  type Roteiro,
} from "@/lib/stories";
import { cn } from "@/lib/utils";
import EditorRoteiro from "./EditorRoteiro";
import DesempenhoRoteiro from "./DesempenhoRoteiro";

const TODOS = "__todos__";

export function StoriesTab() {
  const [roteiros, setRoteiros] = useState<Roteiro[]>([]);
  const [resumo, setResumo] = useState<Record<number, { total: number; comErro: number }>>({});
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState(TODOS);
  const [editando, setEditando] = useState<Roteiro | null>(null);
  const [desempenho, setDesempenho] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [lista, mapa] = await Promise.all([listarRoteiros(), resumoSlides()]);
      setRoteiros(lista);
      setResumo(mapa);
    } catch (e: any) {
      toast.error("Não deu para carregar os roteiros", { description: e?.message });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(
    () => roteiros.filter((r) => filtro === TODOS || String(r.status) === filtro),
    [roteiros, filtro],
  );

  if (editando) {
    return (
      <EditorRoteiro
        roteiroInicial={editando}
        onVoltar={() => { setEditando(null); carregar(); }}
        onSalvou={carregar}
      />
    );
  }

  if (desempenho) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        <div className="shrink-0 mb-3">
          <Button variant="ghost" size="sm" onClick={() => setDesempenho(null)}>Voltar aos roteiros</Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <DesempenhoRoteiro roteiroId={desempenho} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="shrink-0 flex flex-wrap items-center gap-2 mb-3">
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os status</SelectItem>
            {Object.entries(ROTULO_STATUS_ROTEIRO).map(([v, r]) => (
              <SelectItem key={v} value={v}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="ml-auto gap-1"
          onClick={() => setEditando({ status: "rascunho", intervalo_segundos: 0, titulo: "" })}
        >
          <Plus className="h-4 w-4" /> Novo roteiro
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
        {carregando && <Skeleton className="h-40 w-full" />}
        {!carregando && filtrados.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
            Nenhum roteiro com esse filtro. Crie um roteiro para publicar seus stories em sequência.
          </Card>
        )}
        {filtrados.map((r) => {
          const info = resumo[Number(r.id)] ?? { total: 0, comErro: 0 };
          return (
            <Card
              key={r.id}
              className={cn("p-3 flex flex-wrap items-center gap-3 cursor-pointer", info.comErro > 0 && "border-destructive")}
              onClick={() => setEditando(r)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.titulo || "Sem título"}</p>
                <p className="text-xs text-muted-foreground">
                  {dataHoraBR(r.agendado_para)}
                  {r.objetivo ? ` — ${r.objetivo}` : ""}
                </p>
              </div>
              <Badge variant="outline" className={cn("border", CLASSE_STATUS_ROTEIRO[String(r.status ?? "rascunho")])}>
                {ROTULO_STATUS_ROTEIRO[String(r.status ?? "rascunho")] ?? r.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {info.total} {info.total === 1 ? "slide" : "slides"}
              </span>
              {info.comErro > 0 && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {info.comErro} com problema de mídia
                </span>
              )}
              <Button
                size="sm" variant="outline" className="gap-1"
                onClick={(e) => { e.stopPropagation(); setDesempenho(Number(r.id)); }}
              >
                <BarChart3 className="h-4 w-4" /> Desempenho
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default StoriesTab;
