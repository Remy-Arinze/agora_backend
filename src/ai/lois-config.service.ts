import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface UpsertLoisConfigDto {
  customGreeting?: string | null;
  toneNote?: string | null;
  restrictedTopics?: string | null;
  schoolContext?: string | null;
}

// Hard limits — prevents prompt injection and abuse
const MAX_LENGTHS = {
  customGreeting: 300,
  toneNote: 500,
  restrictedTopics: 500,
  schoolContext: 1000,
};

/**
 * Manages per-school and global Lois personality configuration.
 *
 * Security guarantees:
 *  - All free-text fields are stripped of HTML tags before storage
 *  - Hard character limits prevent oversized prompt injections
 *  - Structural rules (SQL schema, tool routing, role rules) are never
 *    stored here — they live in AiChatPromptService and are read-only
 *  - School admins can only read/write their own school's config
 *  - Super admin can read/write any school's config and a global default
 */
@Injectable()
export class LoisConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // ── School-scoped ─────────────────────────────────────────────────────────

  async getForSchool(schoolId: string) {
    return (this.prisma as any).loisConfig.findUnique({ where: { schoolId } });
  }

  async upsertForSchool(schoolId: string, dto: UpsertLoisConfigDto) {
    this.validateAndSanitize(dto);
    return (this.prisma as any).loisConfig.upsert({
      where: { schoolId },
      create: { schoolId, ...this.sanitize(dto) },
      update: this.sanitize(dto),
    });
  }

  async deleteForSchool(schoolId: string) {
    const existing = await (this.prisma as any).loisConfig.findUnique({ where: { schoolId } });
    if (!existing) return null;
    return (this.prisma as any).loisConfig.delete({ where: { schoolId } });
  }

  // ── Super admin — list all configs ────────────────────────────────────────

  async listAll() {
    return (this.prisma as any).loisConfig.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { school: { select: { id: true, name: true } } },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private validateAndSanitize(dto: UpsertLoisConfigDto) {
    for (const [key, max] of Object.entries(MAX_LENGTHS) as [keyof typeof MAX_LENGTHS, number][]) {
      const val = dto[key];
      if (val && val.length > max) {
        throw new BadRequestException(
          `${key} must be ${max} characters or fewer (received ${val.length})`,
        );
      }
    }
  }

  private sanitize(dto: UpsertLoisConfigDto): UpsertLoisConfigDto {
    const strip = (s?: string | null) =>
      s ? s.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim() || null : null;

    return {
      customGreeting: strip(dto.customGreeting),
      toneNote: strip(dto.toneNote),
      restrictedTopics: strip(dto.restrictedTopics),
      schoolContext: strip(dto.schoolContext),
    };
  }
}
