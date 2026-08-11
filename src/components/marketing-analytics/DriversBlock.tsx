import { AnaliseEscrita } from './AnaliseEscrita';
import { C, Card, SectionTitle } from './shared';

export function DriversBlock({ formato }: { dias?: number; formato: string | null; mostrarSkip?: boolean }) {
  return (
    <Card accent={C.bronze}>
      <SectionTitle subtitle="Padrões com pelo menos 3 publicações, comparados à média da conta no período.">
        O que faz performar
      </SectionTitle>
      <AnaliseEscrita formato={formato} />
    </Card>
  );
}
