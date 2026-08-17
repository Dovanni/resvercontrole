
import { describe, it, expect } from 'vitest';
import { MOCK_ARTICLES } from '@/features/vseo-pilot/mockArticles';
import fs from 'fs';
import path from 'path';

describe('VSEO Pilot Lab V1.2 Premium UX Compliance', () => {
  it('should contain exactly three synthetic articles', () => {
    expect(MOCK_ARTICLES.length).toBe(3);
  });

  it('all articles must have a seoScore and lastUpdate field', () => {
    MOCK_ARTICLES.forEach(article => {
      expect(article.seoScore).toBeDefined();
      expect(article.lastUpdate).toBeDefined();
    });
  });

  it('brand normalization: no standalone VEJAMAIS in public content', () => {
     const standaloneRegex = /VEJAMAIS(?! ERP)/i;
     MOCK_ARTICLES.forEach(a => {
        expect(a.content).not.toMatch(standaloneRegex);
        expect(a.author).not.toMatch(standaloneRegex);
     });
  });

  it('dashboard: must contain "VSEO Manager" title', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/vseo-pilot/index.tsx'), 'utf-8');
    expect(content).toContain('VSEO Manager');
  });

  it('dashboard: must contain stats derived from mocks', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/vseo-pilot/index.tsx'), 'utf-8');
    expect(content).toContain('MOCK_ARTICLES.length');
    expect(content).toContain('seoScore');
  });

  it('dashboard: must contain tool buttons (Filter, Settings2, ArrowUpDown)', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/vseo-pilot/index.tsx'), 'utf-8');
    expect(content).toContain('Filter');
    expect(content).toContain('Settings2');
    expect(content).toContain('ArrowUpDown');
  });

  it('article: breadcrumb must have 3 levels and match JSON-LD', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/vseo-pilot/blog/$slug.tsx'), 'utf-8');
    expect(content).toContain('VSEO Pilot');
    expect(content).toContain('Blog Piloto');
    expect(content).toContain('aria-current="page"');
    expect(content).toContain('"@type": "BreadcrumbList"');
  });

  it('article: premium tools must include Google and Social previews', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/vseo-pilot/blog/$slug.tsx'), 'utf-8');
    expect(content).toContain('Google Search Preview');
    expect(content).toContain('Open Graph Social Preview');
  });

  it('article: layout must use article, header and section elements', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/vseo-pilot/blog/$slug.tsx'), 'utf-8');
    expect(content).toContain('<article');
    expect(content).toContain('<header');
    expect(content).toContain('<section class="editorial-content"');
  });

  it('article: line-height is optimized for reading', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/vseo-pilot/blog/$slug.tsx'), 'utf-8');
    expect(content).toContain('prose-p:leading-[1.75]');
  });

  it('article: max reading width is between 720px and 800px', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/vseo-pilot/blog/$slug.tsx'), 'utf-8');
    expect(content).toContain('max-w-[800px]');
  });

  it('blog: hero must contain "Blog VEJAMAIS ERP"', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/vseo-pilot/blog/index.tsx'), 'utf-8');
    expect(content).toContain('Blog VEJAMAIS ERP');
  });

  it('blog: must have search and category filters', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/vseo-pilot/blog/index.tsx'), 'utf-8');
    expect(content).toContain('Search');
    expect(content).toContain('activeCategory');
  });

  it('isolation: 0 supabase imports in vseo-pilot folder', () => {
     const files = [
         'src/routes/vseo-pilot/route.tsx',
         'src/routes/vseo-pilot/index.tsx',
         'src/routes/vseo-pilot/blog/index.tsx',
         'src/routes/vseo-pilot/blog/$slug.tsx'
     ];
     files.forEach(f => {
         const content = fs.readFileSync(path.resolve(process.cwd(), f), 'utf-8');
         expect(content).not.toContain('@supabase');
         expect(content).not.toContain('supabase');
     });
  });
  
  it('robots: remains noindex, nofollow, noarchive, nosnippet', () => {
    const content = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/vseo-pilot/route.tsx'), 'utf-8');
    expect(content).toContain('noindex, nofollow, noarchive, nosnippet');
  });
});
