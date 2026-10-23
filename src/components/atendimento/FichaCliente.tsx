import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ClipboardList, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { chamarRpc } from "@/lib/supabaseRpc";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { toast } from "sonner";

export type FichaDaCliente = {
  primeiro_nome?: string | null;
  resumo?: string | null;
  pecas?: { produto?: string | null; cor?: string | null; tamanho?: string | null; qtd?: number | null; obs?: string | null }[] | null;
  numeracao?: string | number | null;
  cep?: string | null;
  frete_escolhido?: string | null;
  pagamento?: string | null;
  objecao?: string | null;
  etapa?: string | null;
  bola_com?: "loja" | "cliente" | null;
  pendencia_da_loja?: string | null;
  proximo_passo?: string | null;
  nao_perguntar_de_novo?: string[] | null;
  confusao?: string | null;
};

export type RespostaFicha = { ficha: FichaDaCliente | null; gerada_em?: string | null; desatualizada?: boolean };

function idadeFicha(geradaEm?: string | null) {
  if (!geradaEm) return "Gerada há - min";
  const instante = new Date(geradaEm).getTime();
  if (!Number.isFinite(instante)) return "Gerada há - min";
  return `Gerada há ${Math.max(0, Math.floor((Date.now() - instante) / 60000))} min`;
}

function mensagemErro(erro: unknown) {
  return erro && typeof erro === "object" && "message" in erro ? String(erro.message) : "Não foi possível carregar a ficha. Tente novamente.";
}

export function FichaCliente({ conversaId }: { conversaId: string | number }) {
  // A chave também reinicia o estado recolhível e isola gerações de outras conversas.
  return <FichaConversa key={String(conversaId)} conversaId={conversaId} />;
}

function FichaConversa({ conversaId }: { conversaId: string | number }) {
  const [aberto, setAberto] = useState(true);
  const consulta = useQuery({
    queryKey: ["whatsapp-ficha", String(conversaId)],
    queryFn: async () => {
      const { data, error } = await chamarRpc<RespostaFicha>("whatsapp_ficha", { p_conversa: conversaId });
      if (error) throw error;
      return data;
    },
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });
  const gerar = useMutation({
    mutationFn: async () => {
      const resultado = await invokeEdgeFunction("whatsapp-ficha-lead", { conversa_id: conversaId });
      if (resultado?.error || resultado?.erro) throw new Error(String(resultado.error || resultado.erro));
      await consulta.refetch({ throwOnError: true });
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });
  const ficha = consulta.data?.ficha;
  const botaoGerar = (
    <Button type="button" variant="outline" size="sm" disabled={gerar.isPending} onClick={() => gerar.mutate()}>
      {gerar.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
      {ficha ? "Atualizar ficha" : "Gerar ficha"}
    </Button>
  );

  if (!ficha) return (
    <div className="shrink-0 border-b border-border px-3 py-2">
      {consulta.isPending ? <Loader2 aria-label="Carregando ficha" className="h-4 w-4 animate-spin text-muted-foreground" /> : consulta.isError ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-danger" role="alert">
          <span>{mensagemErro(consulta.error)}</span>
          <Button type="button" size="sm" variant="outline" disabled={consulta.isFetching} onClick={() => void consulta.refetch()}>Tentar novamente</Button>
        </div>
      ) : botaoGerar}
    </div>
  );

  const detalhes = [
    ["Numeração", ficha.numeracao], ["CEP", ficha.cep],
    ["Frete", ficha.frete_escolhido], ["Pagamento", ficha.pagamento],
  ].filter(([, valor]) => valor !== null && valor !== undefined && String(valor).trim() !== "");

  return (
    <Collapsible open={aberto} onOpenChange={setAberto} className="min-w-0 shrink-0 border-b border-border bg-muted/20">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" className="h-9 w-full justify-between rounded-none px-3 text-xs">
          <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" />Ficha da cliente</span>
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-[30vh] space-y-2 overflow-y-auto px-3 pb-2 text-xs break-words">
          <div className="flex flex-wrap gap-1.5">
            {ficha.etapa && <Badge variant="secondary">{ficha.etapa.replace(/_/g, " ")}</Badge>}
            {ficha.bola_com === "loja" && <Badge className="border-danger/20 bg-danger/10 text-danger">Bola com a loja</Badge>}
            {ficha.bola_com === "cliente" && <Badge variant="secondary">Bola com a cliente</Badge>}
          </div>
          {ficha.resumo && <p className="whitespace-pre-wrap">{ficha.resumo}</p>}
          {!!ficha.pecas?.length && <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground"><tr>{["Produto", "Cor", "Tamanho", "Qtd", "Obs"].map((titulo) => <th key={titulo} className="px-1 py-1 font-medium">{titulo}</th>)}</tr></thead>
              <tbody>{ficha.pecas.map((peca, i) => <tr key={i} className="border-t border-border">
                {[peca.produto, peca.cor, peca.tamanho, peca.qtd, peca.obs].map((valor, j) => <td key={j} className="px-1 py-1 align-top">{valor ?? "-"}</td>)}
              </tr>)}</tbody>
            </table>
          </div>}
          {!!detalhes.length && <div className="flex flex-wrap gap-x-3 gap-y-1">{detalhes.map(([rotulo, valor]) => <span key={String(rotulo)}><strong>{rotulo}:</strong> {valor}</span>)}</div>}
          {ficha.objecao && <p><strong>Objeção:</strong> {ficha.objecao}</p>}
          {ficha.pendencia_da_loja && <p className="rounded border border-warning/20 bg-warning/10 p-2 text-warning"><strong>A loja ficou devendo:</strong> {ficha.pendencia_da_loja}</p>}
          {ficha.proximo_passo && <p className="rounded border border-primary/20 bg-primary/10 p-2"><strong>Próximo passo:</strong> {ficha.proximo_passo}</p>}
          {!!ficha.nao_perguntar_de_novo?.length && <div className="space-y-1"><strong>Não perguntar de novo:</strong><div className="flex flex-wrap gap-1">{ficha.nao_perguntar_de_novo.map((item, i) => <Badge key={i} variant="outline" className="max-w-full whitespace-normal break-words font-normal">{item}</Badge>)}</div></div>}
          {ficha.confusao && <p role="note" className="rounded border border-warning/20 bg-warning/10 p-2 text-warning"><strong>Atenção: confusão:</strong> {ficha.confusao}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{idadeFicha(consulta.data?.gerada_em)}</span>
            {consulta.data?.desatualizada && <Badge className="border-warning/20 bg-warning/10 text-warning">tem mensagens novas</Badge>}
          </div>
          {botaoGerar}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}