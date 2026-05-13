ALTER TABLE public.metas_whatsapp
  ADD COLUMN IF NOT EXISTS ticket_medio_meta numeric NOT NULL DEFAULT 0;