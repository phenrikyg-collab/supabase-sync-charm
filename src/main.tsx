import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { monitorarRenovacaoSessao } from "./lib/supabaseRpc";

monitorarRenovacaoSessao();

const host = window.location.hostname;
const contextoDePreview =
  !import.meta.env.PROD ||
  window.self !== window.top ||
  host.startsWith("id-preview--") ||
  host.startsWith("preview--") ||
  host === "lovableproject.com" ||
  host.endsWith(".lovableproject.com") ||
  host === "lovableproject-dev.com" ||
  host.endsWith(".lovableproject-dev.com") ||
  host === "beta.lovable.dev" ||
  host.endsWith(".beta.lovable.dev");

if ("serviceWorker" in navigator && !contextoDePreview) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  });
}

const raiz = document.getElementById("root");
if (raiz) createRoot(raiz).render(<App />);
