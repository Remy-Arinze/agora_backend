import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import {
  normalizeSlug,
  suggestSlugFromName,
  validateSlugFormat,
  extractSubdomain,
  isApexHost,
  DEFAULT_PORTAL_ROOTS,
  sortRootsLongestFirst,
  type SlugUnavailableReason,
} from './slug.util';

export interface PortalBrandingDto {
  schoolId: string;
  name: string;
  slug: string;
  logo: string | null;
  accentColor: string | null;
  faviconUrl: string | null;
  loginTagline: string | null;
  hidePlatformMark: boolean;
  customDomain: string | null;
  portalUrl: string;
}

export interface SlugAvailability {
  available: boolean;
  slug: string;
  reason?: SlugUnavailableReason;
}

const SLUG_HOLD_MS = 30 * 24 * 60 * 60 * 1000;
const TRANSFER_TTL_MS = 60 * 1000;

@Injectable()
export class PortalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  rootDomains(): string[] {
    const extra = (this.config.get<string>('PORTAL_ROOT_DOMAINS') || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return sortRootsLongestFirst([...DEFAULT_PORTAL_ROOTS, ...extra]);
  }

  getApexFrontendUrl(): string {
    const explicit = this.config.get<string>('FRONTEND_URL');
    if (explicit) return explicit.replace(/\/+$/, '');
    const nodeEnv = this.config.get<string>('NODE_ENV') || 'development';
    return nodeEnv === 'production' ? 'https://myschoolbud.com' : 'http://localhost:3000';
  }

  async getSchoolFrontendUrl(schoolId?: string | null): Promise<string> {
    if (!schoolId) return this.getApexFrontendUrl();
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        slug: true,
        customDomain: true,
        customDomainStatus: true,
        isActive: true,
        registrationStatus: true,
      },
    });
    if (!school) return this.getApexFrontendUrl();
    return this.buildPortalUrl(school);
  }

  buildPortalUrl(school: {
    slug?: string | null;
    customDomain?: string | null;
    customDomainStatus?: string | null;
  }): string {
    if (school.customDomain && school.customDomainStatus === 'ACTIVE') {
      return `https://${school.customDomain.replace(/\/+$/, '')}`;
    }
    if (!school.slug) return this.getApexFrontendUrl();
    const apex = this.getApexFrontendUrl();
    try {
      const url = new URL(apex);
      const isLocal =
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname.endsWith('.localhost');
      if (isLocal) {
        return `${url.protocol}//${school.slug}.localhost${url.port ? `:${url.port}` : ''}`;
      }
      const host = url.hostname.replace(/^www\./, '');
      return `${url.protocol}//${school.slug}.${host}`;
    } catch {
      return this.getApexFrontendUrl();
    }
  }

  async checkSlugAvailable(raw: string, exceptSchoolId?: string): Promise<SlugAvailability> {
    const slug = normalizeSlug(raw);
    const formatReason = validateSlugFormat(slug);
    if (formatReason) {
      return { available: false, slug, reason: formatReason };
    }

    await this.releaseExpiredHolds(slug);

    const existing = await this.prisma.school.findUnique({
      where: { slug },
      select: { id: true, registrationStatus: true, slugHoldUntil: true },
    });
    if (existing && existing.id !== exceptSchoolId) {
      return { available: false, slug, reason: 'taken' };
    }

    const redirect = await this.prisma.schoolSlugRedirect.findUnique({
      where: { fromSlug: slug },
      select: { schoolId: true },
    });
    if (redirect && redirect.schoolId !== exceptSchoolId) {
      return { available: false, slug, reason: 'reserved' };
    }

    return { available: true, slug };
  }

  async reserveSlug(raw: string, exceptSchoolId?: string): Promise<string> {
    const check = await this.checkSlugAvailable(raw, exceptSchoolId);
    if (!check.available) {
      if (check.reason === 'invalid' || check.reason === 'reserved') {
        throw new BadRequestException('This portal address is not available.');
      }
      throw new ConflictException('This portal address is already taken.');
    }
    return check.slug;
  }

  async assignSlugFromName(name: string, exceptSchoolId?: string): Promise<string> {
    const base = suggestSlugFromName(name) || 'school';
    const candidate = validateSlugFormat(base) ? `${base}-school`.slice(0, 32) : base;
    const first = await this.checkSlugAvailable(candidate, exceptSchoolId);
    if (first.available) return first.slug;

    for (let i = 2; i < 50; i++) {
      const next = `${candidate.slice(0, 28)}-${i}`.replace(/-+/g, '-').replace(/-$/, '');
      const check = await this.checkSlugAvailable(next, exceptSchoolId);
      if (check.available) return check.slug;
    }
    throw new ConflictException('Could not allocate a unique portal address. Please choose one.');
  }

  async ensureSlug(schoolId: string, preferred?: string | null): Promise<string> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, slug: true },
    });
    if (!school) throw new NotFoundException('School not found');
    if (school.slug) return school.slug;

    const slug = preferred
      ? await this.reserveSlug(preferred, schoolId)
      : await this.assignSlugFromName(school.name, schoolId);

    await this.prisma.school.update({
      where: { id: schoolId },
      data: { slug },
    });
    return slug;
  }

  async lockSlug(schoolId: string): Promise<void> {
    await this.prisma.school.update({
      where: { id: schoolId },
      data: { slugLockedAt: new Date(), slugHoldUntil: null },
    });
  }

  async holdSlugOnReject(schoolId: string): Promise<void> {
    await this.prisma.school.update({
      where: { id: schoolId },
      data: { slugHoldUntil: new Date(Date.now() + SLUG_HOLD_MS) },
    });
  }

  async renameSlug(schoolId: string, raw: string): Promise<string> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, slug: true },
    });
    if (!school) throw new NotFoundException('School not found');
    const next = await this.reserveSlug(raw, schoolId);
    if (school.slug && school.slug !== next) {
      await this.prisma.schoolSlugRedirect.upsert({
        where: { fromSlug: school.slug },
        create: { fromSlug: school.slug, schoolId },
        update: { schoolId },
      });
    }
    await this.prisma.school.update({
      where: { id: schoolId },
      data: { slug: next, slugLockedAt: new Date(), slugHoldUntil: null },
    });
    return next;
  }

  async resolveByHost(host: string): Promise<PortalBrandingDto | null> {
    const cleanHost = host.split(':')[0].toLowerCase().replace(/\.$/, '');
    if (!cleanHost) return null;

    if (isApexHost(cleanHost, this.rootDomains())) {
      return null;
    }

    const custom = await this.prisma.school.findFirst({
      where: {
        customDomain: cleanHost,
        customDomainStatus: 'ACTIVE',
        isActive: true,
        registrationStatus: 'VERIFIED',
      },
      include: { branding: true },
    });
    if (custom?.slug) return this.toBrandingDto(custom);

    const slug = extractSubdomain(cleanHost, this.rootDomains());
    if (slug) {
      const live = await this.findLiveBySlug(slug);
      if (live) return this.toBrandingDto(live);

      const redirect = await this.prisma.schoolSlugRedirect.findUnique({
        where: { fromSlug: slug },
      });
      if (redirect) {
        const target = await this.findLiveById(redirect.schoolId);
        if (target) return this.toBrandingDto(target);
      }
    }

    return null;
  }

  async findLiveBySlug(slug: string) {
    return this.prisma.school.findFirst({
      where: {
        slug,
        isActive: true,
        registrationStatus: 'VERIFIED',
      },
      include: { branding: true },
    });
  }

  async findLiveById(id: string) {
    return this.prisma.school.findFirst({
      where: {
        id,
        isActive: true,
        registrationStatus: 'VERIFIED',
      },
      include: { branding: true },
    });
  }

  toBrandingDto(school: {
    id: string;
    name: string;
    slug: string | null;
    logo: string | null;
    customDomain: string | null;
    customDomainStatus: string | null;
    branding: {
      accentColor: string | null;
      faviconUrl: string | null;
      loginTagline: string | null;
      hidePlatformMark: boolean;
    } | null;
  }): PortalBrandingDto {
    const slug = school.slug || '';
    return {
      schoolId: school.id,
      name: school.name,
      slug,
      logo: school.logo,
      accentColor: school.branding?.accentColor ?? null,
      faviconUrl: school.branding?.faviconUrl ?? null,
      loginTagline: school.branding?.loginTagline ?? null,
      hidePlatformMark: school.branding?.hidePlatformMark ?? false,
      customDomain:
        school.customDomainStatus === 'ACTIVE' ? school.customDomain : null,
      portalUrl: this.buildPortalUrl(school),
    };
  }

  async createTransferCode(
    userId: string,
    schoolId: string,
    userAgent?: string,
  ): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const codeHash = createHash('sha256').update(raw).digest('hex');
    await this.prisma.portalTransferCode.create({
      data: {
        codeHash,
        userId,
        schoolId,
        expiresAt: new Date(Date.now() + TRANSFER_TTL_MS),
        userAgentHash: userAgent
          ? createHash('sha256').update(userAgent).digest('hex')
          : null,
      },
    });
    return raw;
  }

  async consumeTransferCode(raw: string, userAgent?: string) {
    const codeHash = createHash('sha256').update(raw).digest('hex');
    const row = await this.prisma.portalTransferCode.findUnique({
      where: { codeHash },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('This sign-in link has expired. Please log in again.');
    }
    if (row.userAgentHash && userAgent) {
      const incoming = createHash('sha256').update(userAgent).digest('hex');
      if (incoming !== row.userAgentHash) {
        throw new BadRequestException('This sign-in link has expired. Please log in again.');
      }
    }
    await this.prisma.portalTransferCode.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return { userId: row.userId, schoolId: row.schoolId };
  }

  private async releaseExpiredHolds(slug: string): Promise<void> {
    await this.prisma.school.updateMany({
      where: {
        slug,
        registrationStatus: 'REJECTED',
        slugHoldUntil: { lt: new Date() },
      },
      data: { slug: null, slugHoldUntil: null },
    });
  }
}
