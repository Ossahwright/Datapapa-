-- Run this script in your Supabase SQL Editor

-- 1. Create bundles table
DROP TABLE IF EXISTS public.bundles CASCADE;
CREATE TABLE public.bundles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  network TEXT NOT NULL,           -- MTN, Telecel, AirtelTigo
  network_key TEXT NOT NULL,       -- mtn, telecel, airteltigo

  capacity TEXT NOT NULL,          -- e.g. "1GB", "2GB"
  volume TEXT,                    -- e.g. "1000", "2000"
  description TEXT,                -- optional (Daily plan, Weekly etc.)

  cost_price NUMERIC,              -- what you pay (admin use)
  selling_price NUMERIC NOT NULL,  -- what user pays

  is_active BOOLEAN DEFAULT true,  -- show/hide bundle

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create transactions table
DROP TABLE IF EXISTS public.transactions CASCADE;
CREATE TABLE public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    paystack_receipt TEXT,
    amount NUMERIC NOT NULL,
    network TEXT NOT NULL,
    network_key TEXT,
    capacity TEXT,
    payee_phone TEXT,
    recipient_phone TEXT NOT NULL,
    status TEXT NOT NULL,
    vtu_status TEXT,
    api_response JSONB,
    profit NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create profiles table (for syncing auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4.1 Create is_admin helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- 1. Check if the user's email matches the known admin
  IF (auth.jwt() ->> 'email') = 'wrightossah@gmail.com' THEN
    RETURN TRUE;
  END IF;

  -- 2. Check profiles table for admin role
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Set up RLS Policies

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can insert profile" ON public.profiles;

CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles." ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (public.is_admin());
-- Allow authenticated users to insert their own profile (needed for trigger/signup)
CREATE POLICY "Anyone can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

-- Bundles Policies
DROP POLICY IF EXISTS "Bundles are readable by everyone." ON public.bundles;
DROP POLICY IF EXISTS "Admin full access bundles" ON public.bundles;
DROP POLICY IF EXISTS "Admins can insert bundles" ON public.bundles;
DROP POLICY IF EXISTS "Admins can update bundles" ON public.bundles;
DROP POLICY IF EXISTS "Admins can delete bundles" ON public.bundles;

CREATE POLICY "Bundles are readable by everyone." ON public.bundles FOR SELECT USING (true);
CREATE POLICY "Admin full access bundles" ON public.bundles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Transaction Policies
DROP POLICY IF EXISTS "Anyone can create a transaction." ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own transactions." ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions." ON public.transactions;
DROP POLICY IF EXISTS "Admins can manage transactions" ON public.transactions;

CREATE POLICY "Anyone can create a transaction." ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own transactions." ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage transactions" ON public.transactions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. Trigger to automatically create a user profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    new.id, 
    new.email, 
    CASE 
      WHEN new.email = 'wrightossah@gmail.com' THEN 'admin' 
      ELSE 'user' 
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists to avoid conflicts, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Insert some default bundles
INSERT INTO public.bundles (network, network_key, capacity, description, cost_price, selling_price, is_active)
SELECT 'MTN', 'mtn', '1 GB', 'Daily 1GB', 3.5, 5, true WHERE NOT EXISTS (SELECT 1 FROM public.bundles);
INSERT INTO public.bundles (network, network_key, capacity, description, cost_price, selling_price, is_active)
SELECT 'MTN', 'mtn', '3 GB', 'Weekly 3GB', 10, 15, true WHERE NOT EXISTS (SELECT 1 FROM public.bundles WHERE capacity = '3 GB');
-- ... adding a few more for example
INSERT INTO public.bundles (network, network_key, capacity, description, cost_price, selling_price, is_active)
SELECT 'MTN', 'mtn', '10 GB', 'Monthly 10GB', 35, 50, true WHERE NOT EXISTS (SELECT 1 FROM public.bundles WHERE capacity = '10 GB');

-- 8. Create settings table
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Only non-secure settings are readable by everyone
DROP POLICY IF EXISTS "Public settings are readable by everyone." ON public.settings;
CREATE POLICY "Public settings are readable by everyone." ON public.settings 
FOR SELECT USING (key != 'secure');

-- Admins can manage all settings including secure ones
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
CREATE POLICY "Admins can manage settings"
ON public.settings
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 9. Insert default settings
INSERT INTO public.settings (key, value)
VALUES (
    'general',
    '{"app_name": "Datapapa", "currency": "GHS", "support_email": "support@datapapa.com", "maintenance_mode": false, "sms_enabled": true, "sms_sender_id": "Datapapa", "sms_template_success": "Hello! You have successfully received {volume} data on your {network} line. Thank you for using {app_name}."}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 10. Create get_customers_summary RPC
CREATE OR REPLACE FUNCTION public.get_customers_summary()
RETURNS TABLE (
    recipient_phone TEXT,
    total_spent NUMERIC,
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
        COUNT(t.id) as transaction_count,
        MAX(t.created_at) as last_transaction,
        MAX(t.network) as network,
        t.user_id
    FROM public.transactions t
    WHERE t.recipient_phone IS NOT NULL
    GROUP BY t.recipient_phone, t.user_id
    ORDER BY last_transaction DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create datahubgh_logs table
CREATE TABLE IF NOT EXISTS public.datahubgh_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    endpoint TEXT NOT NULL,
    status TEXT NOT NULL,           -- success, failed
    http_status INTEGER,
    response_time INTEGER,          -- in ms
    request_payload JSONB,
    response_data JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.datahubgh_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage datahubgh_logs" ON public.datahubgh_logs;
CREATE POLICY "Admins can manage datahubgh_logs"
ON public.datahubgh_logs
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 12. Create paystack_webhook_logs table
CREATE TABLE IF NOT EXISTS public.paystack_webhook_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,           -- success, failed
    datahub_response JSONB,
    sms_response JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.paystack_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage paystack_webhook_logs" ON public.paystack_webhook_logs;
CREATE POLICY "Admins can manage paystack_webhook_logs"
ON public.paystack_webhook_logs
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 13. Enable real-time for relevant tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

-- 14. Create get_today_kpi RPC for Admin Dashboard
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
      COUNT(*) FILTER (WHERE vtu_status='success' OR vtu_status='delivered') AS success_count,
      COUNT(*) FILTER (WHERE vtu_status='failed')  AS failed_count
    FROM public.transactions
    WHERE created_at::date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Create sms_logs table
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL,           -- sent, failed
    response JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage sms_logs" ON public.sms_logs;
CREATE POLICY "Admins can manage sms_logs"
ON public.sms_logs
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
