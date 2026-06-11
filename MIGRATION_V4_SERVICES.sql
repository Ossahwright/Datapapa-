-- 🚀 SUPABASE SCHEMA UPDATE V4: MULTI-SERVICE & PROVIDER ROUTING
-- Run these commands in your Supabase SQL Editor to support the updated Datapapa Architecture.

-- 1. Update public.bundles table
ALTER TABLE public.bundles
  ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'DATA',
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'DATAHUBGH';

-- Add a check constraint to ensure only valid services can be created in bundles
ALTER TABLE public.bundles DROP CONSTRAINT IF EXISTS check_bundle_service_type;
ALTER TABLE public.bundles ADD CONSTRAINT check_bundle_service_type
  CHECK (service_type IN ('DATA', 'AIRTIME', 'BECE', 'WASSCE'));

-- Add a check constraint to ensure only valid providers are specified in bundles
ALTER TABLE public.bundles DROP CONSTRAINT IF EXISTS check_bundle_provider;
ALTER TABLE public.bundles ADD CONSTRAINT check_bundle_provider
  CHECK (provider IN ('DATAHUBGH', 'HUBTEL'));

-- Fix existing bundles to have correct defaults
UPDATE public.bundles SET service_type = 'DATA' WHERE service_type IS NULL;
UPDATE public.bundles SET provider = 'DATAHUBGH' WHERE provider IS NULL;


-- 2. Update public.transactions table
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'DATA',
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'DATAHUBGH';

-- Add check constraints to transactions table
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_tx_service_type;
ALTER TABLE public.transactions ADD CONSTRAINT check_tx_service_type
  CHECK (service_type IN ('DATA', 'AIRTIME', 'BECE', 'WASSCE'));

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_tx_provider;
ALTER TABLE public.transactions ADD CONSTRAINT check_tx_provider
  CHECK (provider IN ('DATAHUBGH', 'HUBTEL'));

-- Fix existing transactions to map correctly
UPDATE public.transactions SET service_type = 'DATA' WHERE service_type IS NULL;
-- Mark Airtime transactions as HUBTEL, others as DATAHUBGH
UPDATE public.transactions SET provider = 'HUBTEL' WHERE service_type = 'AIRTIME';
UPDATE public.transactions SET provider = 'DATAHUBGH' WHERE service_type != 'AIRTIME' OR service_type IS NULL;
UPDATE public.transactions SET provider = 'DATAHUBGH' WHERE provider IS NULL;

-- 3. Enable Real-Time replication on bundles table if not already enabled
ALTER PUBLICATION supabase_realtime ADD TABLE public.bundles;
