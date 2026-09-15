import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { rpcEmails } from "@/lib/emails";

/** Conta quantas pessoas passam no filtro, com atraso para não consultar a cada tecla. */
export function ContadorPublico({ filtro, rotulo = "Hoje passam" }: { filtro: any; rotulo?: string }) {
  const [atrasado, setAtrasado] = useState(filtro);

  useEffect(() => {
    const t = setTimeout(() => setAtrasado(filtro), 600);
    return () => clearTimeout(t);
  }, [JSON.stringify(filtro)]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["fluxos-publico-contar", JSON.stringify(atrasado ?? null)],
    enabled: !!atrasado,
    queryFn: async () => {
      const d = await rpcEmails<any>("emails_publico_contar", { p_filtro: atrasado });
      if (typeof d === "number") return d;
      return Number(d?.total ?? d?.quantidade ?? d?.count ?? 0);
    },
  });

  if (isError) return <p className="text-xs text-muted-foreground">Não foi possível contar o público agora.</p>;

  return (
    <p className="text-xs text-muted-foreground">
      {rotulo}: {isFetching ? "contando…" : Number(data ?? 0).toLocaleString("pt-BR")}
    </p>
  );
}
