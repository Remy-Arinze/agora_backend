import {
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Query,
  Body,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { SchoolAdminSchoolsService } from './school-admin-schools.service';
import { SchoolDto } from '../dto/school.dto';
import { SchoolDashboardDto } from '../dto/dashboard.dto';
import { StaffListResponseDto } from '../dto/staff-list.dto';
import { UpdateSchoolDto } from '../dto/update-school.dto';
import { ResponseDto } from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../../common/guards/school-data-access.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../dto/permission.dto';

@ApiTags('school-admin')
@Controller('school-admin')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
@ApiBearerAuth()
export class SchoolAdminSchoolsController {
  constructor(private readonly schoolAdminSchoolsService: SchoolAdminSchoolsService) {}

  // Note: No @RequirePermission on this endpoint - it's needed for the permission system to bootstrap
  // Access is still controlled by JwtAuthGuard and SchoolDataAccessGuard
  @Get('school')
  @ApiOperation({ summary: 'Get my school information' })
  @ApiResponse({
    status: 200,
    description: 'School information retrieved successfully',
    type: ResponseDto<SchoolDto>,
  })
  async getMySchool(@Request() req: any): Promise<ResponseDto<SchoolDto>> {
    const data = await this.schoolAdminSchoolsService.getMySchool(req.user);
    return ResponseDto.ok(data, 'School information retrieved successfully');
  }

  @Get('dashboard')
  @RequirePermission(PermissionResource.OVERVIEW, PermissionType.READ)
  @ApiOperation({ summary: 'Get school dashboard data' })
  @ApiQuery({
    name: 'schoolType',
    required: false,
    type: String,
    description: 'Filter by school type (PRIMARY, SECONDARY, TERTIARY)',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
    type: ResponseDto<SchoolDashboardDto>,
  })
  async getDashboard(
    @Request() req: any,
    @Query('schoolType') schoolType?: string
  ): Promise<ResponseDto<SchoolDashboardDto>> {
    const data = await this.schoolAdminSchoolsService.getDashboard(req.user, schoolType);
    return ResponseDto.ok(data, 'Dashboard data retrieved successfully');
  }

  @Get('staff')
  @RequirePermission(PermissionResource.STAFF, PermissionType.READ)
  @ApiOperation({ summary: 'Get paginated staff list with search and filtering' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10, max: 100)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search query (name, email, subject)',
  })
  @ApiQuery({ name: 'role', required: false, type: String, description: 'Filter by role' })
  @ApiQuery({
    name: 'schoolType',
    required: false,
    type: String,
    description: 'Filter by school type (PRIMARY, SECONDARY, TERTIARY)',
  })
  @ApiResponse({
    status: 200,
    description: 'Staff list retrieved successfully',
    type: ResponseDto<StaffListResponseDto>,
  })
  async getStaffList(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('schoolType') schoolType?: string
  ): Promise<ResponseDto<StaffListResponseDto>> {
    const query = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      role,
      schoolType,
    };
    const data = await this.schoolAdminSchoolsService.getStaffList(req.user, query);
    return ResponseDto.ok(data, 'Staff list retrieved successfully');
  }

  @Post('school/logo')
  @RequirePermission(PermissionResource.OVERVIEW, PermissionType.WRITE)
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    })
  )
  @ApiOperation({ summary: 'Upload school logo' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Logo uploaded successfully',
    type: ResponseDto<SchoolDto>,
  })
  async uploadLogo(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File
  ): Promise<ResponseDto<SchoolDto>> {
    const data = await this.schoolAdminSchoolsService.uploadLogo(req.user, file);
    return ResponseDto.ok(data, 'Logo uploaded successfully');
  }

  @Patch('school')
  @RequirePermission(PermissionResource.OVERVIEW, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Update school information' })
  @ApiQuery({
    name: 'token',
    required: false,
    type: String,
    description: 'Verification token for sensitive changes',
  })
  @ApiResponse({
    status: 200,
    description: 'School updated successfully',
    type: ResponseDto<SchoolDto>,
  })
  async updateSchool(
    @Request() req: any,
    @Body() updateSchoolDto: UpdateSchoolDto,
    @Query('token') token?: string
  ): Promise<ResponseDto<SchoolDto>> {
    const data = await this.schoolAdminSchoolsService.updateSchool(
      req.user,
      updateSchoolDto,
      token
    );
    return ResponseDto.ok(data, 'School updated successfully');
  }

  @Post('school/request-edit-token')
  @RequirePermission(PermissionResource.OVERVIEW, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Request verification token for sensitive school profile changes' })
  @ApiResponse({
    status: 200,
    description: 'Verification token requested successfully',
  })
  async requestEditToken(
    @Request() req: any,
    @Body() changes: UpdateSchoolDto
  ): Promise<ResponseDto<{ message: string }>> {
    const result = await this.schoolAdminSchoolsService.requestEditToken(req.user, changes);
    return ResponseDto.ok({ message: result.message }, result.message);
  }

  @Get('school/verify-edit-token/:token')
  @RequirePermission(PermissionResource.OVERVIEW, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Verify edit token and get proposed changes' })
  @ApiResponse({
    status: 200,
    description: 'Token verified successfully',
  })
  async verifyEditToken(
    @Request() req: any,
    @Param('token') token: string
  ): Promise<ResponseDto<{ changes: UpdateSchoolDto; school: SchoolDto }>> {
    const data = await this.schoolAdminSchoolsService.verifyEditToken(token, req.user);
    return ResponseDto.ok(data, 'Token verified successfully');
  }
}
