export type ContentChannel = 'instagram-feed' | 'instagram-reels' | 'instagram-stories' | 'email' | 'whatsapp';
export type ContentStatus = 'rascunho' | 'agendado' | 'publicado';
export type ContentObjective = 'engajamento' | 'conversao' | 'relacionamento' | 'lancamento' | 'reativacao';
export type ContentTone = 'inspiracional' | 'urgencia' | 'educativo' | 'emocional' | 'divertido';
export type ContentAudience = 'fas-marca' | 'leads-frios' | 'clientes-recentes' | 'inativos-20dias';

export interface ContentItem {
  id: string;
  date: string; // ISO date string
  channel: ContentChannel;
  type: string;
  title: string;
  caption: string;
  hashtags: string[];
  cta: string;
  suggestedTime: string;
  status: ContentStatus;
  objective: ContentObjective;
  tone: ContentTone;
  audience: ContentAudience;
  product?: string;
  // Email specific
  subjectLine?: string;
  previewText?: string;
  createdAt: string;
}

export interface EmailSequence {
  id: string;
  name: string;
  steps: EmailStep[];
}

export interface EmailStep {
  id: string;
  sequenceId: string;
  stepNumber: string; // D+0, D+3, etc.
  subject: string;
  previewText: string;
  body: string;
  status: 'rascunho' | 'ativo' | 'pausado';
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  audienceSegment: string;
  messageTemplate: string;
  dispatchTime: string;
  coupon: string;
  status: 'rascunho' | 'agendado' | 'enviado';
}

export const CHANNEL_LABELS: Record<ContentChannel, string> = {
  'instagram-feed': 'Instagram Feed',
  'instagram-reels': 'Instagram Reels',
  'instagram-stories': 'Instagram Stories',
  'email': 'E-mail',
  'whatsapp': 'WhatsApp',
};

export const CHANNEL_ICONS: Record<ContentChannel, string> = {
  'instagram-feed': '📷',
  'instagram-reels': '🎬',
  'instagram-stories': '📱',
  'email': '📧',
  'whatsapp': '💬',
};

export const STATUS_COLORS: Record<ContentStatus, { bg: string; text: string; dot: string }> = {
  'rascunho': { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-gray-400' },
  'agendado': { bg: 'bg-[hsl(43,76%,90%)]', text: 'text-[hsl(43,76%,30%)]', dot: 'bg-[#E8CD7E]' },
  'publicado': { bg: 'bg-[hsl(152,60%,90%)]', text: 'text-[hsl(152,60%,25%)]', dot: 'bg-green-500' },
};
