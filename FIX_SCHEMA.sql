-- RUN THESE COMMANDS IN YOUR SUPABASE SQL EDITOR TO FIX THE SCHEMA
-- This adds the missing columns without deleting your existing data.

-- 1. Add missing columns to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS payer_phone_number TEXT,
ADD COLUMN IF NOT EXISTS datahub_network_key TEXT,
ADD COLUMN IF NOT EXISTS datahub_capacity TEXT,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_status TEXT,
ADD COLUMN IF NOT EXISTS sms_response JSONB,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 2. Rename or Create datahub_logs table
-- Check if table exists with old name and rename it, or create new one
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'datahubgh_logs') THEN
        ALTER TABLE public.datahubgh_logs RENAME TO datahub_logs;
        -- Rename columns for consistency
        ALTER TABLE public.datahub_logs RENAME COLUMN request_payload TO payload;
        ALTER TABLE public.datahub_logs RENAME COLUMN response_data TO response;
    ELSE
        CREATE TABLE IF NOT EXISTS public.datahub_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            endpoint TEXT NOT NULL,
            status TEXT NOT NULL,
            http_status INTEGER,
            response_time INTEGER,
            payload JSONB,
            response JSONB,
            error_message TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        );
    END IF;
END $$;

-- 3. Enable RLS and Policies for the new/renamed table
ALTER TABLE public.datahub_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage datahub_logs" ON public.datahub_logs;
CREATE POLICY "Admins can manage datahub_logs"
ON public.datahub_logs
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
