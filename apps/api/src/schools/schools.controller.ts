import { Controller, Get, Post, Delete, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolDto } from './dto/school.dto';
import { AddAdminDto } from './dto/add-admin.dto';
import { AddTeacherDto } from './dto/add-teacher.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { UpdatePrincipalDto } from './dto/update-principal.dto';
import { ConvertTeacherToAdminDto } from './dto/convert-teacher-to-admin.dto';
import { ResponseDto } from '../common/dto/response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('schools')
@Controller('schools')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new school (Super Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'School created successfully',
    type: ResponseDto<SchoolDto>,
  })
  @ApiResponse({ status: 409, description: 'School with subdomain already exists' })
  async createSchool(
    @Body() createSchoolDto: CreateSchoolDto
  ): Promise<ResponseDto<SchoolDto>> {
    const data = await this.schoolsService.createSchool(createSchoolDto);
    return ResponseDto.ok(data, 'School created successfully');
  }

  @Get()
  @ApiOperation({ summary: 'Get all schools' })
  @ApiResponse({
    status: 200,
    description: 'List of schools',
    type: ResponseDto<[SchoolDto]>,
  })
  async findAll(): Promise<ResponseDto<SchoolDto[]>> {
    const data = await this.schoolsService.findAll();
    return ResponseDto.ok(data, 'Schools retrieved successfully');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get school by ID' })
  @ApiResponse({
    status: 200,
    description: 'School details',
    type: ResponseDto<SchoolDto>,
  })
  @ApiResponse({ status: 404, description: 'School not found' })
  async findOne(@Param('id') id: string): Promise<ResponseDto<SchoolDto>> {
    const data = await this.schoolsService.findOne(id);
    return ResponseDto.ok(data, 'School retrieved successfully');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a school' })
  @ApiResponse({
    status: 200,
    description: 'School updated successfully',
    type: SchoolDto,
  })
  @ApiResponse({ status: 404, description: 'School not found' })
  @ApiResponse({ status: 409, description: 'Subdomain already exists' })
  async updateSchool(
    @Param('id') id: string,
    @Body() updateSchoolDto: UpdateSchoolDto
  ): Promise<ResponseDto<SchoolDto>> {
    try {
      const school = await this.schoolsService.updateSchool(id, updateSchoolDto);
      return ResponseDto.ok(school, 'School updated successfully');
    } catch (error) {
      throw error;
    }
  }

  @Post(':id/admins')
  @ApiOperation({ summary: 'Add an administrator to a school' })
  @ApiResponse({
    status: 201,
    description: 'Administrator added successfully',
  })
  @ApiResponse({ status: 404, description: 'School not found' })
  @ApiResponse({ status: 409, description: 'User with email or phone already exists' })
  async addAdmin(
    @Param('id') id: string,
    @Body() addAdminDto: AddAdminDto
  ): Promise<ResponseDto<any>> {
    try {
      const data = await this.schoolsService.addAdmin(id, addAdminDto);
      return ResponseDto.ok(data, 'Administrator added successfully');
    } catch (error) {
      throw error;
    }
  }

  @Post(':id/teachers')
  @ApiOperation({ summary: 'Add a teacher to a school' })
  @ApiResponse({
    status: 201,
    description: 'Teacher added successfully',
  })
  @ApiResponse({ status: 404, description: 'School not found' })
  @ApiResponse({ status: 409, description: 'User with email or phone already exists' })
  async addTeacher(
    @Param('id') id: string,
    @Body() addTeacherDto: AddTeacherDto
  ): Promise<ResponseDto<any>> {
    try {
      const data = await this.schoolsService.addTeacher(id, addTeacherDto);
      return ResponseDto.ok(data, 'Teacher added successfully');
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/teachers/:teacherId')
  @ApiOperation({ summary: 'Update a teacher in a school' })
  @ApiResponse({
    status: 200,
    description: 'Teacher updated successfully',
  })
  @ApiResponse({ status: 404, description: 'School or teacher not found' })
  async updateTeacher(
    @Param('id') id: string,
    @Param('teacherId') teacherId: string,
    @Body() updateTeacherDto: UpdateTeacherDto
  ): Promise<ResponseDto<any>> {
    try {
      const data = await this.schoolsService.updateTeacher(id, teacherId, updateTeacherDto);
      return ResponseDto.ok(data, 'Teacher updated successfully');
    } catch (error) {
      throw error;
    }
  }

  @Delete(':id/teachers/:teacherId')
  @ApiOperation({ summary: 'Delete a teacher from a school' })
  @ApiResponse({
    status: 200,
    description: 'Teacher deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'School or teacher not found' })
  async deleteTeacher(
    @Param('id') id: string,
    @Param('teacherId') teacherId: string
  ): Promise<ResponseDto<void>> {
    try {
      await this.schoolsService.deleteTeacher(id, teacherId);
      return ResponseDto.ok(undefined, 'Teacher deleted successfully');
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/admins/:adminId')
  @ApiOperation({ summary: 'Update an administrator in a school' })
  @ApiResponse({
    status: 200,
    description: 'Administrator updated successfully',
  })
  @ApiResponse({ status: 404, description: 'School or administrator not found' })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid role or school already has a principal' 
  })
  async updateAdmin(
    @Param('id') id: string,
    @Param('adminId') adminId: string,
    @Body() updateAdminDto: UpdateAdminDto
  ): Promise<ResponseDto<any>> {
    try {
      const data = await this.schoolsService.updateAdmin(id, adminId, updateAdminDto);
      return ResponseDto.ok(data, 'Administrator updated successfully');
    } catch (error) {
      throw error;
    }
  }

  @Delete(':id/admins/:adminId')
  @ApiOperation({ summary: 'Delete an administrator from a school' })
  @ApiResponse({
    status: 200,
    description: 'Administrator deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'School or administrator not found' })
  @ApiResponse({ 
    status: 400, 
    description: 'Cannot delete principal without another administrator to assign the role to' 
  })
  async deleteAdmin(
    @Param('id') id: string,
    @Param('adminId') adminId: string
  ): Promise<ResponseDto<void>> {
    try {
      await this.schoolsService.deleteAdmin(id, adminId);
      return ResponseDto.ok(undefined, 'Administrator deleted successfully');
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/admins/:adminId/make-principal')
  @ApiOperation({ summary: 'Make an admin the principal (switches current principal to admin)' })
  @ApiResponse({
    status: 200,
    description: 'Admin successfully made principal',
  })
  @ApiResponse({ status: 404, description: 'School or admin not found' })
  @ApiResponse({ 
    status: 400, 
    description: 'Admin is already principal or invalid request' 
  })
  async makePrincipal(
    @Param('id') id: string,
    @Param('adminId') adminId: string
  ): Promise<ResponseDto<void>> {
    try {
      await this.schoolsService.makePrincipal(id, adminId);
      return ResponseDto.ok(undefined, 'Administrator successfully made principal');
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/teachers/:teacherId/convert-to-admin')
  @ApiOperation({ summary: 'Convert a teacher to an admin (optionally keep teacher role)' })
  @ApiResponse({
    status: 200,
    description: 'Teacher successfully converted to admin',
  })
  @ApiResponse({ status: 404, description: 'School or teacher not found' })
  @ApiResponse({ 
    status: 400, 
    description: 'Teacher is already an admin or invalid request' 
  })
  async convertTeacherToAdmin(
    @Param('id') id: string,
    @Param('teacherId') teacherId: string,
    @Body() dto: ConvertTeacherToAdminDto
  ): Promise<ResponseDto<void>> {
    try {
      await this.schoolsService.convertTeacherToAdmin(id, teacherId, dto);
      return ResponseDto.ok(undefined, 'Teacher successfully converted to administrator');
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id/principal/:principalId')
  @ApiOperation({ summary: 'Update a principal in a school' })
  @ApiResponse({
    status: 200,
    description: 'Principal updated successfully',
  })
  @ApiResponse({ status: 404, description: 'School or principal not found' })
  async updatePrincipal(
    @Param('id') id: string,
    @Param('principalId') principalId: string,
    @Body() updatePrincipalDto: UpdatePrincipalDto
  ): Promise<ResponseDto<any>> {
    try {
      const data = await this.schoolsService.updatePrincipal(id, principalId, updatePrincipalDto);
      return ResponseDto.ok(data, 'Principal updated successfully');
    } catch (error) {
      throw error;
    }
  }

  @Delete(':id/principal/:principalId')
  @ApiOperation({ summary: 'Delete a principal from a school' })
  @ApiResponse({
    status: 200,
    description: 'Principal deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'School or principal not found' })
  @ApiResponse({ 
    status: 400, 
    description: 'Cannot delete principal without another administrator to assign the role to' 
  })
  async deletePrincipal(
    @Param('id') id: string,
    @Param('principalId') principalId: string
  ): Promise<ResponseDto<void>> {
    try {
      await this.schoolsService.deletePrincipal(id, principalId);
      return ResponseDto.ok(undefined, 'Principal deleted successfully');
    } catch (error) {
      throw error;
    }
  }
}

