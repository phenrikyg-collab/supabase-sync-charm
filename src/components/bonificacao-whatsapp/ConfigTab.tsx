import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import {
  useConsultoras, useMetaMes, useMetasIndividuais, useConfigBonificacao,
} from "@/hooks/useBonificacaoWhatsApp";
import { ConfigBonificacao } from "@/lib/bonificacaoWhatsApp";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

export default function ConfigTab({ mes }: { mes: string }) {
  const qc = useQueryClient();
  const { data: consultoras = [], isLoading: loadingC } = useConsultoras();
  const { data: meta } = useMetaMes(mes);
  const { data: metasInd = [] } = useMetasIndividuais(mes);
  const { data: config } = useConfigBonificacao();

  // form nova consultora
  const [nova, setNova] = useState({ nome: "", apelido_canal: "", patterns: "", telefone: "" });

  // form meta
  const [metaTotal, setMetaTotal] = useState<string>("");
  const [modo, setModo] = useState<"individual" | "proporcional">("proporcional");
  const [metasIndState, setMetasIndState] = useState<Record<string, string>>({});

  useEffect(() => {
    setMetaTotal(meta?.meta_total ? String(meta.meta_total) : "");
    setModo(meta?.modo_distribuicao ?? "proporcional");
  }, [meta]);

  useEffect(() => {
    const m: Record<string, string> = {};
    for (const mi of metasInd) m[mi.consultora_id] = String(mi.meta_valor);
    setMetasIndState(m);
  }, [metasInd]);

  // config local edit
  const [cfg, setCfg] = useState<ConfigBonificacao | null>(null);
  useEffect(() => { if (config) setCfg(structuredClone(config)); }, [config]);

  async function addConsultora() {
    if (!nova.nome.trim()) return toast.error("Nome obrigatório");
    const patterns = nova.patterns.split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("consultoras_whatsapp" as any).insert({
      nome: nova.nome.trim(),
      apelido_canal: nova.apelido_canal.trim() || null,
      point_sale_patterns: patterns,
      telefone: nova.telefone.trim() || null,
      ativa: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Consultora cadastrada");
    setNova({ nome: "", apelido_canal: "", patterns: "", telefone: "" });
    qc.invalidateQueries({ queryKey: ["consultoras-wa"] });
  }

  async function removerConsultora(id: string) {
    const { error } = await supabase.from("consultoras_whatsapp" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["consultoras-wa"] });
  }

  async function toggleAtiva(id: string, ativa: boolean) {
    await supabase.from("consultoras_whatsapp" as any).update({ ativa }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["consultoras-wa"] });
  }

  async function salvarMeta() {
    const valor = parseFloat(metaTotal.replace(",", "."));
    if (isNaN(valor)) return toast.error("Meta inválida");
    const { error } = await supabase.from("metas_whatsapp" as any).upsert(
      { mes_referencia: mes, meta_total: valor, modo_distribuicao: modo },
      { onConflict: "mes_referencia" }
    );
    if (error) return toast.error(error.message);

    if (modo === "individual") {
      const rows = Object.entries(metasIndState)
        .map(([cid, v]) => ({ mes_referencia: mes, consultora_id: cid, meta_valor: parseFloat(String(v).replace(",", ".")) || 0 }));
      if (rows.length > 0) {
        const { error: e2 } = await supabase
          .from("metas_whatsapp_consultoras" as any)
          .upsert(rows, { onConflict: "mes_referencia,consultora_id" });
        if (e2) return toast.error(e2.message);
      }
    }
    toast.success("Meta salva");
    qc.invalidateQueries({ queryKey: ["meta-wa", mes] });
    qc.invalidateQueries({ queryKey: ["metas-wa-individuais", mes] });
  }

  async function salvarConfig() {
    if (!cfg) return;
    // desativa anteriores e insere nova ativa
    await supabase.from("config_bonificacao_whatsapp" as any).update({ ativo: false }).eq("ativo", true);
    const { error } = await supabase.from("config_bonificacao_whatsapp" as any).insert({
      faixas_meta: cfg.faixas_meta,
      regras_desconto: cfg.regras_desconto,
      faixas_ticket: cfg.faixas_ticket,
      ativo: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Regras atualizadas");
    qc.invalidateQueries({ queryKey: ["config-bonus-wa"] });
  }

  return (
    <div className="space-y-6">
      {/* Meta do mês */}
      <Card>
        <CardHeader><CardTitle className="font-serif text-xl">Meta do canal — {mes}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Meta total (R$)</Label>
              <Input value={metaTotal} onChange={(e) => setMetaTotal(e.target.value)} placeholder="100000" />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={modo === "individual"} onCheckedChange={(v) => setModo(v ? "individual" : "proporcional")} />
                <Label className="cursor-pointer">{modo === "individual" ? "Meta individual" : "Proporcional (igual entre consultoras ativas)"}</Label>
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={salvarMeta}><Save className="h-4 w-4 mr-1" /> Salvar meta</Button>
            </div>
          </div>

          {modo === "individual" && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2">Defina a meta de cada consultora:</p>
              <div className="grid md:grid-cols-2 gap-3">
                {consultoras.filter((c) => c.ativa).map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <Label className="w-40 truncate">{c.nome}</Label>
                    <Input
                      value={metasIndState[c.id] ?? ""}
                      onChange={(e) => setMetasIndState((s) => ({ ...s, [c.id]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consultoras */}
      <Card>
        <CardHeader><CardTitle className="font-serif text-xl">Consultoras</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-5 gap-2 items-end p-3 rounded-md bg-muted/30">
            <div>
              <Label>Nome *</Label>
              <Input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />
            </div>
            <div>
              <Label>Apelido canal</Label>
              <Input value={nova.apelido_canal} onChange={(e) => setNova({ ...nova, apelido_canal: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Padrões de point_sale (separe por vírgula)</Label>
              <Input value={nova.patterns} onChange={(e) => setNova({ ...nova, patterns: e.target.value })} placeholder="WhatsApp Ana, WPP-ANA" />
            </div>
            <div className="flex gap-2">
              <Input className="flex-1" placeholder="Telefone" value={nova.telefone} onChange={(e) => setNova({ ...nova, telefone: e.target.value })} />
              <Button onClick={addConsultora}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          {loadingC ? (
            <div className="flex items-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Apelido</TableHead>
                  <TableHead>Padrões point_sale</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultoras.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.apelido_canal ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(c.point_sale_patterns ?? []).join(", ") || "—"}
                    </TableCell>
                    <TableCell>{c.telefone ?? "—"}</TableCell>
                    <TableCell>
                      <Switch checked={c.ativa} onCheckedChange={(v) => toggleAtiva(c.id, v)} />
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removerConsultora(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Regras */}
      {cfg && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-xl">Regras de bonificação</CardTitle>
            <Button onClick={salvarConfig}><Save className="h-4 w-4 mr-1" /> Salvar regras</Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Faixas Meta */}
            <div>
              <h4 className="font-medium mb-2">Faixas de bônus (% atingimento da meta)</h4>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Label</TableHead><TableHead>De %</TableHead><TableHead>Até %</TableHead><TableHead>Bônus base (R$)</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {cfg.faixas_meta.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell><Input value={f.label} onChange={(e) => {
                        const v = [...cfg.faixas_meta]; v[i].label = e.target.value; setCfg({ ...cfg, faixas_meta: v });
                      }} /></TableCell>
                      <TableCell><Input type="number" value={f.min_pct} onChange={(e) => {
                        const v = [...cfg.faixas_meta]; v[i].min_pct = +e.target.value; setCfg({ ...cfg, faixas_meta: v });
                      }} /></TableCell>
                      <TableCell><Input type="number" value={f.max_pct} onChange={(e) => {
                        const v = [...cfg.faixas_meta]; v[i].max_pct = +e.target.value; setCfg({ ...cfg, faixas_meta: v });
                      }} /></TableCell>
                      <TableCell><Input type="number" value={f.bonus_base} onChange={(e) => {
                        const v = [...cfg.faixas_meta]; v[i].bonus_base = +e.target.value; setCfg({ ...cfg, faixas_meta: v });
                      }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Regras desconto */}
            <div>
              <h4 className="font-medium mb-2">Multiplicador por desconto médio</h4>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Até desc. %</TableHead><TableHead>Multiplicador (1 = 100%)</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {cfg.regras_desconto.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell><Input type="number" value={f.max_pct} onChange={(e) => {
                        const v = [...cfg.regras_desconto]; v[i].max_pct = +e.target.value; setCfg({ ...cfg, regras_desconto: v });
                      }} /></TableCell>
                      <TableCell><Input type="number" step="0.05" value={f.multiplicador} onChange={(e) => {
                        const v = [...cfg.regras_desconto]; v[i].multiplicador = +e.target.value; setCfg({ ...cfg, regras_desconto: v });
                      }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Faixas ticket */}
            <div>
              <h4 className="font-medium mb-2">Acelerador de ticket médio</h4>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Ticket acima de (R$)</TableHead><TableHead>Acelerador (R$)</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {cfg.faixas_ticket.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell><Input type="number" value={f.min_valor} onChange={(e) => {
                        const v = [...cfg.faixas_ticket]; v[i].min_valor = +e.target.value; setCfg({ ...cfg, faixas_ticket: v });
                      }} /></TableCell>
                      <TableCell><Input type="number" value={f.acelerador} onChange={(e) => {
                        const v = [...cfg.faixas_ticket]; v[i].acelerador = +e.target.value; setCfg({ ...cfg, faixas_ticket: v });
                      }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
