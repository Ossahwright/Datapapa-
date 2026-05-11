-- PAYSTACK V2 SYSTEM MIGRATION
-- Adds support for hardened transaction state machine and authoritative webhooks

ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS webhook_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fulfillment_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_execution_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 🔄 STATE MACHINE ENFORCEMENT
-- We ensure the status column only accepts our authoritative states
-- states: initialized, payment_pending, payment_success, fulfillment_pending, fulfillment_processing, fulfilled, failed, reversed

-- 1. First, normalize any existing older statuses to 'fulfilled' or 'failed' to avoid constraint violations
UPDATE public.transactions SET status = 'fulfilled' WHERE status IN ('delivered', 'success', 'COMPLETED');
UPDATE public.transactions SET status = 'failed' WHERE status IN ('error', 'REJECTED');

-- 2. Add the check constraint
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_transaction_status;
ALTER TABLE public.transactions ADD CONSTRAINT check_transaction_status 
  CHECK (status IN ('initialized', 'payment_pending', 'payment_success', 'fulfillment_pending', 'fulfillment_processing', 'fulfilled', 'failed', 'reversed'));

-- Add indexes for performance and reconciliation
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON public.transactions(paystack_receipt);
CREATE INDEX IF NOT EXISTS idx_transactions_internal_ref ON public.transactions(internal_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);

-- 🚀 UPDATE KPI FUNCTION FOR STATE MACHINE
CREATE OR REPLACE FUNCTION public.get_today_kpi()
RETURNS TABLE (
    total_tx BIGINT,
    revenue NUMERIC,
    success_count BIGINT,
    failed_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
      COUNT(*)                           AS total_tx,
      COALESCE(SUM(amount), 0)           AS revenue,
      COUNT(*) FILTER (WHERE status = 'fulfilled') AS success_count,
      COUNT(*) FILTER (WHERE status = 'failed')  AS failed_count
    FROM public.transactions
    WHERE created_at::date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 🚀 SEED LIVE PAYSTACK KEYS (SAFE IDEMPOTENT INSERT)
-- This ensures the DB also has the keys if the app reads from settings
-- NOTE: Real keys should be inserted via the Supabase Dashboard SQL editor
INSERT INTO public.settings (key, value)
VALUES 
  ('paystack_public_key', '""'),
  ('paystack_secret_key', '""')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- But ensure admins can always reconcile
DROP POLICY IF EXISTS "Admins can manage transactions" ON public.transactions;
CREATE POLICY "Admins can manage transactions" 
ON public.transactions FOR ALL 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());
