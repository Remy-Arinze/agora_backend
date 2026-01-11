import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdatePrincipalDto {
  @ApiPropertyOptional({ description: 'Principal first name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Principal last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Principal phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  // Note: Email and role (Principal) are not editable
}
