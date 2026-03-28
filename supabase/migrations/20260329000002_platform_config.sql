CREATE TABLE IF NOT EXISTS public.platform_config (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    config_key text UNIQUE NOT NULL,
    config_value jsonb NOT NULL,
    description text,
    updated_at timestamptz DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

INSERT INTO public.platform_config (config_key, config_value, description)
VALUES
    ('cold_start_threshold', '100000'::jsonb, '冷启动视频数阈值'),
    ('platform_gmv_scale_threshold', '1000000'::jsonb, 'GMV规模化阈值（美元）'),
    ('support_fund_rate', '0.05'::jsonb, '扶助基金比例5%'),
    ('creator_pool_rate_q1', '0.60'::jsonb, 'Q1创意池比例60%'),
    ('creator_pool_rate_q2_plus', '0.65'::jsonb, 'Q2+创意池比例65%'),
    ('ip_decay_inactive_days', '180'::jsonb, 'IP休眠重置天数'),
    ('hardship_threshold_usd', '2000'::jsonb, '仲裁困难认定阈值（美元）')
ON CONFLICT (config_key) DO NOTHING;

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "platform_config_read_all_authenticated"
    ON public.platform_config FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "platform_config_write_only_service_role"
    ON public.platform_config FOR ALL TO authenticated
    USING (false) WITH CHECK (false);
