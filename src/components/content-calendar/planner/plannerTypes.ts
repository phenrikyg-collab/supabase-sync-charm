export type ChannelFrequency = '2x/week' | '3x/week' | 'daily' | '1x/day' | '2x/day' | '3x/day' | '1x/week' | '2x/week' | '3x/week';

export interface PlannerChannel {
  channel: string;
  enabled: boolean;
  frequency: string;
}

export interface BrandDate {
  id: string;
  date: string;
  label: string;
  type: 'lancamento' | 'reposicao' | 'live' | 'promocao' | 'evento' | 'outro';
  color: string;
}

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  priority: 'alta' | 'media' | 'baixa';
  price?: string;
  included: boolean;
  notes?: string;
}

export interface ProductEvent {
  id: string;
  date: string;
  productId: string;
  productName: string;
  type: 'reposicao' | 'lancamento' | 'esgotando' | 'promocao-relampago' | 'live-produto';
  description: string;
  impact: 'alta' | 'media' | 'baixa';
}

export interface FunnelConfig {
  topo: number;
  meio: number;
  fundo: number;
}

export interface PlanConfig {
  month: number;
  year: number;
  channels: PlannerChannel[];
  holidays: { id: string; date: string; label: string; included: boolean }[];
  brandDates: BrandDate[];
  avoidDays: number[]; // 0=Sun,1=Mon,...6=Sat
  products: ProductItem[];
  productEvents: ProductEvent[];
  funnel: FunnelConfig;
  audiences: string[];
  emailGoal: string;
  whatsappGoal: string;
  coupon: string;
}

export const DEFAULT_CHANNELS: PlannerChannel[] = [
  { channel: 'Instagram Feed', enabled: true, frequency: '3x/week' },
  { channel: 'Instagram Reels', enabled: true, frequency: '2x/day' },
  { channel: 'Instagram Stories', enabled: true, frequency: '1x/day' },
  { channel: 'E-mail', enabled: true, frequency: '2x/week' },
  { channel: 'WhatsApp', enabled: true, frequency: '2x/week' },
];

export const CHANNEL_FREQUENCY_OPTIONS: Record<string, string[]> = {
  'Instagram Feed': ['2x/week', '3x/week', 'daily'],
  'Instagram Reels': ['2x/week', '3x/week', 'daily'],
  'Instagram Stories': ['1x/day', '2x/day', '3x/day'],
  'E-mail': ['1x/week', '2x/week'],
  'WhatsApp': ['1x/week', '2x/week', '3x/week'],
};

export const DEFAULT_PRODUCTS: ProductItem[] = [
  { id: '1', name: 'Calça Modeladora Anna', category: 'Calças', priority: 'alta', included: true },
  { id: '2', name: 'Calça Skinny Juliana', category: 'Calças', priority: 'alta', included: true },
  { id: '3', name: 'Conjunto Madri (Calça + Jaqueta)', category: 'Conjuntos', priority: 'alta', included: true },
  { id: '4', name: 'Bodys', category: 'Bodys', priority: 'media', included: true },
  { id: '5', name: 'Jaquetas', category: 'Jaquetas', priority: 'media', included: true },
  { id: '6', name: 'Vestidos', category: 'Vestidos', priority: 'media', included: false },
  { id: '7', name: 'Blusas', category: 'Blusas', priority: 'baixa', included: false },
];

export const BRAND_DATE_TYPE_COLORS: Record<string, string> = {
  lancamento: '#E8CD7E',
  reposicao: '#8B6914',
  live: '#9b87f5',
  promocao: '#22c55e',
  evento: '#3b82f6',
  outro: '#6b7280',
};

export const BRAND_DATE_TYPE_LABELS: Record<string, string> = {
  lancamento: 'Lançamento',
  reposicao: 'Reposição',
  live: 'Live',
  promocao: 'Promoção',
  evento: 'Evento',
  outro: 'Outro',
};

export const PRODUCT_EVENT_TYPE_LABELS: Record<string, string> = {
  reposicao: 'Reposição',
  lancamento: 'Lançamento',
  esgotando: 'Esgotando',
  'promocao-relampago': 'Promoção Relâmpago',
  'live-produto': 'Live de Produto',
};

export const PRODUCT_EVENT_TYPE_COLORS: Record<string, string> = {
  reposicao: '#3b82f6',
  lancamento: '#E8CD7E',
  esgotando: '#ef4444',
  'promocao-relampago': '#22c55e',
  'live-produto': '#9b87f5',
};
