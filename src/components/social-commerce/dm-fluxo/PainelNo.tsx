import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Flag, Plus, Trash2 } from "lucide-react";
import { SeletorProdutos, type ProdutoPai } from "../SeletorProdutos";
import {
  MAX_BOTOES, MAX_CARTOES, MAX_TITULO_BOTAO, ROTULO_TIPO, VARIAVEIS_PADRAO,
  limparTravessao, novaChave, type ConfigNo, type NoFluxoDados,
} from "@/lib/igDmFluxos";

/** Campo de texto com chips de variáveis que inserem no cursor. */
function CampoTexto({
  valor,
  onChange,
  variaveis,
  linhas = 4,
  placeholder,
}: {
  valor: string;
  onChange: (v: string) => void;
  variaveis: string[];
  linhas?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const inserir = (nome: string) => {
    const el = ref.current;
    const marca = `{{${nome}}}`;
    if (!el) return onChange(`${valor}${marca}`);
    const ini = el.selectionStart ?? valor.length;
    const fim = el.selectionEnd ?? valor.length;
    const novo = `${valor.slice(0, ini)}${marca}${valor.slice(fim)}`;
    onChange(novo);
    requestAnimationFrame(() => {
      el.focus();
      const p = ini + marca.length;
      el.setSelectionRange(p, p);
    });
  };
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {variaveis.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => inserir(v)}
            className="rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
          >
            {`{{${v}}}`}
          </button>
        ))}
      </div>
      <Textarea
        ref={ref}
        rows={linhas}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(limparTravessao(e.target.value))}
      />
    </div>
  );
}

export function PainelNo({
  no,
  nos,
  variaveis,
  produtos,
  inicial,
  onChange,
  onDefinirInicio,
  onExcluir,
}: {
  no: NoFluxoDados;
  nos: NoFluxoDados[];
  variaveis: string[];
  produtos: ProdutoPai[];
  inicial: boolean;
  onChange: (patch: Partial<NoFluxoDados>) => void;
  onDefinirInicio: () => void;
  onExcluir: () => void;
}) {
  const c = no.config ?? {};
  const setConfig = (patch: Partial<ConfigNo>) => onChange({ config: { ...c, ...patch } });
  const botoes = c.botoes ?? [];
  const todasVariaveis = [...VARIAVEIS_PADRAO, ...variaveis];

  const addBotao = () => {
    if (botoes.length >= MAX_BOTOES) return;
    setConfig({ botoes: [...botoes, { id: novaChave("bt"), titulo: "", destino: null }] });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {ROTULO_TIPO[no.tipo]}
          </p>
          <Input
            className="mt-1 h-8"
            value={no.rotulo}
            onChange={(e) => onChange({ rotulo: limparTravessao(e.target.value) })}
            placeholder="Nome do passo"
          />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {(no.tipo === "mensagem" || no.tipo === "pergunta" || no.tipo === "humano") && (
          <div className="space-y-1.5">
            <Label className="text-xs">
              {no.tipo === "humano" ? "Aviso para a cliente (opcional)" : "Texto"}
            </Label>
            <CampoTexto
              valor={c.texto ?? ""}
              onChange={(v) => setConfig({ texto: v })}
              variaveis={todasVariaveis}
              placeholder="Oi {{primeiro_nome}} 💛"
            />
          </div>
        )}

        {no.tipo === "pergunta" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Resposta esperada</Label>
                <Select
                  value={c.validacao ?? "livre"}
                  onValueChange={(v) => setConfig({ validacao: v as any })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="livre">Qualquer texto</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="tamanho">Tamanho</SelectItem>
                    <SelectItem value="cep">CEP</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="numero">Número</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Guardar em</Label>
                <Input
                  className="h-8 text-xs"
                  value={c.variavel ?? ""}
                  onChange={(e) =>
                    setConfig({ variavel: e.target.value.replace(/[^\w]/g, "_").toLowerCase() })
                  }
                  placeholder="tamanho"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Texto quando a resposta não serve</Label>
              <Input
                className="h-8 text-xs"
                value={c.texto_invalido ?? ""}
                onChange={(e) => setConfig({ texto_invalido: limparTravessao(e.target.value) })}
                placeholder="Não entendi, pode escrever de novo?"
              />
            </div>

            {c.validacao === "email" && (
              <div className="space-y-2 rounded-lg border border-success/30 bg-success/5 p-2.5">
                <p className="text-[11px] text-muted-foreground">
                  O e-mail fica guardado na ficha da cliente e ligado ao Instagram dela para sempre.
                  Se ela já comprou, o sistema reconhece na hora.
                </p>
                <div className="flex items-start gap-2">
                  <Switch
                    checked={!!c.consentimento_marketing}
                    onCheckedChange={(v) => setConfig({ consentimento_marketing: v })}
                  />
                  <div>
                    <Label className="cursor-pointer text-xs">
                      Conta como consentimento de marketing
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Ligue só se a pergunta deixar claro que ela vai receber novidades por e-mail.
                    </p>
                  </div>
                </div>
                {!botoes.some((b) => /não informar/i.test(b.titulo)) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      setConfig({
                        botoes: [
                          ...botoes,
                          { id: novaChave("bt"), titulo: "Prefiro não informar", destino: c.proximo ?? null },
                        ],
                      })
                    }
                  >
                    Adicionar botão "Prefiro não informar"
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {(no.tipo === "mensagem" || no.tipo === "pergunta") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Botões ({botoes.length}/{MAX_BOTOES})</Label>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={addBotao}
                disabled={botoes.length >= MAX_BOTOES}
              >
                <Plus className="mr-1 h-3 w-3" /> Botão
              </Button>
            </div>
            {botoes.map((b, i) => {
              const excedeu = (b.titulo ?? "").length > MAX_TITULO_BOTAO;
              return (
                <div key={b.id} className="flex items-center gap-1.5">
                  <Input
                    className={`h-8 text-xs ${excedeu ? "border-danger" : ""}`}
                    value={b.titulo}
                    onChange={(e) =>
                      setConfig({
                        botoes: botoes.map((x, j) =>
                          j === i ? { ...x, titulo: limparTravessao(e.target.value) } : x,
                        ),
                      })
                    }
                    placeholder="Quero ver as peças"
                  />
                  <span className={`w-10 text-right text-[10px] ${excedeu ? "text-danger" : "text-muted-foreground"}`}>
                    {(b.titulo ?? "").length}/{MAX_TITULO_BOTAO}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setConfig({ botoes: botoes.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
            {botoes.length >= MAX_BOTOES && (
              <p className="text-[10px] text-muted-foreground">
                O WhatsApp da Meta aceita no máximo {MAX_BOTOES} botões por mensagem.
              </p>
            )}
          </div>
        )}

        {no.tipo === "cartao" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={c.usar_pecas_da_live !== false}
                onCheckedChange={(v) => setConfig({ usar_pecas_da_live: v })}
              />
              <Label className="cursor-pointer text-xs">Usar as peças da live</Label>
            </div>
            {c.usar_pecas_da_live === false && (
              <>
                <SeletorProdutos
                  produtos={produtos}
                  selecionados={c.produtos ?? []}
                  onToggle={(id, marcado) => {
                    const atuais = c.produtos ?? [];
                    if (marcado && atuais.length >= MAX_CARTOES) return;
                    setConfig({
                      produtos: marcado
                        ? [...atuais, String(id)]
                        : atuais.filter((p) => p !== String(id)),
                    });
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  Até {MAX_CARTOES} peças. Peça sem estoque ou sem link é pulada automaticamente.
                </p>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Texto do botão do cartão</Label>
              <Input
                className="h-8 text-xs"
                value={c.texto_botao ?? ""}
                onChange={(e) => setConfig({ texto_botao: limparTravessao(e.target.value) })}
                placeholder="Ver peça"
              />
            </div>
          </div>
        )}

        {no.tipo === "espera" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Esperar</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="h-8 w-24 text-xs"
                value={Math.max(1, Math.round((Number(c.segundos ?? 60) / 60) * 100) / 100)}
                onChange={(e) => {
                  const min = Number(e.target.value) || 0;
                  setConfig({ segundos: Math.min(86400, Math.max(5, Math.round(min * 60))) });
                }}
              />
              <span className="text-xs text-muted-foreground">minutos (de 5 segundos a 24 horas)</span>
            </div>
          </div>
        )}

        {no.tipo === "condicao" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Campo</Label>
                <Select value={c.campo ?? "email"} onValueChange={(v) => setConfig({ campo: v as any })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="cliente">Já é cliente</SelectItem>
                    <SelectItem value="comprou">Já comprou</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                    <SelectItem value="variavel">Variável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Comparação</Label>
                <Select
                  value={c.operador ?? "existe"}
                  onValueChange={(v) => setConfig({ operador: v as any })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existe">existe</SelectItem>
                    <SelectItem value="igual">é igual a</SelectItem>
                    <SelectItem value="contem">contém</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {c.campo === "variavel" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Variável</Label>
                <Input
                  className="h-8 text-xs"
                  value={c.variavel ?? ""}
                  onChange={(e) => setConfig({ variavel: e.target.value })}
                />
              </div>
            )}
            {c.operador !== "existe" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Valor</Label>
                <Input
                  className="h-8 text-xs"
                  value={c.valor ?? ""}
                  onChange={(e) => setConfig({ valor: e.target.value })}
                />
              </div>
            )}
          </div>
        )}

        {no.tipo === "tag" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Tag</Label>
            <Input
              className="h-8 text-xs"
              value={c.tag ?? ""}
              onChange={(e) => setConfig({ tag: e.target.value })}
              placeholder="live_setembro"
            />
          </div>
        )}

        {no.tipo === "anna" && (
          <p className="text-xs text-muted-foreground">
            A partir daqui a Anna assume a conversa e responde do jeito dela.
          </p>
        )}
        {no.tipo === "fim" && (
          <p className="text-xs text-muted-foreground">O fluxo termina neste passo.</p>
        )}

        <Separator />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onDefinirInicio}
            disabled={inicial}
          >
            <Flag className="mr-1 h-3.5 w-3.5" /> Definir como início
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-danger" onClick={onExcluir}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir passo
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Ligações: arraste da bolinha à direita do passo até a entrada do próximo. Passos ligados:{" "}
          {nos.length}.
        </p>
      </div>
    </div>
  );
}
