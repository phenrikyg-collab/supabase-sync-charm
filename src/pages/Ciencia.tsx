import { useCallback, useEffect, useRef, useState } from "react";

const API = "https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/rh-ciencia";

interface Evento {
  codigo?: string | number | null;
  descricao?: string | null;
  referencia?: string | null;
  provento?: number | null;
  desconto?: number | null;
}

interface Dados {
  holerite_id?: string;
  tipo?: string;
  competencia?: string;
  funcionaria?: string;
  cargo?: string;
  admissao?: string;
  eventos?: Evento[];
  total_proventos?: number;
  total_descontos?: number;
  liquido?: number;
  expirado?: boolean;
  confirmado?: boolean;
  confirmado_em?: string;
  protocolo?: string;
  assinatura?: string;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const TITULOS: Record<string, string> = {
  adiantamento: "Recibo de adiantamento salarial",
  fechamento: "Recibo de pagamento de salário",
  vt: "Recibo de vale transporte",
  va: "Recibo de vale alimentação",
};

const brl = (v?: number | null) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function competenciaExtenso(comp?: string) {
  if (!comp) return "";
  const [a, m] = comp.split("-");
  const mi = Number(m) - 1;
  if (!a || Number.isNaN(mi) || !MESES[mi]) return comp;
  return `${MESES[mi]} de ${a}`;
}

function dataHoraBR(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return `${g("day")}/${g("month")}/${g("year")} às ${g("hour")}:${g("minute")}`;
}

function declaracao(tipo?: string, comp?: string) {
  const c = competenciaExtenso(comp);
  if (tipo === "vt")
    return `Declaro ter recebido de MP CONFECCOES LTDA o vale transporte referente à competência de ${c}, no valor discriminado neste recibo.`;
  if (tipo === "va")
    return `Declaro ter recebido de MP CONFECCOES LTDA o vale alimentação (crédito na plataforma Ticket) referente à competência de ${c}, no valor discriminado neste recibo.`;
  return `Declaro ter recebido de MP CONFECCOES LTDA a importância líquida discriminada neste recibo, referente à competência de ${c}.`;
}

function Assinatura({
  onChange,
}: {
  onChange: (vazio: boolean) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const desenhando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);

  const setup = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const snapshot = canvas.width ? canvas.toDataURL() : null;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(190 * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1f1f1d";
    if (snapshot) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, 190);
      img.src = snapshot;
    }
  }, []);

  useEffect(() => {
    setup();
    window.addEventListener("resize", setup);
    return () => window.removeEventListener("resize", setup);
  }, [setup]);

  const pos = (e: MouseEvent | TouchEvent) => {
    const canvas = ref.current!;
    const rect = canvas.getBoundingClientRect();
    const p = "touches" in e ? e.touches[0] ?? (e as TouchEvent).changedTouches[0] : (e as MouseEvent);
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  };

  const start = (e: MouseEvent | TouchEvent) => {
    if ("touches" in e) e.preventDefault();
    desenhando.current = true;
    ultimo.current = pos(e);
  };
  const move = (e: MouseEvent | TouchEvent) => {
    if (!desenhando.current) return;
    if ("touches" in e) e.preventDefault();
    const ctx = ref.current?.getContext("2d");
    const p = pos(e);
    if (!ctx || !ultimo.current) return;
    ctx.beginPath();
    ctx.moveTo(ultimo.current.x, ultimo.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo.current = p;
    onChange(false);
  };
  const end = (e: MouseEvent | TouchEvent) => {
    if ("touches" in e) e.preventDefault();
    desenhando.current = false;
    ultimo.current = null;
  };

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.addEventListener("mousedown", start);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    c.addEventListener("touchstart", start, { passive: false });
    c.addEventListener("touchmove", move, { passive: false });
    c.addEventListener("touchend", end, { passive: false });
    return () => {
      c.removeEventListener("mousedown", start);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      c.removeEventListener("touchstart", start);
      c.removeEventListener("touchmove", move);
      c.removeEventListener("touchend", end);
    };
  });

  const limpar = () => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    onChange(true);
  };

  return { canvasRef: ref, limpar, element: (
    <canvas
      ref={ref}
      style={{
        width: "100%",
        height: 190,
        background: "#fcfbf8",
        border: "1px dashed #d6d2c8",
        borderRadius: 12,
        touchAction: "none",
        display: "block",
      }}
    />
  ) };
}

export default function Ciencia() {
  const token = new URLSearchParams(window.location.search).get("t");
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroToken, setErroToken] = useState(false);
  const [vazio, setVazio] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const assinatura = Assinatura({ onChange: setVazio });

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    document.title = "Confirmação de recebimento";
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setErroToken(true);
      setCarregando(false);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API}?t=${encodeURIComponent(token)}&f=json`);
        const j = await r.json();
        if (!r.ok) setErroToken(true);
        else setDados(j);
      } catch {
        setErroToken(true);
      } finally {
        setCarregando(false);
      }
    })();
  }, [token]);

  const confirmar = async () => {
    if (!token) return;
    setEnviando(true);
    setErro(null);
    try {
      const png = assinatura.canvasRef.current?.toDataURL("image/png");
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, assinatura: png }),
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        setErro(j.error || "Não foi possível confirmar. Tente novamente.");
        setEnviando(false);
        return;
      }
      setDados((d) => ({
        ...(d ?? {}),
        confirmado: true,
        protocolo: j.protocolo,
        confirmado_em: j.confirmado_em,
        assinatura: png,
      }));
    } catch {
      setErro("Não foi possível confirmar. Tente novamente.");
    }
    setEnviando(false);
  };

  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    background: "#f4f2ee",
    color: "#1f1f1d",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    padding: "24px 16px 48px",
  };
  const col: React.CSSProperties = { maxWidth: 520, margin: "0 auto" };
  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e3e0d9",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  };

  if (carregando) {
    return (
      <div style={wrap}>
        <div style={col}>
          <div style={card}>
            <div style={{ height: 18, width: "60%", background: "#ece9e2", borderRadius: 6, marginBottom: 12 }} />
            <div style={{ height: 12, width: "40%", background: "#ece9e2", borderRadius: 6, marginBottom: 24 }} />
            <div style={{ height: 12, background: "#f0eee8", borderRadius: 6, marginBottom: 10 }} />
            <div style={{ height: 12, background: "#f0eee8", borderRadius: 6, marginBottom: 10 }} />
            <div style={{ height: 12, background: "#f0eee8", borderRadius: 6 }} />
          </div>
        </div>
      </div>
    );
  }

  if (erroToken || !dados || dados.expirado) {
    return (
      <div style={wrap}>
        <div style={col}>
          <div style={card}>
            <div style={{ color: "#a33", fontWeight: 600, fontSize: 16 }}>
              {dados?.expirado ? "Este link expirou." : "Link inválido."}
            </div>
            <div style={{ color: "#7a776f", marginTop: 8, fontSize: 14 }}>
              Peça um novo link ao setor financeiro.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const eventos = dados.eventos ?? [];

  const recibo = (
    <div style={card}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>
        {TITULOS[dados.tipo ?? ""] ?? "Recibo"}
      </div>
      <div style={{ color: "#7a776f", fontSize: 13, marginTop: 4 }}>
        {dados.funcionaria} · competência de {competenciaExtenso(dados.competencia)}
      </div>

      <div style={{ marginTop: 16 }}>
        {eventos.map((e, i) => {
          const desconto = Number(e.desconto) || 0;
          const valor = desconto || Number(e.provento) || 0;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 0",
                borderBottom: "1px solid #f0eee8",
                fontSize: 14,
              }}
            >
              <span>
                {e.descricao}
                {e.referencia ? (
                  <span style={{ fontSize: 12, color: "#9a968d" }}> ({e.referencia})</span>
                ) : null}
              </span>
              <span style={{ whiteSpace: "nowrap", color: desconto ? "#a33" : "#1f1f1d" }}>
                {desconto ? "− " : ""}
                {brl(valor)}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 16,
          background: "#faf6ec",
          border: "1px solid #ecdcb8",
          borderRadius: 12,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 12, letterSpacing: 0.6, color: "#7a776f" }}>VALOR LÍQUIDO</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#8a5a12" }}>{brl(dados.liquido)}</span>
      </div>
    </div>
  );

  if (dados.confirmado) {
    return (
      <div style={wrap}>
        <div style={col}>
          {recibo}
          <div
            style={{
              ...card,
              background: "#eef6ee",
              border: "1px solid #cfe4cf",
              color: "#245c2b",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Recebimento confirmado</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>{dataHoraBR(dados.confirmado_em)}</div>
            {dados.protocolo && (
              <div
                style={{
                  marginTop: 10,
                  display: "inline-block",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  background: "#ffffff",
                  border: "1px solid #cfe4cf",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 13,
                }}
              >
                Protocolo {dados.protocolo}
              </div>
            )}
            {dados.assinatura && (
              <div style={{ marginTop: 16 }}>
                <img
                  src={dados.assinatura}
                  alt="Assinatura"
                  style={{ maxWidth: 220, width: "100%", margin: "0 auto", display: "block" }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={col}>
        {recibo}
        <div style={card}>
          <p style={{ fontSize: 13, color: "#4a4842", lineHeight: 1.5, margin: 0 }}>
            {declaracao(dados.tipo, dados.competencia)}
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 18,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>Assine no espaço abaixo</span>
            <button
              type="button"
              onClick={assinatura.limpar}
              style={{
                background: "none",
                border: "none",
                color: "#8a5a12",
                fontSize: 13,
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
              }}
            >
              apagar
            </button>
          </div>

          {assinatura.element}

          {erro && (
            <div style={{ color: "#a33", fontSize: 13, marginTop: 12 }}>{erro}</div>
          )}

          <button
            type="button"
            disabled={vazio || enviando}
            onClick={confirmar}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "14px 16px",
              borderRadius: 12,
              border: "none",
              background: vazio || enviando ? "#b9b6ae" : "#181817",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: vazio || enviando ? "not-allowed" : "pointer",
            }}
          >
            {enviando ? "Enviando..." : "Confirmar recebimento"}
          </button>

          <div style={{ fontSize: 12, color: "#9a968d", marginTop: 10, textAlign: "center" }}>
            Ao confirmar, ficam registrados a data, a hora e o dispositivo usado.
          </div>
        </div>
      </div>
    </div>
  );
}
