import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsBoolean, ValidateNested, MinLength, MaxLength, IsNotEmpty } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { sanitizeString, sanitizeEmail, sanitizePhone, sanitizeOptionalString } from '../../common/utils/sanitize.util';

export class RegisterSchoolOwnerDto {
    @ApiProperty({ description: 'Owner first name' })
    @IsString({ message: 'First name must be a string' })
    @IsNotEmpty({ message: 'First name is required' })
    @MinLength(2, { message: 'First name must be at least 2 characters' })
    @MaxLength(100, { message: 'First name cannot exceed 100 characters' })
    @Transform(({ value }) => sanitizeString(value, 100))
    firstName: string;

    @ApiProperty({ description: 'Owner last name' })
    @IsString({ message: 'Last name must be a string' })
    @IsNotEmpty({ message: 'Last name is required' })
    @MinLength(2, { message: 'Last name must be at least 2 characters' })
    @MaxLength(100, { message: 'Last name cannot exceed 100 characters' })
    @Transform(({ value }) => sanitizeString(value, 100))
    lastName: string;

    @ApiProperty({ description: 'Owner email address' })
    @IsEmail({}, { message: 'Please provide a valid email address for the owner' })
    @IsNotEmpty({ message: 'Owner email is required' })
    @Transform(({ value }) => sanitizeEmail(value) ?? value ?? '')
    email: string;

    @ApiProperty({ description: 'Owner phone number' })
    @IsString({ message: 'Phone number must be a string' })
    @IsNotEmpty({ message: 'Owner phone number is required' })
    @MinLength(7, { message: 'Owner phone number must be at least 7 characters' })
    @MaxLength(20, { message: 'Owner phone number cannot exceed 20 characters' })
    @Transform(({ value }) => sanitizePhone(value) ?? '')
    phone: string;
}

export class RegisterSchoolLevelsDto {
    @ApiPropertyOptional({ description: 'Has primary school' })
    @IsOptional()
    @IsBoolean()
    primary?: boolean;

    @ApiPropertyOptional({ description: 'Has secondary school' })
    @IsOptional()
    @IsBoolean()
    secondary?: boolean;

    @ApiPropertyOptional({ description: 'Has tertiary institution' })
    @IsOptional()
    @IsBoolean()
    tertiary?: boolean;
}

export class RegisterSchoolDto {
    @ApiProperty({ description: 'School name' })
    @IsString({ message: 'School name must be a string' })
    @IsNotEmpty({ message: 'School name is required' })
    @MinLength(3, { message: 'School name must be at least 3 characters' })
    @MaxLength(200, { message: 'School name cannot exceed 200 characters' })
    @Transform(({ value }) => sanitizeString(value, 200))
    schoolName: string;

    @ApiProperty({ description: 'School contact email' })
    @IsEmail({}, { message: 'Please provide a valid school email address' })
    @IsNotEmpty({ message: 'School email is required' })
    @Transform(({ value }) => sanitizeEmail(value) ?? value ?? '')
    schoolEmail: string;

    @ApiProperty({ description: 'School phone number' })
    @IsString({ message: 'School phone number must be a string' })
    @IsNotEmpty({ message: 'School phone number is required' })
    @MinLength(7, { message: 'School phone number must be at least 7 characters' })
    @MaxLength(20, { message: 'School phone number cannot exceed 20 characters' })
    @Transform(({ value }) => sanitizePhone(value) ?? '')
    schoolPhone: string;

    @ApiPropertyOptional({ description: 'School address' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    @Transform(({ value }) => sanitizeOptionalString(value, 500))
    address?: string;

    @ApiPropertyOptional({ description: 'City' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    @Transform(({ value }) => sanitizeOptionalString(value, 100))
    city?: string;

    @ApiPropertyOptional({ description: 'State' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    @Transform(({ value }) => sanitizeOptionalString(value, 100))
    state?: string;

    @ApiPropertyOptional({ description: 'Country', default: 'Nigeria' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    @Transform(({ value }) => sanitizeOptionalString(value, 100))
    country?: string;

    @ApiProperty({ description: 'School levels' })
    @ValidateNested()
    @Type(() => RegisterSchoolLevelsDto)
    levels: RegisterSchoolLevelsDto;

    @ApiProperty({ description: 'School Owner information' })
    @ValidateNested()
    @Type(() => RegisterSchoolOwnerDto)
    owner: RegisterSchoolOwnerDto;

    @ApiPropertyOptional({ description: 'Optional note/message to Agora team' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    @Transform(({ value }) => sanitizeOptionalString(value, 1000))
    registrationNote?: string;
}

export class RegisterSchoolResponseDto {
    @ApiProperty()
    schoolName: string;

    @ApiProperty()
    email: string;

    @ApiProperty()
    message: string;
}
