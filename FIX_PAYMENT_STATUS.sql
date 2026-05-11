-- 📊 ADD payment_status column for authoritative convergence
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'initialized';

-- Update check constraint to include payment_status if we want, but simple TEXT is fine first.
-- Optionally sync older records
UPDATE public.transactions 
SET payment_status = 'success' 
WHERE status IN ('success', 'payment_success', 'fulfilled');
