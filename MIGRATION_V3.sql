-- 🚀 SUPABASE SCHEMA UPDATE V3
-- Run these commands in your Supabase SQL Editor to fix 500 errors and enable health tracking.

-- 1. Add WhatsApp Tracking columns to transactions table
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_by UUID,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_by_email TEXT, -- Added for easier identification
  ADD COLUMN IF NOT EXISTS whatsapp_message TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_send_count INTEGER DEFAULT 0;

-- 2. Add Health Tracking columns to provider_settings table
ALTER TABLE public.provider_settings
  ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_response_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS health_status TEXT,
  ADD COLUMN IF NOT EXISTS health_details JSONB;

-- 3. Update RLS policies to ensure admin can manage these new columns
-- (Usually "Admins can manage transactions" policy already covers this if it's FOR ALL)

-- 4. Initial seed for health tracking columns if missing
UPDATE public.provider_settings 
SET 
  last_health_check_at = now(),
  health_status = 'operational'
WHERE provider_name = 'datahubgh' 
AND health_status IS NULL;
