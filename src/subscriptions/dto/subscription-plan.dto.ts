import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionTier } from '@prisma/client';

export class PlanFeatureDto {
    @IsString()
    text: string;

    @IsBoolean()
    included: boolean;

    @IsOptional()
    @IsBoolean()
    isGlowing?: boolean;
}

export class CreateSubscriptionPlanDto {
    @IsEnum(SubscriptionTier)
    tierCode: SubscriptionTier;

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNumber()
    monthlyPrice: number;

    @IsNumber()
    yearlyPrice: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PlanFeatureDto)
    features?: PlanFeatureDto[];

    @IsOptional()
    @IsBoolean()
    highlight?: boolean;

    @IsString()
    cta: string;

    @IsString()
    accent: string;

    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;

    @IsOptional()
    @IsString()
    customSchoolId?: string;

    @IsOptional()
    @IsNumber()
    maxStudents?: number;

    @IsOptional()
    @IsNumber()
    maxTeachers?: number;

    @IsOptional()
    @IsNumber()
    maxAdmins?: number;

    @IsOptional()
    @IsNumber()
    aiCredits?: number;
}

export class UpdateSubscriptionPlanDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    monthlyPrice?: number;

    @IsOptional()
    @IsNumber()
    yearlyPrice?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PlanFeatureDto)
    features?: PlanFeatureDto[];

    @IsOptional()
    @IsBoolean()
    highlight?: boolean;

    @IsOptional()
    @IsString()
    cta?: string;

    @IsOptional()
    @IsString()
    accent?: string;

    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;

    @IsOptional()
    @IsString()
    customSchoolId?: string;

    @IsOptional()
    @IsNumber()
    maxStudents?: number;

    @IsOptional()
    @IsNumber()
    maxTeachers?: number;

    @IsOptional()
    @IsNumber()
    maxAdmins?: number;

    @IsOptional()
    @IsNumber()
    aiCredits?: number;
}
