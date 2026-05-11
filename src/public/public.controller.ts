import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PublicService, PublicSchool, PlatformStats } from './public.service';
import { ResponseDto } from '../common/dto/response.dto';
import { SubmitAdmissionApplicationDto } from '../students/dto/admission-application.dto';
import { StudentAdmissionService } from '../students/student-admission.service';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly studentAdmissionService: StudentAdmissionService
  ) {}

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

  @Get('schools/:id')
  @ApiOperation({ summary: 'Get public information about a school' })
  async getSchoolInfo(@Param('id') id: string): Promise<ResponseDto<any>> {
    const data = await this.publicService.getSchoolInfo(id);
    return ResponseDto.ok(data, 'School info retrieved successfully');
  }

  @Post('schools/:id/apply')
  @ApiOperation({ summary: 'Submit an admission application to a school' })
  async submitApplication(
    @Param('id') schoolId: string,
    @Body() dto: SubmitAdmissionApplicationDto
  ): Promise<ResponseDto<any>> {
    const data = await this.studentAdmissionService.submitApplication(schoolId, dto);
    return ResponseDto.ok(data, 'Application submitted successfully');
  }
}
