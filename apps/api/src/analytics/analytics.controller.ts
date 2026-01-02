import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService, AnalyticsStats } from './analytics.service';
import { ResponseDto } from '../common/dto/response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Get platform analytics (Super Admin only)' })
  @ApiQuery({ name: 'month', required: false, description: 'Month (1-12)' })
  @ApiQuery({ name: 'year', required: false, description: 'Year (e.g., 2024)' })
  @ApiResponse({
    status: 200,
    description: 'Analytics data retrieved successfully',
    type: ResponseDto<AnalyticsStats>,
  })
  async getAnalytics(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ): Promise<ResponseDto<AnalyticsStats>> {
    const monthNum = month ? parseInt(month, 10) : undefined;
    const yearNum = year ? parseInt(year, 10) : undefined;
    const data = await this.analyticsService.getAnalytics(monthNum, yearNum);
    return ResponseDto.ok(data, 'Analytics retrieved successfully');
  }
}

