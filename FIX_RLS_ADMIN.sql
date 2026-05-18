-- 🛡️ REPAIR SCRIPT FOR RLS AND ADMIN PERMISSIONS
-- Run this in your Supabase SQL Editor if you hit permission errors

-- 1. Ensure the owner email is always marked as admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'wrightossah@gmail.com';

-- 2. Create the webhook_logs table if it's missing (to avoid any logging failures)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reference TEXT,
    payload JSONB,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage webhook_logs" ON public.webhook_logs;
CREATE POLICY "Admins can manage webhook_logs" ON public.webhook_logs FOR ALL USING (public.is_admin());

-- 3. Relax RLS for 'transactions' update to ensure admins can always fix stuck orders
DROP POLICY IF EXISTS "Admins can manage transactions" ON public.transactions;
CREATE POLICY "Admins can manage transactions" 
ON public.transactions 
FOR ALL 
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Ensure the is_admin function is robust
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check JWT email directly first
  IF (auth.jwt() ->> 'email') = 'wrightossah@gmail.com' THEN
    RETURN TRUE;
  END IF;

  -- Then check the profiles table
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant necessary permissions just in case
GRANT ALL ON TABLE public.transactions TO authenticated;
GRANT ALL ON TABLE public.datahub_logs TO authenticated;
GRANT ALL ON TABLE public.profiles TO authenticated;
