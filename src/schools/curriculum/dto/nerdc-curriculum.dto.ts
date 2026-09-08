import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, IsNotEmpty } from 'class-validator';

/**
 * Agora Subject DTOs
 */

export class AgoraSubjectDto {
  @ApiProperty({ example: 'clx1234567890', description: 'Agora Subject ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ example: 'Mathematics', description: 'Subject name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'MTH', description: 'Subject code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({
    example: 'CORE',
    description: 'Subject category (CORE, ELECTIVE, VOCATIONAL)',
  })
  @IsOptional()
  @IsString()
  category: string | null;

  @ApiProperty({ example: ['PRIMARY', 'SECONDARY'], description: 'Applicable school types' })
  @IsString({ each: true })
  schoolTypes: string[];

  @ApiPropertyOptional({ example: ['JUNIOR', 'SENIOR'], description: 'PRIMARY, JUNIOR (JSS), SENIOR (SS)' })
  @IsOptional()
  @IsString({ each: true })
  levelStreams?: string[];

  @ApiPropertyOptional({ description: 'Subject description' })
  @IsOptional()
  @IsString()
  description: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;
}

/**
 * Agora Curriculum Template Week DTOs
 */

export class AgoraCurriculumTemplateWeekDto {
  @ApiProperty({ example: 'clx1234567890' })
  @IsString()
  id: string;

  @ApiProperty({ example: 1, description: 'Week number (1-13)' })
  @IsNumber()
  weekNumber: number;

  @ApiProperty({ example: 'Number Systems', description: 'Main topic' })
  @IsString()
  topic: string;

  @ApiProperty({ example: ['Place Value', 'Number Line'], description: 'Sub-topics' })
  @IsString({ each: true })
  subTopics: string[];

  @ApiProperty({
    example: ['Understand place value up to millions'],
    description: 'Learning objectives',
  })
  @IsString({ each: true })
  objectives: string[];

  @ApiProperty({ example: ['Group work', 'Number puzzles'], description: 'Suggested activities' })
  @IsString({ each: true })
  activities: string[];

  @ApiProperty({
    example: ['Textbook Chapter 1', 'Number cards'],
    description: 'Required resources',
  })
  @IsString({ each: true })
  resources: string[];

  @ApiPropertyOptional({ example: 'Written test', description: 'Assessment method' })
  @IsOptional()
  @IsString()
  assessment: string | null;

  @ApiPropertyOptional({ example: '5 periods of 40 minutes', description: 'Duration' })
  @IsOptional()
  @IsString()
  duration: string | null;
}

/**
 * Agora Curriculum Template DTOs
 */

export class AgoraCurriculumTemplateDto {
  @ApiProperty({ example: 'clx1234567890' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'PRIMARY_1', description: 'Class level code' })
  @IsString()
  classLevel: string;

  @ApiProperty({ example: 1, description: 'Term number (1, 2, or 3)' })
  @IsNumber()
  term: number;

  @ApiPropertyOptional({ description: 'Curriculum description' })
  @IsOptional()
  @IsString()
  description: string | null;

  @ApiProperty({ type: AgoraSubjectDto, description: 'Subject information' })
  subject: AgoraSubjectDto;

  @ApiProperty({ type: [AgoraCurriculumTemplateWeekDto], description: 'Weekly curriculum content' })
  weeks: AgoraCurriculumTemplateWeekDto[];
}

/**
 * Subject Selection / Query DTOs
 */

export class GetAgoraSubjectsQueryDto {
  @ApiPropertyOptional({ example: 'PRIMARY', description: 'Filter by school type' })
  @IsOptional()
  @IsString()
  schoolType?: string;

  @ApiPropertyOptional({ example: 'CORE', description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class GetAgoraCurriculumTemplateQueryDto {
  @ApiProperty({ example: 'MTH', description: 'Subject code' })
  @IsString()
  @IsNotEmpty()
  subjectCode: string;

  @ApiProperty({ example: 'PRIMARY_1', description: 'Class level code' })
  @IsString()
  @IsNotEmpty()
  classLevel: string;

  @ApiProperty({ example: 1, description: 'Term number (1, 2, or 3)' })
  @IsNumber()
  term: number;
}

// ============================================
// Class Level Mapping
// ============================================

export const CLASS_LEVEL_MAPPING: Record<string, { name: string; schoolType: string }> = {
  // Primary School (1-6)
  PRIMARY_1: { name: 'Primary 1', schoolType: 'PRIMARY' },
  PRIMARY_2: { name: 'Primary 2', schoolType: 'PRIMARY' },
  PRIMARY_3: { name: 'Primary 3', schoolType: 'PRIMARY' },
  PRIMARY_4: { name: 'Primary 4', schoolType: 'PRIMARY' },
  PRIMARY_5: { name: 'Primary 5', schoolType: 'PRIMARY' },
  PRIMARY_6: { name: 'Primary 6', schoolType: 'PRIMARY' },

  // Junior Secondary (JSS 1-3)
  JSS_1: { name: 'JSS 1', schoolType: 'SECONDARY' },
  JSS_2: { name: 'JSS 2', schoolType: 'SECONDARY' },
  JSS_3: { name: 'JSS 3', schoolType: 'SECONDARY' },

  // Senior Secondary (SS 1-3)
  SS_1: { name: 'SS 1', schoolType: 'SECONDARY' },
  SS_2: { name: 'SS 2', schoolType: 'SECONDARY' },
  SS_3: { name: 'SS 3', schoolType: 'SECONDARY' },
};

function compactGradeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Super-admin UI labels like "Pry 1" compact to pry1, not primary1. */
const GRADE_COMPACT_ALIASES: Record<string, string> = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((n) => [`pry${n}`, `PRIMARY_${n}`]),
);

/**
 * Resolve a class name or stored grade key to the canonical code (PRIMARY_1, JSS_1, …).
 * Accepts "Primary 1", "Primary_1", "PRIMARY_1", and "Pry 1".
 */
export function resolveClassLevelCode(gradeLevel: string, schoolType?: string): string | null {
  const trimmed = gradeLevel?.trim();
  if (!trimmed) return null;

  const compact = compactGradeToken(trimmed);

  const matchCode = (code: string | undefined) => {
    if (!code) return null;
    const mapping = CLASS_LEVEL_MAPPING[code];
    if (!mapping) return null;
    if (schoolType && mapping.schoolType !== schoolType) return null;
    return code;
  };

  const byCode = Object.keys(CLASS_LEVEL_MAPPING).find((code) => compactGradeToken(code) === compact);
  const fromCode = matchCode(byCode);
  if (fromCode) return fromCode;

  for (const [code, mapping] of Object.entries(CLASS_LEVEL_MAPPING)) {
    if (compactGradeToken(mapping.name) === compact) {
      const fromName = matchCode(code);
      if (fromName) return fromName;
    }
  }

  return matchCode(GRADE_COMPACT_ALIASES[compact]);
}

// Reverse mapping: from class level name to code
export function getClassLevelCode(name: string, schoolType: string): string | null {
  return resolveClassLevelCode(name, schoolType);
}

/**
 * Grade keys a school-admin library lookup should accept for one class level.
 * Super-admin packs store PRIMARY_1; class names become Primary_1; E2E seed uses Primary_1.
 */
export function agoraGradeLevelCandidates(gradeLevel: string): string[] {
  const trimmed = gradeLevel?.trim();
  if (!trimmed) return [];

  const underscored = trimmed.replace(/\s+/g, '_');
  const candidates = new Set<string>([trimmed, underscored, underscored.toUpperCase()]);

  const code = resolveClassLevelCode(trimmed);
  if (code) {
    const mapping = CLASS_LEVEL_MAPPING[code];
    candidates.add(code);
    candidates.add(mapping.name);
    candidates.add(mapping.name.replace(/\s+/g, '_'));
  }

  return [...candidates];
}
