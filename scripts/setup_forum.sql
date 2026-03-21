-- Forum Schema Setup

DROP TABLE IF EXISTS public.forum_comments CASCADE;
DROP TABLE IF EXISTS public.forum_posts CASCADE;
DROP TABLE IF EXISTS public.forum_categories CASCADE;

-- 1. Forum Categories
CREATE TABLE IF NOT EXISTS public.forum_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'MessageSquare',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Forum Posts (Threads)
CREATE TABLE IF NOT EXISTS public.forum_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Forum Comments (Replies)
CREATE TABLE IF NOT EXISTS public.forum_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Optional, can be skipped if APIs use service_role)
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;

-- Simple public read access
CREATE POLICY "Categories are viewable by everyone" ON public.forum_categories FOR SELECT USING (true);
CREATE POLICY "Posts are viewable by everyone" ON public.forum_posts FOR SELECT USING (true);
CREATE POLICY "Comments are viewable by everyone" ON public.forum_comments FOR SELECT USING (true);

-- Insert policy for authenticated users (mapped via users table)
CREATE POLICY "Users can insert posts" ON public.forum_posts FOR INSERT WITH CHECK (
    author_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
);
CREATE POLICY "Users can insert comments" ON public.forum_comments FOR INSERT WITH CHECK (
    author_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
);
