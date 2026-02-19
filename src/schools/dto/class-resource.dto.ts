import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ClassResourceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  filePath: string;

  @ApiProperty()
  fileSize: number;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  fileType: string;

  @ApiProperty({ required: false })
  description: string | null;

  @ApiProperty()
  classId: string;

  @ApiProperty()
  uploadedBy: string;

  @ApiProperty()
  uploadedByName?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  downloadUrl?: string;
}

export class CreateClassResourceDto {
  @ApiProperty({ description: 'Resource description (optional)', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
