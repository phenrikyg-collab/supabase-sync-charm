import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateEmbaixadora,
  useCheckCupomDisponivel,
  TIER_LABELS,
  STATUS_INFLU_LABELS,
  type Tier,
  type StatusInfluenciadora,
} from "@/hooks/useEmbaixadoras";

interface FormState {
  nome: string;
  instagram: string;
  tiktok: string;
  whatsapp: string;
  email: string;
  tier: Tier;
  status: StatusInfluenciadora;
  cupom_exclusivo: string;
  comissao_pct: string;
  produto_enviado: string;
  data_inicio_parceria: string;
  data_fim_parceria: string;
  responsavel_interno: string;
  notas: string;
}

const initial: FormState = {
  nome: "",
  instagram: "",
  tiktok: "",
  whatsapp: "",
  email: "",
  tier: "micro",
  status: "prospecto",
  cupom_exclusivo: "",
  comissao_pct: "10",
  produto_enviado: "",
  data_inicio_parceria: "",
  data_fim_parceria: "",
  responsavel_interno: "Marketing",
  notas: "",
};

export default function EmbaixadoraNova() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const create = useCreateEmbaixadora();
  const checkCupom = useCheckCupomDisponivel();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function validateStep1() {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.nome.trim()) e.nome = "Nome é obrigatório";
    if (!form.instagram.trim()) e.instagram = "Instagram é obrigatório";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function validateStep2() {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.tier) e.tier = "Selecione o tier";
    if (form.cupom_exclusivo.trim()) {
      const livre = await checkCupom.mutateAsync({ cupom: form.cupom_exclusivo.trim() });
      if (!livre) e.cupom_exclusivo = "Este cupom já está em uso";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !(await validateStep2())) return;
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    try {
      const payload = {
        nome: form.nome.trim(),
        instagram: form.instagram.trim(),
        tiktok: form.tiktok.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        tier: form.tier,
        status: form.status,
        cupom_exclusivo: form.cupom_exclusivo.trim() || null,
        comissao_pct: Number(form.comissao_pct) || 0,
        produto_enviado: form.produto_enviado.trim() || null,
        data_inicio_parceria: form.data_inicio_parceria || null,
        data_fim_parceria: form.data_fim_parceria || null,
        responsavel_interno: form.responsavel_interno.trim() || "Marketing",
        notas: form.notas.trim() || null,
      };
      const result = await create.mutateAsync(payload);
      toast.success("Embaixadora cadastrada com sucesso");
      navigate(`/embaixadoras/${result.id}`);
    } catch (e: any) {
      toast.error("Erro ao cadastrar: " + (e?.message || "desconhecido"));
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/embaixadoras")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="font-serif text-2xl font-bold">Nova Embaixadora</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center flex-1">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {step > n ? <Check className="h-4 w-4" /> : n}
            </div>
            {n < 3 && <div className={`h-px flex-1 mx-2 ${step > n ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
      </div>
      <div className="text-sm text-muted-foreground">
        {step === 1 && "Etapa 1 de 3 — Dados pessoais"}
        {step === 2 && "Etapa 2 de 3 — Dados da parceria"}
        {step === 3 && "Etapa 3 de 3 — Revisão"}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nome completo *</Label>
                <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
                {errors.nome && <p className="text-xs text-red-600 mt-1">{errors.nome}</p>}
              </div>
              <div>
                <Label>Instagram *</Label>
                <Input
                  value={form.instagram}
                  onChange={(e) => set("instagram", e.target.value)}
                  placeholder="@usuario"
                />
                {errors.instagram && <p className="text-xs text-red-600 mt-1">{errors.instagram}</p>}
              </div>
              <div>
                <Label>TikTok</Label>
                <Input value={form.tiktok} onChange={(e) => set("tiktok", e.target.value)} placeholder="@usuario" />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Tier *</Label>
                <Select value={form.tier} onValueChange={(v) => set("tier", v as Tier)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIER_LABELS) as Tier[]).map((t) => (
                      <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as StatusInfluenciadora)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_INFLU_LABELS) as StatusInfluenciadora[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_INFLU_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cupom exclusivo</Label>
                <Input
                  value={form.cupom_exclusivo}
                  onChange={(e) => set("cupom_exclusivo", e.target.value.toUpperCase())}
                  placeholder="EX: MARIANA10"
                />
                {errors.cupom_exclusivo && (
                  <p className="text-xs text-red-600 mt-1">{errors.cupom_exclusivo}</p>
                )}
              </div>
              <div>
                <Label>Comissão (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.comissao_pct}
                  onChange={(e) => set("comissao_pct", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Produto enviado</Label>
                <Input value={form.produto_enviado} onChange={(e) => set("produto_enviado", e.target.value)} />
              </div>
              <div>
                <Label>Início da parceria</Label>
                <Input
                  type="date"
                  value={form.data_inicio_parceria}
                  onChange={(e) => set("data_inicio_parceria", e.target.value)}
                />
              </div>
              <div>
                <Label>Fim da parceria</Label>
                <Input
                  type="date"
                  value={form.data_fim_parceria}
                  onChange={(e) => set("data_fim_parceria", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Responsável interno</Label>
                <Input
                  value={form.responsavel_interno}
                  onChange={(e) => set("responsavel_interno", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Notas</Label>
                <Textarea value={form.notas} onChange={(e) => set("notas", e.target.value)} rows={3} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <h3 className="font-semibold text-base">Revise os dados</h3>
              <dl className="grid grid-cols-2 gap-y-2">
                <dt className="text-muted-foreground">Nome</dt><dd>{form.nome}</dd>
                <dt className="text-muted-foreground">Instagram</dt><dd>{form.instagram}</dd>
                <dt className="text-muted-foreground">TikTok</dt><dd>{form.tiktok || "—"}</dd>
                <dt className="text-muted-foreground">WhatsApp</dt><dd>{form.whatsapp || "—"}</dd>
                <dt className="text-muted-foreground">E-mail</dt><dd>{form.email || "—"}</dd>
                <dt className="text-muted-foreground">Tier</dt><dd>{TIER_LABELS[form.tier]}</dd>
                <dt className="text-muted-foreground">Status</dt><dd>{STATUS_INFLU_LABELS[form.status]}</dd>
                <dt className="text-muted-foreground">Cupom</dt><dd>{form.cupom_exclusivo || "—"}</dd>
                <dt className="text-muted-foreground">Comissão</dt><dd>{form.comissao_pct}%</dd>
                <dt className="text-muted-foreground">Produto</dt><dd>{form.produto_enviado || "—"}</dd>
                <dt className="text-muted-foreground">Início</dt><dd>{form.data_inicio_parceria || "—"}</dd>
                <dt className="text-muted-foreground">Fim</dt><dd>{form.data_fim_parceria || "—"}</dd>
                <dt className="text-muted-foreground">Responsável</dt><dd>{form.responsavel_interno}</dd>
              </dl>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            {step < 3 ? (
              <Button onClick={handleNext} disabled={checkCupom.isPending}>
                {checkCupom.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
