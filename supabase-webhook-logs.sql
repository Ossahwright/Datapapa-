-- RUN THIS IN SUPABASE SQL EDITOR

CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reference TEXT,
    payload JSONB,
    status TEXT NOT NULL,           -- processed, ignored, error
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view/manage logs
DROP POLICY IF EXISTS "Admins can manage webhook_logs" ON public.webhook_logs;
CREATE POLICY "Admins can manage webhook_logs"
ON public.webhook_logs
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Create index for faster reference lookups
CREATE INDEX IF NOT EXISTS idx_webhook_logs_reference ON public.webhook_logs(reference);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at);
