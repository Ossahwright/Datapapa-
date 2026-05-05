-- RUN THIS IN SUPABASE SQL EDITOR

CREATE TABLE IF NOT EXISTS public.api_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    endpoint TEXT NOT NULL,
    request JSONB,
    response JSONB,
    status TEXT NOT NULL,      -- success, failed
    http_status INTEGER,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view logs
DROP POLICY IF EXISTS "Admins can manage api_logs" ON public.api_logs;
CREATE POLICY "Admins can manage api_logs"
ON public.api_logs
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Index for debugging
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON public.api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON public.api_logs(endpoint);
