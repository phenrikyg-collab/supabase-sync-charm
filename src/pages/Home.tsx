import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 py-12">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
          Gestão Mariana Cardoso
        </h1>
        <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
          Sistema de gestão interno da Use Mariana Cardoso — consolida vendas da
          loja, atendimento via WhatsApp, produção, estoque e desempenho de mídia
          paga (Meta Ads e Google Ads) em um único painel.
        </p>
        <Button asChild size="lg" className="mt-4">
          <Link to="/login">Entrar</Link>
        </Button>
      </div>
    </main>
  );
}
