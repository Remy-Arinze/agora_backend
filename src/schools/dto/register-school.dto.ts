import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsBoolean, ValidateNested, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterSchoolOwnerDto {
    @ApiProperty({ description: 'Owner first name' })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    firstName: string;

    @ApiProperty({ description: 'Owner last name' })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    lastName: string;

    @ApiProperty({ description: 'Owner email address' })
    @IsEmail()
    email: string;

    @ApiProperty({ description: 'Owner phone number' })
    @IsString()
    @MinLength(7)
    @MaxLength(20)
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
    @IsString()
    @MinLength(3)
    @MaxLength(200)
    schoolName: string;

    @ApiProperty({ description: 'School contact email' })
    @IsEmail()
    schoolEmail: string;

    @ApiProperty({ description: 'School phone number' })
    @IsString()
    @MinLength(7)
    @MaxLength(20)
    schoolPhone: string;

    @ApiPropertyOptional({ description: 'School address' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;

    @ApiPropertyOptional({ description: 'City' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    city?: string;

    @ApiPropertyOptional({ description: 'State' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    state?: string;

    @ApiPropertyOptional({ description: 'Country', default: 'Nigeria' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
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
