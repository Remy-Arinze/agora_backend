import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PublicService, PublicSchool, PlatformStats } from './public.service';
import { ResponseDto } from '../common/dto/response.dto';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('schools')
  @ApiOperation({ summary: 'Get list of schools using Agora (public endpoint)' })
  @ApiResponse({
    status: 200,
    description: 'Schools retrieved successfully',
  })
  async getPublicSchools(): Promise<ResponseDto<PublicSchool[]>> {
    const data = await this.publicService.getPublicSchools();
    return ResponseDto.ok(data, 'Schools retrieved successfully');
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics (public endpoint)' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getPlatformStats(): Promise<ResponseDto<PlatformStats>> {
    const data = await this.publicService.getPlatformStats();
    return ResponseDto.ok(data, 'Statistics retrieved successfully');
  }
}

