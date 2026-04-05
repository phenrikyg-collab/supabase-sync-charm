import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ProductItem, ProductEvent, PRODUCT_EVENT_TYPE_LABELS, PRODUCT_EVENT_TYPE_COLORS } from './plannerTypes';

interface Step2Props {
  products: ProductItem[];
  onProductsChange: (p: ProductItem[]) => void;
  productEvents: ProductEvent[];
  onProductEventsChange: (e: ProductEvent[]) => void;
}

const priorityColors: Record<string, string> = {
  alta: '#ef4444',
  media: '#E8CD7E',
  baixa: '#6b7280',
};

export function Step2Produtos({ products, onProductsChange, productEvents, onProductEventsChange }: Step2Props) {
  const [showProductModal, setShowProductModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', category: '', priority: 'media' as ProductItem['priority'], price: '' });
  const [newEvent, setNewEvent] = useState({ date: '', productId: '', type: 'reposicao' as ProductEvent['type'], description: '', impact: 'media' as ProductEvent['impact'] });

  const toggleProduct = (id: string) => {
    onProductsChange(products.map(p => p.id === id ? { ...p, included: !p.included } : p));
  };

  const setPriority = (id: string, priority: ProductItem['priority']) => {
    onProductsChange(products.map(p => p.id === id ? { ...p, priority } : p));
  };

  const addProduct = () => {
    if (!newProduct.name) return;
    const p: ProductItem = { id: crypto.randomUUID(), ...newProduct, included: true };
    onProductsChange([...products, p]);
    setNewProduct({ name: '', category: '', priority: 'media', price: '' });
    setShowProductModal(false);
  };

  const addEvent = () => {
    if (!newEvent.date || !newEvent.productId) return;
    const prod = products.find(p => p.id === newEvent.productId);
    const e: ProductEvent = {
      id: crypto.randomUUID(),
      ...newEvent,
      productName: prod?.name || '',
    };
    onProductEventsChange([...productEvents, e]);
    setNewEvent({ date: '', productId: '', type: 'reposicao', description: '', impact: 'media' });
    setShowEventModal(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* LEFT — Products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            🛍️ Produtos Best-Sellers
          </h3>
          <Button size="sm" variant="outline" onClick={() => setShowProductModal(true)} className="text-xs border-[#E8CD7E]/50 text-[#8B6914]">
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {products.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-white border transition-all" style={{ borderColor: p.included ? 'rgba(232,205,126,0.3)' : 'rgba(0,0,0,0.05)', opacity: p.included ? 1 : 0.5 }}>
              <Switch checked={p.included} onCheckedChange={() => toggleProduct(p.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <Badge variant="outline" className="text-[10px] mt-0.5">{p.category}</Badge>
              </div>
              <Select value={p.priority} onValueChange={(v: ProductItem['priority']) => setPriority(p.id, v)}>
                <SelectTrigger className="w-[90px] h-7 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: priorityColors[p.priority] }} />
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — Timeline */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            📅 Calendário de Reposição e Lançamentos
          </h3>
          <Button size="sm" variant="outline" onClick={() => setShowEventModal(true)} className="text-xs border-[#E8CD7E]/50 text-[#8B6914]">
            <Plus className="h-3 w-3 mr-1" /> Adicionar Evento
          </Button>
        </div>

        {productEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-lg" style={{ borderColor: 'rgba(232,205,126,0.3)' }}>
            Nenhum evento de produto adicionado.
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {[...productEvents].sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
              <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-white border" style={{ borderColor: 'rgba(232,205,126,0.2)' }}>
                <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: PRODUCT_EVENT_TYPE_COLORS[ev.type] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{format(parseISO(ev.date), 'dd/MM')}</span>
                    <Badge className="text-[10px] text-white" style={{ backgroundColor: PRODUCT_EVENT_TYPE_COLORS[ev.type] }}>
                      {PRODUCT_EVENT_TYPE_LABELS[ev.type]}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium mt-1">{ev.productName}</p>
                  {ev.description && <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>}
                </div>
                <button onClick={() => onProductEventsChange(productEvents.filter(e => e.id !== ev.id))} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent>
          <DialogHeader><DialogTitle style={{ fontFamily: "'Cormorant Garamond', serif" }}>Adicionar Produto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome do produto" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
            <Input placeholder="Categoria" value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} />
            <Select value={newProduct.priority} onValueChange={(v: any) => setNewProduct({ ...newProduct, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Preço / Oferta (opcional)" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} />
          </div>
          <DialogFooter>
            <Button onClick={addProduct} style={{ backgroundColor: '#8B6914' }} className="text-white">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Event Modal */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent>
          <DialogHeader><DialogTitle style={{ fontFamily: "'Cormorant Garamond', serif" }}>Adicionar Evento de Produto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="date" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} />
            <Select value={newEvent.productId} onValueChange={v => setNewEvent({ ...newEvent, productId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
              <SelectContent>
                {products.filter(p => p.included).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newEvent.type} onValueChange={(v: any) => setNewEvent({ ...newEvent, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRODUCT_EVENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea placeholder="Descrição / Observação" value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} />
            <Select value={newEvent.impact} onValueChange={(v: any) => setNewEvent({ ...newEvent, impact: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Urgência Alta</SelectItem>
                <SelectItem value="media">Urgência Média</SelectItem>
                <SelectItem value="baixa">Urgência Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={addEvent} style={{ backgroundColor: '#8B6914' }} className="text-white">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
