import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';

interface GenerationOverlayProps {
  isVisible: boolean;
  progress: number;
}

const statusMessages = [
  'Analisando datas importantes do mês...',
  'Distribuindo produtos no calendário...',
  'Respeitando o funil de aquisição...',
  'Criando conteúdos para Instagram...',
  'Gerando sequências de e-mail...',
  'Preparando campanhas de WhatsApp...',
  'Finalizando seu calendário editorial...',
];

export function GenerationOverlay({ isVisible, progress }: GenerationOverlayProps) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!isVisible) { setMsgIdx(0); return; }
    const interval = setInterval(() => {
      setMsgIdx(prev => (prev + 1) % statusMessages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(29,29,27,0.92)' }}>
      <div className="text-center space-y-8 px-8 max-w-md">
        <img src="/images/logo.png" alt="MC" className="w-16 h-16 mx-auto rounded-lg animate-pulse" />

        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          Gerando seu calendário...
        </h2>

        <div className="w-full">
          <Progress value={progress} className="h-2 bg-white/10" />
        </div>

        <p className="text-sm animate-pulse" style={{ color: '#E8CD7E', fontFamily: "'DM Sans', sans-serif" }}>
          {statusMessages[msgIdx]}
        </p>
      </div>
    </div>
  );
}
