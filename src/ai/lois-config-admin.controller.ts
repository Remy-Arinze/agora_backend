import { Controller, Get, Put, Post, Delete, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { LoisConfigService } from './lois-config.service';
import { AiChatPromptService } from './ai-chat-prompt.service';
import { SystemPromptConfigService, SystemPromptConfigDto } from './system-prompt-config.service';
import { LoisSkillsService, CreateSkillDto, UpdateSkillDto } from './lois-skills.service';
import { AGORA_TOOLS } from './agora-chat-tools.definition';

/**
 * Super Admin only — global Lois system prompt config, tools registry, and per-school overrides.
 */
@ApiTags('Lois Config (Super Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Throttle({ standard: {} })
@Controller('admin/lois')
export class LoisConfigAdminController {
  constructor(
    private readonly loisConfigService: LoisConfigService,
    private readonly chatPrompt: AiChatPromptService,
    private readonly systemPromptConfig: SystemPromptConfigService,
    private readonly loisSkills: LoisSkillsService,
  ) {}

  // ── Global system prompt config ───────────────────────────────────────────

  /** Get the current global system prompt overrides (null fields = using hardcoded defaults) */
  @Get('system-config')
  @ApiOperation({ summary: 'Get global Lois system prompt configuration' })
  async getSystemConfig() {
    const config = await this.systemPromptConfig.get();
    return { success: true, data: config ?? null };
  }

  /** Save global system prompt overrides */
  @Put('system-config')
  @ApiOperation({ summary: 'Save global Lois system prompt configuration' })
  async upsertSystemConfig(@Body() body: SystemPromptConfigDto) {
    const config = await this.systemPromptConfig.upsert(body);
    return { success: true, data: config };
  }

  /** Reset all overrides back to hardcoded defaults */
  @Delete('system-config')
  @ApiOperation({ summary: 'Reset global system config to hardcoded defaults' })
  async resetSystemConfig() {
    await this.systemPromptConfig.delete();
    return { success: true, message: 'System prompt config reset to platform defaults.' };
  }

  /** Read the live rendered system prompt (what Lois is actually running on right now) */
  @Get('system-prompt-preview')
  @ApiOperation({ summary: 'Preview the live Lois system prompt (rendered, read-only)' })
  async previewSystemPrompt() {
    const { systemPrompt } = await this.chatPrompt.getChatPrompt(
      [{ role: 'user', content: 'Hello' }],
      undefined,
      undefined,
    );
    return {
      success: true,
      data: {
        prompt: systemPrompt,
        note: 'This is the live rendered prompt. Dynamic context (school name, teacher assignments, RAG results) is injected at runtime per user session.',
      },
    };
  }

  /** List all registered Lois tools/skills */
  @Get('tools')
  @ApiOperation({ summary: 'List all Lois agent tools' })
  async listTools() {
    const tools = AGORA_TOOLS.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }));
    return { success: true, data: tools };
  }

  // ── Per-school config ─────────────────────────────────────────────────────

  /** List all schools that have customised their Lois config */
  @Get('configs')
  @ApiOperation({ summary: 'List all school Lois configs' })
  async listAll() {
    const configs = await this.loisConfigService.listAll();
    return { success: true, data: configs };
  }

  /** Get a specific school's config */
  @Get('configs/:schoolId')
  @ApiOperation({ summary: 'Get Lois config for a specific school' })
  async getForSchool(@Param('schoolId') schoolId: string) {
    const config = await this.loisConfigService.getForSchool(schoolId);
    return { success: true, data: config ?? null };
  }

  /** Super admin sets a school's Lois config */
  @Put('configs/:schoolId')
  @ApiOperation({ summary: 'Set Lois config for a specific school' })
  async upsertForSchool(
    @Param('schoolId') schoolId: string,
    @Body() body: { customGreeting?: string; toneNote?: string; restrictedTopics?: string; schoolContext?: string },
  ) {
    const config = await this.loisConfigService.upsertForSchool(schoolId, body);
    return { success: true, data: config };
  }

  /** Super admin resets a school's config back to platform defaults */
  @Delete('configs/:schoolId')
  @ApiOperation({ summary: 'Reset Lois config for a specific school to defaults' })
  async deleteForSchool(@Param('schoolId') schoolId: string) {
    await this.loisConfigService.deleteForSchool(schoolId);
    return { success: true, message: 'Config reset to platform defaults.' };
  }

  // ── Skills ────────────────────────────────────────────────────────────────

  @Get('skills')
  @ApiOperation({ summary: 'List all Lois skills' })
  async listSkills() {
    const skills = await this.loisSkills.listAll();
    return { success: true, data: skills };
  }

  @Post('skills')
  @ApiOperation({ summary: 'Create a new Lois skill' })
  async createSkill(@Body() body: CreateSkillDto) {
    const skill = await this.loisSkills.create(body);
    return { success: true, data: skill };
  }

  @Put('skills/:id')
  @ApiOperation({ summary: 'Update a Lois skill' })
  async updateSkill(@Param('id') id: string, @Body() body: UpdateSkillDto) {
    const skill = await this.loisSkills.update(id, body);
    return { success: true, data: skill };
  }

  @Patch('skills/:id/toggle')
  @ApiOperation({ summary: 'Toggle a skill active/inactive' })
  async toggleSkill(@Param('id') id: string) {
    const skill = await this.loisSkills.toggleActive(id);
    return { success: true, data: skill };
  }

  @Patch('skills/:id/priority')
  @ApiOperation({ summary: 'Update a skill priority' })
  async reorderSkill(@Param('id') id: string, @Body() body: { priority: number }) {
    const skill = await this.loisSkills.reorder(id, body.priority);
    return { success: true, data: skill };
  }

  @Delete('skills/:id')
  @ApiOperation({ summary: 'Delete a Lois skill' })
  async deleteSkill(@Param('id') id: string) {
    await this.loisSkills.delete(id);
    return { success: true, message: 'Skill deleted.' };
  }
}
