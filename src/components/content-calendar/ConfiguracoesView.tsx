import { useState, useEffect } from 'react';
import { KeyRound, CheckCircle, AlertTriangle, Info, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { loadBrandSettings, saveBrandSettings, BrandSettings, buildSystemPrompt } from '@/lib/brandContext';

export function ConfiguracoesView() {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);

  // Brand settings
  const [brandSettings, setBrandSettings] = useState<BrandSettings>(loadBrandSettings());

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

  const updateBrandField = <K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) => {
    const updated = { ...brandSettings, [key]: value };
    setBrandSettings(updated);
    saveBrandSettings(updated);
  };

  const handleSaveBrand = () => {
    saveBrandSettings(brandSettings);
    toast.success('Configurações da marca salvas!');
  };

  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ backgroundColor: '#F5F5F5' }}>
      <div className="max-w-2xl mx-auto space-y-8">
        <h2 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
          ⚙️ Configurações
        </h2>

        {/* Brand Context section */}
        <div className="bg-white rounded-xl border p-6 space-y-4" style={{ borderColor: 'rgba(232,205,126,0.3)' }}>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5" style={{ color: '#8B6914' }} />
            <h3 className="text-lg font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
              Contexto da Marca
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Essas informações são injetadas automaticamente em todas as gerações de conteúdo com IA.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Nome da marca</Label>
              <Input
                value={brandSettings.brandName}
                onChange={e => updateBrandField('brandName', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Handle do Instagram</Label>
              <Input
                value={brandSettings.instagramHandle}
                onChange={e => updateBrandField('instagramHandle', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Seguidores</Label>
              <Input
                value={brandSettings.followers}
                onChange={e => updateBrandField('followers', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Cupom padrão do mês</Label>
              <Input
                value={brandSettings.defaultCoupon}
                onChange={e => updateBrandField('defaultCoupon', e.target.value)}
                placeholder="Ex: ANNA, LOOK15"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground">Produtos principais (um por linha)</Label>
            <Textarea
              value={brandSettings.mainProducts.join('\n')}
              onChange={e => updateBrandField('mainProducts', e.target.value.split('\n').filter(l => l.trim()))}
              placeholder="Calça Modeladora Anna&#10;Calça Skinny Juliana&#10;Conjunto Madri"
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground">Instruções fixas adicionais para a IA</Label>
            <Textarea
              value={brandSettings.additionalInstructions}
              onChange={e => updateBrandField('additionalInstructions', e.target.value)}
              placeholder="Ex: Sempre mencionar que temos frete grátis acima de R$299. Nunca usar a palavra 'barato'..."
              className="mt-1 min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Essas instruções serão adicionadas ao contexto de TODAS as gerações de conteúdo.
            </p>
          </div>

          <Button onClick={handleSaveBrand} className="text-white" style={{ backgroundColor: '#8B6914' }}>
            Salvar Configurações da Marca
          </Button>

          {/* Preview */}
          <details className="border rounded-lg overflow-hidden" style={{ borderColor: 'rgba(232,205,126,0.2)' }}>
            <summary className="px-4 py-2 text-xs cursor-pointer select-none" style={{ backgroundColor: 'rgba(232,205,126,0.05)', color: '#8B6914' }}>
              🔍 Ver prompt completo gerado
            </summary>
            <pre className="p-4 text-[10px] font-mono bg-white overflow-auto max-h-48 whitespace-pre-wrap" style={{ color: 'rgba(29,29,27,0.6)' }}>
              {buildSystemPrompt()}
            </pre>
          </details>
        </div>

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
