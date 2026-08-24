import { AnaliseEscrita } from './AnaliseEscrita';
import type { FiltroGrade } from './GradeConteudo';
import { C, Card, SectionTitle } from './shared';

export function DriversBlock({ formato, dias, onFiltrar }: {
  dias?: number;
  formato: string | null;
  mostrarSkip?: boolean;
  onFiltrar?: (f: FiltroGrade) => void;
}) {
  return (
    <Card accent={C.bronze}>
      <SectionTitle subtitle="Padrões com pelo menos 3 publicações, comparados à média da conta no período. Clique num padrão para ver as publicações.">
        O que faz performar
      </SectionTitle>
      <AnaliseEscrita formato={formato} onFiltrar={onFiltrar} />
    </Card>
  );
}
