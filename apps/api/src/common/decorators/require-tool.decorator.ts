import { SetMetadata } from '@nestjs/common';

export const TOOL_KEY = 'requiredTool';

/**
 * Decorator to require access to a specific tool
 * Use this to protect routes that require tool access
 * 
 * @param toolSlug The tool slug (e.g., 'prepmaster', 'socrates', 'rollcall', 'bursary')
 * 
 * @example
 * ```typescript
 * @RequireTool('socrates')
 * @Get('lesson-plans')
 * async getLessonPlans() { ... }
 * ```
 */
export const RequireTool = (toolSlug: string) => SetMetadata(TOOL_KEY, toolSlug);
















