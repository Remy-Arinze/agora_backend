import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

// AdminRole enum kept for backward compatibility and special cases (like PRINCIPAL)
// But roles are now stored as strings to support custom roles
export enum AdminRole {
  PRINCIPAL = 'PRINCIPAL',
  BURSAR = 'BURSAR',
  GUIDANCE_COUNSELOR = 'GUIDANCE_COUNSELOR',
  VICE_PRINCIPAL = 'VICE_PRINCIPAL',
  ADMINISTRATOR = 'ADMINISTRATOR',
}

export class PrincipalDto {
  @ApiProperty({ description: 'Principal first name' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Principal last name' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Principal email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Principal phone number' })
  @IsString()
  phone: string;
}

export class AdminDto {
  @ApiProperty({ description: 'Admin first name' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Admin last name' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Admin email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Admin phone number' })
  @IsString()
  phone: string;

  @ApiProperty({ description: 'Admin role (e.g., "Bursar", "Vice Principal", "Dean of Studies")' })
  @IsString()
  role: string;
}

export class CreateSchoolDto {
  @ApiProperty({ description: 'School name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'School subdomain (unique identifier)' })
  @IsString()
  subdomain: string;

  @ApiPropertyOptional({ description: 'School domain' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ description: 'School address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Country', default: 'Nigeria' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'School phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'School email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'School levels', type: Object })
  @IsOptional()
  levels?: {
    primary?: boolean;
    secondary?: boolean;
    tertiary?: boolean;
  };

  @ApiPropertyOptional({ description: 'Principal information' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PrincipalDto)
  principal?: PrincipalDto;

  @ApiPropertyOptional({ description: 'Additional admins', type: [AdminDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminDto)
  admins?: AdminDto[];
}
