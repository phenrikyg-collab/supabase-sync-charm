import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CobrancasDaConversa } from "@/components/atendimento/CobrancaPix";
import { LinksDaConversa } from "@/components/atendimento/LinksPagamento";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function CobrancasConversa({ conversaId }: { conversaId: string | number }) {
  const isMobile = useIsMobile();
  const [expandido, setExpandido] = useState(false);
  const [quantidadePix, setQuantidadePix] = useState(0);
  const [quantidadeLinks, setQuantidadeLinks] = useState(0);
  const registrarPix = useCallback((quantidade: number) => setQuantidadePix(quantidade), []);
  const registrarLinks = useCallback((quantidade: number) => setQuantidadeLinks(quantidade), []);
  const temCobrancas = quantidadePix + quantidadeLinks > 0;

  useEffect(() => {
    setExpandido(false);
    setQuantidadePix(0);
    setQuantidadeLinks(0);
  }, [conversaId]);

  if (!isMobile) {
    return (
      <>
        <CobrancasDaConversa conversaId={conversaId} />
        <LinksDaConversa conversaId={conversaId} />
      </>
    );
  }

  return (
    <div className={cn("shrink-0 border-b border-border", !temCobrancas && "hidden")}>
      <Button
        type="button"
        variant="ghost"
        className="h-10 w-full justify-between rounded-none px-3 text-xs font-medium"
        onClick={() => setExpandido((atual) => !atual)}
        aria-expanded={expandido}
      >
        <span>Cobranças: {quantidadePix} Pix · {quantidadeLinks} {quantidadeLinks === 1 ? "link" : "links"}</span>
        {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      <div className={cn("max-h-[40dvh] overflow-y-auto", !expandido && "hidden")}>
        <CobrancasDaConversa conversaId={conversaId} embutido onQuantidadeChange={registrarPix} />
        <LinksDaConversa conversaId={conversaId} embutido onQuantidadeChange={registrarLinks} />
      </div>
    </div>
  );
}