import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ErrorsService } from './errors.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ErrorStatus } from '@prisma/client';
import { ResponseDto } from '../../common/dto/response.dto';

@ApiTags('Operations - Errors')
@Controller('operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('SUPER_ADMIN') // Only super admins can view errors
export class ErrorsController {
  constructor(private readonly errorsService: ErrorsService) {}

  @Get('schools/:schoolId/errors')
  @ApiOperation({ summary: 'Get errors for a specific school' })
  @ApiResponse({ status: 200, description: 'Errors retrieved successfully' })
  async getSchoolErrors(
    @Param('schoolId') schoolId: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('errorType') errorType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters = {
      severity: severity as any,
      status: status as any,
      errorType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    const result = await this.errorsService.getErrorsBySchool(schoolId, filters);
    return ResponseDto.ok(result, 'Errors retrieved successfully');
  }

  @Get('errors/:errorId')
  @ApiOperation({ summary: 'Get error details by ID' })
  @ApiResponse({ status: 200, description: 'Error details retrieved successfully' })
  async getErrorDetails(@Param('errorId') errorId: string) {
    const error = await this.errorsService.getErrorById(errorId);
    if (!error) {
      return ResponseDto.error('Error not found', 404);
    }
    return ResponseDto.ok(error, 'Error details retrieved successfully');
  }

  @Patch('errors/:errorId/status')
  @ApiOperation({ summary: 'Update error status' })
  @ApiResponse({ status: 200, description: 'Error status updated successfully' })
  async updateErrorStatus(
    @Param('errorId') errorId: string,
    @Body('status') status: ErrorStatus,
    @Request() req: any,
  ) {
    const resolvedBy = req.user?.id;
    const error = await this.errorsService.updateErrorStatus(errorId, status, resolvedBy);
    return ResponseDto.ok(error, 'Error status updated successfully');
  }

  @Get('schools/:schoolId/errors/stats')
  @ApiOperation({ summary: 'Get error statistics for a school' })
  @ApiResponse({ status: 200, description: 'Error statistics retrieved successfully' })
  async getErrorStats(
    @Param('schoolId') schoolId: string,
    @Query('days') days?: string,
  ) {
    const stats = await this.errorsService.getErrorStats(
      schoolId,
      days ? parseInt(days, 10) : 30,
    );
    return ResponseDto.ok(stats, 'Error statistics retrieved successfully');
  }
}
