import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ClassLevelNamingMode, SubjectRegistryMode, TeacherScopeMode } from '@prisma/client';

export class UpdateStructureSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  terminologyOverrides?: Record<string, string>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultClassArmNames?: string[];

  @ApiPropertyOptional({ enum: ClassLevelNamingMode })
  @IsOptional()
  @IsEnum(ClassLevelNamingMode)
  classLevelNamingMode?: ClassLevelNamingMode;

  @ApiPropertyOptional({ enum: SubjectRegistryMode })
  @IsOptional()
  @IsEnum(SubjectRegistryMode)
  subjectRegistryMode?: SubjectRegistryMode;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultAgoraSubjectIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  facultyStructureVisible?: boolean;

  @ApiPropertyOptional({ enum: TeacherScopeMode })
  @IsOptional()
  @IsEnum(TeacherScopeMode)
  teacherScope?: TeacherScopeMode;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customRoles?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  admissionApproverRoles?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transferApproverRoles?: string[];
}
