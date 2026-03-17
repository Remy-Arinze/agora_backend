import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SessionType {
  NEW_SESSION = 'NEW_SESSION', // New academic session (September) - triggers promotion
  NEW_TERM = 'NEW_TERM', // New term (January/April) - triggers carry over
}

/**
 * Custom per-term date range for late-onboarding scenarios.
 * Allows the admin to specify real-world start/end dates for each term
 * instead of relying on auto-calculated equal splits.
 */
export class TermDateDto {
  @ApiProperty({ description: 'Term number (1, 2, or 3 for PRIMARY/SECONDARY; 1 or 2 for TERTIARY)' })
  @IsInt()
  @Min(1)
  @Max(3)
  number: number;

  @ApiProperty({ description: 'Term start date' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'Term end date' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}

export class InitializeSessionDto {
  @ApiProperty({ description: 'Session name (e.g., "2025/2026")' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Session start date' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'Session end date' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ description: 'Type of session initialization', enum: SessionType })
  @IsEnum(SessionType)
  @IsNotEmpty()
  type: SessionType;

  @ApiProperty({ description: 'School type (PRIMARY, SECONDARY, TERTIARY)', required: false })
  @IsString()
  @IsOptional()
  schoolType?: string;

  @ApiProperty({
    description:
      'Which term/semester to activate initially (1-3). ' +
      'Defaults to 1. Use this when a school is onboarding mid-session ' +
      'and is already in term 2 or 3.',
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(3)
  @IsOptional()
  startingTermNumber?: number;

  @ApiProperty({
    description:
      'Custom date ranges for each term/semester. ' +
      'If omitted, terms are auto-split equally across the session period. ' +
      'Use this for late-onboarding schools with real-world term dates.',
    required: false,
    type: [TermDateDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TermDateDto)
  @IsOptional()
  termDates?: TermDateDto[];
}

export class CreateTermDto {
  @ApiProperty({ description: 'Term name (e.g., "1st Term", "2nd Term", "3rd Term")' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Term number (1, 2, or 3)' })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty({ description: 'Term start date' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'Term end date' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ description: 'Half-term break start date', required: false })
  @IsDateString()
  @IsOptional()
  halfTermStart?: string;

  @ApiProperty({ description: 'Half-term break end date', required: false })
  @IsDateString()
  @IsOptional()
  halfTermEnd?: string;
}

export class MigrateStudentsDto {
  @ApiProperty({ description: 'Term ID to migrate students to' })
  @IsString()
  @IsNotEmpty()
  termId: string;

  @ApiProperty({ description: 'Whether to carry over students (true) or promote them (false)' })
  @IsString()
  @IsNotEmpty()
  carryOver: boolean; // true = carry over, false = promote
}

/**
 * DTO for updating term dates after creation.
 * Useful when a school needs to adjust term dates post-setup.
 */
export class UpdateTermDatesDto {
  @ApiProperty({ description: 'New term start date', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ description: 'New term end date', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ description: 'Half-term break start date', required: false })
  @IsDateString()
  @IsOptional()
  halfTermStart?: string;

  @ApiProperty({ description: 'Half-term break end date', required: false })
  @IsDateString()
  @IsOptional()
  halfTermEnd?: string;
}
