import { normalizeSlug, suggestSlugFromName, validateSlugFormat, extractSubdomain, isApexHost } from './slug.util';

describe('slug.util', () => {
  it('normalizes school names', () => {
    expect(suggestSlugFromName('Lagos Model College')).toBe('lagos-model-college');
    expect(normalizeSlug('  Kings College!!! ')).toBe('kings-college');
  });

  it('rejects reserved and short slugs', () => {
    expect(validateSlugFormat('www')).toBe('reserved');
    expect(validateSlugFormat('dev')).toBe('reserved');
    expect(validateSlugFormat('ab')).toBe('invalid');
    expect(validateSlugFormat('lagos-model')).toBeNull();
  });

  it('extracts subdomain from production, staging, and localhost hosts', () => {
    const roots = ['myschoolbud.com', 'dev.myschoolbud.com'];
    expect(extractSubdomain('beulah.myschoolbud.com', roots)).toBe('beulah');
    expect(extractSubdomain('www.myschoolbud.com', roots)).toBeNull();
    expect(extractSubdomain('dev.myschoolbud.com', roots)).toBeNull();
    expect(extractSubdomain('www.dev.myschoolbud.com', roots)).toBeNull();
    expect(extractSubdomain('beulah.dev.myschoolbud.com', roots)).toBe('beulah');
    expect(extractSubdomain('beulah.localhost:3000', roots)).toBe('beulah');
    expect(extractSubdomain('localhost:3000', roots)).toBeNull();
    expect(isApexHost('dev.myschoolbud.com', roots)).toBe(true);
    expect(isApexHost('beulah.dev.myschoolbud.com', roots)).toBe(false);
  });
});
