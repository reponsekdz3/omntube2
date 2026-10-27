-- ========================================================================
-- OmniTube Production Database Schema Migration
-- Sound Registry, Remix Lineage, Creator Tiers, Subscriptions & Open Search
-- ========================================================================

-- 1. SOUNDS & AUDIO TRACKS REGISTRY
CREATE TABLE IF NOT EXISTS public.sounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sound_id TEXT UNIQUE NOT NULL,
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    creator_address TEXT,
    source_video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    audio_path TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 30,
    waveform_peaks JSONB,
    bpm INTEGER DEFAULT 120,
    musical_key TEXT,
    audio_fingerprint TEXT NOT NULL, -- Cryptographic Keccak-256 hash
    royalty_bps INTEGER DEFAULT 500, -- 500 = 5.00%
    license_fee NUMERIC(28, 18) DEFAULT 0, -- native token wei
    uses_count INTEGER DEFAULT 0,
    is_nft_minted BOOLEAN DEFAULT FALSE,
    nft_token_id TEXT,
    nft_tx_hash TEXT,
    chain TEXT DEFAULT 'bsc',
    created_at TIMESTAMPTZ DEFAULT clock_timestamp() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sounds_creator_id ON public.sounds(creator_id);
CREATE INDEX IF NOT EXISTS idx_sounds_fingerprint ON public.sounds(audio_fingerprint);
CREATE INDEX IF NOT EXISTS idx_sounds_source_video ON public.sounds(source_video_id);

ALTER TABLE public.sounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public sounds"
    ON public.sounds FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create sounds"
    ON public.sounds FOR INSERT
    WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their own sounds"
    ON public.sounds FOR UPDATE
    USING (auth.uid() = creator_id);

-- 2. CREATOR TIERS CONFIGURATION
CREATE TABLE IF NOT EXISTS public.creator_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tier_name TEXT NOT NULL, -- 'Supporter', 'VIP', 'Elite Patron'
    tier_level INTEGER NOT NULL DEFAULT 1,
    monthly_price_usd NUMERIC(10, 2) NOT NULL,
    monthly_price_crypto TEXT NOT NULL, -- e.g. '0.008'
    token_symbol TEXT DEFAULT 'BNB' NOT NULL,
    perks_json JSONB DEFAULT '[]'::jsonb,
    badge_color TEXT DEFAULT '#59ebc8',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp() NOT NULL,
    UNIQUE (creator_id, tier_level)
);

CREATE INDEX IF NOT EXISTS idx_creator_tiers_creator ON public.creator_tiers(creator_id);

ALTER TABLE public.creator_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view creator tiers"
    ON public.creator_tiers FOR SELECT
    USING (true);

CREATE POLICY "Creators can manage their own tiers"
    ON public.creator_tiers FOR ALL
    USING (auth.uid() = creator_id);

-- 3. CREATOR SUBSCRIPTIONS & MEMBERSHIPS
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subscriber_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    subscriber_address TEXT NOT NULL,
    tier_id UUID REFERENCES public.creator_tiers(id) ON DELETE SET NULL,
    tier_name TEXT NOT NULL,
    amount NUMERIC(28, 18) NOT NULL,
    token_symbol TEXT NOT NULL,
    chain TEXT NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL, -- 'active', 'expired', 'cancelled'
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_creator ON public.subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber_addr ON public.subscriptions(subscriber_address);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tx_hash ON public.subscriptions(tx_hash);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = subscriber_id OR auth.uid() = creator_id);

CREATE POLICY "System/Service can log verified subscriptions"
    ON public.subscriptions FOR INSERT
    WITH CHECK (true);

-- 4. ON-CHAIN SOUND ROYALTIES & LICENSING
CREATE TABLE IF NOT EXISTS public.sound_royalties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sound_id TEXT NOT NULL,
    payer_address TEXT NOT NULL,
    creator_address TEXT NOT NULL,
    amount NUMERIC(28, 18) NOT NULL,
    token_symbol TEXT NOT NULL,
    chain TEXT NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    royalty_type TEXT DEFAULT 'remix_license', -- 'tip', 'remix_license', 'nft_mint'
    status TEXT DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT clock_timestamp() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sound_royalties_sound_id ON public.sound_royalties(sound_id);
CREATE INDEX IF NOT EXISTS idx_sound_royalties_creator ON public.sound_royalties(creator_address);

ALTER TABLE public.sound_royalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view verified royalties"
    ON public.sound_royalties FOR SELECT
    USING (true);

CREATE POLICY "Anyone can log on-chain royalty payment"
    ON public.sound_royalties FOR INSERT
    WITH CHECK (true);

-- 5. DERIVATIVE REMIX & DUET LINEAGE
CREATE TABLE IF NOT EXISTS public.remix_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    parent_video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
    parent_sound_id TEXT,
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    remix_type TEXT NOT NULL, -- 'duet_split', 'duet_pip', 'audio_swap', 'camera_take'
    child_fingerprint TEXT,
    notarized_tx_hash TEXT,
    chain TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_remix_child ON public.remix_lineage(child_video_id);
CREATE INDEX IF NOT EXISTS idx_remix_parent_video ON public.remix_lineage(parent_video_id);
CREATE INDEX IF NOT EXISTS idx_remix_parent_sound ON public.remix_lineage(parent_sound_id);

ALTER TABLE public.remix_lineage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view remix lineage"
    ON public.remix_lineage FOR SELECT
    USING (true);

CREATE POLICY "Creators can register remix lineage"
    ON public.remix_lineage FOR INSERT
    WITH CHECK (auth.uid() = creator_id);

-- 6. FULL-TEXT OPEN SEARCH INVERTED INDEX & GIN ACCELERATION
CREATE TABLE IF NOT EXISTS public.search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'video', 'sound', 'creator', 'playlist'
    entity_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT,
    category TEXT,
    kind TEXT,
    view_count INTEGER DEFAULT 0,
    score_weight INTEGER DEFAULT 100,
    search_vector TSVECTOR,
    indexed_at TIMESTAMPTZ DEFAULT clock_timestamp() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_vector_gin ON public.search_index USING gin(search_vector);

-- Trigger to automatically update search_vector on insert/update
CREATE OR REPLACE FUNCTION public.update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
                         setweight(to_tsvector('english', coalesce(NEW.tags, '')), 'B') ||
                         setweight(to_tsvector('english', coalesce(NEW.category, '')), 'C') ||
                         setweight(to_tsvector('english', coalesce(NEW.description, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_search_vector ON public.search_index;
CREATE TRIGGER trigger_update_search_vector
    BEFORE INSERT OR UPDATE ON public.search_index
    FOR EACH ROW
    EXECUTE FUNCTION public.update_search_vector();
