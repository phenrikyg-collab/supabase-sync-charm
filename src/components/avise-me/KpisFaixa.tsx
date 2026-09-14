import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CarregandoTabela, EstadoErro } from "./Estados";
import { inteiro, numero, objetoDe, rpcAviseMe } from "@/lib/aviseMe";

const CARDS: { chaves: string[]; rotulo: string; verde?: boolean }[] = [
  { chaves: ["pessoas_esperando", "esperando"], rotulo: "Pessoas esperando" },
  { chaves: ["pessoas_unicas", "unicas"], rotulo: "Pessoas únicas" },
  { chaves: ["grades_com_fila", "grades"], rotulo: "Grades com fila" },
  { chaves: ["grades_voltaram", "grades_que_voltaram", "voltaram"], rotulo: "Grades que voltaram", verde: true },
  { chaves: ["pessoas_nas_voltaram", "pessoas_grades_voltaram", "esperando_voltaram"], rotulo: "Esperando nessas grades", verde: true },
];

function valor(resumo: Record<string, any>, chaves: string[]) {
  const c = chaves.find((k) => resumo?.[k] !== undefined && resumo?.[k] !== null);
  return c ? numero(resumo[c]) : 0;
}

export function KpisFaixa({ recarregar }: { recarregar?: number }) {
  const [resumo, setResumo] = useState<Record<string, any> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await rpcAviseMe("avise_me_painel_resumo");
      setResumo(objetoDe(r));
    } catch (e: any) {
      setErro(e?.message ?? "Erro inesperado");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recarregar]);

  if (carregando) return <CarregandoTabela linhas={2} />;
  if (erro) return <EstadoErro mensagem={erro} onTentar={carregar} />;

  const dados = resumo ?? {};
  const semGrade = valor(dados, ["sem_grade"]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {CARDS.map((c) => {
          const v = valor(dados, c.chaves);
          const destaque = !!c.verde && v > 0;
          return (
            <Card
              key={c.rotulo}
              className={cn("p-4", destaque && "border-success/40 bg-success/5")}
            >
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.rotulo}</p>
              <p
                className={cn(
                  "mt-1 font-serif text-2xl font-bold",
                  destaque ? "text-success" : "text-card-foreground",
                )}
              >
                {inteiro(v)}
              </p>
            </Card>
          );
        })}
      </div>

      {semGrade > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          {inteiro(semGrade)} grades não casaram com nenhuma variação da Tray, confira cor e tamanho
        </p>
      )}
    </div>
  );
}
