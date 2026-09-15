import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Workflow } from "lucide-react";

export function AutomacoesTab() {
  return (
    <Card className="flex flex-col items-center gap-3 p-10 text-center">
      <Workflow className="h-10 w-10 text-muted-foreground opacity-50" />
      <p className="text-sm text-muted-foreground">As automações de e-mail agora são fluxos.</p>
      <Button asChild>
        <Link to="/automacoes">Abrir Automações</Link>
      </Button>
    </Card>
  );
}

export default AutomacoesTab;
