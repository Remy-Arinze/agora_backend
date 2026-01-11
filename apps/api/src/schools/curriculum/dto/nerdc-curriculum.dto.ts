import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================
// NERDC Subject DTOs
// ============================================

export class NerdcSubjectDto {
  @ApiProperty({ example: 'clx1234567890', description: 'NERDC Subject ID' })
  id: string;

  @ApiProperty({ example: 'Mathematics', description: 'Subject name' })
  name: string;

  @ApiProperty({ example: 'MTH', description: 'Subject code' })
  code: string;

  @ApiPropertyOptional({
    example: 'CORE',
    description: 'Subject category (CORE, ELECTIVE, VOCATIONAL)',
  })
  category: string | null;

  @ApiProperty({ example: ['PRIMARY', 'SECONDARY'], description: 'Applicable school types' })
  schoolTypes: string[];

  @ApiPropertyOptional({ description: 'Subject description' })
  description: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;
}

// ============================================
// NERDC Curriculum Week DTOs
// ============================================

export class NerdcCurriculumWeekDto {
  @ApiProperty({ example: 'clx1234567890' })
  id: string;

  @ApiProperty({ example: 1, description: 'Week number (1-13)' })
  weekNumber: number;

  @ApiProperty({ example: 'Number Systems', description: 'Main topic' })
  topic: string;

  @ApiProperty({ example: ['Place Value', 'Number Line'], description: 'Sub-topics' })
  subTopics: string[];

  @ApiProperty({
    example: ['Understand place value up to millions'],
    description: 'Learning objectives',
  })
  objectives: string[];

  @ApiProperty({ example: ['Group work', 'Number puzzles'], description: 'Suggested activities' })
  activities: string[];

  @ApiProperty({
    example: ['Textbook Chapter 1', 'Number cards'],
    description: 'Required resources',
  })
  resources: string[];

  @ApiPropertyOptional({ example: 'Written test', description: 'Assessment method' })
  assessment: string | null;

  @ApiPropertyOptional({ example: '5 periods of 40 minutes', description: 'Duration' })
  duration: string | null;
}

// ============================================
// NERDC Curriculum DTOs
// ============================================

export class NerdcCurriculumDto {
  @ApiProperty({ example: 'clx1234567890' })
  id: string;

  @ApiProperty({ example: 'PRIMARY_1', description: 'Class level code' })
  classLevel: string;

  @ApiProperty({ example: 1, description: 'Term number (1, 2, or 3)' })
  term: number;

  @ApiPropertyOptional({ description: 'Curriculum description' })
  description: string | null;

  @ApiProperty({ type: NerdcSubjectDto, description: 'Subject information' })
  subject: NerdcSubjectDto;

  @ApiProperty({ type: [NerdcCurriculumWeekDto], description: 'Weekly curriculum content' })
  weeks: NerdcCurriculumWeekDto[];
}

// ============================================
// NERDC Query DTOs
// ============================================

export class GetNerdcSubjectsQueryDto {
  @ApiPropertyOptional({ example: 'PRIMARY', description: 'Filter by school type' })
  schoolType?: string;

  @ApiPropertyOptional({ example: 'CORE', description: 'Filter by category' })
  category?: string;
}

export class GetNerdcCurriculumQueryDto {
  @ApiProperty({ example: 'MTH', description: 'Subject code' })
  subjectCode: string;

  @ApiProperty({ example: 'PRIMARY_1', description: 'Class level code' })
  classLevel: string;

  @ApiProperty({ example: 1, description: 'Term number (1, 2, or 3)' })
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
