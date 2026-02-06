import { Controller, Get, Post, Delete, Patch, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SuperAdminSchoolsService } from './super-admin-schools.service';
import { CreateSchoolDto } from '../dto/create-school.dto';
import { UpdateSchoolDto } from '../dto/update-school.dto';
import { SchoolDto } from '../dto/school.dto';
import { ResponseDto } from '../../common/dto/response.dto';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('schools')
@Controller('schools')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@ApiBearerAuth()
export class SuperAdminSchoolsController {
  constructor(private readonly superAdminSchoolsService: SuperAdminSchoolsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new school (Super Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'School created successfully',
    type: ResponseDto<SchoolDto>,
  })
  @ApiResponse({ status: 409, description: 'School with subdomain already exists' })
  async createSchool(@Body() createSchoolDto: CreateSchoolDto): Promise<ResponseDto<SchoolDto>> {
    const data = await this.superAdminSchoolsService.createSchool(createSchoolDto);
    return ResponseDto.ok(data, 'School created successfully');
  }

  @Get()
  @ApiOperation({ summary: 'Get all schools with pagination (Super Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10, max: 100)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name, subdomain, city, or state' })
  @ApiQuery({ name: 'filter', required: false, enum: ['all', 'active', 'inactive'], description: 'Filter by status (default: all)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of schools',
    type: ResponseDto<PaginatedResponseDto<SchoolDto>>,
  })
  async findAll(@Query() query: PaginationDto): Promise<ResponseDto<PaginatedResponseDto<SchoolDto>>> {
    const data = await this.superAdminSchoolsService.findAll(query);
    return ResponseDto.ok(data, 'Schools retrieved successfully');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get school by ID (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'School details',
    type: ResponseDto<SchoolDto>,
  })
  @ApiResponse({ status: 404, description: 'School not found' })
  async findOne(@Param('id') id: string): Promise<ResponseDto<SchoolDto>> {
    const data = await this.superAdminSchoolsService.findOne(id);
    return ResponseDto.ok(data, 'School retrieved successfully');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a school (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'School updated successfully',
    type: ResponseDto<SchoolDto>,
  })
  @ApiResponse({ status: 404, description: 'School not found' })
  @ApiResponse({ status: 409, description: 'Subdomain already exists' })
  async updateSchool(
    @Param('id') id: string,
    @Body() updateSchoolDto: UpdateSchoolDto
  ): Promise<ResponseDto<SchoolDto>> {
    const data = await this.superAdminSchoolsService.updateSchool(id, updateSchoolDto);
    return ResponseDto.ok(data, 'School updated successfully');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a school (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'School deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'School not found' })
  async deleteSchool(@Param('id') id: string): Promise<ResponseDto<void>> {
    await this.superAdminSchoolsService.deleteSchool(id);
    return ResponseDto.ok(undefined, 'School deleted successfully');
  }
}
