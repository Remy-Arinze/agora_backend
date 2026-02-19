import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ClassType } from '../../schools/dto/create-class.dto';

export class GetStudentsDto extends PaginationDto {
  @ApiProperty({
    description: 'Filter by school type',
    enum: ClassType,
    required: false,
  })
  @IsOptional()
  @IsEnum(ClassType)
  schoolType?: ClassType;
}
