import { brl, dataBRCompleta, competenciaLabel } from "@/lib/rh";

export interface HoleriteEvento {
  codigo?: string | number | null;
  descricao?: string | null;
  referencia?: string | null;
  provento?: number | null;
  desconto?: number | null;
}

export interface Holerite {
  id?: string;
  funcionario_id?: string;
  nome?: string | null;
  funcionario_nome?: string | null;
  cargo?: string | null;
  cpf?: string | null;
  admissao?: string | null;
  competencia?: string | null;
  tipo?: string | null;
  liquido?: number | null;
  total_proventos?: number | null;
  total_descontos?: number | null;
  salario_base?: number | null;
  base_inss?: number | null;
  base_irrf?: number | null;
  base_fgts?: number | null;
  fgts_mes?: number | null;
  pis?: string | null;
  rg?: string | null;
  eventos?: HoleriteEvento[] | null;
  dados?: any;
}

const EMPRESA = {
  codigo: "76",
  razao: "MP CONFECCOES LTDA",
  cnpj: "33.275.957/0001-08",
  endereco: "Pc Presidente Vargas, 4 - Vila Assuncao - Santo André/SP - 09030-325",
};

export const holeriteNome = (h: Holerite) => h.nome ?? h.funcionario_nome ?? h.dados?.nome ?? "—";

export function normalizarHolerite(raw: any): Holerite {
  const d = raw?.dados && typeof raw.dados === "object" ? raw.dados : {};
  const h: Holerite = { ...d, ...raw };
  const eventos = (h.eventos ?? d.eventos ?? []) as HoleriteEvento[];
  h.eventos = Array.isArray(eventos) ? eventos : [];
  const prov = h.total_proventos ?? h.eventos.reduce((s, e) => s + (Number(e.provento) || 0), 0);
  const desc = h.total_descontos ?? h.eventos.reduce((s, e) => s + (Number(e.desconto) || 0), 0);
  h.total_proventos = Number(prov) || 0;
  h.total_descontos = Number(desc) || 0;
  h.liquido = h.liquido != null ? Number(h.liquido) : h.total_proventos - h.total_descontos;
  return h;
}

const LINHAS_MIN = 12;

export function HoleriteRecibo({ h, via }: { h: Holerite; via?: string }) {
  const eventos = h.eventos ?? [];
  const vazias = Math.max(0, LINHAS_MIN - eventos.length);

  return (
    <div className="holerite-recibo bg-white text-black border border-black text-[11px] font-sans">
      <div className="bg-neutral-300 border-b border-black px-2 py-1 flex items-center gap-2">
        <img src="/images/logo.png" alt="Mariana Cardoso" className="h-8 w-8 rounded object-contain" />
        <div className="flex-1 text-center font-bold tracking-wide uppercase">
          Recibo de Pagamento de Salário
        </div>
        <div className="h-8 w-8" />
      </div>

      <div className="flex border-b border-black">
        <div className="flex-1 p-2 space-y-0.5">
          <div className="font-bold uppercase">Empregador: {EMPRESA.codigo} - {EMPRESA.razao}</div>
          <div>CNPJ: {EMPRESA.cnpj}</div>
          <div>{EMPRESA.endereco}</div>
        </div>
        <div className="w-56 border-l border-black p-2 text-right">
          <div className="uppercase text-[10px]">Competência</div>
          <div className="font-bold text-sm">{competenciaLabel(h.competencia)}</div>
          {h.tipo && <div className="text-[10px] uppercase">{h.tipo}</div>}
          {via && <div className="text-[10px]">{via}</div>}
        </div>
      </div>

      <div className="grid grid-cols-6 border-b border-black">
        <Celula label="Nome do Funcionário" valor={holeriteNome(h)} className="col-span-2" />
        <Celula label="Função" valor={h.cargo ?? "—"} />
        <Celula label="CPF / Admissão" valor={`${h.cpf ?? "—"} · ${dataBRCompleta(h.admissao)}`} />
        <Celula label="PIS" valor={h.pis ?? " "} />
        <Celula label="RG" valor={h.rg ?? " "} />
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-neutral-200 text-[10px] uppercase">
            <th className="border border-black p-1 w-16 text-left">Código</th>
            <th className="border border-black p-1 text-left">Descrição dos Eventos</th>
            <th className="border border-black p-1 w-20 text-center">Referência</th>
            <th className="border border-black p-1 w-28 text-right">Proventos</th>
            <th className="border border-black p-1 w-28 text-right">Descontos</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((e, i) => (
            <tr key={i}>
              <td className="border-x border-black px-1 h-[22px]">{e.codigo ?? ""}</td>
              <td className="border-x border-black px-1">{e.descricao ?? ""}</td>
              <td className="border-x border-black px-1 text-center">{e.referencia ?? ""}</td>
              <td className="border-x border-black px-1 text-right tabular-nums">
                {Number(e.provento) ? brl(e.provento) : ""}
              </td>
              <td className="border-x border-black px-1 text-right tabular-nums">
                {Number(e.desconto) ? brl(e.desconto) : ""}
              </td>
            </tr>
          ))}
          {Array.from({ length: vazias }).map((_, i) => (
            <tr key={`v${i}`}>
              <td className="border-x border-black px-1 h-[22px]">&nbsp;</td>
              <td className="border-x border-black px-1"></td>
              <td className="border-x border-black px-1"></td>
              <td className="border-x border-black px-1"></td>
              <td className="border-x border-black px-1"></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-neutral-100 font-bold">
            <td className="border border-black p-1" colSpan={3}>Totais</td>
            <td className="border border-black p-1 text-right tabular-nums">{brl(h.total_proventos)}</td>
            <td className="border border-black p-1 text-right tabular-nums">{brl(h.total_descontos)}</td>
          </tr>
          <tr>
            <td className="border border-black p-1" colSpan={3}></td>
            <td className="border border-black p-1 text-right uppercase text-[10px] bg-neutral-300 font-bold">Total Líquido</td>
            <td className="border border-black p-1 text-right tabular-nums font-bold bg-neutral-300">{brl(h.liquido)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="grid grid-cols-5 border-t border-black">
        <Celula label="Salário Base" valor={brl(h.salario_base)} />
        <Celula label="Base INSS" valor={brl(h.base_inss)} />
        <Celula label="Base IRRF" valor={brl(h.base_irrf)} />
        <Celula label="Base FGTS" valor={brl(h.base_fgts)} />
        <Celula label="FGTS do Mês" valor={brl(h.fgts_mes)} />
      </div>

      <div className="border-t border-black p-3 space-y-6">
        <p className="text-[10px]">Declaro ter recebido a importância líquida discriminada neste recibo.</p>
        <div className="flex gap-8 items-end">
          <div className="w-40">
            <div className="border-b border-black h-5" />
            <div className="text-[9px] uppercase mt-0.5">Data</div>
          </div>
          <div className="flex-1">
            <div className="border-b border-black h-5" />
            <div className="text-[9px] uppercase mt-0.5">Assinatura do Funcionário</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Celula({ label, valor, className }: { label: string; valor: string; className?: string }) {
  return (
    <div className={`p-1.5 border-r border-black last:border-r-0 ${className ?? ""}`}>
      <div className="text-[9px] uppercase text-neutral-600">{label}</div>
      <div className="font-medium">{valor}</div>
    </div>
  );
}
