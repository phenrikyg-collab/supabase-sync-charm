import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  vipClassificacaoOpcoes,
  vipCriativosDoProduto,
  vipRedigir,
  type VipClassificacaoOpcoes,
  type VipCriativoMatriz,
  type VipPersona,
  type VipRedacao,
} from "@/lib/vip";

type Props = {
  camadas: Record<string, string>;
  setCamadas: (c: Record<string, string>) => void;
  produtoId?: string | null;
  publico: string;
  onGerado: (r: VipRedacao) => void;
};

const CAMPOS: Array<{ campo: string; label: string; chave: keyof VipClassificacaoOpcoes; dica?: string }> = [
  { campo: "tema", label: "Tema", chave: "tema" },
  { campo: "tipo", label: "Tipo", chave: "tipo" },
  { campo: "pilar", label: "Pilar da mensagem", chave: "pilar", dica: "Bloco 12 — não é o pilar de conteúdo da Matriz." },
  { campo: "jornada", label: "Jornada", chave: "jornada" },
  { campo: "objetivo", label: "Objetivo", chave: "objetivo" },
  { campo: "intencao", label: "Intenção", chave: "intencao" },
  { campo: "midia_sugerida", label: "Mídia", chave: "midia" },
  { campo: "angulo", label: "Ângulo", chave: "angulo" },
  { campo: "estrutura_narrativa", label: "Estrutura narrativa", chave: "estrutura_narrativa" },
  { campo: "etapa_funil", label: "Etapa do funil", chave: "etapa_funil" },
];

export function ClassificacaoBloco({ camadas, setCamadas, produtoId, publico, onGerado }: Props) {
  const [opcoes, setOpcoes] = useState<VipClassificacaoOpcoes | null>(null);
  const [criativos, setCriativos] = useState<VipCriativoMatriz[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [gerando, setGerando] = useState(false);
  const [usou, setUsou] = useState<VipRedacao["usou"] | null>(null);

  useEffect(() => {
    vipClassificacaoOpcoes()
      .then(setOpcoes)
      .catch((e) => toast.error(e.message ?? "Falha ao carregar as opções de classificação"));
  }, []);

  useEffect(() => {
    if (!produtoId) {
      setCriativos([]);
      return;
    }
    vipCriativosDoProduto(produtoId).then(setCriativos).catch(() => setCriativos([]));
  }, [produtoId]);

  const personas: VipPersona[] = opcoes?.personas ?? [];
  const persona = useMemo(
    () => personas.find((p) => (p.nome ?? "") === (camadas.persona ?? "")) ?? null,
    [personas, camadas.persona],
  );

  const set = (campo: string, valor: string) => setCamadas({ ...camadas, [campo]: valor });

  const gerar = async () => {
    setGerando(true);
    try {
      const r = await vipRedigir({
        persona: camadas.persona || null,
        tema: camadas.tema || null,
        tipo: camadas.tipo || null,
        pilar: camadas.pilar || null,
        jornada: camadas.jornada || null,
        objetivo: camadas.objetivo || null,
        intencao: camadas.intencao || null,
        angulo: camadas.angulo || null,
        estrutura_narrativa: camadas.estrutura_narrativa || null,
        etapa_funil: camadas.etapa_funil || null,
        midia_sugerida: camadas.midia_sugerida || null,
        produto_id: produtoId ?? null,
        publico,
        observacoes: observacoes || null,
      });
      setUsou(r?.usou ?? null);
      onGerado(r ?? {});
      toast.success("Texto gerado. Leia e ajuste antes de aprovar.");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar o texto");
    } finally {
      setGerando(false);
    }
  };

  return (
    <Collapsible defaultOpen>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex-row cursor-pointer items-center justify-between py-3">
            <CardTitle className="text-sm">Classificação (opcional — vira o briefing da IA)</CardTitle>
            <ChevronDown className="h-4 w-4" />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Persona — campo principal */}
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <Label>Persona</Label>
                <Select value={camadas.persona ?? ""} onValueChange={(v) => set("persona", v)}>
                  <SelectTrigger><SelectValue placeholder="Escolha a persona" /></SelectTrigger>
                  <SelectContent>
                    {personas.map((p) => (
                      <SelectItem key={p.id ?? p.nome ?? ""} value={p.nome ?? ""}>
                        {p.emoji ? `${p.emoji} ` : ""}{p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  As 6 personas reais da Matriz Criativa.
                </p>
              </div>
              {persona && (
                <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                  <div className="text-sm font-medium">
                    {persona.emoji} {persona.nome}
                    {persona.faixa_etaria && (
                      <span className="ml-2 text-xs text-muted-foreground">{persona.faixa_etaria}</span>
                    )}
                  </div>
                  {persona.motivacao && <div><b>Motivação:</b> {persona.motivacao}</div>}
                  {persona.objecao && <div><b>Objeção:</b> {persona.objecao}</div>}
                  {persona.pilar_abre && <div><b>Abre com:</b> {persona.pilar_abre}</div>}
                  {persona.pilar_fecha && <div><b>Fecha com:</b> {persona.pilar_fecha}</div>}
                  {persona.mensagem_principal && (
                    <div><b>Mensagem principal:</b> {persona.mensagem_principal}</div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS.map((c) => {
                const lista = (opcoes?.[c.chave] as string[] | undefined) ?? [];
                return (
                  <div key={c.campo}>
                    <Label>{c.label}</Label>
                    <Select value={camadas[c.campo] ?? ""} onValueChange={(v) => set(c.campo, v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {lista.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {c.dica && <p className="mt-1 text-[11px] text-muted-foreground">{c.dica}</p>}
                  </div>
                );
              })}
            </div>

            {opcoes?.nota && <p className="text-[11px] text-muted-foreground">{opcoes.nota}</p>}

            {produtoId && (
              <div className="space-y-2">
                <div className="text-xs font-medium">Criativos que a Matriz já rodou para esta peça</div>
                {criativos.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Nenhum criativo registrado para esta peça na Matriz.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {criativos.map((c, i) => (
                      <div key={c.id ?? i} className="rounded-md border p-2 text-xs space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {c.angulo && <Badge variant="outline">{c.angulo}</Badge>}
                          {c.estrutura_narrativa && <Badge variant="outline">{c.estrutura_narrativa}</Badge>}
                          {c.persona && <Badge variant="outline">{c.persona}</Badge>}
                        </div>
                        {c.dor && <div><b>Dor:</b> {c.dor}</div>}
                        {c.solucao && <div><b>Solução:</b> {c.solucao}</div>}
                        {c.beneficio && <div><b>Benefício:</b> {c.beneficio}</div>}
                        {c.objecao_resolvida && <div><b>Objeção resolvida:</b> {c.objecao_resolvida}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Observações para a IA</Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Contexto extra, o que não pode faltar, o que evitar."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={gerar} disabled={gerando}>
                {gerando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                Gerar texto com IA
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Preenche o formulário. Nada é salvo — leia e ajuste antes de aprovar.
              </span>
            </div>

            {usou && (
              <p className="text-[11px] text-muted-foreground">
                Escreveu com: {Number(usou.criativos_da_matriz ?? 0)} criativo(s) da Matriz
                {Number(usou.criativos_da_matriz ?? 0) === 0
                  ? " (a peça não tem histórico na Matriz — o texto saiu só do produto)"
                  : ""}
                {" · "}grade real {usou.grade_disponivel ? "disponível" : "indisponível"}
                {" · "}preço Sale {usou.preco_sale ? "aplicado" : "não aplicado"}.
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
