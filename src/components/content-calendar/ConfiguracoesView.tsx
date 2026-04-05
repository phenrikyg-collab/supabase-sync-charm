import { useState, useEffect } from 'react';
import { KeyRound, CheckCircle, AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function ConfiguracoesView() {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('anthropic_api_key');
    if (stored) {
      setHasKey(true);
      setApiKey(stored);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error('Insira uma chave válida');
      return;
    }
    localStorage.setItem('anthropic_api_key', apiKey.trim());
    setHasKey(true);
    toast.success('Chave salva com sucesso!');
  };

  const handleClear = () => {
    localStorage.removeItem('anthropic_api_key');
    setApiKey('');
    setHasKey(false);
    toast.success('Chave removida');
  };

  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ backgroundColor: '#F5F5F5' }}>
      <div className="max-w-2xl mx-auto space-y-8">
        <h2 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
          ⚙️ Configurações
        </h2>

        {/* API Key section */}
        <div className="bg-white rounded-xl border p-6 space-y-4" style={{ borderColor: 'rgba(232,205,126,0.3)' }}>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" style={{ color: '#8B6914' }} />
            <h3 className="text-lg font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
              Integração com IA
            </h3>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {hasKey ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-700 font-medium">API Key configurada</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-amber-700 font-medium">API Key não configurada</span>
              </>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground">Anthropic API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Sua chave da API do Claude (Anthropic). Encontre em{' '}
              <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#8B6914' }}>
                console.anthropic.com
              </a>
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} className="text-white" style={{ backgroundColor: '#8B6914' }}>
              Salvar Chave
            </Button>
            {hasKey && (
              <Button variant="outline" onClick={handleClear} className="border-red-200 text-red-600 hover:bg-red-50">
                Remover Chave
              </Button>
            )}
          </div>
        </div>

        {/* Edge Function info */}
        <div className="bg-white rounded-xl border p-6 space-y-4" style={{ borderColor: 'rgba(232,205,126,0.3)' }}>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5" style={{ color: '#8B6914' }} />
            <h3 className="text-lg font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
              Backend Function
            </h3>
          </div>

          <p className="text-sm text-muted-foreground">
            A geração de conteúdo usa uma função backend segura. A <code className="text-xs bg-muted px-1 py-0.5 rounded">ANTHROPIC_API_KEY</code> precisa
            estar configurada nos secrets do backend para que a geração funcione.
          </p>

          <p className="text-xs text-muted-foreground">
            A chave salva localmente é apenas para referência. O valor real deve estar configurado no backend.
          </p>
        </div>
      </div>
    </div>
  );
}
