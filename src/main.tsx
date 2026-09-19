import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { monitorarRenovacaoSessao } from "./lib/supabaseRpc";

monitorarRenovacaoSessao();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  });
}

const raiz = document.getElementById("root");
if (raiz) createRoot(raiz).render(<App />);
