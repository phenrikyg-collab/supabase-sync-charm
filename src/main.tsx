import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { monitorarRenovacaoSessao } from "./lib/supabaseRpc";

monitorarRenovacaoSessao();

createRoot(document.getElementById("root")!).render(<App />);
