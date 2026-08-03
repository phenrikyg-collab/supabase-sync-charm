import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { uploadRelatorio } from "@/lib/relatoriosStorage";

interface UploadRelatorioDialogProps {
  /** pasta no storage: "tendencias" | "planejamento" */
  pasta: string;
  titulo?: string;
  descricao?: string;
  labelPlaceholder?: string;
  onUploaded?: () => void;
}

export function UploadRelatorioDialog({
  pasta,
  titulo = "Enviar novo HTML",
  descricao = "Selecione um arquivo .html já estilizado. Ele ficará disponível como uma nova aba/relatório.",
  labelPlaceholder = "Ex.: Monitoramento Semanal — 04/08/2026",
  onUploaded,
}: UploadRelatorioDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [enviando, setEnviando] = useState(false);

  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

  const validarArquivo = (f: File): string | null => {
    const nome = f.name.toLowerCase();
    if (!nome.endsWith(".html") && !nome.endsWith(".htm")) {
      return "Formato inválido: envie um arquivo .html.";
    }
    if (f.type && !["text/html", "application/xhtml+xml", ""].includes(f.type)) {
      return "Formato inválido: o arquivo não parece ser HTML.";
    }
    if (f.size === 0) {
      return "O arquivo está vazio.";
    }
    if (f.size > MAX_BYTES) {
      return `Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(1)} MB). O limite é 5 MB.`;
    }
    return null;
  };

  const selecionar = (f: File | null) => {
    if (!f) {
      setFile(null);
      setErro(null);
      return;
    }
    const msg = validarArquivo(f);
    if (msg) {
      setFile(null);
      setErro(msg);
      toast({ title: "Arquivo inválido", description: msg, variant: "destructive" });
      return;
    }
    setErro(null);
    setFile(f);
  };

  const enviar = async () => {
    if (!file) return;
    const msg = validarArquivo(file);
    if (msg) {
      setErro(msg);
      toast({ title: "Arquivo inválido", description: msg, variant: "destructive" });
      return;
    }
    setEnviando(true);
    try {
      await uploadRelatorio(pasta, file, label || file.name);
      toast({ title: "Arquivo enviado", description: "O relatório já está disponível." });
      setOpen(false);
      setFile(null);
      setErro(null);
      setLabel("");
      onUploaded?.();
    } catch (e) {
      toast({
        title: "Erro ao enviar",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Upload className="h-4 w-4" /> Enviar HTML
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rel-label">Nome do relatório</Label>
            <Input
              id="rel-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={labelPlaceholder}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rel-file">Arquivo HTML</Label>
            <Input
              id="rel-file"
              type="file"
              accept=".html,text/html"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={!file || enviando}>
            {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
