-- 🚀 TELECOM-GRADE NORMALIZATION MIGRATION
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS display_bundle TEXT,
  ADD COLUMN IF NOT EXISTS internal_bundle_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_capacity TEXT,
  ADD COLUMN IF NOT EXISTS provider_network_key TEXT;

COMMENT ON COLUMN public.transactions.display_bundle IS 'The human-readable bundle label (e.g. 1GB)';
COMMENT ON COLUMN public.transactions.internal_bundle_id IS 'The authoritative BUNDLE_CONFIG identifier (e.g. MTN_1GB)';
COMMENT ON COLUMN public.transactions.provider_capacity IS 'The native provider capacity value (e.g. 1)';
COMMENT ON COLUMN public.transactions.provider_network_key IS 'The native provider network key (e.g. YELLO)';
