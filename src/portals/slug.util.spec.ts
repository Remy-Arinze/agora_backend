import { normalizeSlug, suggestSlugFromName, validateSlugFormat, extractSubdomain } from './slug.util';

describe('slug.util', () => {
  it('normalizes school names', () => {
    expect(suggestSlugFromName('Lagos Model College')).toBe('lagos-model-college');
    expect(normalizeSlug('  Kings College!!! ')).toBe('kings-college');
  });

  it('rejects reserved and short slugs', () => {
    expect(validateSlugFormat('www')).toBe('reserved');
    expect(validateSlugFormat('ab')).toBe('invalid');
    expect(validateSlugFormat('lagos-model')).toBeNull();
  });

  it('extracts subdomain from production and localhost hosts', () => {
    expect(extractSubdomain('beulah.myschoolbud.com', ['myschoolbud.com'])).toBe('beulah');
    expect(extractSubdomain('www.myschoolbud.com', ['myschoolbud.com'])).toBeNull();
    expect(extractSubdomain('beulah.localhost:3000', ['myschoolbud.com'])).toBe('beulah');
    expect(extractSubdomain('localhost:3000', ['myschoolbud.com'])).toBeNull();
  });
});
