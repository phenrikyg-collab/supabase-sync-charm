import RelatoriosMensaisTab from '@/components/marketing/RelatoriosMensaisTab';
import { MALayout } from '@/components/marketing-analytics/shared';

export default function MARelatorios() {
  return (
    <MALayout titulo="Relatórios Mensais" subtitulo="Histórico consolidado por mês" semPeriodo>
      <RelatoriosMensaisTab />
    </MALayout>
  );
}
