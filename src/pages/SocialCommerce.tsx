import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AtendimentoTab } from "@/components/social-commerce/AtendimentoTab";
import { ComentariosTab } from "@/components/social-commerce/ComentariosTab";
import { PublicacoesTab } from "@/components/social-commerce/PublicacoesTab";
import { ProdutosPostTab } from "@/components/social-commerce/ProdutosPostTab";
import { FunilLeadsTab } from "@/components/social-commerce/FunilLeadsTab";
import { MessageCircle, MessagesSquare, CalendarDays, ShoppingBag, Filter } from "lucide-react";

const ABAS = [
  { valor: "atendimento", label: "Atendimento (DM)", icone: MessageCircle },
  { valor: "funil", label: "Funil de leads", icone: Filter },
  { valor: "comentarios", label: "Comentários", icone: MessagesSquare },
  { valor: "publicacoes", label: "Publicações", icone: CalendarDays },
  { valor: "produtos", label: "Produtos do Post", icone: ShoppingBag },
];

export default function SocialCommerce() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "atendimento";

  return (
    <div className="p-4 md:p-6 space-y-5">
      <header>
        <h1 className="font-serif text-2xl font-bold tracking-tight">Social Commerce</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Caixa de entrada do Instagram: Direct, comentários, agendamento e automação de resposta por post.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          {ABAS.map((a) => (
            <TabsTrigger key={a.valor} value={a.valor} className="gap-1.5">
              <a.icone className="h-4 w-4" />
              <span className="hidden sm:inline">{a.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="atendimento" className="mt-4">
          <AtendimentoTab />
        </TabsContent>
        <TabsContent value="comentarios" className="mt-4">
          <ComentariosTab />
        </TabsContent>
        <TabsContent value="publicacoes" className="mt-4">
          <PublicacoesTab />
        </TabsContent>
        <TabsContent value="produtos" className="mt-4">
          <ProdutosPostTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
