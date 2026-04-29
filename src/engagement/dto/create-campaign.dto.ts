import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray } from 'class-validator';
import { CampaignTarget, CampaignStatus } from '@prisma/client';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsEnum(CampaignTarget)
  @IsOptional()
  target?: CampaignTarget;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetSchools?: string[];

  @IsEnum(CampaignStatus)
  @IsOptional()
  status?: CampaignStatus;

  @IsOptional()
  scheduledAt?: Date;
}
