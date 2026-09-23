import { OportunidadesAoVivo } from "@/components/recuperacao/OportunidadesAoVivo";
import { ResgateAutomatico } from "@/components/atendimento/ResgateAutomatico";

/**
 * Aba "Oportunidades" do Atendimento: resgate automático acima do bloco de
 * Oportunidades ao Vivo, com abertura da conversa no próprio painel.
 */
export function OportunidadesTab({
  onAbrirConversa,
  onContagem,
}: {
  onAbrirConversa?: (conversaId: string) => void;
  onContagem?: (n: number) => void;
}) {
  return (
    <div>
      <ResgateAutomatico onAbrirConversa={onAbrirConversa} />
      <OportunidadesAoVivo
        intervaloMs={60000}
        onAbrirConversa={onAbrirConversa}
        onContagem={onContagem}
      />
    </div>
  );
}
