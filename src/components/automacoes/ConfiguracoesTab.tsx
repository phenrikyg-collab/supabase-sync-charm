import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConstrutorPublico, filtroVazio, usePublicoCampos, type No } from "@/components/emails/ConstrutorPublico";
import { ContadorPublico } from "./ContadorPublico";
import type { Catalogo } from "./api";

const DIAS_SEMANA: [number, string][] = [
  [1, "seg"], [2, "ter"], [3, "qua"], [4, "qui"], [5, "sex"], [6, "sáb"], [7, "dom"],
];

function CampoNumero({
  rotulo, valor, ajuda, onChange, min = 0, max,
}: {
  rotulo: string;
  valor: any;
  ajuda?: string;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{rotulo}</Label>
      <Input type="number" min={min} max={max} value={valor ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
      {ajuda && <p className="text-[11px] text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

export function ConfiguracoesTab({
  fluxo, catalogo, onChange,
}: {
  fluxo: Record<string, any>;
  catalogo?: Catalogo;
  onChange: (patch: Record<string, any>) => void;
}) {
  const { data: campos = [] } = usePublicoCampos();
  const gatilhoTipo = fluxo.gatilho_tipo ?? "";
  const gc = fluxo.gatilho_config ?? {};
  const setGc = (p: Record<string, any>) => onChange({ gatilho_config: { ...gc, ...p } });
  const gatilhoMeta = (catalogo?.gatilhos ?? []).find((g) => g.tipo === gatilhoTipo);
  const grupos = catalogo?.grupos ?? [];

  const diasSemana: number[] = Array.isArray(gc.dias_semana) ? gc.dias_semana : [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3 p-4">
        <h3 className="font-serif text-lg">Identificação</h3>
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input value={fluxo.nome ?? ""} onChange={(e) => onChange({ nome: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Descrição</Label>
          <Textarea rows={3} value={fluxo.descricao ?? ""} onChange={(e) => onChange({ descricao: e.target.value })} />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="font-serif text-lg">Gatilho</h3>
        <Select value={gatilhoTipo} onValueChange={(v) => onChange({ gatilho_tipo: v, gatilho_config: {} })}>
          <SelectTrigger><SelectValue placeholder="Escolha o gatilho" /></SelectTrigger>
          <SelectContent>
            {(catalogo?.gatilhos ?? []).map((g) => (
              <SelectItem key={g.tipo} value={g.tipo}>{g.rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {gatilhoMeta?.descricao && <p className="text-xs text-muted-foreground">{gatilhoMeta.descricao}</p>}

        {gatilhoTipo === "filtro" && (
          <p className="text-xs text-muted-foreground">
            O público de entrada é o critério. Confira se ele não está vazio.
          </p>
        )}

        {gatilhoTipo === "navegacao" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoNumero rotulo="Mínimo de visualizações" valor={gc.min_visualizacoes} onChange={(v) => setGc({ min_visualizacoes: v })} />
            <CampoNumero rotulo="Janela (horas)" valor={gc.janela_horas} onChange={(v) => setGc({ janela_horas: v })} />
            <CampoNumero rotulo="Espera (minutos)" valor={gc.espera_minutos} onChange={(v) => setGc({ espera_minutos: v })} />
            <CampoNumero rotulo="Máximo de peças" valor={gc.max_pecas} onChange={(v) => setGc({ max_pecas: v })} />
            <div className="flex items-center justify-between gap-2 sm:col-span-2">
              <Label className="text-xs">Não entra quem tem carrinho aberto</Label>
              <Switch checked={!!gc.exclui_carrinho} onCheckedChange={(v) => setGc({ exclui_carrinho: v })} />
            </div>
            <div className="sm:col-span-2">
              <CampoNumero
                rotulo="Intervalo de contato (dias)"
                valor={gc.intervalo_contato_dias}
                ajuda="Não entra quem recebeu qualquer e-mail nos últimos N dias. Use 0 para desligar."
                onChange={(v) => setGc({ intervalo_contato_dias: v })}
              />
            </div>
          </div>
        )}

        {gatilhoTipo === "carrinho" && (
          <CampoNumero rotulo="Horas após o carrinho" valor={gc.horas_apos} onChange={(v) => setGc({ horas_apos: v })} />
        )}
        {(gatilhoTipo === "compra" || gatilhoTipo === "cadastro") && (
          <CampoNumero rotulo="Dias depois" valor={gc.dias_apos} onChange={(v) => setGc({ dias_apos: v })} />
        )}
        {gatilhoTipo === "lead_novo" && (
          <CampoNumero rotulo="Horas no máximo" valor={gc.horas_max} onChange={(v) => setGc({ horas_max: v })} />
        )}
        {["aniversario", "aniversario_cliente", "cashback"].includes(gatilhoTipo) && (
          <CampoNumero rotulo="Dias antes" valor={gc.dias_antes} onChange={(v) => setGc({ dias_antes: v })} />
        )}

        {gatilhoTipo === "agendado" && (
          <div className="space-y-2">
            <CampoNumero rotulo="Hora (0 a 23)" valor={gc.hora} max={23} onChange={(v) => setGc({ hora: v })} />
            <div className="space-y-1">
              <Label className="text-xs">Dias da semana</Label>
              <div className="flex flex-wrap gap-1">
                {DIAS_SEMANA.map(([n, r]) => {
                  const ativo = diasSemana.includes(n);
                  return (
                    <Badge
                      key={n}
                      variant={ativo ? "default" : "outline"}
                      className="cursor-pointer text-[11px]"
                      onClick={() =>
                        setGc({
                          dias_semana: ativo ? diasSemana.filter((d) => d !== n) : [...diasSemana, n].sort(),
                        })
                      }
                    >
                      {r}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {gatilhoTipo === "manual" && (
          <p className="text-xs text-muted-foreground">Só entra quem você colocar pelo Disparar agora.</p>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="font-serif text-lg">Público de entrada</h3>
        <p className="text-xs text-muted-foreground">
          O gatilho diz quando a cliente entra; o público diz quem pode entrar.
        </p>
        <ConstrutorPublico
          filtro={(fluxo.publico_filtro ?? filtroVazio()) as No}
          campos={campos}
          onChange={(f) => onChange({ publico_filtro: f })}
        />
        <ContadorPublico filtro={fluxo.publico_filtro ?? filtroVazio()} rotulo="Público hoje" />
      </Card>

      <Card className="space-y-4 p-4">
        <h3 className="font-serif text-lg">Regras</h3>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Sair do fluxo quando comprar</Label>
            <Switch
              checked={!!fluxo.sair_ao_comprar}
              onCheckedChange={(v) => onChange({ sair_ao_comprar: v })}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Quem comprar no meio do caminho sai na hora e o que estiver na fila é cancelado. Deixe desligado em fluxos pós-compra.
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Grupo exclusivo</Label>
          <Input
            list="grupos-fluxo"
            value={fluxo.grupo_exclusivo ?? ""}
            placeholder="Sem grupo"
            onChange={(e) => onChange({ grupo_exclusivo: e.target.value || null })}
          />
          <datalist id="grupos-fluxo">
            {grupos.map((g) => <option key={g} value={g} />)}
          </datalist>
          <p className="text-[11px] text-muted-foreground">
            Quem está ativo num fluxo do grupo não entra em outro do mesmo grupo.
          </p>
        </div>

        <CampoNumero
          rotulo="Prioridade"
          valor={fluxo.prioridade}
          ajuda="Menor número roda primeiro."
          onChange={(v) => onChange({ prioridade: v })}
        />

        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Pode entrar de novo</Label>
          <Switch
            checked={!!fluxo.repetir_por_cliente}
            onCheckedChange={(v) => onChange({ repetir_por_cliente: v })}
          />
        </div>
        {fluxo.repetir_por_cliente && (
          <CampoNumero
            rotulo="Depois de quantos dias"
            valor={fluxo.intervalo_minimo_dias}
            onChange={(v) => onChange({ intervalo_minimo_dias: v })}
          />
        )}

        <CampoNumero
          rotulo="Máximo de pessoas que entram por rodada"
          valor={fluxo.lote_max}
          onChange={(v) => onChange({ lote_max: v })}
        />
      </Card>
    </div>
  );
}
