import { OportunidadesAoVivo } from "@/components/recuperacao/OportunidadesAoVivo";

/**
 * Aba "Oportunidades" do Atendimento: mesmo bloco de Oportunidades ao Vivo
 * usado na tela de Vendas ao Vivo, com abertura da conversa no próprio painel.
 */
export function OportunidadesTab({
  onAbrirConversa,
}: {
  onAbrirConversa?: (conversaId: string) => void;
}) {
  return <OportunidadesAoVivo intervaloMs={60000} onAbrirConversa={onAbrirConversa} />;
}
