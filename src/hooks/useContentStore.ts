import { useState, useEffect, useCallback } from 'react';
import { ContentItem, EmailSequence, WhatsAppCampaign } from '@/components/content-calendar/types';
import { sampleEmailSequences, sampleWhatsAppCampaigns } from '@/components/content-calendar/sampleData';

const STORAGE_KEYS = {
  content: 'mc-content-items',
  emails: 'mc-email-sequences',
  whatsapp: 'mc-whatsapp-campaigns',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return fallback;
}

export function useContentStore() {
  const [contentItems, setContentItems] = useState<ContentItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.content, [])
  );
  const [emailSequences, setEmailSequences] = useState<EmailSequence[]>(() =>
    loadFromStorage(STORAGE_KEYS.emails, sampleEmailSequences)
  );
  const [whatsappCampaigns, setWhatsappCampaigns] = useState<WhatsAppCampaign[]>(() =>
    loadFromStorage(STORAGE_KEYS.whatsapp, sampleWhatsAppCampaigns)
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.content, JSON.stringify(contentItems));
  }, [contentItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.emails, JSON.stringify(emailSequences));
  }, [emailSequences]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.whatsapp, JSON.stringify(whatsappCampaigns));
  }, [whatsappCampaigns]);

  const addContent = useCallback((item: ContentItem) => {
    setContentItems(prev => [...prev, item]);
  }, []);

  const updateContent = useCallback((id: string, updates: Partial<ContentItem>) => {
    setContentItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  }, []);

  const deleteContent = useCallback((id: string) => {
    setContentItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const cloneContent = useCallback((id: string) => {
    setContentItems(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const clone: ContentItem = {
        ...item,
        id: crypto.randomUUID(),
        title: `${item.title} (cópia)`,
        status: 'rascunho',
        createdAt: new Date().toISOString(),
      };
      return [...prev, clone];
    });
  }, []);

  const updateEmailStep = useCallback((sequenceId: string, stepId: string, updates: Partial<import('@/components/content-calendar/types').EmailStep>) => {
    setEmailSequences(prev => prev.map(seq => {
      if (seq.id !== sequenceId) return seq;
      return { ...seq, steps: seq.steps.map(s => s.id === stepId ? { ...s, ...updates } : s) };
    }));
  }, []);

  const updateWhatsAppCampaign = useCallback((id: string, updates: Partial<WhatsAppCampaign>) => {
    setWhatsappCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  return {
    contentItems,
    emailSequences,
    whatsappCampaigns,
    addContent,
    updateContent,
    deleteContent,
    cloneContent,
    updateEmailStep,
    updateWhatsAppCampaign,
  };
}
