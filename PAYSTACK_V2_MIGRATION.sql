-- PAYSTACK V2 SYSTEM MIGRATION
-- Adds support for hardened transaction state machine and authoritative webhooks

ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS webhook_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fulfillment_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;

-- Add indexes for performance and reconciliation
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON public.transactions(paystack_receipt);
CREATE INDEX IF NOT EXISTS idx_transactions_internal_ref ON public.transactions(internal_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);

-- Update RLS if needed (service_role usually handles everything)
-- But ensure admins can always reconcile
DROP POLICY IF EXISTS "Admins can manage transactions" ON public.transactions;
CREATE POLICY "Admins can manage transactions" 
ON public.transactions FOR ALL 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());
