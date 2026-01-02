import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateAdminDto {
  @ApiPropertyOptional({ description: 'Admin first name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Admin last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Admin phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ 
    description: 'Admin role (e.g., "Bursar", "Vice Principal", "Dean of Studies")',
    example: 'Bursar'
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'Profile image URL (Cloudinary)' })
  @IsOptional()
  @IsString()
  profileImage?: string;

  // Note: Email is not editable
}

