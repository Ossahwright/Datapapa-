-- 🚀 ADMIN OPERATIONAL CONTROLS MIGRATION
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.transactions.fulfilled_at IS 'The timestamp when the transaction was officially marked as completed (auto or manual)';
COMMENT ON COLUMN public.transactions.manual_override IS 'True if an admin manually forced the transaction to a delivered state';
COMMENT ON COLUMN public.transactions.audit_log IS 'Json array of state changes and administrative actions';
