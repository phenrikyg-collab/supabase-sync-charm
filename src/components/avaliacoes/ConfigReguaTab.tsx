import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { avalConfigLer, avalConfigSalvar, formatarData, type ConfigRegua } from "@/lib/avaliacoes";

function listaTelefones(v: any): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) return v.split(/[,;\s]+/).filter(Boolean);
  return [];
}

const FIGURINHAS: { valor: string; rotulo: string }[] = [
  { valor: "reacao_carinho", rotulo: "Ai, que amor! (atual)" },
  { valor: "agradecimento", rotulo: "Obrigada, viu" },
  { valor: "pos_entrega_review", rotulo: "Chegou?! Me mostra!" },
  { valor: "reacao_elogio_cliente", rotulo: "Mandou bem!" },
];

export function ConfigReguaTab() {
  const { toast } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [cfg, setCfg] = useState<ConfigRegua>({});
  const [telefones, setTelefones] = useState<string[]>([]);
  const [novoTelefone, setNovoTelefone] = useState("");

  async function carregar() {
    setCarregando(true);
    try {
      const c = (await avalConfigLer()) ?? {};
      const fluxo = (c.fluxo ?? {}) as Record<string, any>;
      setCfg({
        ...c,
        figurinha_final: c.figurinha_final ?? fluxo.figurinha_final ?? false,
        figurinha_final_tag: c.figurinha_final_tag ?? fluxo.figurinha_final_tag ?? "reacao_carinho",
      });
      setTelefones(listaTelefones(c?.telefones_teste));
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

  function set(chave: string, valor: any) {
    setCfg((c) => ({ ...c, [chave]: valor }));
  }

  const baseEnvio = (cfg.base_prazo ?? "envio") === "envio";

  async function salvar() {
    setSalvando(true);
    try {
      await avalConfigSalvar({
        envio_ativo: !!cfg.envio_ativo,
        modo_teste: !!cfg.modo_teste,
        telefones_teste: telefones,
        base_prazo: cfg.base_prazo ?? "envio",
        dias_apos_envio: Number(cfg.dias_apos_envio ?? 0),
        dias_apos_entrega: Number(cfg.dias_apos_entrega ?? 0),
        dias_estimativa_entrega: Number(cfg.dias_estimativa_entrega ?? 0),
        nota_minima_auto: Number(cfg.nota_minima_auto ?? 4),
        fotos_auto_publicar: !!cfg.fotos_auto_publicar,
        agrupar_familia: !!cfg.agrupar_familia,
        lembrete_canal: cfg.lembrete_canal ?? "email",
        email_no_primeiro_envio: !!cfg.email_no_primeiro_envio,
        lembrete_ativo: !!cfg.lembrete_ativo,
        dias_lembrete: Number(cfg.dias_lembrete ?? 0),
        janela_inicio_hora: Number(cfg.janela_inicio_hora ?? 0),
        janela_fim_hora: Number(cfg.janela_fim_hora ?? 0),
        lote_max: Number(cfg.lote_max ?? 40),
        figurinha_final: !!cfg.figurinha_final,
        figurinha_final_tag: cfg.figurinha_final_tag ?? "reacao_carinho",
        google_review_url: cfg.google_review_url ?? null,
      });
      toast({ title: "Configuração salva" });
      await carregar();
    } catch (e: any) {
      toast({ title: "Não foi possível salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4 pt-4">
      <Card className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="envio_ativo" className="text-sm font-medium">
              Enviar pedidos de avaliação
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Desligado, nenhum pedido de avaliação sai. A fila continua sendo gerada.
            </p>
          </div>
          <Switch
            id="envio_ativo"
            checked={!!cfg.envio_ativo}
            onCheckedChange={(v) => set("envio_ativo", v)}
          />
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
          <div>
            <Label htmlFor="modo_teste" className="text-sm font-medium">
              Modo teste
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Com o modo teste ligado, o pedido de avaliação só vai para os telefones da lista
              abaixo. Os outros pedidos ficam esperando na fila.
            </p>
          </div>
          <Switch
            id="modo_teste"
            checked={!!cfg.modo_teste}
            onCheckedChange={(v) => set("modo_teste", v)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Telefones de teste</Label>
          <div className="flex flex-wrap gap-2">
            {telefones.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <button
                  type="button"
                  aria-label={`Remover ${t}`}
                  onClick={() => setTelefones((l) => l.filter((x) => x !== t))}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {!telefones.length && <span className="text-sm text-muted-foreground">Nenhum</span>}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="(11) 90000-0000"
              value={novoTelefone}
              onChange={(e) => setNovoTelefone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && novoTelefone.trim()) {
                  setTelefones((l) => Array.from(new Set([...l, novoTelefone.trim()])));
                  setNovoTelefone("");
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                if (!novoTelefone.trim()) return;
                setTelefones((l) => Array.from(new Set([...l, novoTelefone.trim()])));
                setNovoTelefone("");
              }}
            >
              Adicionar
            </Button>
          </div>
        </div>
      </Card>

      <Card className="space-y-5 p-5">
        <h3 className="font-serif text-lg">Quando o convite sai</h3>

        <div className="space-y-1.5">
          <Label htmlFor="base_prazo">Contagem do prazo</Label>
          <Select
            value={cfg.base_prazo ?? "envio"}
            onValueChange={(v) => set("base_prazo", v)}
          >
            <SelectTrigger id="base_prazo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="envio">Contar do envio</SelectItem>
              <SelectItem value="entrega">Contar da entrega</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Contar do envio funciona para 100% dos pedidos, já a confirmação de entrega só existe
            em parte deles.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div
            className={`space-y-1.5 rounded-lg p-3 ${baseEnvio ? "bg-muted/60" : "opacity-60"}`}
          >
            <Label htmlFor="dias_apos_envio">Dias após o envio</Label>
            <Input
              id="dias_apos_envio"
              type="number"
              min={0}
              max={60}
              value={cfg.dias_apos_envio ?? 0}
              onChange={(e) => set("dias_apos_envio", e.target.value)}
            />
          </div>
          <div
            className={`space-y-1.5 rounded-lg p-3 ${!baseEnvio ? "bg-muted/60" : "opacity-60"}`}
          >
            <Label htmlFor="dias_apos_entrega">Dias após a entrega</Label>
            <Input
              id="dias_apos_entrega"
              type="number"
              min={0}
              max={30}
              value={cfg.dias_apos_entrega ?? 0}
              onChange={(e) => set("dias_apos_entrega", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dias_estimativa_entrega">
            Quando o rastreio não confirma, considerar entregue em X dias após o envio
          </Label>
          <Input
            id="dias_estimativa_entrega"
            type="number"
            min={0}
            max={30}
            value={cfg.dias_estimativa_entrega ?? 0}
            onChange={(e) => set("dias_estimativa_entrega", e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="janela_inicio_hora">Envio a partir de (hora)</Label>
            <Input
              id="janela_inicio_hora"
              type="number"
              min={0}
              max={23}
              value={cfg.janela_inicio_hora ?? 0}
              onChange={(e) => set("janela_inicio_hora", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="janela_fim_hora">Envio até (hora)</Label>
            <Input
              id="janela_fim_hora"
              type="number"
              min={0}
              max={23}
              value={cfg.janela_fim_hora ?? 0}
              onChange={(e) => set("janela_fim_hora", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lote_max">Máximo de convites por hora</Label>
          <Input
            id="lote_max"
            type="number"
            min={1}
            max={200}
            value={cfg.lote_max ?? 40}
            onChange={(e) => set("lote_max", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            O motor respeita este limite a cada hora, então um lote grande se espalha por várias
            horas em vez de sair todo de uma vez.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm">
            Início da régua:{" "}
            <span className="font-medium">{formatarData(cfg.vigencia_inicio)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {baseEnvio
              ? "Só pedidos enviados a partir desta data entram na fila."
              : "Só pedidos entregues a partir desta data entram na fila."}
          </p>
        </div>
      </Card>

      <Card className="space-y-5 p-5">
        <h3 className="font-serif text-lg">Publicação e moderação</h3>

        <div className="space-y-1.5">
          <Label htmlFor="nota_minima_auto">Publicar direto a partir da nota</Label>
          <Input
            id="nota_minima_auto"
            type="number"
            min={1}
            max={5}
            value={cfg.nota_minima_auto ?? 4}
            onChange={(e) => set("nota_minima_auto", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Avaliação com nota abaixo desse valor fica pendente de moderação em vez de publicar.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <Label htmlFor="fotos_auto_publicar">
            Foto da cliente publica direto, sem aprovação
          </Label>
          <Switch
            id="fotos_auto_publicar"
            checked={!!cfg.fotos_auto_publicar}
            onCheckedChange={(v) => set("fotos_auto_publicar", v)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="agrupar_familia">
            Avaliação vale para todas as cores do mesmo modelo
          </Label>
          <Switch
            id="agrupar_familia"
            checked={!!cfg.agrupar_familia}
            onCheckedChange={(v) => set("agrupar_familia", v)}
          />
        </div>
      </Card>

      <Card className="space-y-5 p-5">
        <h3 className="font-serif text-lg">Canais</h3>

        <div className="space-y-1.5">
          <Label htmlFor="lembrete_canal">Canal do lembrete</Label>
          <Select
            value={cfg.lembrete_canal ?? "email"}
            onValueChange={(v) => set("lembrete_canal", v)}
          >
            <SelectTrigger id="lembrete_canal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            O lembrete por e-mail não custa template.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
          <div>
            <Label htmlFor="email_no_primeiro_envio">Enviar e-mail junto com o WhatsApp</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Desligado, o e-mail só sai para quem não tem telefone ou quando o envio do WhatsApp
              falha.
            </p>
          </div>
          <Switch
            id="email_no_primeiro_envio"
            checked={!!cfg.email_no_primeiro_envio}
            onCheckedChange={(v) => set("email_no_primeiro_envio", v)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="lembrete_ativo">Enviar lembrete para quem não respondeu</Label>
          <Switch
            id="lembrete_ativo"
            checked={!!cfg.lembrete_ativo}
            onCheckedChange={(v) => set("lembrete_ativo", v)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dias_lembrete">Dias até o lembrete</Label>
          <Input
            id="dias_lembrete"
            type="number"
            min={0}
            max={30}
            value={cfg.dias_lembrete ?? 0}
            onChange={(e) => set("dias_lembrete", e.target.value)}
          />
        </div>

        <div className="space-y-1.5 border-t border-border pt-4">
          <Label htmlFor="google_review_url">Link da avaliação no Google</Label>
          <Input
            id="google_review_url"
            value={cfg.google_review_url ?? ""}
            onChange={(e) => set("google_review_url", e.target.value)}
            placeholder="https://"
          />
        </div>
      </Card>

      <Card className="space-y-5 p-5">
        <h3 className="font-serif text-lg">Fim da conversa</h3>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="figurinha_final">Mandar figurinha no fim da conversa</Label>
          <Switch
            id="figurinha_final"
            checked={!!cfg.figurinha_final}
            onCheckedChange={(v) => set("figurinha_final", v)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="figurinha_final_tag">Figurinha usada</Label>
          <Select
            value={cfg.figurinha_final_tag ?? "reacao_carinho"}
            onValueChange={(v) => set("figurinha_final_tag", v)}
          >
            <SelectTrigger id="figurinha_final_tag">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIGURINHAS.map((f) => (
                <SelectItem key={f.valor} value={f.valor}>
                  {f.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={salvando}>
          {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}
