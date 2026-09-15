import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { VisaoGeralTab } from "@/components/cashback/VisaoGeralTab";
import { CuponsTab } from "@/components/cashback/CuponsTab";
import { ReguaTab } from "@/components/cashback/ReguaTab";
import { ConfigTab } from "@/components/cashback/ConfigTab";
import { PainelCliente } from "@/components/cashback/PainelCliente";
import { CarregandoBloco, EstadoErro } from "@/components/cashback/Estados";
import { rpcCashback, objetoDe, listaDe } from "@/lib/cashback";

const PERIODOS = [7, 30, 90];

export function CashbackConteudo() {
  return <Cashback semCabecalho />;
}

export default function Cashback({ semCabecalho }: { semCabecalho?: boolean } = {}) {
  const [dias, setDias] = useState(30);
  const [resumo, setResumo] = useState<Record<string, any>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [cliente, setCliente] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await rpcCashback("cashback_painel_resumo", { p_dias: dias });
      setResumo(objetoDe(r));
    } catch (e: any) {
      setErro(e?.message ?? "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  }, [dias]);

  useEffect(() => { carregar(); }, [carregar]);

  const templatesEmail = listaDe(resumo.templates_email)
    .map((t: any) => (typeof t === "string" ? t : t.slug))
    .filter((s: any) => typeof s === "string" && s.startsWith("auto-cashback"));

  return (
    <div className={semCabecalho ? "space-y-6" : "space-y-6 p-4 md:p-6"}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        {!semCabecalho && (
          <div>
            <h1 className="font-serif text-2xl">Cashback</h1>
            <p className="text-sm text-muted-foreground">
              Cupons de cashback, filas do motor, régua de avisos e regras do programa.
            </p>
          </div>
        )}
        <div className="flex gap-1.5">
          {PERIODOS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={dias === d ? "default" : "outline"}
              className="h-9"
              onClick={() => setDias(d)}
            >
              {d} dias
            </Button>
          ))}
        </div>
      </header>

      {carregando ? (
        <CarregandoBloco linhas={6} />
      ) : erro ? (
        <EstadoErro mensagem={erro} onTentar={carregar} />
      ) : (
        <Tabs defaultValue="visao">
          <TabsList>
            <TabsTrigger value="visao">Visão geral</TabsTrigger>
            <TabsTrigger value="cupons">Cupons</TabsTrigger>
            <TabsTrigger value="regua">Régua</TabsTrigger>
            <TabsTrigger value="config">Configuração</TabsTrigger>
          </TabsList>

          <TabsContent value="visao">
            <VisaoGeralTab resumo={resumo} onAbrirCliente={(c) => c && setCliente(c)} />
          </TabsContent>
          <TabsContent value="cupons">
            <CuponsTab onAbrirCliente={(c) => c && setCliente(c)} />
          </TabsContent>
          <TabsContent value="regua">
            <ReguaTab resumo={resumo} templatesEmail={templatesEmail} onAtualizar={carregar} />
          </TabsContent>
          <TabsContent value="config">
            <ConfigTab resumo={resumo} onAtualizar={carregar} />
          </TabsContent>
        </Tabs>
      )}

      <PainelCliente customer={cliente} onFechar={() => setCliente(null)} onAtualizado={carregar} />
    </div>
  );
}
