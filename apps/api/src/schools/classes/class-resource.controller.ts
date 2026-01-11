import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ClassResourceService } from './class-resource.service';
import { ClassResourceDto, CreateClassResourceDto } from '../dto/class-resource.dto';
import { ResponseDto } from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../../common/guards/school-data-access.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../dto/permission.dto';
import { Response } from 'express';

@ApiTags('schools')
@Controller('schools/:schoolId/classes/:classId/resources')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
@ApiBearerAuth()
export class ClassResourceController {
  constructor(private readonly resourceService: ClassResourceService) {}

  @Post('upload')
  @RequirePermission(PermissionResource.RESOURCES, PermissionType.WRITE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a resource to a class' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Resource uploaded successfully',
    type: ClassResourceDto,
  })
  @ApiResponse({ status: 404, description: 'Class not found' })
  @ApiResponse({ status: 400, description: 'Invalid file or missing file' })
  async uploadResource(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateClassResourceDto,
    @Request() req: any
  ): Promise<ResponseDto<ClassResourceDto>> {
    const userId = req.user?.userId || req.user?.id;
    const data = await this.resourceService.uploadResource(schoolId, classId, file, userId, dto);
    return ResponseDto.ok(data, 'Resource uploaded successfully');
  }

  @Get()
  @RequirePermission(PermissionResource.RESOURCES, PermissionType.READ)
  @ApiOperation({ summary: 'Get all resources for a class' })
  @ApiResponse({
    status: 200,
    description: 'Resources retrieved successfully',
    type: [ClassResourceDto],
  })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async getClassResources(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string
  ): Promise<ResponseDto<ClassResourceDto[]>> {
    const data = await this.resourceService.getClassResources(schoolId, classId);
    return ResponseDto.ok(data, 'Resources retrieved successfully');
  }

  @Get(':resourceId')
  @RequirePermission(PermissionResource.RESOURCES, PermissionType.READ)
  @ApiOperation({ summary: 'Get a single resource' })
  @ApiResponse({
    status: 200,
    description: 'Resource retrieved successfully',
    type: ClassResourceDto,
  })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async getResource(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Param('resourceId') resourceId: string
  ): Promise<ResponseDto<ClassResourceDto>> {
    const data = await this.resourceService.getResource(schoolId, classId, resourceId);
    return ResponseDto.ok(data, 'Resource retrieved successfully');
  }

  @Get(':resourceId/download')
  @RequirePermission(PermissionResource.RESOURCES, PermissionType.READ)
  @ApiOperation({ summary: 'Download a resource file' })
  @ApiResponse({
    status: 200,
    description: 'File downloaded successfully',
  })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async downloadResource(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Param('resourceId') resourceId: string,
    @Res() res: Response
  ): Promise<void> {
    const { buffer, resource } = await this.resourceService.getFileBuffer(
      schoolId,
      classId,
      resourceId
    );

    res.setHeader('Content-Type', resource.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${resource.name}"`);
    res.setHeader('Content-Length', resource.fileSize);
    res.send(buffer);
  }

  @Delete(':resourceId')
  @RequirePermission(PermissionResource.RESOURCES, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Delete a resource' })
  @ApiResponse({
    status: 200,
    description: 'Resource deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async deleteResource(
    @Param('schoolId') schoolId: string,
    @Param('classId') classId: string,
    @Param('resourceId') resourceId: string
  ): Promise<ResponseDto<void>> {
    await this.resourceService.deleteResource(schoolId, classId, resourceId);
    return ResponseDto.ok(undefined, 'Resource deleted successfully');
  }
}
