import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean } from 'class-validator';

export class ConvertTeacherToAdminDto {
  @ApiProperty({
    description: 'Admin role to assign (e.g., "Bursar", "Vice Principal", "Dean of Studies")',
  })
  @IsString()
  role: string;

  @ApiProperty({ description: 'Whether to keep the teacher role', default: false })
  @IsBoolean()
  keepAsTeacher: boolean;
}
