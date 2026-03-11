import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Factory, Cake, SprayCan, Megaphone, Sparkles, ChevronRight,
} from "lucide-react";

const INTERVAL_MS = 15_000;

const FRASES_MOTIVACIONAIS = [
  "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
  "Trabalho em equipe divide a tarefa e multiplica o resultado.",
  "A qualidade nunca é um acidente. É sempre o resultado de um esforço inteligente.",
  "Grandes coisas nunca vêm de zonas de conforto.",
  "O único lugar onde o sucesso vem antes do trabalho é no dicionário.",
  "Acredite que você pode, assim você já está no meio do caminho.",
  "Cada dia é uma nova oportunidade para fazer melhor.",
  "Juntos somos mais fortes.",
  "Excelência não é um ato, mas um hábito.",
  "O talento vence jogos, mas só o trabalho em equipe ganha campeonatos.",
];

interface Colaborador {
  id: string;
  nome: string;
  data_nascimento: string | null;
  ativo: boolean;
}

interface EscalaLimpeza {
  id: string;
  data: string;
  colaborador_id: string;
  colaboradores?: { nome: string };
}

interface Aviso {
  id: string;
  titulo: string;
  mensagem: string | null;
  prioridade: number;
}

type PainelKey = "producao" | "aniversariantes" | "limpeza" | "avisos" | "frase";

const PAINEIS: { key: PainelKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "producao", label: "Produção", icon: Factory },
  { key: "aniversariantes", label: "Aniversariantes", icon: Cake },
  { key: "limpeza", label: "Escala de Limpeza", icon: SprayCan },
  { key: "avisos", label: "Avisos", icon: Megaphone },
  { key: "frase", label: "Motivação", icon: Sparkles },
];

export default function TVInterna() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [escala, setEscala] = useState<EscalaLimpeza[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [fraseIndex, setFraseIndex] = useState(0);
  const [clock, setClock] = useState(new Date());

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-rotate
  useEffect(() => {
    const t = setInterval(() => {
      setActiveIndex((i) => {
        const next = (i + 1) % PAINEIS.length;
        if (PAINEIS[next].key === "frase") {
          setFraseIndex((f) => (f + 1) % FRASES_MOTIVACIONAIS.length);
        }
        return next;
      });
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchAll = async () => {
      const [colabRes, escalaRes, avisosRes] = await Promise.all([
        supabase.from("colaboradores").select("*").eq("ativo", true),
        supabase
          .from("escala_limpeza")
          .select("*, colaboradores(nome)")
          .gte("data", format(new Date(), "yyyy-MM-dd"))
          .order("data", { ascending: true })
          .limit(10),
        supabase
          .from("avisos_mural")
          .select("*")
          .eq("ativo", true)
          .order("prioridade", { ascending: false }),
      ]);
      if (colabRes.data) setColaboradores(colabRes.data);
      if (escalaRes.data) setEscala(escalaRes.data as any);
      if (avisosRes.data) setAvisos(avisosRes.data);
    };
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, []);

  const aniversariantes = colaboradores.filter((c) => {
    if (!c.data_nascimento) return false;
    const nascimento = parseISO(c.data_nascimento);
    return isSameMonth(nascimento, new Date()) && nascimento.getDate() >= new Date().getDate();
  });

  const activePanel = PAINEIS[activeIndex];

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-black/30 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-4">
          <img src="/images/logo.png" alt="Logo" className="w-10 h-10 rounded-lg" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mariana Cardoso</h1>
            <p className="text-xs text-white/50 uppercase tracking-widest">TV Interna</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-mono font-bold tabular-nums">
            {format(clock, "HH:mm:ss")}
          </p>
          <p className="text-sm text-white/60 capitalize">
            {format(clock, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </header>

      {/* Navigation dots */}
      <div className="flex items-center justify-center gap-3 py-3 bg-black/20">
        {PAINEIS.map((p, i) => (
          <button
            key={p.key}
            onClick={() => setActiveIndex(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              i === activeIndex
                ? "bg-white/20 text-white scale-105"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            <p.icon className="h-3.5 w-3.5" />
            {p.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 relative px-8 py-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePanel.key}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 px-8 py-6"
          >
            {activePanel.key === "producao" && <PainelProducao />}
            {activePanel.key === "aniversariantes" && (
              <PainelAniversariantes aniversariantes={aniversariantes} />
            )}
            {activePanel.key === "limpeza" && <PainelLimpeza escala={escala} />}
            {activePanel.key === "avisos" && <PainelAvisos avisos={avisos} />}
            {activePanel.key === "frase" && (
              <PainelFrase frase={FRASES_MOTIVACIONAIS[fraseIndex]} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <motion.div
          key={activeIndex}
          className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: INTERVAL_MS / 1000, ease: "linear" }}
        />
      </div>
    </div>
  );
}

/* ── Painéis ───────────────────────────────────────────── */

function PainelProducao() {
  const [contagens, setContagens] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase
      .from("resumo_producao_andamento" as any)
      .select("*")
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data || []).forEach((item: any) => {
          const status = item.status_ordem || "Sem status";
          const qtd = item.quantidade_pecas_ordem || 0;
          counts[status] = (counts[status] || 0) + qtd;
        });
        setContagens(counts);
      });
  }, []);

  const etapas = [
    { label: "Corte", status: "Corte", color: "from-blue-500 to-cyan-500" },
    { label: "Costura", status: "Costura", color: "from-violet-500 to-purple-500" },
    { label: "Revisão", status: "Revisão", color: "from-amber-500 to-yellow-500" },
    { label: "Em Conserto", status: "Em Conserto", color: "from-rose-500 to-pink-500" },
    { label: "Finalizado", status: "Finalizado", color: "from-emerald-500 to-green-500" },
  ];

  return (
    <div className="h-full flex flex-col">
      <SectionHeader icon={Factory} title="Resumo da Produção" />
      <div className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-5 gap-4 w-full max-w-5xl">
          {etapas.map((etapa) => (
            <motion.div
              key={etapa.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`rounded-2xl bg-gradient-to-br ${etapa.color} p-[1px]`}
            >
              <div className="bg-slate-900/90 rounded-2xl p-6 text-center h-full">
                <p className="text-4xl font-bold mb-2">
                  {contagens[etapa.status] || 0}
                </p>
                <p className="text-white/60 text-sm">{etapa.label}</p>
                <p className="text-white/30 text-xs mt-1">peças</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PainelAniversariantes({ aniversariantes }: { aniversariantes: Colaborador[] }) {
  return (
    <div className="h-full flex flex-col">
      <SectionHeader icon={Cake} title="Aniversariantes do Mês" />
      <div className="flex-1 flex items-center justify-center">
        {aniversariantes.length === 0 ? (
          <p className="text-white/40 text-2xl">Nenhum aniversariante próximo 🎂</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl w-full">
            {aniversariantes.map((c) => (
              <motion.div
                key={c.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  {c.nome.charAt(0)}
                </div>
                <p className="font-semibold text-lg">{c.nome}</p>
                {c.data_nascimento && (
                  <p className="text-white/50 text-sm mt-1">
                    {format(parseISO(c.data_nascimento), "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PainelLimpeza({ escala }: { escala: EscalaLimpeza[] }) {
  return (
    <div className="h-full flex flex-col">
      <SectionHeader icon={SprayCan} title="Escala de Limpeza da Cozinha" />
      <div className="flex-1 flex items-center justify-center">
        {escala.length === 0 ? (
          <p className="text-white/40 text-2xl">Nenhuma escala definida</p>
        ) : (
          <div className="space-y-4 w-full max-w-2xl">
            {escala.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`flex items-center gap-4 p-5 rounded-xl border transition-all ${
                  e.data === format(new Date(), "yyyy-MM-dd")
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg">
                  {e.colaboradores?.nome?.charAt(0) || "?"}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">{e.colaboradores?.nome || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-sm">
                    {format(parseISO(e.data), "EEEE", { locale: ptBR })}
                  </p>
                  <p className="font-mono font-semibold">
                    {format(parseISO(e.data), "dd/MM")}
                  </p>
                </div>
                {e.data === format(new Date(), "yyyy-MM-dd") && (
                  <span className="px-3 py-1 rounded-full bg-amber-500 text-black text-xs font-bold uppercase">
                    Hoje
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PainelAvisos({ avisos }: { avisos: Aviso[] }) {
  return (
    <div className="h-full flex flex-col">
      <SectionHeader icon={Megaphone} title="Mural de Avisos" />
      <div className="flex-1 flex items-center justify-center">
        {avisos.length === 0 ? (
          <p className="text-white/40 text-2xl">Nenhum aviso no momento 📋</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            {avisos.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6"
              >
                <div className="flex items-start gap-3">
                  <ChevronRight className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-bold text-lg mb-2">{a.titulo}</h3>
                    {a.mensagem && (
                      <p className="text-white/60 leading-relaxed">{a.mensagem}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PainelFrase({ frase }: { frase: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-3xl text-center"
      >
        <Sparkles className="h-12 w-12 text-amber-400 mx-auto mb-8" />
        <p className="text-4xl md:text-5xl font-serif italic leading-tight text-white/90">
          "{frase}"
        </p>
      </motion.div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-amber-400" />
      </div>
      <h2 className="text-2xl font-bold">{title}</h2>
    </div>
  );
}
