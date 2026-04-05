import { useState } from 'react';
import { RefreshCw, Edit, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { EmailSequence, EmailStep } from './types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmailsCRMProps {
  sequences: EmailSequence[];
  onUpdateStep: (sequenceId: string, stepId: string, updates: Partial<EmailStep>) => void;
}

export function EmailsCRM({ sequences, onUpdateStep }: EmailsCRMProps) {
  const [selectedSeq, setSelectedSeq] = useState<string>(sequences[0]?.id || '');
  const [selectedStep, setSelectedStep] = useState<string>('');
  const [editingBody, setEditingBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const currentSeq = sequences.find(s => s.id === selectedSeq);
  const currentStep = currentSeq?.steps.find(s => s.id === selectedStep);

  const handleRegenerate = async (step: EmailStep) => {
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-conteudo', {
        body: {
          prompt: `Regenere o e-mail a seguir para a marca Use Mariana Cardoso. Assunto atual: "${step.subject}". Etapa: ${step.stepNumber}. Gere uma variação diferente mantendo o mesmo tom feminino e sofisticado. Retorne caption (corpo do email em HTML simples), subjectLine e previewText.`,
          channel: 'email',
        },
      });
      if (error) throw error;
      onUpdateStep(step.sequenceId, step.id, {
        subject: data.subjectLine || step.subject,
        previewText: data.previewText || step.previewText,
        body: data.caption || step.body,
      });
      toast.success('E-mail regenerado!');
    } catch {
      toast.error('Erro ao regenerar e-mail');
    } finally {
      setRegenerating(false);
    }
  };

  const statusColors: Record<string, string> = {
    ativo: 'bg-green-100 text-green-700',
    pausado: 'bg-yellow-100 text-yellow-700',
    rascunho: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left - Sequence list */}
      <div className="w-80 border-r overflow-y-auto" style={{ borderColor: 'rgba(232,205,126,0.15)' }}>
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            📧 E-mails CRM
          </h2>
        </div>
        {sequences.map(seq => (
          <div key={seq.id}>
            <button
              onClick={() => { setSelectedSeq(seq.id); setSelectedStep(''); }}
              className={cn('w-full text-left px-4 py-3 border-b transition-colors', selectedSeq === seq.id ? 'bg-[#E8CD7E]/10' : 'hover:bg-muted/50')}
              style={{ borderColor: 'rgba(232,205,126,0.1)' }}
            >
              <h3 className="font-medium text-sm" style={{ color: '#1D1D1B' }}>{seq.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{seq.steps.length} touchpoints</p>
            </button>
            {selectedSeq === seq.id && (
              <div className="bg-muted/30">
                {seq.steps.map(step => (
                  <button
                    key={step.id}
                    onClick={() => { setSelectedStep(step.id); setIsEditing(false); }}
                    className={cn('w-full text-left px-6 py-2.5 border-b text-xs transition-colors', selectedStep === step.id ? 'bg-[#E8CD7E]/15 font-medium' : 'hover:bg-muted/50')}
                    style={{ borderColor: 'rgba(232,205,126,0.08)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[#8B6914]">{step.stepNumber}</span>
                      <Badge className={cn('text-[9px]', statusColors[step.status])}>{step.status}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-muted-foreground">{step.subject}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right - Detail */}
      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#FAFAF8' }}>
        {!currentStep ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground">Selecione um e-mail para ver os detalhes</p>
          </div>
        ) : (
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-mono text-sm px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(232,205,126,0.2)', color: '#8B6914' }}>{currentStep.stepNumber}</span>
              <Badge className={cn('text-xs', statusColors[currentStep.status])}>{currentStep.status}</Badge>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Assunto</label>
                <p className="font-medium mt-1" style={{ color: '#1D1D1B' }}>{currentStep.subject}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Preview Text</label>
                <p className="text-sm text-muted-foreground mt-1">{currentStep.previewText}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Corpo do E-mail</label>
                {isEditing ? (
                  <div className="mt-2">
                    <Textarea
                      value={editingBody}
                      onChange={e => setEditingBody(e.target.value)}
                      className="min-h-[200px] font-mono text-xs"
                    />
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" onClick={() => { onUpdateStep(currentStep.sequenceId, currentStep.id, { body: editingBody }); setIsEditing(false); toast.success('Salvo!'); }} style={{ backgroundColor: '#8B6914' }} className="text-white">Salvar</Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 bg-white rounded-lg border p-4 prose prose-sm max-w-none" style={{ borderColor: 'rgba(232,205,126,0.2)' }} dangerouslySetInnerHTML={{ __html: currentStep.body }} />
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t" style={{ borderColor: 'rgba(232,205,126,0.2)' }}>
                <Button variant="outline" size="sm" onClick={() => handleRegenerate(currentStep)} disabled={regenerating} className="border-[#E8CD7E]/50 text-[#8B6914]">
                  {regenerating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                  Regenerar E-mail
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setEditingBody(currentStep.body); setIsEditing(true); }} className="border-[#E8CD7E]/50 text-[#8B6914]">
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(currentStep.body); toast.success('HTML copiado!'); }} className="border-[#E8CD7E]/50 text-[#8B6914]">
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar HTML
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
