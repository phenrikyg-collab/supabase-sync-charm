import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, GripVertical, ImagePlus, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  BLOCOS_DISPONIVEIS,
  CONFIG_PADRAO,
  ConfigGeral,
  carregarConfigGeral,
  salvarConfigGeral,
  uploadLogo,
} from "@/lib/linkbioPerfil";

export function AparenciaTab() {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<ConfigGeral>(CONFIG_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    carregarConfigGeral()
      .then(setCfg)
      .catch((e: any) => toast.error(e.message ?? "Erro ao carregar a configuração."))
      .finally(() => setCarregando(false));
  }, []);

  const set = (patch: Partial<ConfigGeral>) => setCfg((p) => ({ ...p, ...patch }));

  const onDrop = (destino: number) => {
    if (dragIdx === null || dragIdx === destino) return;
    setCfg((p) => {
      const copia = [...p.ordem_blocos];
      const [mov] = copia.splice(dragIdx, 1);
      copia.splice(destino, 0, mov);
      return { ...p, ordem_blocos: copia };
    });
    setDragIdx(null);
  };

  const handleLogo = async (file: File | null) => {
    if (!file) return;
    setEnviando(true);
    try {
      set({ logo_url: await uploadLogo(file) });
      toast.success("Logo enviada. Clique em Salvar para publicar.");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar a logo.");
    } finally {
      setEnviando(false);
    }
  };

  // Cada toggle é independente: atualiza só a sua chave e persiste sozinho.
  const alternar = async (chave: "lead_ativo" | "lead_jogo_ativo", valor: boolean) => {
    const anterior = cfg[chave];
    const proximo = { ...cfg, [chave]: valor };
    setCfg(proximo);
    try {
      await salvarConfigGeral(proximo);
      qc.invalidateQueries({ queryKey: ["linkbio-config"] });
      toast.success(valor ? "Ativado." : "Desativado.");
    } catch (e: any) {
      setCfg((p) => ({ ...p, [chave]: anterior }));
      toast.error(e.message ?? "Erro ao salvar.");
    }
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await salvarConfigGeral(cfg);
      qc.invalidateQueries({ queryKey: ["linkbio-config"] });
      toast.success("Aparência salva. A página pública já reflete a alteração.");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Identidade da página</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
              {cfg.logo_url ? (
                <img src={cfg.logo_url} alt="Logo da página link na bio" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogo(e.target.files?.[0] ?? null)}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={enviando}>
                {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-2" />}
                Trocar logo
              </Button>
              {cfg.logo_url && (
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => set({ logo_url: "" })}>
                  Remover
                </Button>
              )}
              <p className="text-xs text-muted-foreground">PNG ou JPG quadrado, mínimo 300x300px.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={cfg.titulo} onChange={(e) => set({ titulo: e.target.value })} placeholder="Use Mariana Cardoso" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Descrição (bio curta)</Label>
              <Textarea
                value={cfg.descricao}
                onChange={(e) => set({ descricao: e.target.value })}
                rows={3}
                placeholder="Moda feminina que veste bem de verdade."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ordem dos blocos na página</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Arraste pelo ícone para definir a sequência exibida na bio.</p>
          {cfg.ordem_blocos.map((id, idx) => {
            const bloco = BLOCOS_DISPONIVEIS.find((b) => b.id === id);
            return (
              <div
                key={id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(idx)}
                className={`flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 ${dragIdx === idx ? "opacity-60" : ""}`}
              >
                <div
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragEnd={() => setDragIdx(null)}
                  className="cursor-grab text-muted-foreground"
                  aria-label="Reordenar bloco"
                >
                  <GripVertical className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{idx + 1}.</span>
                <span className="text-sm">{bloco?.nome ?? id}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Formulário de Cupom</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
            <Switch
              id="lead-ativo"
              checked={cfg.lead_ativo}
              onCheckedChange={(v) => set({ lead_ativo: v })}
            />
            <Label htmlFor="lead-ativo" className="cursor-pointer">
              Exibir formulário de cupom na página pública
            </Label>
          </div>

          <fieldset disabled={!cfg.lead_ativo} className={cfg.lead_ativo ? "space-y-4" : "space-y-4 opacity-50"}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">

              <Label>Título do card</Label>
              <Input
                value={cfg.lead_titulo}
                maxLength={120}
                onChange={(e) => set({ lead_titulo: e.target.value })}
                placeholder="Ganhe 10% OFF na primeira compra"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Texto do botão (CTA)</Label>
              <Input
                value={cfg.lead_cta_texto}
                maxLength={60}
                onChange={(e) => set({ lead_cta_texto: e.target.value })}
                placeholder="Quero meu desconto"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Descrição do card</Label>
              <Textarea
                value={cfg.lead_descricao}
                maxLength={300}
                rows={2}
                onChange={(e) => set({ lead_descricao: e.target.value })}
                placeholder="Cupom na hora, direto no seu WhatsApp."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Código do cupom</Label>
              <Input
                value={cfg.lead_cupom_codigo}
                maxLength={40}
                onChange={(e) => set({ lead_cupom_codigo: e.target.value.toUpperCase() })}
                placeholder="BEMVINDA"
              />
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                Esse código precisa existir e estar ativo no Tray/Vindi antes de salvar aqui.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Microcopy abaixo do botão</Label>
              <Input
                value={cfg.lead_microcopy}
                maxLength={160}
                onChange={(e) => set({ lead_microcopy: e.target.value })}
                placeholder="Cupom liberado na hora. Sem spam."
              />
            </div>
          </div>

          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="text-sm font-medium">Campos obrigatórios no formulário</p>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="lead-nome"
                  checked={cfg.lead_campo_nome_obrigatorio}
                  onCheckedChange={(v) => set({ lead_campo_nome_obrigatorio: v })}
                />
                <Label htmlFor="lead-nome" className="cursor-pointer">Nome obrigatório</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="lead-whatsapp"
                  checked={cfg.lead_campo_whatsapp_obrigatorio}
                  onCheckedChange={(v) => set({ lead_campo_whatsapp_obrigatorio: v })}
                />
                <Label htmlFor="lead-whatsapp" className="cursor-pointer">WhatsApp obrigatório</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="lead-email"
                  checked={cfg.lead_campo_email_obrigatorio}
                  onCheckedChange={(v) => set({ lead_campo_email_obrigatorio: v })}
                />
                <Label htmlFor="lead-email" className="cursor-pointer">Email obrigatório</Label>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Switch
                id="lead-jogo"
                checked={cfg.lead_jogo_ativo}
                onCheckedChange={(v) => set({ lead_jogo_ativo: v })}
              />
              <Label htmlFor="lead-jogo" className="cursor-pointer">Ativar jogo de caixas</Label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Título do jogo</Label>
                <Input
                  value={cfg.lead_jogo_titulo}
                  maxLength={120}
                  disabled={!cfg.lead_jogo_ativo}
                  onChange={(e) => set({ lead_jogo_titulo: e.target.value })}
                  placeholder="Escolha uma caixa e ganhe seu prêmio"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade de caixas</Label>
                <Input
                  type="number"
                  min={3}
                  max={8}
                  value={cfg.lead_jogo_qtd_caixas}
                  disabled={!cfg.lead_jogo_ativo}
                  onChange={(e) =>
                    set({ lead_jogo_qtd_caixas: Math.min(8, Math.max(3, Number(e.target.value) || 3)) })
                  }
                />
                <p className="text-xs text-muted-foreground">Entre 3 e 8 caixas.</p>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Texto de vitória</Label>
                <Input
                  value={cfg.lead_jogo_texto_vitoria}
                  maxLength={160}
                  disabled={!cfg.lead_jogo_ativo}
                  onChange={(e) => set({ lead_jogo_texto_vitoria: e.target.value })}
                  placeholder="Parabéns! Você ganhou 10% OFF."
                />
              </div>
            </div>
          </div>
          </fieldset>

        </CardContent>
      </Card>
    </div>
  );
}
