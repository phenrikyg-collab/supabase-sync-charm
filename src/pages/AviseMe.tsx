import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpisFaixa } from "@/components/avise-me/KpisFaixa";
import { OrdemCorteTab, type Grade } from "@/components/avise-me/OrdemCorteTab";
import { PessoasTab } from "@/components/avise-me/PessoasTab";
import { DisparoTab } from "@/components/avise-me/DisparoTab";

export default function AviseMe() {
  const [aba, setAba] = useState("corte");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [gradeDisparo, setGradeDisparo] = useState<Grade | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  function limparGrade(campo: "produto" | "cor" | "tamanho" | "tudo") {
    if (campo === "tudo" || campo === "produto") return setGrade(null);
    setGrade((g) => (g ? { ...g, [campo]: undefined } : g));
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-2xl">Avise-me</h1>
        <p className="text-sm text-muted-foreground">
          Fila de quem está esperando uma grade voltar ao estoque, demanda para corte e disparo dos avisos.
        </p>
      </header>

      <KpisFaixa recarregar={recarregar} />

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="corte">Ordem de corte</TabsTrigger>
          <TabsTrigger value="pessoas">Quem está esperando</TabsTrigger>
          <TabsTrigger value="disparo">Disparo</TabsTrigger>
        </TabsList>

        <TabsContent value="corte">
          <OrdemCorteTab
            onAbrirGrade={(g) => {
              setGrade(g);
              setAba("pessoas");
            }}
            onIrParaDisparo={(g) => {
              setGradeDisparo(g);
              setAba("disparo");
            }}
          />
        </TabsContent>

        <TabsContent value="pessoas">
          <PessoasTab grade={grade} onLimparGrade={limparGrade} />
        </TabsContent>

        <TabsContent value="disparo">
          <DisparoTab
            gradeInicial={gradeDisparo}
            onDisparado={() => setRecarregar((n) => n + 1)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
