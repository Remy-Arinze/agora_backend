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

// Reverse mapping: from class level name to code
export function getClassLevelCode(name: string, schoolType: string): string | null {
  for (const [code, mapping] of Object.entries(CLASS_LEVEL_MAPPING)) {
    if (mapping.name.toLowerCase() === name.toLowerCase() && mapping.schoolType === schoolType) {
      return code;
    }
  }
  // Try partial match
  const normalized = name.toLowerCase().replace(/\s+/g, '');
  for (const [code, mapping] of Object.entries(CLASS_LEVEL_MAPPING)) {
    const mappingNormalized = mapping.name.toLowerCase().replace(/\s+/g, '');
    if (mappingNormalized === normalized && mapping.schoolType === schoolType) {
      return code;
    }
  }
  return null;
}
