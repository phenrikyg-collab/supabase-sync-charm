import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { popupsApi, type Popup } from "@/lib/popups";
import { SeletorFigurinha } from "./SeletorFigurinha";
import { CampoCor } from "./campos";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const CAMPOS_ORIGEM = [
  { v: "utm_source", n: "utm_source" },
  { v: "utm_medium", n: "utm_medium" },
  { v: "utm_campaign", n: "utm_campaign" },
  { v: "utm_content", n: "utm_content" },
  { v: "referrer", n: "Site de origem" },
  { v: "url", n: "Endereço da página" },
  { v: "parametro", n: "Parâmetro da URL" },
];

const OPS = [
  { v: "contem", n: "contém" },
  { v: "igual", n: "é igual a" },
  { v: "diferente", n: "é diferente de" },
  { v: "nao_contem", n: "não contém" },
  { v: "comeca", n: "começa com" },
  { v: "existe", n: "existe" },
  { v: "nao_existe", n: "não existe" },
];

function resumoGatilho(g: any) {
  const partes: string[] = [];
  if (g?.quando === "saida") partes.push("Abre quando ela for sair da página");
  else if (g?.quando === "inatividade") partes.push(`Abre quando ficar parada por ${g?.inatividade_s ?? 0} s`);
  else if (g?.quando === "clique") partes.push("Abre só quando clicar no elemento escolhido");
  else partes.push("Abre assim que cumprir as condições");

  const cond: string[] = [];
  if (g?.tempo_min_s) cond.push(`${g.tempo_min_s} s na página`);
  if (g?.rolagem_min_pct) cond.push(`${g.rolagem_min_pct}% de rolagem`);
  if (g?.paginas_min) cond.push(`${g.paginas_min} páginas vistas`);
  let txt = partes[0] + (cond.length ? `, depois de ${cond.join(" e ")}` : "") + ".";

  if (g?.quando === "saida") {
    const extras: string[] = [];
    if (g?.saida_mobile) extras.push("na subida rápida");
    if (g?.fallback_mobile_s) extras.push(`aos ${g.fallback_mobile_s} s`);
    if (extras.length) txt += ` No celular, abre ${extras.join(" ou ")}.`;
  }
  return txt;
}

function resumoFrequencia(f: any) {
  const mapa: Record<string, string> = {
    uma_vez: "Aparece uma vez por pessoa",
    por_sessao: "Aparece uma vez por visita",
    sempre: "Pode aparecer sempre",
  };
  let txt = f?.tipo === "a_cada_dias" ? `Aparece no máximo a cada ${f?.dias ?? 0} dias` : (mapa[f?.tipo] ?? mapa.uma_vez);
  if (f?.max_impressoes) txt += `, no máximo ${f.max_impressoes} vezes`;
  if (f?.pausa_apos_fechar_dias) txt += `. Se ela fechar, espera ${f.pausa_apos_fechar_dias} dias`;
  if (f?.parar_apos_conversao) txt += ". Depois de converter, não aparece mais";
  return txt + ".";
}

const PLATAFORMAS_APP: { v: string; n: string }[] = [
  { v: "android", n: "Android" },
  { v: "ios", n: "iPhone" },
  { v: "outro", n: "Outro" },
];

const SITUACOES_APP: { v: string; n: string }[] = [
  { v: "pedido_em_transito", n: "Pedido a caminho" },
  { v: "pedido_entregue_recente", n: "Pedido entregue há pouco" },
  { v: "sem_pedido", n: "Sem pedido" },
  { v: "cashback_disponivel", n: "Tem cashback disponível" },
  { v: "troca_aberta", n: "Tem troca aberta" },
];

export function AbaRegras({
  popup,
  mudar,
  destino = "site",
}: {
  popup: Popup;
  mudar: (patch: Partial<Popup>) => void;
  destino?: "site" | "app";
}) {
  const ehApp = destino === "app";
  const r = popup.regras ?? {};
  const setR = (chave: string, patch: any) => mudar({ regras: { ...r, [chave]: { ...(r[chave] ?? {}), ...patch } } });
  const setRaiz = (patch: any) => mudar({ regras: { ...r, ...patch } });

  const { data: config } = useQuery({ queryKey: ["popups-config"], queryFn: () => popupsApi.configObter() });

  const g = r.gatilho ?? {};
  const origem = r.origem ?? { modo: "todas", condicoes: [] };
  const condicoes: any[] = origem.condicoes ?? [];

  const agendado = popup.inicio && new Date(popup.inicio).getTime() > Date.now();

  function paraLocal(iso: string | null | undefined) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      {ehApp && (
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Quem vê no app</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Instalação</Label>
              <RadioGroup
                value={r.app?.instalacao ?? "todos"}
                onValueChange={(v) => setR("app", { instalacao: v })}
                className="space-y-2"
              >
                {[
                  { v: "todos", n: "Todas as visitantes do app" },
                  { v: "instalado", n: "Só quem instalou" },
                  { v: "nao_instalado", n: "Só quem ainda não instalou" },
                ].map((o) => (
                  <div key={o.v} className="flex items-center gap-2">
                    <RadioGroupItem value={o.v} id={`app-inst-${o.v}`} />
                    <Label htmlFor={`app-inst-${o.v}`} className="text-sm font-normal">{o.n}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Aparelho</Label>
              <div className="flex flex-wrap gap-4">
                {PLATAFORMAS_APP.map((p) => {
                  const atuais: string[] = r.app?.plataformas ?? ["android", "ios", "outro"];
                  const marcado = atuais.includes(p.v);
                  return (
                    <div key={p.v} className="flex items-center gap-2">
                      <Checkbox
                        id={`app-plat-${p.v}`}
                        checked={marcado}
                        onCheckedChange={() =>
                          setR("app", {
                            plataformas: marcado ? atuais.filter((x) => x !== p.v) : [...atuais, p.v],
                          })
                        }
                      />
                      <Label htmlFor={`app-plat-${p.v}`} className="text-sm font-normal">{p.n}</Label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">CPF salvo no celular</Label>
              <RadioGroup
                value={r.app?.identificada ?? "todas"}
                onValueChange={(v) => setR("app", { identificada: v })}
                className="space-y-2"
              >
                {[
                  { v: "todas", n: "Tanto faz" },
                  { v: "sim", n: "Só quem já salvou" },
                  { v: "nao", n: "Só quem não salvou" },
                ].map((o) => (
                  <div key={o.v} className="flex items-center gap-2">
                    <RadioGroupItem value={o.v} id={`app-id-${o.v}`} />
                    <Label htmlFor={`app-id-${o.v}`} className="text-sm font-normal">{o.n}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Situação da cliente</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {SITUACOES_APP.map((s) => {
                  const atuais: string[] = r.app?.situacoes ?? [];
                  const marcado = atuais.includes(s.v);
                  return (
                    <div key={s.v} className="flex items-center gap-2">
                      <Checkbox
                        id={`app-sit-${s.v}`}
                        checked={marcado}
                        onCheckedChange={() =>
                          setR("app", {
                            situacoes: marcado ? atuais.filter((x) => x !== s.v) : [...atuais, s.v],
                          })
                        }
                      />
                      <Label htmlFor={`app-sit-${s.v}`} className="text-sm font-normal">{s.n}</Label>
                    </div>
                  );
                })}
              </div>
              {(r.app?.situacoes ?? []).length >= 2 && (
                <div className="flex items-center gap-3 pt-1">
                  <Label className="text-xs">Precisa ter</Label>
                  <Select
                    value={r.app?.situacoes_modo ?? "qualquer"}
                    onValueChange={(v) => setR("app", { situacoes_modo: v })}
                  >
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qualquer">Qualquer uma</SelectItem>
                      <SelectItem value="todas">Todas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                A situação vem do próprio app, com o CPF que a cliente salvou. Sem CPF salvo, a cliente não entra em popups com situação marcada.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Quando abrir</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
            O popup só abre depois que TODAS as condições mínimas forem cumpridas. Aí ele espera o momento escolhido.
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tempo mínimo na página (segundos)</Label>
              <Input type="number" min={0} value={g.tempo_min_s ?? 0} onChange={(e) => setR("gatilho", { tempo_min_s: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rolagem mínima (%)</Label>
              <Input type="number" min={0} max={100} value={g.rolagem_min_pct ?? 0} onChange={(e) => setR("gatilho", { rolagem_min_pct: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Páginas vistas na visita</Label>
              <Input type="number" min={0} value={g.paginas_min ?? 0} onChange={(e) => setR("gatilho", { paginas_min: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Funciona melhor: 30 a 60 segundos ou 25% a 50% de rolagem. Abrir antes de 5 segundos interrompe quem ainda nem viu o site.
          </p>

          <div className="space-y-2">
            <Label className="text-xs">Momento de abrir</Label>
            <RadioGroup value={g.quando ?? "ao_cumprir"} onValueChange={(v) => setR("gatilho", { quando: v })} className="space-y-2">
              {[
                { v: "ao_cumprir", n: "Assim que cumprir as condições" },
                { v: "saida", n: "Quando for sair da página" },
                { v: "inatividade", n: "Quando ficar parada" },
                { v: "clique", n: "Só quando clicar" },
              ].map((o) => (
                <div key={o.v} className="flex items-center gap-2">
                  <RadioGroupItem value={o.v} id={`q-${o.v}`} />
                  <Label htmlFor={`q-${o.v}`} className="text-sm font-normal">{o.n}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {g.quando === "saida" && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">No celular, usar subida rápida da tela como sinal de saída</Label>
                <Switch checked={!!g.saida_mobile} onCheckedChange={(v) => setR("gatilho", { saida_mobile: v })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">No celular, abrir mesmo sem sinal de saída depois de X segundos (0 desliga)</Label>
                <Input type="number" min={0} value={g.fallback_mobile_s ?? 0} onChange={(e) => setR("gatilho", { fallback_mobile_s: Number(e.target.value) || 0 })} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Celular não tem cursor, então a intenção de saída do computador não existe lá.
              </p>
            </div>
          )}

          {g.quando === "inatividade" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Segundos parada</Label>
              <Input type="number" min={0} value={g.inatividade_s ?? 30} onChange={(e) => setR("gatilho", { inatividade_s: Number(e.target.value) || 0 })} />
            </div>
          )}

          {g.quando === "clique" && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <Label className="text-xs">Seletor do elemento</Label>
              <Input value={g.seletor_clique ?? ""} onChange={(e) => setR("gatilho", { seletor_clique: e.target.value })} placeholder=".meu-banner" />
              <p className="text-[11px] text-muted-foreground">Pronto para copiar no site:</p>
              <code className="block rounded bg-muted p-2 text-[11px]">{`<a href="#mc-popup-${popup.id ?? "ID"}">`}</code>
              <code className="block rounded bg-muted p-2 text-[11px]">{`data-mc-popup-abrir="${popup.id ?? "ID"}"`}</code>
              <p className="text-[11px] text-muted-foreground">Popup por clique ignora frequência e é o que menos incomoda.</p>
            </div>
          )}

          <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">{resumoGatilho(g)}</div>
        </CardContent>
      </Card>

      <Card className={ehApp ? "hidden" : undefined}>
        <CardHeader><CardTitle className="text-base">Onde</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Incluir (uma por linha, * para todas)</Label>
            <Textarea rows={4} value={(r.paginas?.incluir ?? []).join("\n")} onChange={(e) => setR("paginas", { incluir: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Excluir</Label>
            <Textarea rows={3} value={(r.paginas?.excluir ?? []).join("\n")} onChange={(e) => setR("paginas", { excluir: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
          </div>
          <div className="rounded-md border border-border bg-muted/50 p-2 text-[11px] text-muted-foreground">
            Checkout, carrinho, login e minha conta nunca recebem popup.
            {!!(config?.paginas_excluidas ?? []).length && (
              <span className="mt-1 block">Excluídas em todos: {(config!.paginas_excluidas as string[]).join(", ")}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Público</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de visitante</Label>
            <Select value={r.publico?.tipo ?? "todos"} onValueChange={(v) => setR("publico", { tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="novas">Primeira visita</SelectItem>
                <SelectItem value="recorrentes">Já visitou antes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(ehApp
            ? [["excluir_convertidas", "Excluir quem já converteu em algum popup"]]
            : [
                ["excluir_clientes", "Excluir quem já comprou"],
                ["excluir_identificadas", "Excluir quem já deixou e-mail ou WhatsApp"],
                ["excluir_convertidas", "Excluir quem já converteu em algum popup"],
              ]
          ).map(([k, n]) => (
            <div key={k} className="flex items-center justify-between">
              <Label className="text-xs">{n}</Label>
              <Switch checked={!!r.publico?.[k]} onCheckedChange={(v) => setR("publico", { [k]: v })} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Origem da visita</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs">Combinar condições</Label>
            <Select value={origem.modo ?? "todas"} onValueChange={(v) => setR("origem", { modo: v })}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas precisam valer</SelectItem>
                <SelectItem value="qualquer">Qualquer uma basta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {condicoes.map((c, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
              <Select
                value={c.campo ?? "utm_source"}
                onValueChange={(v) => {
                  const novas = [...condicoes];
                  novas[i] = { ...c, campo: v };
                  setR("origem", { condicoes: novas });
                }}
              >
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{CAMPOS_ORIGEM.map((o) => <SelectItem key={o.v} value={o.v}>{o.n}</SelectItem>)}</SelectContent>
              </Select>
              {c.campo === "parametro" && (
                <Input
                  className="w-40" placeholder="nome do parâmetro" value={c.nome ?? ""}
                  onChange={(e) => { const n = [...condicoes]; n[i] = { ...c, nome: e.target.value }; setR("origem", { condicoes: n }); }}
                />
              )}
              <Select
                value={c.op ?? "contem"}
                onValueChange={(v) => { const n = [...condicoes]; n[i] = { ...c, op: v }; setR("origem", { condicoes: n }); }}
              >
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{OPS.map((o) => <SelectItem key={o.v} value={o.v}>{o.n}</SelectItem>)}</SelectContent>
              </Select>
              {c.op !== "existe" && c.op !== "nao_existe" && (
                <Input
                  className="w-48" placeholder="valor" value={c.valor ?? ""}
                  onChange={(e) => { const n = [...condicoes]; n[i] = { ...c, valor: e.target.value }; setR("origem", { condicoes: n }); }}
                />
              )}
              <Button
                variant="ghost" size="icon"
                onClick={() => setR("origem", { condicoes: condicoes.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={() => setR("origem", { condicoes: [...condicoes, { campo: "utm_source", op: "contem", valor: "" }] })}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar condição
          </Button>
          <p className="text-[11px] text-muted-foreground">Casar o popup com a mensagem do anúncio de onde ela veio.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Frequência</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={r.frequencia?.tipo ?? "uma_vez"} onValueChange={(v) => setR("frequencia", { tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="uma_vez">Uma vez por pessoa</SelectItem>
              <SelectItem value="por_sessao">Uma vez por visita</SelectItem>
              <SelectItem value="a_cada_dias">No máximo a cada X dias</SelectItem>
              <SelectItem value="sempre">Sempre</SelectItem>
            </SelectContent>
          </Select>
          {r.frequencia?.tipo === "a_cada_dias" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Dias</Label>
              <Input type="number" min={1} value={r.frequencia?.dias ?? 7} onChange={(e) => setR("frequencia", { dias: Number(e.target.value) || 1 })} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Máximo de aparições (vazio sem limite)</Label>
            <Input
              type="number" min={0} value={r.frequencia?.max_impressoes ?? ""}
              onChange={(e) => setR("frequencia", { max_impressoes: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Se ela fechar, esperar X dias</Label>
            <Input type="number" min={0} value={r.frequencia?.pausa_apos_fechar_dias ?? 0} onChange={(e) => setR("frequencia", { pausa_apos_fechar_dias: Number(e.target.value) || 0 })} />
            <p className="text-[11px] text-muted-foreground">7 a 30 dias.</p>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Parar de aparecer depois que converter</Label>
            <Switch checked={!!r.frequencia?.parar_apos_conversao} onCheckedChange={(v) => setR("frequencia", { parar_apos_conversao: v })} />
          </div>
          <div className="rounded-md border border-border bg-muted/50 p-2 text-xs">{resumoFrequencia(r.frequencia)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Dispositivos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Computador</Label>
            <Switch checked={r.dispositivos?.desktop !== false} onCheckedChange={(v) => setR("dispositivos", { desktop: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Celular</Label>
            <Switch checked={r.dispositivos?.mobile !== false} onCheckedChange={(v) => setR("dispositivos", { mobile: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Período e horário
            {agendado && <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">Agendado</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Início</Label>
              <Input
                type="datetime-local" value={paraLocal(popup.inicio)}
                onChange={(e) => mudar({ inicio: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fim</Label>
              <Input
                type="datetime-local" value={paraLocal(popup.fim)}
                onChange={(e) => mudar({ fim: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Dias da semana</Label>
            <div className="flex flex-wrap gap-1">
              {DIAS.map((d, i) => {
                const sel = (r.horario?.dias ?? [0, 1, 2, 3, 4, 5, 6]).includes(i);
                return (
                  <button
                    key={d}
                    onClick={() => {
                      const atuais: number[] = r.horario?.dias ?? [0, 1, 2, 3, 4, 5, 6];
                      const novos = sel ? atuais.filter((x) => x !== i) : [...atuais, i].sort();
                      setR("horario", { dias: novos });
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition",
                      sel ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Das</Label>
              <Input type="time" value={r.horario?.de ?? ""} onChange={(e) => setR("horario", { de: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Até</Label>
              <Input type="time" value={r.horario?.ate ?? ""} onChange={(e) => setR("horario", { ate: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Aba minimizada</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Mostrar aba depois que fechar</Label>
            <Switch checked={!!r.teaser?.ativo} onCheckedChange={(v) => setR("teaser", { ativo: v })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Texto</Label>
            <Input value={r.teaser?.texto ?? ""} onChange={(e) => setR("teaser", { texto: e.target.value })} placeholder="Ganhe R$ 40 OFF" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Posição</Label>
              <Select value={r.teaser?.posicao ?? "direita"} onValueChange={(v) => setR("teaser", { posicao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="esquerda">Esquerda</SelectItem>
                  <SelectItem value="direita">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dias visível</Label>
              <Input type="number" min={0} value={r.teaser?.dias ?? 7} onChange={(e) => setR("teaser", { dias: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cor de fundo</Label>
              <Input value={r.teaser?.cor_fundo ?? ""} onChange={(e) => setR("teaser", { cor_fundo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor do texto</Label>
              <Input value={r.teaser?.cor_texto ?? ""} onChange={(e) => setR("teaser", { cor_texto: e.target.value })} />
            </div>
          </div>
          <SeletorFigurinha
            rotulo="Imagem da aba"
            valor={r.teaser?.imagem ?? ""}
            popupId={popup.id ?? "novo"}
            aoMudar={(url) => setR("teaser", { imagem: url })}
          />
          <div className="grid grid-cols-2 gap-3">
            <CampoCor rotulo="Cor da borda" valor={r.teaser?.cor_borda ?? ""} aoMudar={(v) => setR("teaser", { cor_borda: v })} />
            <CampoCor rotulo="Cor atrás da imagem" valor={r.teaser?.cor_avatar ?? ""} aoMudar={(v) => setR("teaser", { cor_avatar: v })} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Quem fecha sem converter vê uma aba pequena no canto. Tocar reabre o popup.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Prioridade e teste A/B</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Prioridade (menor abre primeiro)</Label>
            <Input type="number" value={popup.prioridade ?? 100} onChange={(e) => mudar({ prioridade: Number(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Grupo de teste A/B</Label>
            <Input value={popup.teste_ab_grupo ?? ""} onChange={(e) => mudar({ teste_ab_grupo: e.target.value || null })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Peso (0 a 100)</Label>
            <Input type="number" min={0} max={100} value={popup.peso ?? 100} onChange={(e) => mudar({ peso: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Popups com o mesmo nome de grupo dividem o público pelo peso. Cada pessoa sempre vê a mesma versão.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
