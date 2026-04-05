import { useState } from 'react';
import { RefreshCw, Clock, Tag, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { WhatsAppCampaign } from './types';
import { cn } from '@/lib/utils';
import { callClaude, ANNA_SYSTEM_PROMPT } from '@/lib/claudeApi';
import { toast } from 'sonner';

interface WhatsAppCRMProps {
  campaigns: WhatsAppCampaign[];
  onUpdate: (id: string, updates: Partial<WhatsAppCampaign>) => void;
}

export function WhatsAppCRM({ campaigns, onUpdate }: WhatsAppCRMProps) {
  const [selectedId, setSelectedId] = useState<string>(campaigns[0]?.id || '');
  const [regenerating, setRegenerating] = useState(false);
  const [editingMsg, setEditingMsg] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const selected = campaigns.find(c => c.id === selectedId);

  const statusColors: Record<string, string> = {
    rascunho: 'bg-muted text-muted-foreground',
    agendado: 'bg-[hsl(43,76%,90%)] text-[hsl(43,76%,30%)]',
    enviado: 'bg-green-100 text-green-700',
  };

  const handleRegenerate = async (campaign: WhatsAppCampaign) => {
    setRegenerating(true);
    try {
      const userPrompt = `Regenere a mensagem de WhatsApp a seguir para a marca Use Mariana Cardoso. Campanha: "${campaign.name}". Público: ${campaign.audienceSegment}. Cupom: ${campaign.coupon}. Gere uma variação diferente mantendo o tom feminino, próximo e exclusivo.

Retorne SOMENTE JSON válido:
{
  "caption": "mensagem completa do WhatsApp"
}`;
      const raw = await callClaude(ANNA_SYSTEM_PROMPT, userPrompt);
      const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const data = JSON.parse(clean);
      onUpdate(campaign.id, { messageTemplate: data.caption || campaign.messageTemplate });
      toast.success('Mensagem regenerada!');
    } catch {
      toast.error('Erro ao regenerar mensagem');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left list */}
      <div className="w-80 border-r overflow-y-auto" style={{ borderColor: 'rgba(232,205,126,0.15)' }}>
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            💬 WhatsApp CRM
          </h2>
        </div>
        {campaigns.map(c => (
          <button
            key={c.id}
            onClick={() => { setSelectedId(c.id); setIsEditing(false); }}
            className={cn('w-full text-left px-4 py-3 border-b transition-colors', selectedId === c.id ? 'bg-[#E8CD7E]/10' : 'hover:bg-muted/50')}
            style={{ borderColor: 'rgba(232,205,126,0.1)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium text-sm truncate" style={{ color: '#1D1D1B' }}>{c.name}</h3>
              <Badge className={cn('text-[9px] shrink-0 ml-2', statusColors[c.status])}>{c.status}</Badge>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" />{c.audienceSegment}
              <Clock className="h-3 w-3 ml-1" />{c.dispatchTime}
            </div>
          </button>
        ))}
      </div>

      {/* Right detail */}
      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#FAFAF8' }}>
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-muted-foreground">Selecione uma campanha</p>
          </div>
        ) : (
          <div className="max-w-2xl">
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>{selected.name}</h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-lg border p-3" style={{ borderColor: 'rgba(232,205,126,0.2)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4" style={{ color: '#8B6914' }} />
                  <span className="text-xs font-medium text-muted-foreground">Público</span>
                </div>
                <p className="text-sm font-medium">{selected.audienceSegment}</p>
              </div>
              <div className="bg-white rounded-lg border p-3" style={{ borderColor: 'rgba(232,205,126,0.2)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4" style={{ color: '#8B6914' }} />
                  <span className="text-xs font-medium text-muted-foreground">Horário de envio</span>
                </div>
                <p className="text-sm font-medium">{selected.dispatchTime}</p>
              </div>
              <div className="bg-white rounded-lg border p-3" style={{ borderColor: 'rgba(232,205,126,0.2)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Tag className="h-4 w-4" style={{ color: '#8B6914' }} />
                  <span className="text-xs font-medium text-muted-foreground">Cupom</span>
                </div>
                <p className="text-sm font-medium font-mono">{selected.coupon}</p>
              </div>
              <div className="bg-white rounded-lg border p-3" style={{ borderColor: 'rgba(232,205,126,0.2)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Status</span>
                </div>
                <Badge className={cn('text-xs', statusColors[selected.status])}>{selected.status}</Badge>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
              {isEditing ? (
                <div className="mt-2">
                  <Textarea value={editingMsg} onChange={e => setEditingMsg(e.target.value)} className="min-h-[180px]" />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => { onUpdate(selected.id, { messageTemplate: editingMsg }); setIsEditing(false); toast.success('Salvo!'); }} style={{ backgroundColor: '#8B6914' }} className="text-white">Salvar</Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 bg-white rounded-lg border p-4 whitespace-pre-wrap text-sm" style={{ borderColor: 'rgba(232,205,126,0.2)' }}>
                  {selected.messageTemplate}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 mt-4 border-t" style={{ borderColor: 'rgba(232,205,126,0.2)' }}>
              <Button variant="outline" size="sm" onClick={() => handleRegenerate(selected)} disabled={regenerating} className="border-[#E8CD7E]/50 text-[#8B6914]">
                {regenerating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Regenerar Mensagem
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setEditingMsg(selected.messageTemplate); setIsEditing(true); }} className="border-[#E8CD7E]/50 text-[#8B6914]">
                ✏️ Editar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
