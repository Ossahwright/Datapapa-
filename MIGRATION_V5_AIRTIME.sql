-- 🚀 SUPABASE SCHEMA UPDATE V5: AIRTIME PRODUCT MODULE & AIRTIME ORDERS LEDGER
-- Run these commands in your Supabase SQL Editor to initialize the airtime-specific tables and models.

-- 1. Create airtime_products table if not exists
CREATE TABLE IF NOT EXISTS public.airtime_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network TEXT NOT NULL,                     -- MTN, TELECEL, AT
    provider TEXT DEFAULT 'HUBTEL',            -- Default Airtime Provider is HUBTEL
    is_active BOOLEAN DEFAULT TRUE,            -- Toggle visibility of the airtime product
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed Supported Airtime Networks
INSERT INTO public.airtime_products (network, provider, is_active)
VALUES 
  ('MTN', 'HUBTEL', TRUE),
  ('TELECEL', 'HUBTEL', TRUE),
  ('AT', 'HUBTEL', TRUE)
ON CONFLICT DO NOTHING;

-- 2. Create airtime_orders table if not exists
CREATE TABLE IF NOT EXISTS public.airtime_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT UNIQUE NOT NULL,            -- Friendly identifier or paystack reference convergence
    customer_phone TEXT NOT NULL,              -- Target recipient number
    payer_phone_number TEXT,                   -- Mobile money account phone payer
    network TEXT NOT NULL,                     -- MTN, TELECEL, AT
    amount NUMERIC(10,2) NOT NULL,             -- Loaded sum in GHS
    provider TEXT DEFAULT 'HUBTEL',            -- Direct provider (HUBTEL)
    payment_status TEXT DEFAULT 'pending',     -- payment_status (pending, success, failed)
    delivery_status TEXT DEFAULT 'pending',    -- delivery_status (pending, delivered, failed)
    provider_reference TEXT,                   -- Reference received from Hubtel airtime execution API
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Real-Time replication on airtime_products and airtime_orders tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.airtime_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.airtime_orders;

-- 3. Modify existing transactions table constraints just in case (already supports columns)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_tx_service_type;
ALTER TABLE public.transactions ADD CONSTRAINT check_tx_service_type
  CHECK (service_type IN ('DATA', 'AIRTIME', 'BECE', 'WASSCE'));

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_tx_provider;
ALTER TABLE public.transactions ADD CONSTRAINT check_tx_provider
  CHECK (provider IN ('DATAHUBGH', 'HUBTEL'));

-- 4. Redefine get_customers_summary to strictly include DATA & AIRTIME, and exclude BECE/WASSCE for rewards
CREATE OR REPLACE FUNCTION public.get_customers_summary()
RETURNS TABLE (
    recipient_phone TEXT,
    total_spent NUMERIC,
    weekly_spent NUMERIC,
    transaction_count BIGINT,
    last_transaction TIMESTAMPTZ,
    network TEXT,
    user_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.recipient_phone,
        SUM(t.amount) as total_spent,
        SUM(CASE WHEN t.created_at >= NOW() - INTERVAL '7 days' THEN t.amount ELSE 0 END) as weekly_spent,
        COUNT(t.id) as transaction_count,
        MAX(t.created_at) as last_transaction,
        MAX(t.network) as network,
        t.user_id
    FROM public.transactions t
    WHERE t.recipient_phone IS NOT NULL
      AND (t.status = 'success' OR t.status = 'fulfilled' OR t.status = 'paid' OR t.status = 'payment_success') -- Only count successful transactions
      AND (t.service_type IS NULL OR t.service_type = 'DATA' OR t.service_type = 'AIRTIME') -- Strictly count only DATA and AIRTIME as per business rules
    GROUP BY t.recipient_phone, t.user_id
    ORDER BY last_transaction DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

