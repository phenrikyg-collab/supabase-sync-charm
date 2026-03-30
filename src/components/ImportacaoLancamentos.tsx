import { useRef, useState } from "react";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { useCategorias } from "@/hooks/useSupabase";
import { findCategoriaByDescricao } from "@/lib/categoriaMappings";
import * as XLSX from "xlsx";

interface LancamentoImportado {
  descricao: string;
  valor: number;
  data: string;
  data_vencimento?: string | null;
  tipo?: "entrada" | "saida";
  categoria_id?: string | null;
  categoria_nome?: string | null;
  categoria?: any;
}

interface Props {
  onImportar: (lancamentos: LancamentoImportado[]) => void;
}

type FormatoDetectado = "extrato_pagamentos_safra" | "extrato_safra" | "vindi" | "generico";

const detectarFormato = (headers: string[]): FormatoDetectado => {
  const h = headers.map((c) => String(c ?? "").toLowerCase().trim());

  // Extrato Pagamentos Safra: "data", "data vencimento", "favorecido / beneficiário", "valor (r$)"
  if (h.some((c) => c.includes("favorecido")) && h.some((c) => c.includes("valor (r$)"))) {
    return "extrato_pagamentos_safra";
  }

  // Vindi: "data da transação", "cliente", "valor pago", "valor loja"
  if (h.some((c) => c.includes("data da transação") || c.includes("data da transacao")) && h.some((c) => c.includes("valor loja") || c.includes("valor pago"))) {
    return "vindi";
  }

  // Extrato Safra: "tipo do lançamento", "lançamento", "complemento"
  if (h.some((c) => c.includes("tipo do lançamento") || c.includes("tipo do lancamento")) && h.some((c) => c.includes("lançamento") || c.includes("lancamento"))) {
    return "extrato_safra";
  }

  return "generico";
};

const formatExcelDate = (val: any): string => {
  if (!val) return new Date().toISOString().split("T")[0];
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(val).trim();
  // DD/MM/AAAA
  const matchFull = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchFull) return `${matchFull[3]}-${matchFull[2]}-${matchFull[1]}`;
  // DD/MM (sem ano) — assume ano corrente
  const matchShort = s.match(/^(\d{2})\/(\d{2})$/);
  if (matchShort) return `${new Date().getFullYear()}-${matchShort[2]}-${matchShort[1]}`;
  // AAAA-MM-DD (já está ok) ou datetime
  const matchIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
  return s;
};

const parseSafeNumber = (val: any): number => {
  if (typeof val === "number") return val;
  const n = parseFloat(String(val).replace(/[^\d.,-]/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const mapExtratoPagamentosSafra = (rows: any[][]): LancamentoImportado[] => {
  const headers = rows[0].map((c: any) => String(c ?? "").toLowerCase().trim());
  const iData = headers.findIndex((h: string) => h === "data");
  const iVenc = headers.findIndex((h: string) => h.includes("data vencimento"));
  const iDesc = headers.findIndex((h: string) => h.includes("favorecido"));
  const iValor = headers.findIndex((h: string) => h.includes("valor"));

  return rows.slice(1).filter((r) => r[iDesc]).map((r) => ({
    descricao: String(r[iDesc] || ""),
    valor: Math.abs(parseSafeNumber(r[iValor])),
    data: formatExcelDate(r[iData]),
    data_vencimento: iVenc >= 0 ? formatExcelDate(r[iVenc]) : null,
    tipo: "saida" as const,
  }));
};

const mapExtratoSafra = (rows: any[][]): LancamentoImportado[] => {
  const headers = rows[0].map((c: any) => String(c ?? "").toLowerCase().trim());
  const iData = headers.findIndex((h: string) => h === "data");
  const iTipo = headers.findIndex((h: string) => h.includes("tipo do"));
  const iLanc = headers.findIndex((h: string) => h === "lançamento" || h === "lancamento");
  const iCompl = headers.findIndex((h: string) => h.includes("complemento"));
  const iValor = headers.findIndex((h: string) => h === "valor");

  return rows.slice(1).filter((r) => r[iLanc]).map((r) => {
    const tipoLanc = String(r[iTipo] || "").toLowerCase();
    const valor = parseSafeNumber(r[iValor]);
    const descParts = [String(r[iLanc] || "")];
    if (r[iCompl] && String(r[iCompl]).trim() !== "" && String(r[iCompl]).toLowerCase() !== "nan") {
      descParts.push(String(r[iCompl]));
    }

    return {
      descricao: descParts.join(" - "),
      valor: Math.abs(valor),
      data: formatExcelDate(r[iData]),
      data_vencimento: null,
      tipo: (tipoLanc.includes("créd") || tipoLanc.includes("cred") || valor > 0 ? "entrada" : "saida") as "entrada" | "saida",
    };
  });
};

const mapVindi = (rows: any[][]): LancamentoImportado[] => {
  const headers = rows[0].map((c: any) => String(c ?? "").toLowerCase().trim());
  const iData = headers.findIndex((h: string) => h.includes("data da transação") || h.includes("data da transacao"));
  const iCliente = headers.findIndex((h: string) => h === "cliente");
  const iValorLoja = headers.findIndex((h: string) => h.includes("valor loja"));
  const iValorPago = headers.findIndex((h: string) => h.includes("valor pago"));
  const iCredito = headers.findIndex((h: string) => h.includes("data credito") || h.includes("data crédito"));
  const iPedido = headers.findIndex((h: string) => h.includes("número pedido") || h.includes("numero pedido"));
  const iStatus = headers.findIndex((h: string) => h === "status");

  return rows.slice(1)
    .filter((r) => {
      if (iStatus >= 0) {
        const status = String(r[iStatus] || "").toLowerCase();
        if (status && !status.includes("aprovada") && status !== "nan") return false;
      }
      return r[iCliente];
    })
    .map((r) => {
      const valorLoja = iValorLoja >= 0 ? parseSafeNumber(r[iValorLoja]) : 0;
      const valorPago = iValorPago >= 0 ? parseSafeNumber(r[iValorPago]) : 0;
      const pedido = iPedido >= 0 && r[iPedido] ? ` #${r[iPedido]}` : "";

      return {
        descricao: `${String(r[iCliente] || "")}${pedido}`,
        valor: valorLoja || valorPago,
        data: formatExcelDate(r[iData]),
        data_vencimento: iCredito >= 0 ? formatExcelDate(r[iCredito]) : null,
        tipo: "entrada" as const,
      };
    });
};

const mapGenerico = (rows: any[][]): LancamentoImportado[] => {
  return rows.slice(1).map((cols, i) => ({
    descricao: String(cols[0] || "") || `Lançamento ${i + 1}`,
    valor: Math.abs(parseSafeNumber(cols[1])),
    data: formatExcelDate(cols[2]),
    data_vencimento: null,
  })).filter((l) => l.descricao);
};

export default function ImportacaoLancamentos({ onImportar }: Props) {
  const csvRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { data: categorias } = useCategorias();

  const processSpreadsheetRows = (rows: any[][]) => {
    if (!rows.length || rows.length < 2) {
      setErro("Planilha vazia ou sem dados.");
      return;
    }

    const headers = rows[0];
    const formato = detectarFormato(headers.map((c: any) => String(c ?? "")));

    let lancamentos: LancamentoImportado[];
    switch (formato) {
      case "extrato_pagamentos_safra":
        lancamentos = mapExtratoPagamentosSafra(rows);
        break;
      case "extrato_safra":
        lancamentos = mapExtratoSafra(rows);
        break;
      case "vindi":
        lancamentos = mapVindi(rows);
        break;
      default:
        lancamentos = mapGenerico(rows);
    }

    if (!lancamentos.length) {
      setErro("Nenhum lançamento encontrado na planilha.");
      return;
    }

    // Pré-atribuir categorias com base no mapeamento descrição→categoria
    if (categorias?.length) {
      lancamentos = lancamentos.map((l) => {
        const match = findCategoriaByDescricao(l.descricao, categorias);
        if (match) {
          return { ...l, categoria_id: match.id, categoria_nome: match.nome };
        }
        return l;
      });
    }

    onImportar(lancamentos);
  };

  const handleSpreadsheet = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);

    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (isXlsx) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        processSpreadsheetRows(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const texto = ev.target?.result as string;
        const linhas = texto.trim().split("\n");
        const rows = linhas.map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
        processSpreadsheetRows(rows);
      };
      reader.readAsText(file);
    }
  };
  // ── Importação PDF ──────────────────────────────────────────────────────────
  const handlePDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessando(true);
    setErro(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
        reader.readAsDataURL(file);
      });

      const data = await invokeEdgeFunction("categorizar-despesa", {
        action: "parse_pdf",
        pdf_base64: base64,
        categorias: categorias?.map((c) => ({ id: c.id, nome: c.nome_categoria, grupo_dre: c.grupo_dre })),
      });

      if (!data?.rows?.length) throw new Error("Nenhuma transação encontrada no PDF");

      const lancamentos: LancamentoImportado[] = data.rows.map((t: any) => ({
        descricao: t.descricao,
        valor: Math.abs(t.valor),
        data: t.data,
        data_vencimento: t.data_vencimento || null,
        categoria: t.categoria_sugerida ? { nome: t.categoria_sugerida, id: t.categoria_id } : undefined,
      }));

      onImportar(lancamentos);
    } catch (err: any) {
      setErro(err.message || "Erro ao processar o PDF");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="bg-card rounded-2xl shadow-lg p-10 max-w-lg w-full text-center space-y-6 border border-border">
        <div className="text-5xl">📂</div>
        <h1 className="text-2xl font-bold text-foreground">Importar Lançamentos</h1>
        <p className="text-muted-foreground text-sm">
          Importe um extrato de cartão em <strong>PDF</strong> ou uma planilha em <strong>CSV / XLSX</strong>.
        </p>

        {processando ? (
          <div className="space-y-3">
            <div className="animate-spin text-4xl">⏳</div>
            <p className="text-primary font-medium">Lendo o PDF e classificando transações...</p>
            <p className="text-muted-foreground text-sm">Isso pode levar alguns segundos</p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => pdfRef.current?.click()}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              📄 Importar extrato PDF
            </button>
            <p className="text-xs text-muted-foreground">
              Extratos de cartão de crédito em PDF — a IA extrai e classifica automaticamente
            </p>

            <div className="flex items-center gap-3 text-muted-foreground/50">
              <hr className="flex-1 border-border" />
              <span className="text-sm text-muted-foreground">ou</span>
              <hr className="flex-1 border-border" />
            </div>

            <button
              onClick={() => csvRef.current?.click()}
              className="w-full border border-input hover:bg-accent text-foreground font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              📊 Importar planilha CSV / XLSX
            </button>
            <p className="text-xs text-muted-foreground">
              Arquivo com colunas: <code className="bg-muted px-1 rounded">descricao, valor, data</code>
            </p>
          </div>
        )}

        {erro && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
            ⚠️ {erro}
          </div>
        )}

        <input ref={pdfRef} type="file" accept=".pdf" onChange={handlePDF} className="hidden" />
        <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleSpreadsheet} className="hidden" />
      </div>
    </div>
  );
}
