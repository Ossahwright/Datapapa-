-- Run this script in your Supabase SQL Editor

-- 1. Create bundles table
DROP TABLE IF EXISTS public.bundles CASCADE;
CREATE TABLE public.bundles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  network TEXT NOT NULL,           -- MTN, Telecel, AirtelTigo
  network_key TEXT NOT NULL,       -- mtn, telecel, airteltigo

  capacity TEXT NOT NULL,          -- e.g. "1GB", "2GB"
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

-- 5. Set up RLS Policies

-- Bundles are readable by everyone, but only admins can modify
CREATE POLICY "Bundles are readable by everyone." ON public.bundles FOR SELECT USING (true);

CREATE POLICY "Admin full access bundles"
ON public.bundles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Transactions can be created by anyone (for the demo) but read only by the owner or admin
CREATE POLICY "Anyone can create a transaction." ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own transactions." ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all transactions." ON public.transactions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role = 'admin'
    )
);

-- 6. Trigger to automatically create a user profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'admin'); -- Defaulting to admin for this specific app's setup
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists to avoid conflicts, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Insert some default bundles
INSERT INTO public.bundles (network, network_key, capacity, description, cost_price, selling_price, is_active) VALUES
('MTN', 'mtn', '1 GB', 'Daily 1GB', 3.5, 5, true),
('MTN', 'mtn', '3 GB', 'Weekly 3GB', 10, 15, true),
('MTN', 'mtn', '10 GB', 'Monthly 10GB', 35, 50, true),
('Telecel', 'telecel', '1.5 GB', 'Daily Xtra 1.5GB', 3.5, 5, true),
('Telecel', 'telecel', '5 GB', 'Weekend 5GB', 7, 10, true),
('Telecel', 'telecel', '15 GB', 'Monthly Boss 15GB', 30, 45, true),
('AirtelTigo', 'airteltigo', '2 GB', 'Big Time 2GB', 3, 5, true),
('AirtelTigo', 'airteltigo', '5 GB', 'Sika Kokoo 5GB', 8, 12, true),
('AirtelTigo', 'airteltigo', '10 GB', 'No Expiry 10GB', 25, 40, true);

-- 8. Create settings table
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings are readable by everyone." ON public.settings FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings"
ON public.settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

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
    network TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.recipient_phone,
        SUM(t.amount) as total_spent,
        COUNT(t.id) as transaction_count,
        MAX(t.created_at) as last_transaction,
        MAX(t.network) as network
    FROM public.transactions t
    WHERE t.recipient_phone IS NOT NULL
    GROUP BY t.recipient_phone
    ORDER BY last_transaction DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
