import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AlertTriangle, BellRing, MousePointerClick, Send, Smartphone, UserCheck } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { pushApi, nBR, pctBR } from "@/components/notificacoes-app/api";
import { AbaEnviar } from "@/components/notificacoes-app/AbaEnviar";
import { AbaHistorico } from "@/components/notificacoes-app/AbaHistorico";
import { AbaAutomaticos } from "@/components/notificacoes-app/AbaAutomaticos";
import { AbaInscritas } from "@/components/notificacoes-app/AbaInscritas";

export default function NotificacoesApp() {
  const qc = useQueryClient();
  const [confirmarDesligar, setConfirmarDesligar] = useState(false);

  const { data: resumo, isLoading } = useQuery({
    queryKey: ["app-push-resumo"],
    queryFn: () => pushApi.resumo(),
  });

  const ligar = useMutation({
    mutationFn: (ativo: boolean) => pushApi.salvarConfig({ ativo }),
    onSuccess: (novo, ativo) => {
      qc.setQueryData(["app-push-resumo"], novo);
      qc.invalidateQueries({ queryKey: ["app-push-resumo"] });
      toast.success(ativo ? "Avisos ligados" : "Avisos desligados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">Notificações do App</h1>
          <p className="text-sm text-muted-foreground">
            Avisos no celular para quem ativou as notificações no app Minha MC.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="push-ativo" className="text-sm">Avisos ligados</Label>
          <Switch
            id="push-ativo"
            checked={resumo?.ativo ?? false}
            onCheckedChange={(v) => (v ? ligar.mutate(true) : setConfirmarDesligar(true))}
          />
        </div>
      </div>

      {resumo && !resumo.ativo && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4" />
          Os avisos estão desligados. Nada é enviado.
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Inscritas ativas"
            value={nBR(resumo?.inscritas)}
            subtitle={`${nBR(resumo?.novas_7d)} novas em 7 dias`}
            icon={BellRing}
            variant="primary"
          />
          <StatCard title="Com CPF" value={nBR(resumo?.com_cpf)} icon={UserCheck} />
          <StatCard
            title="Android / iPhone"
            value={`${nBR(resumo?.android)} / ${nBR(resumo?.ios)}`}
            subtitle={`${nBR(resumo?.outro)} outros`}
            icon={Smartphone}
          />
          <StatCard title="Enviadas 30d" value={nBR(resumo?.enviados_30d)} icon={Send} />
          <StatCard
            title="Cliques 30d"
            value={nBR(resumo?.cliques_30d)}
            subtitle={`Taxa ${pctBR(resumo?.cliques_30d, resumo?.enviados_30d)}`}
            icon={MousePointerClick}
          />
        </div>
      )}

      <Tabs defaultValue="enviar">
        <TabsList>
          <TabsTrigger value="enviar">Enviar</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="automaticos">Automáticos</TabsTrigger>
          <TabsTrigger value="inscritas">Inscritas</TabsTrigger>
        </TabsList>
        <TabsContent value="enviar" className="mt-4">
          <AbaEnviar podeEnviar={resumo?.ativo ?? false} />
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <AbaHistorico />
        </TabsContent>
        <TabsContent value="automaticos" className="mt-4">
          <AbaAutomaticos resumo={resumo} />
        </TabsContent>
        <TabsContent value="inscritas" className="mt-4">
          <AbaInscritas />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmarDesligar} onOpenChange={setConfirmarDesligar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desligar os avisos?</AlertDialogTitle>
            <AlertDialogDescription>
              Enquanto estiverem desligados, nenhum aviso é enviado para o celular das clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmarDesligar(false); ligar.mutate(false); }}
            >
              Desligar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
