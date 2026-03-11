import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, CalendarDays, Megaphone, Plus, Trash2, Pencil, Monitor, Shuffle, ImagePlus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/* ─── Types ─── */
interface Colaborador {
  id: string;
  nome: string;
  data_nascimento: string | null;
  foto_url: string | null;
  ativo: boolean;
  created_at: string;
}

interface EscalaLimpeza {
  id: string;
  data: string;
  colaborador_id: string;
  created_at: string;
  colaboradores?: { nome: string };
}

interface Aviso {
  id: string;
  titulo: string;
  mensagem: string | null;
  prioridade: number;
  ativo: boolean;
  created_at: string;
}

/* ─── Main Page ─── */
export default function AdminTVInterna() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Monitor className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Gestão TV Interna</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie colaboradores, escala de limpeza e avisos do mural
          </p>
        </div>
      </div>

      <Tabs defaultValue="colaboradores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="colaboradores" className="gap-2">
            <Users className="h-4 w-4" /> Colaboradores
          </TabsTrigger>
          <TabsTrigger value="escala" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Escala de Limpeza
          </TabsTrigger>
          <TabsTrigger value="avisos" className="gap-2">
            <Megaphone className="h-4 w-4" /> Avisos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="colaboradores">
          <TabColaboradores />
        </TabsContent>
        <TabsContent value="escala">
          <TabEscala />
        </TabsContent>
        <TabsContent value="avisos">
          <TabAvisos />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ════════════════════════════════════════════
   TAB: Colaboradores
   ════════════════════════════════════════════ */
function TabColaboradores() {
  const [lista, setLista] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("colaboradores")
      .select("*")
      .order("nome");
    setLista(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setEditId(null);
    setNome("");
    setDataNascimento("");
    setAtivo(true);
  };

  const openEdit = (c: Colaborador) => {
    setEditId(c.id);
    setNome(c.nome);
    setDataNascimento(c.data_nascimento || "");
    setAtivo(c.ativo);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    const payload = {
      nome: nome.trim(),
      data_nascimento: dataNascimento || null,
      ativo,
    };

    if (editId) {
      const { error } = await supabase
        .from("colaboradores")
        .update(payload)
        .eq("id", editId);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Colaborador atualizado" });
    } else {
      const { error } = await supabase.from("colaboradores").insert(payload);
      if (error) {
        toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Colaborador criado" });
    }

    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("colaboradores").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Colaborador excluído" });
    fetchData();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Colaboradores</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Editar" : "Novo"} Colaborador</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={ativo} onCheckedChange={setAtivo} />
                <Label>Ativo</Label>
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : lista.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum colaborador cadastrado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Nascimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>
                    {c.data_nascimento
                      ? format(new Date(c.data_nascimento + "T12:00:00"), "dd/MM/yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${c.ativo ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                      {c.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════
   TAB: Escala de Limpeza
   ════════════════════════════════════════════ */
function TabEscala() {
  const [lista, setLista] = useState<EscalaLimpeza[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [colabId, setColabId] = useState("");
  const [data, setData] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const [escalaRes, colabRes] = await Promise.all([
      supabase
        .from("escala_limpeza")
        .select("*, colaboradores(nome)")
        .order("data", { ascending: false })
        .limit(50),
      supabase.from("colaboradores").select("*").eq("ativo", true).order("nome"),
    ]);
    setLista((escalaRes.data as any) || []);
    setColaboradores(colabRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!colabId || !data) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("escala_limpeza")
      .insert({ colaborador_id: colabId, data });
    if (error) {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Escala adicionada" });
    setDialogOpen(false);
    setColabId("");
    setData("");
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("escala_limpeza").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Escala removida" });
    fetchData();
  };

  const gerarSemana = async () => {
    if (colaboradores.length === 0) {
      toast({ title: "Nenhum colaborador ativo", variant: "destructive" });
      return;
    }

    setGenerating(true);

    // Find next Monday (or today if Monday)
    const today = new Date();
    const nextMonday = startOfWeek(addDays(today, today.getDay() === 0 ? 1 : today.getDay() === 1 ? 0 : 8 - today.getDay()), { weekStartsOn: 1 });

    // Generate weekdays (Mon-Fri)
    const weekdays: string[] = [];
    for (let i = 0; i < 5; i++) {
      weekdays.push(format(addDays(nextMonday, i), "yyyy-MM-dd"));
    }

    // Shuffle collaborators
    const shuffled = [...colaboradores].sort(() => Math.random() - 0.5);

    // Assign one per day, cycling if fewer than 5
    const entries = weekdays.map((dia, i) => ({
      colaborador_id: shuffled[i % shuffled.length].id,
      data: dia,
    }));

    // Check for existing entries on those dates
    const { data: existing } = await supabase
      .from("escala_limpeza")
      .select("data")
      .in("data", weekdays);

    const existingDates = new Set((existing || []).map((e: any) => e.data));
    const newEntries = entries.filter((e) => !existingDates.has(e.data));

    if (newEntries.length === 0) {
      toast({ title: "Escala já existe para essa semana", description: "Exclua a escala existente antes de gerar uma nova." });
      setGenerating(false);
      return;
    }

    const { error } = await supabase.from("escala_limpeza").insert(newEntries);
    if (error) {
      toast({ title: "Erro ao gerar escala", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Escala gerada!",
        description: `${newEntries.length} dias criados (${format(nextMonday, "dd/MM")} a ${format(addDays(nextMonday, 4), "dd/MM")})`,
      });
    }

    setGenerating(false);
    fetchData();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Escala de Limpeza</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={gerarSemana} disabled={generating}>
            <Shuffle className="h-4 w-4" />
            {generating ? "Gerando..." : "Gerar Semana"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Nova Escala
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Escala</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select value={colabId} onValueChange={setColabId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : lista.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma escala cadastrada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Dia da Semana</TableHead>
                <TableHead className="w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    {e.colaboradores?.nome || "—"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(e.data + "T12:00:00"), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="capitalize">
                    {format(new Date(e.data + "T12:00:00"), "EEEE", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════
   TAB: Avisos
   ════════════════════════════════════════════ */
function TabAvisos() {
  const [lista, setLista] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [prioridade, setPrioridade] = useState(0);
  const [ativo, setAtivo] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("avisos_mural")
      .select("*")
      .order("prioridade", { ascending: false });
    setLista(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setEditId(null);
    setTitulo("");
    setMensagem("");
    setPrioridade(0);
    setAtivo(true);
  };

  const openEdit = (a: Aviso) => {
    setEditId(a.id);
    setTitulo(a.titulo);
    setMensagem(a.mensagem || "");
    setPrioridade(a.prioridade);
    setAtivo(a.ativo);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast({ title: "Título é obrigatório", variant: "destructive" });
      return;
    }

    const payload = {
      titulo: titulo.trim(),
      mensagem: mensagem.trim() || null,
      prioridade,
      ativo,
    };

    if (editId) {
      const { error } = await supabase
        .from("avisos_mural")
        .update(payload)
        .eq("id", editId);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Aviso atualizado" });
    } else {
      const { error } = await supabase.from("avisos_mural").insert(payload);
      if (error) {
        toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Aviso criado" });
    }

    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("avisos_mural").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Aviso excluído" });
    fetchData();
  };

  const toggleAtivo = async (a: Aviso) => {
    await supabase.from("avisos_mural").update({ ativo: !a.ativo }).eq("id", a.id);
    fetchData();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Avisos do Mural</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Novo Aviso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Editar" : "Novo"} Aviso</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do aviso" />
              </div>
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Detalhes do aviso (opcional)"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridade (maior = aparece primeiro)</Label>
                <Input
                  type="number"
                  value={prioridade}
                  onChange={(e) => setPrioridade(Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={ativo} onCheckedChange={setAtivo} />
                <Label>Ativo (visível na TV)</Label>
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : lista.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum aviso cadastrado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.titulo}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {a.mensagem || "—"}
                  </TableCell>
                  <TableCell>{a.prioridade}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleAtivo(a)}>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer ${a.ativo ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                        {a.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
