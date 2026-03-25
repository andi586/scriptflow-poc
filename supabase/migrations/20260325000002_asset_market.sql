-- supabase/migrations/20260325000002_asset_market.sql
-- F70: Creator Asset Market

CREATE TYPE public.asset_category AS ENUM (
  'character', 'music', 'weapon', 'prop', 'costume', 'scene'
);

CREATE TYPE public.asset_tier AS ENUM (
  'free', 'paid', 'exclusive'
);

CREATE TABLE IF NOT EXISTS public.assets (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name         text NOT NULL,
    description  text,
    category     asset_category NOT NULL,
    tier         asset_tier NOT NULL DEFAULT 'free',
    price        integer NOT NULL DEFAULT 0 CHECK (price >= 0),
    preview_url  text NOT NULL,
    asset_url    text,
    tags         text[] DEFAULT '{}',
    metadata     jsonb DEFAULT '{}',
    is_active    boolean DEFAULT true,
    created_at   timestamptz DEFAULT now() NOT NULL,
    updated_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_category_tier_active ON public.assets (category, tier, is_active);
CREATE INDEX IF NOT EXISTS idx_assets_creator_id ON public.assets (creator_id);
CREATE INDEX IF NOT EXISTS idx_assets_tags ON public.assets USING GIN (tags);

CREATE TABLE IF NOT EXISTS public.user_assets (
    id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_id       uuid NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
    purchased_at   timestamptz DEFAULT now() NOT NULL,
    price_paid     integer NOT NULL CHECK (price_paid >= 0),
    transaction_id text,
    created_at     timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT uk_user_asset UNIQUE (user_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_user_assets_user_id ON public.user_assets (user_id);
CREATE INDEX IF NOT EXISTS idx_user_assets_asset_id ON public.user_assets (asset_id);

CREATE TABLE IF NOT EXISTS public.asset_exclusivity (
    asset_id      uuid PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    locked_at     timestamptz DEFAULT now() NOT NULL
);

-- updated_at 触发器（独立命名，避免与现有函数冲突）
CREATE OR REPLACE FUNCTION public.handle_asset_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_assets_updated_at
    BEFORE UPDATE ON public.assets
    FOR EACH ROW EXECUTE FUNCTION public.handle_asset_updated_at();

-- 独家资产锁定触发器
CREATE OR REPLACE FUNCTION public.enforce_exclusive_purchase()
RETURNS trigger AS $$
DECLARE
    asset_tier_val asset_tier;
BEGIN
    SELECT tier INTO asset_tier_val FROM public.assets WHERE id = NEW.asset_id;

    IF asset_tier_val = 'exclusive' THEN
        IF EXISTS (SELECT 1 FROM public.asset_exclusivity WHERE asset_id = NEW.asset_id) THEN
            RAISE EXCEPTION 'Exclusive asset already purchased. No longer available.'
                USING HINT = 'Only one owner allowed for exclusive tier assets.';
        END IF;
        INSERT INTO public.asset_exclusivity (asset_id, owner_user_id)
        VALUES (NEW.asset_id, NEW.user_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_enforce_exclusive
    BEFORE INSERT ON public.user_assets
    FOR EACH ROW EXECUTE FUNCTION public.enforce_exclusive_purchase();

-- RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_exclusivity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "查看上架资产" ON public.assets
    FOR SELECT TO authenticated, anon USING (is_active = true);

CREATE POLICY "管理自己的资产" ON public.assets
    FOR ALL TO authenticated
    USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

CREATE POLICY "管理自己的已购资产" ON public.user_assets
    FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "查看自己的独家锁定" ON public.asset_exclusivity
    FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

COMMENT ON TABLE public.assets IS '创作者资产市场 - 全局资产库';
COMMENT ON TABLE public.user_assets IS '用户购买记录';
COMMENT ON TABLE public.asset_exclusivity IS '独家资产锁定表';

