import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHAVE_DISPENSA = "gestao-mc-instalar-dispensado-ate";
const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function estaInstalado() {
  const navegadorIos = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navegadorIos.standalone === true;
}

export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalacao | null>(null);
  const [visivel, setVisivel] = useState(false);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const dispensadoAte = Number(localStorage.getItem(CHAVE_DISPENSA) ?? 0);
    if (window.innerWidth >= 768 || estaInstalado() || dispensadoAte > Date.now()) return;
    setVisivel(true);
    const aoInstalar = (event: Event) => {
      event.preventDefault();
      setEvento(event as EventoInstalacao);
    };
    window.addEventListener("beforeinstallprompt", aoInstalar);
    return () => window.removeEventListener("beforeinstallprompt", aoInstalar);
  }, []);

  if (!visivel) return null;

  const fechar = () => {
    localStorage.setItem(CHAVE_DISPENSA, String(Date.now() + TRINTA_DIAS));
    setVisivel(false);
  };

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    const escolha = await evento.userChoice;
    if (escolha.outcome === "accepted") setVisivel(false);
    setEvento(null);
  };

  return (
    <div className="flex min-h-10 items-center gap-2 border-b border-border bg-secondary px-3 py-2 text-xs md:hidden">
      {ios ? <Share className="h-4 w-4 shrink-0 text-primary" /> : <Download className="h-4 w-4 shrink-0 text-primary" />}
      <p className="min-w-0 flex-1">
        {ios ? <>Toque em Compartilhar e depois em <strong>Adicionar à Tela de Início</strong>.</> : "Instale o painel para abrir como aplicativo."}
      </p>
      {!ios && evento && <Button size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => void instalar()}>Instalar o app</Button>}
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Fechar" onClick={fechar}><X className="h-4 w-4" /></Button>
    </div>
  );
}