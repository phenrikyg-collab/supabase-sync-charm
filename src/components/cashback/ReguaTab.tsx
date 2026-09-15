import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Workflow } from "lucide-react";

export function ReguaTab() {
  return (
    <div className="pt-4">
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <Workflow className="h-10 w-10 text-muted-foreground opacity-50" />
        <p className="max-w-md text-sm text-muted-foreground">
          A régua do cashback agora é um fluxo de automação. Prazo do primeiro aviso, lembretes e canais são editados lá.
        </p>
        <Button asChild>
          <Link to="/automacoes/19">Abrir o fluxo</Link>
        </Button>
      </Card>
    </div>
  );
}

export default ReguaTab;
