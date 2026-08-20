import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { FolhaMesTab } from "@/components/rh/FolhaMesTab";
import { LotePixTab } from "@/components/rh/LotePixTab";
import { FuncionariosTab } from "@/components/rh/FuncionariosTab";
import { HistoricoTab } from "@/components/rh/HistoricoTab";
import { HoleritesTab, TipoHolerite } from "@/components/rh/HoleritesTab";
import { RhAuthGate } from "@/components/rh/RhAuthGate";
import { FeriadosDialog } from "@/components/rh/FeriadosDialog";
import { useFolhaMes } from "@/components/rh/useFolha";


export default function Funcionarios() {
  const hoje = new Date();
  const [mesAno, setMesAno] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );
  const [tab, setTab] = useState("folha");
  const [tipoHolerite, setTipoHolerite] = useState<TipoHolerite>("fechamento");
  const [feriadosAberto, setFeriadosAberto] = useState(false);
  const competencia = `${mesAno}-01`;
  const { data: folha } = useFolhaMes(competencia);
  const diasUteis = folha?.dias_uteis;

  const irParaHolerite = (comp: string, tipo: TipoHolerite = "fechamento") => {
    setMesAno(comp.slice(0, 7));
    setTipoHolerite(tipo);
    setTab("holerites");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-serif font-bold">Funcionários</h1>
          <p className="text-sm text-muted-foreground">
            Adiantamento 40% (dia 20) · Saldo 60% (dia 5 do mês seguinte) · VT e cesta dia 5 · VA pedido na Ticket até dia 28 do mês anterior.
          </p>
        </div>
        <div className="w-44">
          <Input type="month" value={mesAno} onChange={(e) => setMesAno(e.target.value)} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="print:hidden">
          <TabsTrigger value="folha">Folha do Mês</TabsTrigger>
          <TabsTrigger value="lote">Lote PIX · Inter</TabsTrigger>
          <TabsTrigger value="holerites">Holerites</TabsTrigger>
          <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="folha" className="mt-6">
          <FolhaMesTab
            competencia={competencia}
            onIrParaLote={() => setTab("lote")}
            onVerHolerite={() => irParaHolerite(competencia, "fechamento")}
          />
        </TabsContent>
        <TabsContent value="lote" className="mt-6">
          <LotePixTab competencia={competencia} />
        </TabsContent>
        <TabsContent value="holerites" className="mt-6">
          <HoleritesTab competencia={competencia} tipo={tipoHolerite} onTipoChange={setTipoHolerite} />
        </TabsContent>
        <TabsContent value="funcionarios" className="mt-6">
          <RhAuthGate>
            <FuncionariosTab />
          </RhAuthGate>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <HistoricoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
