export const RESERVED_SLUGS = new Set([
  'www',
  'www2',
  'app',
  'api',
  'admin',
  'auth',
  'mail',
  'status',
  'help',
  'docs',
  'staging',
  'dev',
  'cdn',
  'static',
  'public',
  'assets',
  'login',
  'register',
  'super-admin',
  'superadmin',
]);

export const DEFAULT_PORTAL_ROOTS = ['dev.myschoolbud.com', 'myschoolbud.com'];

export function sortRootsLongestFirst(roots: string[]): string[] {
  return Array.from(new Set(roots.map((r) => r.trim().toLowerCase()).filter(Boolean))).sort(
    (a, b) => b.length - a.length,
  );
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export type SlugUnavailableReason = 'taken' | 'reserved' | 'invalid';

export function normalizeSlug(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function suggestSlugFromName(name: string): string {
  return normalizeSlug(name);
}

export function validateSlugFormat(slug: string): SlugUnavailableReason | null {
  if (!slug || slug.length < 3 || slug.length > 32 || !SLUG_RE.test(slug)) {
    return 'invalid';
  }
  if (RESERVED_SLUGS.has(slug)) {
    return 'reserved';
  }
  return null;
}

export function extractSubdomain(host: string, rootDomains: string[]): string | null {
  const hostname = host.split(':')[0].toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.slice(0, -'.localhost'.length);
    return sub && !sub.includes('.') ? sub : null;
  }
  for (const root of sortRootsLongestFirst(rootDomains)) {
    const suffix = `.${root}`;
    if (hostname === root || hostname === `www.${root}`) {
      return null;
    }
    if (hostname.endsWith(suffix)) {
      const sub = hostname.slice(0, -suffix.length);
      if (sub && !sub.includes('.') && !RESERVED_SLUGS.has(sub)) {
        return sub;
      }
      return null;
    }
  }
  return null;
}

export function isApexHost(host: string, rootDomains: string[]): boolean {
  const hostname = host.split(':')[0].toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  return sortRootsLongestFirst(rootDomains).some((root) => hostname === root || hostname === `www.${root}`);
}
