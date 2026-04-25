import { Controller, Get, Post, Body, Patch, Delete, Param, UseGuards, Query, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, AgoraCurriculumPublishStatus } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserWithContext } from '../auth/types/user-with-context.type';
import { ResponseDto } from '../common/dto/response.dto';
import { AgoraCurriculumService } from './agora-curriculum.service';
import { CreateAgoraCurriculumSourceDto, ConsolidateCurriculumDto, PublishCurriculumDto, CreateAgoraSubjectDto, UpdateAgoraSubjectDto } from './dto/agora-curriculum.dto';
import { Throttle } from '@nestjs/throttler';

/**
 * heavy-ai tier: Protects resource-intensive document parsing and consolidation endpoints.
 * Limits are set low to prevent excessive AI token consumption and storage overhead.
 */
@ApiTags('Agora Curriculum (Super Admin)')
@Controller('agora-curriculum')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AgoraCurriculumController {
  constructor(private readonly agoraCurriculumService: AgoraCurriculumService) {}

  // ==========================================
  // SUBJECTS
  // ==========================================

  @Get('subjects')
  @ApiOperation({ summary: 'Get all NERDC subjects' })
  async getNerdcSubjects(
    @Query('schoolType') schoolType?: string,
    @Query('category') category?: string,
    @Query('search') search?: string
  ) {
    const subjects = await this.agoraCurriculumService.getNerdcSubjects(schoolType, category, search);
    return ResponseDto.ok(subjects, 'Subjects retrieved successfully');
  }

  @Post('subjects')
  @ApiOperation({ summary: 'Create a new Agora standard subject' })
  async createSubject(@Body() dto: CreateAgoraSubjectDto) {
    const subject = await this.agoraCurriculumService.createSubject(dto);
    return ResponseDto.ok(subject, 'Subject created successfully');
  }

  @Patch('subjects/:id')
  @ApiOperation({ summary: 'Update an Agora standard subject' })
  async updateSubject(
    @Param('id') id: string,
    @Body() dto: UpdateAgoraSubjectDto
  ) {
    const subject = await this.agoraCurriculumService.updateSubject(id, dto);
    return ResponseDto.ok(subject, 'Subject updated successfully');
  }

  @Delete('subjects/:id')
  @ApiOperation({ summary: 'Delete or deactivate an Agora standard subject' })
  async deleteSubject(@Param('id') id: string) {
    const result = await this.agoraCurriculumService.deleteSubject(id);
    return ResponseDto.ok(result, 'Subject deleted or deactivated successfully');
  }

  // ==========================================
  // SOURCES MANAGEMENT
  // ==========================================

  @Post('sources')
  @ApiOperation({ summary: 'Upload or manually create an Agora Curriculum Source' })
  @ApiResponse({ status: 201, description: 'Source created, queued for parsing' })
  async createSource(
    @Body() dto: CreateAgoraCurriculumSourceDto,
    @CurrentUser() user: UserWithContext
  ) {
    const source = await this.agoraCurriculumService.createSource(dto, user.id);
    return ResponseDto.ok(source, 'Source created successfully and queued for parsing');
  }

  @Get('sources')
  @ApiOperation({ summary: 'Get all curriculum sources with optional filters' })
  async getSources(
    @Query('subjectId') subjectId?: string,
    @Query('gradeLevel') gradeLevel?: string
  ) {
    const sources = await this.agoraCurriculumService.getSources(subjectId, gradeLevel);
    return ResponseDto.ok(sources, 'Sources retrieved successfully');
  }

  @Post('sources/upload')
  @Throttle({ 'heavy-ai': { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Upload an Agora Curriculum Source document' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSource(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateAgoraCurriculumSourceDto,
    @CurrentUser() user: UserWithContext
  ) {
    if (!file) throw new BadRequestException('File is required');
    const source = await this.agoraCurriculumService.uploadAndCreateSource(file, dto, user.id);
    return ResponseDto.ok(source, 'Source uploaded successfully and queued for parsing');
  }

  @Post('sources/upload-multiple')
  @Throttle({ 'heavy-ai': { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Upload multiple curriculum source documents as a batch' })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultipleSources(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateAgoraCurriculumSourceDto,
    @CurrentUser() user: UserWithContext
  ) {
    if (!files || files.length === 0) throw new BadRequestException('Files are required');
    const result = await this.agoraCurriculumService.uploadMultipleSources(files, dto, user.id);
    return ResponseDto.ok(result, 'Multiple sources uploaded and batch processing started');
  }

  @Get('sources/:id/status')
  @ApiOperation({ summary: 'Get parsing status of a specific source' })
  async getSourceStatus(@Param('id') id: string) {
    const status = await this.agoraCurriculumService.getSourceStatus(id);
    return ResponseDto.ok(status, 'Source status retrieved successfully');
  }

  @Get('batch/:batchId/status')
  @ApiOperation({ summary: 'Get processing status for an entire batch' })
  async getBatchStatus(@Param('batchId') batchId: string) {
    const status = await this.agoraCurriculumService.getBatchStatus(batchId);
    return ResponseDto.ok(status, 'Batch status retrieved successfully');
  }

  @Post('sources/:id/retry')
  @ApiOperation({ summary: 'Retry a failed parsing job' })
  async retryParsing(@Param('id') id: string) {
    const result = await this.agoraCurriculumService.retrySourceParsing(id);
    return ResponseDto.ok(result, 'Retry job queued');
  }

  @Get('sources/:id')
  @ApiOperation({ summary: 'Get details of a specific source' })
  async getSource(@Param('id') id: string) {
    const source = await this.agoraCurriculumService.getSource(id);
    return ResponseDto.ok(source, 'Source retrieved successfully');
  }

  @Delete('sources/:id')
  @ApiOperation({ summary: 'Delete a curriculum source' })
  async deleteSource(@Param('id') id: string) {
    await this.agoraCurriculumService.deleteSource(id);
    return ResponseDto.ok(null, 'Source deleted successfully');
  }

  @Post('sources/:id/cancel')
  @ApiOperation({ summary: 'Cancel an in-progress parsing job' })
  async cancelProcessing(@Param('id') id: string) {
    const result = await this.agoraCurriculumService.cancelSourceProcessing(id);
    return ResponseDto.ok(result, 'Processing cancelled');
  }

  // ==========================================
  // CONSOLIDATED CURRICULUM
  // ==========================================

  @Post('consolidate')
  @ApiOperation({ summary: 'Consolidate multiple parsed sources into a structured curriculum' })
  @ApiResponse({ status: 201, description: 'Consolidation queued' })
  async consolidateSources(
    @Body() dto: ConsolidateCurriculumDto,
    @CurrentUser() user: UserWithContext
  ) {
    const curriculum = await this.agoraCurriculumService.consolidateSources(dto, user.id);
    return ResponseDto.ok(curriculum, 'Consolidation started successfully. A draft curriculum will be generated.');
  }

  @Get()
  @ApiOperation({ summary: 'Get all consolidated curricula (draft/published)' })
  async getCurricula(
    @Query('subjectId') subjectId?: string,
    @Query('gradeLevel') gradeLevel?: string,
    @Query('status') status?: AgoraCurriculumPublishStatus
  ) {
    const curricula = await this.agoraCurriculumService.getCurricula(subjectId, gradeLevel, status);
    return ResponseDto.ok(curricula, 'Curricula retrieved successfully');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full curriculum details including topics/weeks' })
  async getCurriculum(@Param('id') id: string) {
    const curriculum = await this.agoraCurriculumService.getCurriculum(id);
    return ResponseDto.ok(curriculum, 'Curriculum retrieved successfully');
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish or revert a drafted curriculum' })
  async publishCurriculum(
    @Param('id') id: string,
    @Body() dto: PublishCurriculumDto,
    @CurrentUser() user: UserWithContext
  ) {
    const curriculum = await this.agoraCurriculumService.publishCurriculum(id, dto, user.id);
    return ResponseDto.ok(curriculum, `Curriculum status updated to ${dto.status}`);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a drafted or published curriculum' })
  async deleteCurriculum(@Param('id') id: string) {
    await this.agoraCurriculumService.deleteCurriculum(id);
    return ResponseDto.ok(null, 'Curriculum deleted successfully');
  }

  @Patch('topics/:topicId')
  @ApiOperation({ summary: 'Update a curriculum topic inside a curriculum' })
  async updateTopic(@Param('topicId') topicId: string, @Body() dto: any) {
    const topic = await this.agoraCurriculumService.updateTopic(topicId, dto);
    return ResponseDto.ok(topic, 'Topic updated successfully');
  }

  @Post(':id/topics')
  @ApiOperation({ summary: 'Add a new topic to a curriculum' })
  async createTopic(@Param('id') id: string, @Body() dto: any) {
    const topic = await this.agoraCurriculumService.addTopic(id, dto);
    return ResponseDto.ok(topic, 'Topic added successfully');
  }

  @Delete('topics/:topicId')
  @ApiOperation({ summary: 'Remove a topic from a curriculum' })
  async deleteTopic(@Param('topicId') topicId: string) {
    await this.agoraCurriculumService.deleteTopic(topicId);
    return ResponseDto.ok(null, 'Topic deleted successfully');
  }
}
