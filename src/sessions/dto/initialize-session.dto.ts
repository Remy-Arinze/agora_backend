import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, IsOptional, IsEnum } from 'class-validator';

export enum SessionType {
  NEW_SESSION = 'NEW_SESSION', // New academic session (September) - triggers promotion
  NEW_TERM = 'NEW_TERM', // New term (January/April) - triggers carry over
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
