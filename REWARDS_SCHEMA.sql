-- Run this script in your Supabase SQL Editor to enable Appreciation Rewards

CREATE TABLE IF NOT EXISTS public.appreciation_reward_cycles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cycle_start TIMESTAMPTZ NOT NULL,
    cycle_end TIMESTAMPTZ NOT NULL,
    total_eligible INTEGER DEFAULT 0,
    total_selected INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.appreciation_reward_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage appreciation_reward_cycles" ON public.appreciation_reward_cycles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


CREATE TABLE IF NOT EXISTS public.appreciation_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID,
    customer_name TEXT,
    customer_phone TEXT NOT NULL,
    network TEXT NOT NULL,
    reward_type TEXT DEFAULT 'data',
    reward_value TEXT DEFAULT '1 GB',
    reward_cycle UUID REFERENCES public.appreciation_reward_cycles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending_approval',  -- pending_approval, sending, sent, failed
    approved_by TEXT, -- Admin email or ID
    created_at TIMESTAMPTZ DEFAULT now(),
    rewarded_at TIMESTAMPTZ
);
ALTER TABLE public.appreciation_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage appreciation_rewards" ON public.appreciation_rewards FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Re-enable realtime for the new tables if appropriate
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'appreciation_rewards') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appreciation_rewards;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'appreciation_reward_cycles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appreciation_reward_cycles;
  END IF;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;
