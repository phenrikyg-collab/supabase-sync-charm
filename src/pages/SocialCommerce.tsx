import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AtendimentoTab } from "@/components/social-commerce/AtendimentoTab";
import { ComentariosTab } from "@/components/social-commerce/ComentariosTab";
import { PublicacoesTab } from "@/components/social-commerce/PublicacoesTab";
import { ProdutosPostTab } from "@/components/social-commerce/ProdutosPostTab";
import { FunilLeadsTab } from "@/components/social-commerce/FunilLeadsTab";
import { KitsTab } from "@/components/social-commerce/KitsTab";
import { LiveTab } from "@/components/social-commerce/LiveTab";
import { BufferConexaoCard } from "@/components/social-commerce/BufferConexaoCard";

import { MessageCircle, MessagesSquare, CalendarDays, ShoppingBag, Filter, Package, Radio } from "lucide-react";

const ABAS = [
  { valor: "atendimento", label: "Atendimento (DM)", icone: MessageCircle },
  { valor: "funil", label: "Funil de leads", icone: Filter },
  { valor: "comentarios", label: "Comentários", icone: MessagesSquare },
  { valor: "kits", label: "Kits", icone: Package },
  { valor: "live", label: "Live", icone: Radio },
  { valor: "publicacoes", label: "Publicações", icone: CalendarDays },
  { valor: "produtos", label: "Produtos do Post", icone: ShoppingBag },
];


export default function SocialCommerce() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "atendimento";

  return (
    <div className="flex flex-col h-[calc(100dvh-6.5rem)] min-h-0 overflow-hidden">
      <header className="shrink-0">
        <h1 className="font-serif text-2xl font-bold tracking-tight">Social Commerce</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Caixa de entrada do Instagram: Direct, comentários, agendamento e automação de resposta por post.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setParams({ tab: v }, { replace: true })}
        className="flex-1 flex flex-col min-h-0 mt-4"
      >
        <TabsList className="shrink-0 self-start">
          {ABAS.map((a) => (
            <TabsTrigger key={a.valor} value={a.valor} className="gap-1.5">
              <a.icone className="h-4 w-4" />
              <span className="hidden sm:inline">{a.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="atendimento" className="mt-3 flex-1 min-h-0 overflow-hidden">
          <AtendimentoTab />
        </TabsContent>

        <TabsContent value="funil" className="mt-4 flex-1 min-h-0 overflow-y-auto">
          <FunilLeadsTab />
        </TabsContent>
        <TabsContent value="comentarios" className="mt-4 flex-1 min-h-0 overflow-y-auto">
          <ComentariosTab />
        </TabsContent>
        <TabsContent value="kits" className="mt-4 flex-1 min-h-0 overflow-y-auto">
          <KitsTab />
        </TabsContent>
        <TabsContent value="live" className="mt-4 flex-1 min-h-0 overflow-y-auto">
          <LiveTab />
        </TabsContent>

        <TabsContent value="publicacoes" className="mt-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
          <BufferConexaoCard />
          <PublicacoesTab />
        </TabsContent>

        <TabsContent value="produtos" className="mt-4 flex-1 min-h-0 overflow-y-auto">
          <ProdutosPostTab />
        </TabsContent>

      </Tabs>
    </div>
  );
}
