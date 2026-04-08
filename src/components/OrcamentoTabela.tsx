import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Save, Eraser, Copy, TrendingUp, Loader2, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";

interface Categoria {
  id: string;
  grupo_dre: string | null;
  nome_categoria: string | null;
  descricao_categoria: string | null;
  codigo: string | null;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function OrcamentoTabela() {
  const { toast } = useToast();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("categorias_financeiras")
      .select("id, grupo_dre, nome_categoria, descricao_categoria, codigo")
      .then(({ data }) => {
        if (data) setCategorias(data as Categoria[]);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("orcamentos")
      .select("categoria_id, valor_orcado")
      .eq("mes", mes)
      .eq("ano", ano)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        data?.forEach((r: any) => {
          map[r.categoria_id] = Number(r.valor_orcado);
        });
        setValores(map);
        setLoading(false);
      });
  }, [mes, ano]);

  const grouped = useMemo(() => {
    const result: Record<string, Record<string, Categoria[]>> = {};
    categorias
      .filter((c) => c.grupo_dre && c.descricao_categoria)
      .forEach((c) => {
        const faixa = c.grupo_dre!;
        const cat = c.nome_categoria || "Outros";
        if (!result[faixa]) result[faixa] = {};
        if (!result[faixa][cat]) result[faixa][cat] = [];
        result[faixa][cat].push(c);
      });
    return result;
  }, [categorias]);

  // Flat list for template/import matching
  const flatCategorias = useMemo(() => {
    return categorias
      .filter((c) => c.grupo_dre && c.descricao_categoria)
      .sort((a, b) => (a.grupo_dre || "").localeCompare(b.grupo_dre || "") || (a.nome_categoria || "").localeCompare(b.nome_categoria || ""));
  }, [categorias]);

  const handleSave = async () => {
    setSaving(true);
    const rows = Object.entries(valores)
      .filter(([, v]) => v > 0)
      .map(([categoria_id, valor_orcado]) => ({
        categoria_id,
        mes,
        ano,
        valor_orcado,
        updated_at: new Date().toISOString(),
      }));

    if (rows.length === 0) {
      toast({ title: "Nenhum valor para salvar" });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("orcamentos").upsert(rows, {
      onConflict: "categoria_id,mes,ano",
    });

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Orçamento salvo com sucesso!" });
    }
  };

  const handleLimpar = () => setValores({});

  const handleCopiarMesAnterior = async () => {
    setLoading(true);
    const prevMes = mes === 1 ? 12 : mes - 1;
    const prevAno = mes === 1 ? ano - 1 : ano;
    const { data } = await supabase
      .from("orcamentos")
      .select("categoria_id, valor_orcado")
      .eq("mes", prevMes)
      .eq("ano", prevAno);
    const map: Record<string, number> = {};
    data?.forEach((r: any) => {
      map[r.categoria_id] = Number(r.valor_orcado);
    });
    setValores(map);
    setLoading(false);
    toast({ title: `Valores copiados de ${MESES[prevMes - 1]}/${prevAno}` });
  };

  const handleSugerirMedia = async () => {
    setLoading(true);
    const dates: { m: number; y: number }[] = [];
    let m = mes, y = ano;
    for (let i = 0; i < 3; i++) {
      m--;
      if (m === 0) { m = 12; y--; }
      dates.push({ m, y });
    }

    const startDate = `${dates[2].y}-${String(dates[2].m).padStart(2, "0")}-01`;
    const endM = dates[0].m === 12 ? 1 : dates[0].m + 1;
    const endY = dates[0].m === 12 ? dates[0].y + 1 : dates[0].y;
    const endDate = `${endY}-${String(endM).padStart(2, "0")}-01`;

    const { data } = await supabase
      .from("movimentacoes_financeiras")
      .select("categoria_id, valor")
      .eq("impacta_dre", true)
      .gte("data", startDate)
      .lt("data", endDate)
      .not("categoria_id", "is", null);

    const sums: Record<string, number> = {};
    data?.forEach((r: any) => {
      if (!r.categoria_id) return;
      sums[r.categoria_id] = (sums[r.categoria_id] || 0) + Math.abs(Number(r.valor));
    });

    const map: Record<string, number> = {};
    Object.keys(sums).forEach((id) => {
      map[id] = Math.round((sums[id] / 3) * 100) / 100;
    });
    setValores(map);
    setLoading(false);
    toast({ title: "Valores sugeridos pela média dos últimos 3 meses" });
  };

  // ── Download Excel template ──
  const handleDownloadTemplate = () => {
    const rows = flatCategorias.map((c) => ({
      "Faixa (grupo_dre)": c.grupo_dre || "",
      "Categoria (nome_categoria)": c.nome_categoria || "",
      "Plano de conta (descricao_categoria)": c.descricao_categoria || "",
      "Valor Orçado": valores[c.id] ?? "",
      "categoria_id (NÃO ALTERAR)": c.id,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws["!cols"] = [
      { wch: 25 }, { wch: 30 }, { wch: 40 }, { wch: 18 }, { wch: 40 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orçamento");

    // Instructions sheet
    const instrRows = [
      { Instrução: "1. Preencha APENAS a coluna 'Valor Orçado' com os valores desejados." },
      { Instrução: "2. NÃO altere a coluna 'categoria_id (NÃO ALTERAR)' — ela é usada para vincular ao sistema." },
      { Instrução: "3. Deixe em branco ou com 0 as linhas que não deseja orçar." },
      { Instrução: "4. Salve o arquivo e importe de volta no sistema usando o botão 'Importar planilha'." },
      { Instrução: `5. Este modelo foi gerado para ${MESES[mes - 1]}/${ano}.` },
    ];
    const wsInstr = XLSX.utils.json_to_sheet(instrRows);
    wsInstr["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções");

    XLSX.writeFile(wb, `orcamento_modelo_${MESES[mes - 1]}_${ano}.xlsx`);
    toast({ title: "Modelo baixado com sucesso!" });
  };

  // ── Import Excel ──
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        const map: Record<string, number> = {};
        let imported = 0;

        for (const row of rows) {
          const catId =
            row["categoria_id (NÃO ALTERAR)"] ||
            row["categoria_id"] ||
            row["ID"];
          const valor =
            row["Valor Orçado"] ??
            row["valor_orcado"] ??
            row["Valor"] ??
            row["valor"];

          if (!catId) continue;

          const numVal = Number(String(valor).replace(/[^\d.,-]/g, "").replace(",", "."));
          if (!isNaN(numVal) && numVal > 0) {
            // Validate that catId exists in our categories
            if (categorias.some((c) => c.id === catId)) {
              map[catId] = numVal;
              imported++;
            }
          }
        }

        if (imported === 0) {
          toast({
            title: "Nenhum valor importado",
            description: "Verifique se o arquivo segue o modelo com a coluna 'categoria_id'.",
            variant: "destructive",
          });
        } else {
          setValores(map);
          toast({ title: `${imported} valores importados com sucesso!`, description: "Clique em 'Salvar orçamento' para gravar." });
        }
      } catch {
        toast({ title: "Erro ao ler arquivo", variant: "destructive" });
      }

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cadastro de Orçamento</CardTitle>
        <div className="flex flex-wrap gap-3 mt-2">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((label, i) => (
                <SelectItem key={i} value={String(i + 1)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[ano - 1, ano, ano + 1].map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2 ml-auto flex-wrap">
            <Button variant="outline" size="sm" onClick={handleLimpar}>
              <Eraser className="h-4 w-4 mr-1" /> Preencher manualmente
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopiarMesAnterior}>
              <Copy className="h-4 w-4 mr-1" /> Copiar mês anterior
            </Button>
            <Button variant="outline" size="sm" onClick={handleSugerirMedia}>
              <TrendingUp className="h-4 w-4 mr-1" /> Sugerir pela média
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-1" /> Baixar modelo
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Importar planilha
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportExcel}
            />
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar orçamento
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Faixa</TableHead>
                  <TableHead className="w-[200px]">Categoria</TableHead>
                  <TableHead>Plano de conta</TableHead>
                  <TableHead className="w-[180px] text-right">Valor orçado (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(grouped).map(([faixa, cats]) =>
                  Object.entries(cats).map(([catName, planos]) =>
                    planos.map((plano, idx) => (
                      <TableRow key={plano.id}>
                        {idx === 0 && Object.entries(cats).indexOf([catName, planos] as any) === -1 ? null : idx === 0 ? (
                          <TableCell
                            className="font-semibold text-muted-foreground align-top"
                            rowSpan={Object.values(cats).reduce((a, b) => a + b.length, 0)}
                            style={idx === 0 && Object.keys(cats)[0] === catName ? {} : { display: "none" }}
                          >
                            {faixa}
                          </TableCell>
                        ) : null}
                        {idx === 0 && (
                          <TableCell className="font-medium align-top" rowSpan={planos.length}>
                            {catName}
                          </TableCell>
                        )}
                        <TableCell>{plano.descricao_categoria}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="w-36 text-right ml-auto"
                            value={valores[plano.id] ?? ""}
                            onChange={(e) =>
                              setValores((prev) => ({
                                ...prev,
                                [plano.id]: Number(e.target.value),
                              }))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
