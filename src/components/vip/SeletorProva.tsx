import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { vipProvaSignedUrl, vipProvasListar, type VipProva } from "@/lib/vip";

type Props = {
  provaId: string | null;
  onEscolher: (provaId: string | null, url: string | null, autorizada: boolean) => void;
};

/** Só lista provas autorizadas — o restante do acervo fica na aba Prova social. */
export function SeletorProva({ provaId, onEscolher }: Props) {
  const [provas, setProvas] = useState<VipProva[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const lista = (await vipProvasListar()).filter(
          (p) => (p.status ?? "").toLowerCase() === "autorizada",
        );
        setProvas(lista);
        const pares = await Promise.all(
          lista.map(async (p) => [p.id, p.imagem_url ?? (await vipProvaSignedUrl(p.imagem_path))] as const),
        );
        setUrls(Object.fromEntries(pares.filter(([, u]) => !!u) as [string, string][]));
      } catch (e: any) {
        setErro(e.message ?? "Falha ao carregar o acervo");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (erro) return <p className="text-xs text-destructive">{erro}</p>;
  if (provas.length === 0)
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma prova autorizada no acervo. Registre e peça autorização na aba Prova social.
      </p>
    );

  return (
    <div className="grid grid-cols-4 gap-2">
      {provas.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onEscolher(p.id, urls[p.id] ?? null, true)}
          className={`overflow-hidden rounded-lg border text-left ${
            provaId === p.id ? "border-primary ring-2 ring-primary/30" : "border-border"
          }`}
        >
          {urls[p.id] ? (
            <img src={urls[p.id]} alt={p.cliente_nome ?? ""} className="h-24 w-full object-cover" />
          ) : (
            <div className="h-24 w-full bg-muted" />
          )}
          <div className="truncate px-1 py-1 text-[11px]">{p.cliente_nome ?? "Cliente"}</div>
        </button>
      ))}
    </div>
  );
}
