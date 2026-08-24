import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/financeiroFormat";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, MessageCircle, Mail, Megaphone, MessagesSquare, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

type Resumo = {
  total: number;
  quentes: number;
  contactaveis: number;
  valor_em_jogo: number;
  por_tipo?: Record<string, number> | null;
} | null;

type Oportunidade = {
  tipo: string | null;
  prioridade: number | null;
  titulo: string | null;
  detalhe: string | null;
  acao_sugerida: string | null;
  canal_sugerido: string | null;
  valor: number | null;
  quente: boolean | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  segmento_rfm: string | null;
  ocorrido_em: string | null;
};

const CANAL_STYLES: Record<string, string> = {
  whatsapp: "bg-green-100 text-green-800 border-green-300",
  "chat do site": "bg-blue-100 text-blue-800 border-blue-300",
  "e-mail": "bg-violet-100 text-violet-800 border-violet-300",
  email: "bg-violet-100 text-violet-800 border-violet-300",
  "anúncios": "bg-amber-100 text-amber-900 border-amber-300",
  anuncios: "bg-amber-100 text-amber-900 border-amber-300",
};

function IconeCanal({ canal }: { canal: string }) {
  const c = canal.toLowerCase();
  if (c.includes("whats")) return <MessageCircle className="h-3.5 w-3.5" />;
  if (c.includes("mail")) return <Mail className="h-3.5 w-3.5" />;
  if (c.includes("an")) return <Megaphone className="h-3.5 w-3.5" />;
  return <MessagesSquare className="h-3.5 w-3.5" />;
}

function linkWhatsApp(tel: string) {
  const d = tel.replace(/\D/g, "");
  const full = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${full}`;
}

export function OportunidadesAoVivo({ refreshKey }: { refreshKey?: number }) {
  const [resumo, setResumo] = useState<Resumo>(null);
  const [lista, setLista] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        (supabase as any).rpc("rastreamento_oportunidades_resumo", { p_horas: 24 }),
        (supabase as any).rpc("rastreamento_oportunidades", { p_horas: 24, p_limite: 15 }),
      ]);
      if (!r1.error) setResumo((r1.data ?? null) as Resumo);
      if (!r2.error) setLista((Array.isArray(r2.data) ? r2.data : []) as Oportunidade[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar, refreshKey]);

  const partes: string[] = [];
  if ((resumo?.quentes ?? 0) > 0) partes.push(`${resumo!.quentes} quentes agora`);
  if ((resumo?.contactaveis ?? 0) > 0) partes.push(`${resumo!.contactaveis} com contato`);
  if ((resumo?.valor_em_jogo ?? 0) > 0) partes.push(`${brl(resumo!.valor_em_jogo)} em carrinho neste momento`);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="font-serif text-xl font-bold">Oportunidades ao Vivo</h2>
        {partes.length > 0 && (
          <p className="text-sm text-muted-foreground">{partes.join(" · ")}</p>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : lista.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground text-center">
            Nenhuma oportunidade nas últimas 24h
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lista.map((o, i) => {
            const quente = o.quente === true;
            const canal = (o.canal_sugerido ?? "").trim();
            const canalKey = canal.toLowerCase();
            const isWhats = canalKey.includes("whats");
            return (
              <Card
                key={`${o.tipo}-${i}`}
                className={cn(quente && "border-orange-400 bg-orange-50 dark:bg-orange-950/20")}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug">{o.titulo ?? "Oportunidade"}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {o.valor != null && (
                        <span className="font-serif font-bold text-sm">{brl(o.valor)}</span>
                      )}
                      {quente && (
                        <Badge className="bg-orange-500 text-white gap-1">
                          <Flame className="h-3 w-3" /> Agora
                        </Badge>
                      )}
                    </div>
                  </div>

                  {o.detalhe && <p className="text-sm text-muted-foreground">{o.detalhe}</p>}

                  <div className="flex flex-wrap items-center gap-2">
                    {o.nome && <span className="text-xs font-medium">{o.nome}</span>}
                    {o.segmento_rfm && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{o.segmento_rfm}</Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                    {canal && (
                      <Badge
                        variant="outline"
                        className={cn("gap-1 text-[11px]", CANAL_STYLES[canalKey] ?? "bg-muted text-muted-foreground")}
                      >
                        <IconeCanal canal={canal} /> {canal}
                      </Badge>
                    )}
                    {o.acao_sugerida && (
                      <span className="text-xs text-foreground/80 flex-1 min-w-[8rem]">{o.acao_sugerida}</span>
                    )}
                    {o.telefone && isWhats && (
                      <Button asChild size="sm" className="h-7 gap-1 bg-green-600 hover:bg-green-700 text-white">
                        <a href={linkWhatsApp(o.telefone)} target="_blank" rel="noreferrer">
                          <Phone className="h-3 w-3" /> {o.telefone}
                        </a>
                      </Button>
                    )}
                    {o.telefone && !isWhats && (
                      <span className="text-xs text-muted-foreground">{o.telefone}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
