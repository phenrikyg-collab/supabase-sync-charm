import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, X } from "lucide-react";
import { ConstrutorPublico, filtroVazio, usePublicoCampos, type No } from "@/components/emails/ConstrutorPublico";
import { IframePrevia, usePreviaTemplate } from "@/components/emails/PreviaTemplate";
import { ContadorPublico } from "./ContadorPublico";
import { TIPOS_NO, type NoData, type TipoNo } from "./tipos";
import { ROTULO_EVENTO, type Catalogo } from "./api";

type NoLista = { ref: string; tipo: TipoNo; rotulo: string };

function Chips({ variaveis, onAdd }: { variaveis: string[]; onAdd: (v: string) => void }) {
  if (!variaveis.length) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {variaveis.map((v) => (
        <Badge
          key={v}
          variant="outline"
          className="cursor-pointer text-[10px]"
          onClick={() => onAdd(v)}
        >
          {v}
        </Badge>
      ))}
    </div>
  );
}

function CamposWhatsAppTemplate({
  config, catalogo, onChange, prefixoAjuda,
}: {
  config: Record<string, any>;
  catalogo?: Catalogo;
  onChange: (patch: Record<string, any>) => void;
  prefixoAjuda?: string;
}) {
  const templates = catalogo?.templates_whatsapp ?? [];
  const escolhido = templates.find((t) => String(t.id) === String(config.template_id));
  const qtd = Number(escolhido?.variaveis ?? 0);
  const variaveis: string[] = Array.isArray(config.variaveis) ? config.variaveis : [];

  const escolherTemplate = (id: string) => {
    const t = templates.find((x) => String(x.id) === id);
    const n = Number(t?.variaveis ?? 0);
    const novas = Array.from({ length: n }, (_, i) => variaveis[i] ?? (i === 0 ? "{{primeiro_nome}}" : ""));
    onChange({ template_id: id, variaveis: novas });
  };

  const previa = useMemo(() => {
    let texto = String(escolhido?.corpo ?? "");
    variaveis.forEach((v, i) => {
      texto = texto.split(`{{${i + 1}}}`).join(v || `exemplo ${i + 1}`);
    });
    return texto.split("{{primeiro_nome}}").join("Mariana");
  }, [escolhido?.corpo, JSON.stringify(variaveis)]);

  return (
    <div className="space-y-3">
      {prefixoAjuda && <p className="text-xs text-muted-foreground">{prefixoAjuda}</p>}
      <div className="space-y-1">
        <Label className="text-xs">Template aprovado</Label>
        <Select value={config.template_id ? String(config.template_id) : ""} onValueChange={escolherTemplate}>
          <SelectTrigger><SelectValue placeholder="Escolha um template" /></SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={String(t.id)} value={String(t.id)}>
                {t.nome} {t.categoria ? `(${t.categoria})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {escolhido?.copiar_cupom && (
          <Badge variant="outline" className="border-success/40 bg-success/10 text-[10px] text-success">
            Cupom no botão Copiar
          </Badge>
        )}
        {escolhido?.corpo && (
          <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
            {escolhido.corpo}
          </p>
        )}
      </div>

      {qtd > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Variáveis do template</Label>
          {Array.from({ length: qtd }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Input
                value={variaveis[i] ?? ""}
                placeholder={`Valor da variável ${i + 1}`}
                onChange={(e) => {
                  const novas = [...variaveis];
                  novas[i] = e.target.value;
                  onChange({ variaveis: novas });
                }}
              />
              <Chips
                variaveis={catalogo?.variaveis_texto ?? []}
                onAdd={(v) => {
                  const novas = [...variaveis];
                  novas[i] = `${novas[i] ?? ""}${v}`;
                  onChange({ variaveis: novas });
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Tipo do envio</Label>
        <Select value={config.tipo ?? ""} onValueChange={(v) => onChange({ tipo: v })}>
          <SelectTrigger><SelectValue placeholder="Deixe vazio para o padrão do template" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="campanha">Marketing: respeita 10h às 20h, seg a sáb, e opt-out</SelectItem>
            <SelectItem value="transacional">A cliente espera esta mensagem: sai a qualquer hora</SelectItem>
          </SelectContent>
        </Select>
        {!config.tipo && (
          <p className="text-[11px] text-muted-foreground">
            Sem escolha aqui, template do tipo UTILITY vira transacional sozinho.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Pode enviar no fim de semana</Label>
        <Switch
          checked={!!config.permite_fim_semana}
          onCheckedChange={(v) => onChange({ permite_fim_semana: v })}
        />
      </div>

      {previa && (
        <div className="space-y-1">
          <Label className="text-xs">Prévia</Label>
          <p className="whitespace-pre-wrap rounded-md border border-border p-2 text-[11px]">{previa}</p>
        </div>
      )}
    </div>
  );
}

function PreviaEmailDialog({ slug, open, onOpenChange }: { slug?: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data } = usePreviaTemplate(slug ?? undefined, open && !!slug);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Prévia do e-mail</DialogTitle></DialogHeader>
        {data?.html ? <IframePrevia html={data.html} mobile={false} titulo="Prévia do e-mail" /> : <p className="text-sm text-muted-foreground">Carregando prévia…</p>}
      </DialogContent>
    </Dialog>
  );
}

export function ConfigNoPanel({
  data, catalogo, nosDoFluxo, gatilhoTipo, onChange, onRemover, onFechar, onIrConfiguracoes,
}: {
  data: NoData;
  catalogo?: Catalogo;
  nosDoFluxo: NoLista[];
  gatilhoTipo?: string | null;
  onChange: (patch: { rotulo?: string; config?: Record<string, any> }) => void;
  onRemover: () => void;
  onFechar: () => void;
  onIrConfiguracoes: () => void;
}) {
  const ehCashback = gatilhoTipo === "cashback";
  const referenciasEspera = ehCashback ? catalogo?.espera_referencias ?? [] : [];
  const referenciaEspera = data.config?.referencia ? String(data.config.referencia) : "fixo";
  const modosExtra = ehCashback ? catalogo?.condicao_modos_extra ?? [] : [];
  const meta = TIPOS_NO[data.tipo] ?? TIPOS_NO.fim;
  const config = data.config ?? {};
  const { data: campos = [] } = usePublicoCampos();
  const [previaAberta, setPreviaAberta] = useState(false);

  const patch = (p: Record<string, any>) => onChange({ config: { ...config, ...p } });

  const templatesEmail = catalogo?.templates_email ?? [];
  const nosEnvio = nosDoFluxo.filter((n) => ["enviar_email", "whatsapp_template", "whatsapp_janela"].includes(n.tipo));
  const refDoNo = (valor: any) =>
    valor == null || valor === "" ? "" : /^\d+$/.test(String(valor)) ? `db-${valor}` : String(valor);
  const noEventoEscolhido = nosEnvio.find((n) => n.ref === refDoNo(config.no_id));
  const eventosDisponiveis =
    noEventoEscolhido?.tipo === "enviar_email"
      ? catalogo?.eventos?.email ?? []
      : noEventoEscolhido
        ? catalogo?.eventos?.whatsapp ?? []
        : [];

  const templateEmailEscolhido = templatesEmail.find((t) => String(t.id) === String(config.template_id));

  return (
    <Card className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{meta.label}</h3>
          <p className="text-[11px] text-muted-foreground">{meta.descricao}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onFechar} aria-label="Fechar painel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Rótulo</Label>
          <Input
            value={data.rotulo ?? ""}
            placeholder={meta.label}
            onChange={(e) => onChange({ rotulo: e.target.value })}
          />
        </div>

        {data.tipo === "gatilho" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Gatilho atual: {data.gatilhoRotulo || "não definido"}</p>
            <Button size="sm" variant="outline" onClick={onIrConfiguracoes}>
              Editar em Configurações
            </Button>
          </div>
        )}

        {data.tipo === "filtro" && (
          <div className="space-y-2">
            <Label className="text-xs">Quem passa</Label>
            <ConstrutorPublico
              filtro={(config.filtro ?? filtroVazio()) as No}
              campos={campos}
              empilhado
              onChange={(f) => patch({ filtro: f })}
            />
            <ContadorPublico filtro={config.filtro ?? filtroVazio()} />
          </div>
        )}

        {data.tipo === "condicao" && (
          <div className="space-y-3">
            <RadioGroup value={config.modo ?? "publico"} onValueChange={(v) => patch({ modo: v })} className="space-y-1">
              {[
                ["publico", "Dados da cliente"],
                ["evento", "Reação a um envio anterior"],
                ["comprou", "Comprou desde que entrou"],
                ["janela_whatsapp", "Janela de 24h do WhatsApp aberta"],
              ].map(([v, r]) => (
                <div key={v} className="flex items-center gap-2">
                  <RadioGroupItem value={v} id={`modo-${v}`} />
                  <Label htmlFor={`modo-${v}`} className="text-xs font-normal">{r}</Label>
                </div>
              ))}
            </RadioGroup>

            {(config.modo ?? "publico") === "publico" && (
              <div className="space-y-2">
                <ConstrutorPublico
                  filtro={(config.filtro ?? filtroVazio()) as No}
                  campos={campos}
                  empilhado
                  onChange={(f) => patch({ filtro: f })}
                />
                <ContadorPublico filtro={config.filtro ?? filtroVazio()} />
              </div>
            )}

            {config.modo === "evento" && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Passo de envio</Label>
                  <Select value={refDoNo(config.no_id)} onValueChange={(v) => patch({ no_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Escolha o envio" /></SelectTrigger>
                    <SelectContent>
                      {nosEnvio.map((n) => (
                        <SelectItem key={n.ref} value={n.ref}>{n.rotulo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">O que aconteceu</Label>
                  <Select value={config.evento ?? ""} onValueChange={(v) => patch({ evento: v })}>
                    <SelectTrigger><SelectValue placeholder="Escolha o evento" /></SelectTrigger>
                    <SelectContent>
                      {eventosDisponiveis.map((e: string) => (
                        <SelectItem key={e} value={e}>{ROTULO_EVENTO[e] ?? e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Coloque uma Espera antes de conferir abertura, leitura ou resposta.
            </p>
          </div>
        )}

        {data.tipo === "espera" && (
          <div className="space-y-3">
            {referenciasEspera.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Contar a partir de</Label>
                <Select
                  value={referenciaEspera}
                  onValueChange={(v) =>
                    patch(
                      v === "fixo"
                        ? { referencia: null, dias_antes: null }
                        : { referencia: v, dias_antes: config.dias_antes ?? 7, ate_hora: config.ate_hora ?? 10 },
                    )
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Tempo fixo</SelectItem>
                    {referenciasEspera.map((o) => (
                      <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {referenciaEspera !== "fixo" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Quantos dias antes de vencer</Label>
                  <Input
                    type="number"
                    min={0}
                    value={config.dias_antes ?? 7}
                    onChange={(e) => patch({ dias_antes: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hora (0 a 23)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={config.ate_hora ?? 10}
                    onChange={(e) => patch({ ate_hora: Number(e.target.value) })}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A espera termina esse tanto de dias antes do cashback vencer, no horário escolhido.
                </p>
              </div>
            ) : (
            <>
            <div className="grid grid-cols-3 gap-2">
              {[["dias", "Dias"], ["horas", "Horas"], ["minutos", "Minutos"]].map(([k, r]) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">{r}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={config[k] ?? 0}
                    onChange={(e) => patch({ [k]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Só a partir de um horário</Label>
              <Switch
                checked={config.ate_hora != null && config.ate_hora !== ""}
                onCheckedChange={(v) => patch({ ate_hora: v ? 10 : null })}
              />
            </div>
            {config.ate_hora != null && config.ate_hora !== "" && (
              <div className="space-y-1">
                <Label className="text-xs">Hora (0 a 23)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={config.ate_hora}
                  onChange={(e) => patch({ ate_hora: Number(e.target.value) })}
                />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Antes desse horário espera até ele; das 20h em diante passa para o dia seguinte.
            </p>
            </>
            )}
          </div>
        )}

        {data.tipo === "enviar_email" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Template</Label>
              <Select
                value={config.template_id ? String(config.template_id) : ""}
                onValueChange={(v) => patch({ template_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Escolha um template" /></SelectTrigger>
                <SelectContent>
                  {templatesEmail.map((t) => (
                    <SelectItem key={String(t.id)} value={String(t.id)}>
                      {t.nome}{t.assunto ? `: ${t.assunto}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Assunto</Label>
              <Input
                value={config.assunto ?? ""}
                placeholder="Deixe vazio para usar o assunto do template"
                onChange={(e) => patch({ assunto: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Cupom</Label>
              <RadioGroup value={config.cupom ?? "nao"} onValueChange={(v) => patch({ cupom: v })} className="space-y-1">
                {[
                  ["nao", "Sem cupom"],
                  ["rfm", "Só para os segmentos de cupom do CRM"],
                  ["sempre", "Sempre gera cupom"],
                  ["herdar", "Reusa o cupom de um e-mail anterior"],
                ].map(([v, r]) => (
                  <div key={v} className="flex items-center gap-2">
                    <RadioGroupItem value={v} id={`cupom-${v}`} />
                    <Label htmlFor={`cupom-${v}`} className="text-xs font-normal">{r}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {config.cupom === "herdar" && (
              <div className="space-y-1">
                <Label className="text-xs">E-mail de origem do cupom</Label>
                <Select
                  value={refDoNo(config.cupom_de_no)}
                  onValueChange={(v) => patch({ cupom_de_no: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Escolha o e-mail anterior" /></SelectTrigger>
                  <SelectContent>
                    {nosDoFluxo.filter((n) => n.tipo === "enviar_email").map((n) => (
                      <SelectItem key={n.ref} value={n.ref}>{n.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Incluir as peças que ela olhou</Label>
              <Switch
                checked={config.incluir_pecas !== false}
                onCheckedChange={(v) => patch({ incluir_pecas: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Respeitar o teto de e-mails por segmento</Label>
              <Switch
                checked={config.respeitar_teto !== false}
                onCheckedChange={(v) => patch({ respeitar_teto: v })}
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              disabled={!templateEmailEscolhido?.slug}
              onClick={() => setPreviaAberta(true)}
            >
              Pré-visualizar
            </Button>
            <PreviaEmailDialog
              slug={templateEmailEscolhido?.slug}
              open={previaAberta}
              onOpenChange={setPreviaAberta}
            />
          </div>
        )}

        {data.tipo === "whatsapp_template" && (
          <CamposWhatsAppTemplate config={config} catalogo={catalogo} onChange={patch} />
        )}

        {data.tipo === "whatsapp_janela" && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Texto livre</Label>
              <Textarea
                rows={5}
                value={config.texto ?? ""}
                onChange={(e) => patch({ texto: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">{String(config.texto ?? "").length} caracteres</p>
              <Chips
                variaveis={catalogo?.variaveis_texto ?? []}
                onAdd={(v) => patch({ texto: `${config.texto ?? ""}${v}` })}
              />
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-xs font-medium">Se a janela estiver fechada, sai o template:</p>
              <CamposWhatsAppTemplate config={config} catalogo={catalogo} onChange={patch} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              A janela é conferida na hora de sair a mensagem, não na hora em que a cliente chega neste passo.
            </p>
          </div>
        )}

        {data.tipo === "aplicar_tag" && (
          <div className="space-y-1">
            <Label className="text-xs">Tag</Label>
            <Select value={config.tag_id ? String(config.tag_id) : ""} onValueChange={(v) => patch({ tag_id: v })}>
              <SelectTrigger><SelectValue placeholder="Escolha uma tag" /></SelectTrigger>
              <SelectContent>
                {(catalogo?.tags ?? []).map((t) => (
                  <SelectItem key={String(t.id)} value={String(t.id)}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {data.tipo !== "gatilho" && (
          <Button size="sm" variant="outline" className="w-full text-danger" onClick={onRemover}>
            <Trash2 className="mr-2 h-4 w-4" />
            Remover passo
          </Button>
        )}
      </div>
    </Card>
  );
}
