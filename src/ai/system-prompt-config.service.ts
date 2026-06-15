import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface SystemPromptConfigDto {
  identityOverride?: string | null;
  additionalRules?: string | null;
  teacherRulesOverride?: string | null;
  adminRulesOverride?: string | null;
  studentRulesOverride?: string | null;
  internalNotes?: string | null;
}

const MAX_LENGTHS: Record<keyof SystemPromptConfigDto, number> = {
  identityOverride: 3000,
  additionalRules: 3000,
  teacherRulesOverride: 2000,
  adminRulesOverride: 2000,
  studentRulesOverride: 2000,
  internalNotes: 2000,
};

/**
 * Manages the singleton global SystemPromptConfig row.
 * Super admins can override sections of the Lois system prompt without
 * touching TypeScript. Structural runtime context (SQL schema, tool routing,
 * RAG) remains code-only.
 */
@Injectable()
export class SystemPromptConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SystemPromptConfigDto & { updatedAt?: Date; createdAt?: Date } | null> {
    return (this.prisma as any).systemPromptConfig.findUnique({ where: { id: 'global' } }).catch(() => null);
  }

  async upsert(dto: SystemPromptConfigDto): Promise<any> {
    this.validate(dto);
    const sanitized = this.sanitize(dto);
    return (this.prisma as any).systemPromptConfig.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...sanitized },
      update: sanitized,
    });
  }

  async delete(): Promise<void> {
    await (this.prisma as any).systemPromptConfig
      .delete({ where: { id: 'global' } })
      .catch(() => null); // no-op if not exists
  }

  private validate(dto: SystemPromptConfigDto) {
    for (const [key, max] of Object.entries(MAX_LENGTHS) as [keyof SystemPromptConfigDto, number][]) {
      const val = dto[key];
      if (val && val.length > max) {
        throw new BadRequestException(`${key} must be ${max} characters or fewer (received ${val.length})`);
      }
    }
  }

  private sanitize(dto: SystemPromptConfigDto): SystemPromptConfigDto {
    const strip = (s?: string | null) => (s ? s.replace(/<script[^>]*>.*?<\/script>/gi, '').trim() || null : null);
    return {
      identityOverride: strip(dto.identityOverride),
      additionalRules: strip(dto.additionalRules),
      teacherRulesOverride: strip(dto.teacherRulesOverride),
      adminRulesOverride: strip(dto.adminRulesOverride),
      studentRulesOverride: strip(dto.studentRulesOverride),
      internalNotes: strip(dto.internalNotes),
    };
  }
}
