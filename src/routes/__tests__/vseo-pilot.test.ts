import { describe, it, expect } from 'vitest';
import { MOCK_ARTICLES } from '../features/vseo-pilot/mockArticles';

describe('VSEO Pilot Lab Mocks', () => {
  it('dashboard should contain exactly three articles', () => {
    expect(MOCK_ARTICLES.length).toBe(3);
  });

  it('all article slugs must be unique', () => {
    const slugs = MOCK_ARTICLES.map(a => a.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it('all meta titles must be present and unique', () => {
    const titles = MOCK_ARTICLES.map(a => a.metaTitle);
    titles.forEach(t => expect(t.length).toBeGreaterThan(0));
    const uniqueTitles = new Set(titles);
    expect(uniqueTitles.size).toBe(titles.length);
  });

  it('all meta descriptions must be present and unique', () => {
    const descs = MOCK_ARTICLES.map(a => a.metaDescription);
    descs.forEach(d => expect(d.length).toBeGreaterThan(0));
    const uniqueDescs = new Set(descs);
    expect(uniqueDescs.size).toBe(descs.length);
  });

  it('all articles should have a focus keyword', () => {
    MOCK_ARTICLES.forEach(article => {
      expect(article.focusKeyword).toBeDefined();
      expect(article.focusKeyword.length).toBeGreaterThan(0);
    });
  });

  it('author should be correctly identified as pilot', () => {
    MOCK_ARTICLES.forEach(article => {
      expect(article.author).toBe('Equipe Editorial VEJAMAIS — Conteúdo Piloto');
    });
  });

  it('status should be draft by default in this mock phase', () => {
    MOCK_ARTICLES.forEach(article => {
      expect(article.status).toBe('draft');
    });
  });
});
