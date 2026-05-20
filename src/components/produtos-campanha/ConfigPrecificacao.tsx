import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";

interface ConfigRow {
  id?: number | string;
  imposto_pct?: number; comissao_pct?: number; cupom_pct?: number;
  parcelamento_pct?: number; marketing_pct?: number; frete_pct?: number;
  overhead_pct?: number; devolucao_pct?: number; cac_pct?: number;
  chargeback_pct?: number; conteudo_pct?: number;
  custo_corte?: number; custo_costura?: number; custo_embalagem?: number;
}

const DEDUCOES: { key: keyof ConfigRow; label: string }[] = [
  { key: "imposto_pct",       label: "Imposto" },
  { key: "comissao_pct",      label: "Comissão" },
  { key: "cupom_pct",         label: "Cupom" },
  { key: "parcelamento_pct",  label: "Parcelamento" },
  { key: "marketing_pct",     label: "Marketing" },
  { key: "frete_pct",         label: "Frete" },
  { key: "overhead_pct",      label: "Overhead" },
  { key: "devolucao_pct",     label: "Devolução" },
  { key: "cac_pct",           label: "CAC" },
  { key: "chargeback_pct",    label: "Chargeback" },
  { key: "conteudo_pct",      label: "Conteúdo/Foto" },
];

const VARIAVEIS: { key: keyof ConfigRow; label: string }[] = [
  { key: "custo_corte",   label: "Corte" },
  { key: "custo_costura", label: "Costura" },
];

const FIXOS: { key: keyof ConfigRow; label: string }[] = [
  { key: "custo_embalagem", label: "Embalagem" },
];

export function ConfigPrecificacao() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<ConfigRow>({});

  async function carregar() {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("config_precificacao")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setCfg((data as ConfigRow) || {});
    } catch (e: any) {
      toast.error("Erro ao carregar configuração: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { carregar(); }, []);

  function setField(k: keyof ConfigRow, v: string) {
    const n = v === "" ? 0 : Number(v.replace(",", "."));
    setCfg((p) => ({ ...p, [k]: isNaN(n) ? 0 : n }));
  }

  async function salvar() {
    setSaving(true);
    try {
      const payload: any = { ...cfg };
      if (!payload.id) payload.id = 1;
      const { error } = await (supabase as any)
        .from("config_precificacao")
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;
      toast.success("Configuração salva!");
      carregar();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  }

  const totalDeducoes = DEDUCOES.reduce((s, d) => s + Number(cfg[d.key] || 0), 0);

  if (loading) return <Skeleton className="h-96 w-full" />;

  const renderField = (key: keyof ConfigRow, label: string, suffix: string) => (
    <div key={key}>
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="0.01"
          value={cfg[key] ?? ""}
          onChange={(e) => setField(key, e.target.value)}
          className="pr-10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-serif text-xl">Configuração de Precificação</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Encargos e custos usados para calcular o preço mínimo viável.
            </p>
          </div>
          <Button onClick={salvar} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar configuração"}
          </Button>
        </div>

        <section>
          <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Deduções sobre venda (%)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {DEDUCOES.map((d) => renderField(d.key, d.label, "%"))}
          </div>
          <p className="mt-3 text-sm">
            Total de deduções:{" "}
            <span className={`font-medium ${totalDeducoes >= 50 ? "text-red-600" : totalDeducoes >= 35 ? "text-yellow-700" : "text-green-700"}`}>
              {totalDeducoes.toFixed(2)}%
            </span>
          </p>
        </section>

        <section>
          <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Custos Variáveis (R$)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {VARIAVEIS.map((d) => renderField(d.key, d.label, "R$"))}
          </div>
        </section>

        <section>
          <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Custos Fixos (R$)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {FIXOS.map((d) => renderField(d.key, d.label, "R$"))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
