CREATE TABLE public.blog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

GRANT SELECT ON public.blog_categories TO anon, authenticated;
GRANT ALL ON public.blog_categories TO service_role;

CREATE TABLE public.blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT,
    featured_image TEXT,
    category_id UUID REFERENCES public.blog_categories(id),
    author_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMPTZ,
    meta_title TEXT,
    meta_description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT ALL ON public.blog_posts TO service_role;

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to published posts" ON public.blog_posts FOR SELECT USING (status = 'published');
CREATE POLICY "Allow public read access to all categories" ON public.blog_categories FOR SELECT USING (true);

CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX idx_blog_posts_status_published ON public.blog_posts(status, published_at) WHERE status = 'published';
CREATE INDEX idx_blog_categories_slug ON public.blog_categories(slug);

INSERT INTO public.blog_categories (name, slug, description)
VALUES 
    ('Gestão Financeira', 'gestao-financeira', 'Dicas e estratégias para organizar as finanças do seu negócio.'),
    ('E-commerce', 'e-commerce', 'Tudo sobre como vender mais e melhor na internet.'),
    ('Novidades Vejamais', 'novidades', 'Atualizações e novos recursos da plataforma Vejamais.');

INSERT INTO public.blog_posts (title, slug, excerpt, content, category_id, status, published_at, meta_title, meta_description)
SELECT 
    'Como organizar o fluxo de caixa do seu e-commerce',
    'como-organizar-fluxo-de-caixa-ecommerce',
    'Aprenda os passos fundamentais para manter a saúde financeira da sua loja virtual.',
    'O fluxo de caixa é o coração de qualquer negócio...',
    id,
    'published',
    now(),
    'Fluxo de Caixa para E-commerce | Vejamais',
    'Guia completo sobre gestão de fluxo de caixa para lojistas virtuais.'
FROM public.blog_categories WHERE slug = 'gestao-financeira' LIMIT 1;
