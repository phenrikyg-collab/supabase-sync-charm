import { Badge } from "@/components/ui/badge";

/** Cores dos selos de situação do envio. */
const CORES: Record<string, string> = {
  entregue: "bg-emerald-100 text-emerald-800 border-emerald-200",
  em_transito: "bg-amber-100 text-amber-900 border-amber-200",
  saiu_para_entrega: "bg-amber-100 text-amber-900 border-amber-200",
  aguardando_postagem: "bg-muted text-muted-foreground border-border",
  sem_informacao: "bg-muted text-muted-foreground border-border",
  tentativa_falhou: "bg-orange-100 text-orange-800 border-orange-200",
  aguardando_retirada: "bg-orange-100 text-orange-800 border-orange-200",
  problema: "bg-orange-100 text-orange-800 border-orange-200",
  devolvendo: "bg-red-50 text-red-700 border-red-200",
  devolvido: "bg-red-50 text-red-700 border-red-200",
  cancelado: "bg-red-50 text-red-700 border-red-200",
};

export function SeloSituacao({ situacao, rotulo }: { situacao?: string | null; rotulo?: string | null }) {
  const cor = CORES[String(situacao ?? "")] ?? "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`whitespace-nowrap font-normal ${cor}`}>
      {rotulo || situacao || "sem situação"}
    </Badge>
  );
}

/** Número com vírgula decimal, sem casas sobrando. */
export function num(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "sem dados";
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  });
}

export function inteiro(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "0";
  return Number(valor).toLocaleString("pt-BR");
}

/** Monta o link do WhatsApp a partir do telefone da cliente. */
export function linkWhatsApp(telefone?: string | null): string | null {
  const digitos = String(telefone ?? "").replace(/\D/g, "");
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    return `https://wa.me/${digitos}`;
  }
  if (digitos.length === 10 || digitos.length === 11) return `https://wa.me/55${digitos}`;
  return null;
}
