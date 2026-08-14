import { FormularioProposta } from "@/components/atendimento/ProporCarrinho";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export default function ProporCarrinhoPage() {
  return (
    <div className="container mx-auto max-w-3xl py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShoppingCart className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Propor Carrinho
          </h1>
          <p className="text-sm text-muted-foreground">
            Monte o carrinho, gere o link de pagamento e copie o texto pronto para enviar em qualquer canal.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Montar carrinho</CardTitle>
          <CardDescription>
            Busque produtos do catálogo, escolha cor/tamanho, calcule frete e gere o texto completo com Pix.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioProposta modo="texto" />
        </CardContent>
      </Card>
    </div>
  );
}
