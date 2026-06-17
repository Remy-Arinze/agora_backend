import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type SkillCategory = 'behavior' | 'knowledge' | 'tone' | 'workflow';
export type SkillTargetRole = 'TEACHER' | 'SCHOOL_ADMIN' | 'STUDENT' | 'ALL';

export interface CreateSkillDto {
  name: string;
  description: string;
  content: string;
  targetRoles?: string; // e.g. "TEACHER,STUDENT" or "ALL"
  category?: SkillCategory;
  isActive?: boolean;
  priority?: number;
  internalNotes?: string | null;
}

export interface UpdateSkillDto extends Partial<CreateSkillDto> {}

const VALID_ROLES: SkillTargetRole[] = ['TEACHER', 'SCHOOL_ADMIN', 'STUDENT', 'ALL'];
const VALID_CATEGORIES: SkillCategory[] = ['behavior', 'knowledge', 'tone', 'workflow'];

const LIMITS = {
  name: 100,
  description: 300,
  content: 5000,
  internalNotes: 2000,
};

/**
 * Manages DB-stored Lois skills.
 *
 * Skills are named blocks of instructions injected into the system prompt
 * at runtime for users matching targetRoles. Super admins craft them
 * in the dashboard — no code deployment required.
 */
@Injectable()
export class LoisSkillsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Query ──────────────────────────────────────────────────────────────────

  async listAll() {
    return (this.prisma as any).loisSkill.findMany({
      orderBy: [{ isActive: 'desc' }, { priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getById(id: string) {
    const skill = await (this.prisma as any).loisSkill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException(`Skill ${id} not found`);
    return skill;
  }

  /**
   * Returns active skills for a given user role, sorted by priority.
   * Used by AiChatPromptService at prompt-assembly time.
   */
  async getActiveForRole(role: string): Promise<{ name: string; content: string; category: string }[]> {
    const all = await (this.prisma as any).loisSkill.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
      select: { name: true, content: true, category: true, targetRoles: true },
    });

    return all.filter((s: any) => {
      const targets = s.targetRoles.split(',').map((r: string) => r.trim().toUpperCase());
      return targets.includes('ALL') || targets.includes(role.toUpperCase());
    });
  }

  // ── Mutation ───────────────────────────────────────────────────────────────

  async create(dto: CreateSkillDto) {
    this.validate(dto as UpdateSkillDto, true);
    return (this.prisma as any).loisSkill.create({
      data: {
        name: dto.name.trim(),
        description: dto.description.trim(),
        content: dto.content.trim(),
        targetRoles: this.normalizeRoles(dto.targetRoles ?? 'ALL'),
        category: dto.category ?? 'behavior',
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? 100,
        internalNotes: dto.internalNotes?.trim() || null,
      },
    });
  }

  async update(id: string, dto: UpdateSkillDto) {
    await this.getById(id); // throws 404 if not found
    this.validate(dto, false);

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.content !== undefined) data.content = dto.content.trim();
    if (dto.targetRoles !== undefined) data.targetRoles = this.normalizeRoles(dto.targetRoles);
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.internalNotes !== undefined) data.internalNotes = dto.internalNotes?.trim() || null;

    return (this.prisma as any).loisSkill.update({ where: { id }, data });
  }

  async toggleActive(id: string): Promise<any> {
    const skill = await this.getById(id);
    return (this.prisma as any).loisSkill.update({
      where: { id },
      data: { isActive: !skill.isActive },
    });
  }

  async reorder(id: string, priority: number) {
    await this.getById(id);
    if (typeof priority !== 'number' || priority < 0) {
      throw new BadRequestException('Priority must be a non-negative integer');
    }
    return (this.prisma as any).loisSkill.update({ where: { id }, data: { priority } });
  }

  async delete(id: string) {
    await this.getById(id);
    return (this.prisma as any).loisSkill.delete({ where: { id } });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private validate(dto: UpdateSkillDto, isCreate: boolean) {
    if (isCreate) {
      if (!dto.name?.trim()) throw new BadRequestException('name is required');
      if (!dto.description?.trim()) throw new BadRequestException('description is required');
      if (!dto.content?.trim()) throw new BadRequestException('content is required');
    }

    if (dto.name && dto.name.length > LIMITS.name)
      throw new BadRequestException(`name must be ≤ ${LIMITS.name} characters`);
    if (dto.description && dto.description.length > LIMITS.description)
      throw new BadRequestException(`description must be ≤ ${LIMITS.description} characters`);
    if (dto.content && dto.content.length > LIMITS.content)
      throw new BadRequestException(`content must be ≤ ${LIMITS.content} characters`);
    if (dto.internalNotes && dto.internalNotes.length > LIMITS.internalNotes)
      throw new BadRequestException(`internalNotes must be ≤ ${LIMITS.internalNotes} characters`);

    if (dto.category && !VALID_CATEGORIES.includes(dto.category))
      throw new BadRequestException(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);

    if (dto.targetRoles) {
      const roles = dto.targetRoles.split(',').map((r) => r.trim().toUpperCase());
      for (const r of roles) {
        if (!VALID_ROLES.includes(r as SkillTargetRole))
          throw new BadRequestException(`Invalid role "${r}". Must be one of: ${VALID_ROLES.join(', ')}`);
      }
    }
  }

  private normalizeRoles(raw: string): string {
    return raw
      .split(',')
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean)
      .join(',');
  }
}
