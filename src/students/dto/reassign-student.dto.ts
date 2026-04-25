import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class ReassignStudentDto {
  @ApiProperty({ description: 'Target class level name (e.g., JSS 1, SS 2)' })
  @IsString()
  @IsNotEmpty()
  targetClassLevel: string;

  @ApiProperty({ description: 'Academic year (e.g., 2024/2025)' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiPropertyOptional({ description: 'Specific target Class ID (optional for tertiary/older schools)' })
  @IsOptional()
  @IsString()
  targetClassId?: string;

  @ApiPropertyOptional({ description: 'Specific target ClassArm ID (highly recommended for primary/secondary)' })
  @IsOptional()
  @IsString()
  targetClassArmId?: string;

  @ApiPropertyOptional({ description: 'Reason for reassignment' })
  @IsOptional()
  @IsString()
  reason?: string;
}
