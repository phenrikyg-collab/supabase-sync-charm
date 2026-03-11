import { useState, useEffect, useCallback } from "react";
import { format, getDaysInMonth, getDay, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useResumoProducao } from "@/hooks/useSupabase";
import { useColaboradores, useEscalaLimpeza, useAvisosMural } from "@/hooks/useTvInterna";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Megaphone, Cake, SprayCan, Factory, ChevronLeft, ChevronRight } from "lucide-react";

const PANEL_INTERVAL = 15000; // 15 seconds

const COLUNAS_PRODUCAO = [
  { key: "corte", label: "Corte", match: ["corte"] },
  { key: "costura", label: "Costura", match: ["costura"] },
  { key: "revisao", label: "Revisão", match: ["revisao", "revisão"] },
  { key: "finalizado", label: "Finalizado", match: ["finalizado"] },
];

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 50%)",
  "hsl(150, 60%, 45%)",
];

function PanelProducao() {
  const { data: producao } = useResumoProducao();

  const chartData = COLUNAS_PRODUCAO.map((col) => ({
    name: col.label,
    qtd: producao?.filter((p) => col.match.includes(p.status_ordem?.toLowerCase() ?? "")).length ?? 0,
  }));

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="flex items-center gap-3 mb-8">
        <Factory className="h-10 w-10 text-primary" />
        <h2 className="text-4xl font-serif font-bold text-foreground">Produção em Andamento</h2>
      </div>
      <div className="w-full max-w-3xl h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={80}>
            <XAxis dataKey="name" tick={{ fontSize: 20, fill: "hsl(var(--foreground))" }} />
            <YAxis tick={{ fontSize: 16, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip />
            <Bar dataKey="qtd" radius={[8, 8, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-6 mt-8">
        {chartData.map((d, i) => (
          <div key={d.name} className="text-center">
            <div className="text-5xl font-bold" style={{ color: COLORS[i] }}>{d.qtd}</div>
            <div className="text-lg text-muted-foreground mt-1">{d.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelEscalaLimpeza() {
  const now = new Date();
  const mesAtual = format(now, "yyyy-MM");
  const { data: escala } = useEscalaLimpeza(mesAtual);

  const daysInMonth = getDaysInMonth(now);
  const firstDayOfWeek = getDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const escalaMap: Record<string, string> = {};
  escala?.forEach((e) => {
    const day = parseISO(e.data).getDate().toString();
    escalaMap[day] = e.colaboradores?.nome ?? "—";
  });

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="flex items-center gap-3 mb-6">
        <SprayCan className="h-10 w-10 text-primary" />
        <h2 className="text-4xl font-serif font-bold text-foreground">
          Escala de Limpeza — {format(now, "MMMM yyyy", { locale: ptBR })}
        </h2>
      </div>

      <div className="grid grid-cols-7 gap-2 w-full max-w-4xl">
        {diasSemana.map((d) => (
          <div key={d} className="text-center font-bold text-muted-foreground text-lg py-2">{d}</div>
        ))}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = format(new Date(now.getFullYear(), now.getMonth(), day), "yyyy-MM-dd");
          const isHoje = isToday(new Date(now.getFullYear(), now.getMonth(), day));
          const responsavel = escalaMap[day.toString()];

          return (
            <div
              key={day}
              className={`rounded-lg p-2 text-center border transition-all ${
                isHoje
                  ? "bg-primary text-primary-foreground border-primary shadow-lg scale-105"
                  : "bg-card border-border"
              }`}
            >
              <div className={`text-lg font-bold ${isHoje ? "" : "text-foreground"}`}>{day}</div>
              {responsavel && (
                <div className={`text-xs mt-1 truncate ${isHoje ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {responsavel}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PanelAniversariantes() {
  const { data: colaboradores } = useColaboradores();
  const now = new Date();
  const mesAtual = now.getMonth() + 1;

  const aniversariantes = colaboradores?.filter((c) => {
    if (!c.data_nascimento) return false;
    const mes = parseISO(c.data_nascimento).getMonth() + 1;
    return mes === mesAtual;
  }).sort((a, b) => {
    const diaA = parseISO(a.data_nascimento!).getDate();
    const diaB = parseISO(b.data_nascimento!).getDate();
    return diaA - diaB;
  }) ?? [];

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="flex items-center gap-3 mb-8">
        <Cake className="h-10 w-10 text-primary" />
        <h2 className="text-4xl font-serif font-bold text-foreground">
          Aniversariantes de {format(now, "MMMM", { locale: ptBR })}
        </h2>
      </div>

      {aniversariantes.length === 0 ? (
        <p className="text-2xl text-muted-foreground">Nenhum aniversariante este mês 🎂</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {aniversariantes.map((c) => {
            const dia = parseISO(c.data_nascimento!).getDate();
            const isHoje = dia === now.getDate();
            return (
              <Card
                key={c.id}
                className={`text-center transition-all ${isHoje ? "border-primary shadow-lg bg-primary/5 scale-105" : ""}`}
              >
                <CardContent className="pt-6 pb-4">
                  <div className="text-4xl mb-2">{isHoje ? "🎉" : "🎂"}</div>
                  <div className="text-xl font-bold text-foreground">{c.nome}</div>
                  {c.cargo && <div className="text-sm text-muted-foreground">{c.cargo}</div>}
                  <div className="text-lg font-medium text-primary mt-2">Dia {dia}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PanelAvisos() {
  const { data: avisos } = useAvisosMural();

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="flex items-center gap-3 mb-8">
        <Megaphone className="h-10 w-10 text-primary" />
        <h2 className="text-4xl font-serif font-bold text-foreground">Mural de Avisos</h2>
      </div>

      {(!avisos || avisos.length === 0) ? (
        <p className="text-2xl text-muted-foreground">Nenhum aviso no momento ✅</p>
      ) : (
        <div className="space-y-6 w-full max-w-3xl">
          {avisos.map((a) => (
            <Card key={a.id} className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <h3 className="text-2xl font-bold text-foreground">{a.titulo}</h3>
                {a.mensagem && <p className="text-lg text-muted-foreground mt-2">{a.mensagem}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const PANELS = [
  { key: "producao", component: PanelProducao },
  { key: "escala", component: PanelEscalaLimpeza },
  { key: "aniversariantes", component: PanelAniversariantes },
  { key: "avisos", component: PanelAvisos },
];

const PANEL_LABELS = ["Produção", "Escala de Limpeza", "Aniversariantes", "Avisos"];

export default function TvInterna() {
  const [activePanel, setActivePanel] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActivePanel((prev) => (prev + 1) % PANELS.length);
    }, PANEL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const CurrentPanel = PANELS[activePanel].component;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-background">
      {/* Indicators */}
      <div className="flex items-center justify-center gap-4 py-4">
        <button
          onClick={() => setActivePanel((prev) => (prev - 1 + PANELS.length) % PANELS.length)}
          className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        {PANELS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActivePanel(i)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              i === activePanel
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {PANEL_LABELS[i]}
          </button>
        ))}
        <button
          onClick={() => setActivePanel((prev) => (prev + 1) % PANELS.length)}
          className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePanel}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            <CurrentPanel />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <motion.div
          key={activePanel}
          className="h-full bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: PANEL_INTERVAL / 1000, ease: "linear" }}
        />
      </div>
    </div>
  );
}
