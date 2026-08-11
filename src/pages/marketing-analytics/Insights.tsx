import InsightsIATab from '@/components/marketing/InsightsIATab';
import { MALayout } from '@/components/marketing-analytics/shared';

export default function MAInsights() {
  return (
    <MALayout titulo="Insights IA" subtitulo="Relatório gerado por IA sobre a performance do perfil" semPeriodo>
      <InsightsIATab />
    </MALayout>
  );
}
