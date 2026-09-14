import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone } from "lucide-react";
import { rpcEmails } from "@/lib/emails";

export type Previa = {
  slug?: string;
  nome?: string;
  assunto?: string;
  preheader?: string | null;
  html?: string;
  html_sem_cupom?: string;
  variaveis_encontradas?: string[];
  checagem?: Record<string, any>;
};

/** Prévia renderizada pelo banco. Nunca use o HTML cru do template. */
export function usePreviaTemplate(slug?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["emails-template-previa", slug],
    queryFn: () => rpcEmails<Previa>("emails_template_previa", { p_slug: slug }),
    enabled: !!slug && enabled,
  });
}

/** Confere o HTML que está sendo digitado, sem precisar salvar. */
export function useConferirTemplate(html: string, assunto: string, atrasoMs = 500) {
  const [htmlLento, setHtmlLento] = useState(html);
  const [assuntoLento, setAssuntoLento] = useState(assunto);

  useEffect(() => {
    const t = setTimeout(() => {
      setHtmlLento(html);
      setAssuntoLento(assunto);
    }, atrasoMs);
    return () => clearTimeout(t);
  }, [html, assunto, atrasoMs]);

  return useQuery({
    queryKey: ["emails-template-conferir", htmlLento, assuntoLento],
    queryFn: () =>
      rpcEmails<Previa>("emails_template_conferir", {
        p_html: htmlLento,
        p_assunto: assuntoLento,
        p_nome: null,
        p_cupom: null,
        p_valor: null,
      }),
    enabled: !!htmlLento.trim(),
  });
}

export function useVariaveisDisponiveis(enabled = true) {
  return useQuery({
    queryKey: ["emails-variaveis"],
    queryFn: async () => (await rpcEmails<any[]>("emails_variaveis_disponiveis")) ?? [],
    enabled,
  });
}

export function ControlesPrevia({
  mobile, onMobile, semCupom, onSemCupom,
}: {
  mobile: boolean;
  onMobile: (v: boolean) => void;
  semCupom?: boolean;
  onSemCupom?: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        <Button size="sm" variant={mobile ? "outline" : "secondary"} onClick={() => onMobile(false)}>
          <Monitor className="mr-1 h-3.5 w-3.5" /> Desktop
        </Button>
        <Button size="sm" variant={mobile ? "secondary" : "outline"} onClick={() => onMobile(true)}>
          <Smartphone className="mr-1 h-3.5 w-3.5" /> Mobile 400px
        </Button>
      </div>
      {onSemCupom && (
        <div className="flex gap-1">
          <Button size="sm" variant={semCupom ? "outline" : "secondary"} onClick={() => onSemCupom(false)}>
            Com cupom
          </Button>
          <Button size="sm" variant={semCupom ? "secondary" : "outline"} onClick={() => onSemCupom(true)}>
            Sem cupom
          </Button>
        </div>
      )}
    </div>
  );
}

export function IframePrevia({
  html, mobile, altura = 560, titulo,
}: { html?: string | null; mobile: boolean; altura?: number; titulo: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-2">
      <iframe
        title={titulo}
        sandbox=""
        srcDoc={html || "<p style='font-family:sans-serif;color:#888'>Sem prévia para mostrar.</p>"}
        className="mx-auto w-full rounded bg-white"
        style={{ height: altura, ...(mobile ? { width: 400, maxWidth: "100%" } : {}) }}
      />
    </div>
  );
}
