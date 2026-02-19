import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TransfersService } from './transfers.service';
import {
  GenerateTacDto,
  InitiateTransferDto,
  CompleteTransferDto,
  RejectTransferDto,
  GenerateTacResponseDto,
  StudentTransferDataDto,
} from './dto/transfer.dto';
import { ResponseDto } from '../common/dto/response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolDataAccessGuard } from '../common/guards/school-data-access.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { PermissionResource, PermissionType } from '../schools/dto/permission.dto';
import { TransferStatus } from '@prisma/client';
import { UserWithContext } from '../auth/types/user-with-context.type';

@ApiTags('schools')
@Controller('schools/:schoolId/transfers')
@UseGuards(JwtAuthGuard, SchoolDataAccessGuard, PermissionGuard)
@ApiBearerAuth()
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  // Outgoing Transfers

  @Post('outgoing/generate')
  @RequirePermission(PermissionResource.TRANSFERS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Generate TAC for outgoing transfer' })
  @ApiResponse({
    status: 201,
    description: 'TAC generated successfully',
    type: ResponseDto<GenerateTacResponseDto>,
  })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async generateTac(
    @Param('schoolId') schoolId: string,
    @Request() req: any,
    @Body() dto: GenerateTacDto
  ): Promise<ResponseDto<GenerateTacResponseDto>> {
    const user: UserWithContext = req.user;
    const data = await this.transfersService.generateTac(schoolId, user.id, dto);
    return ResponseDto.ok(data, 'TAC generated successfully');
  }

  @Get('outgoing')
  @RequirePermission(PermissionResource.TRANSFERS, PermissionType.READ)
  @ApiOperation({ summary: 'List outgoing transfers' })
  @ApiQuery({ name: 'status', enum: TransferStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({
    name: 'schoolType',
    type: String,
    required: false,
    description: 'Filter by school type (PRIMARY, SECONDARY, TERTIARY)',
  })
  @ApiResponse({ status: 200, description: 'Outgoing transfers retrieved successfully' })
  async getOutgoingTransfers(
    @Param('schoolId') schoolId: string,
    @Query('status') status?: TransferStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('schoolType') schoolType?: string
  ): Promise<ResponseDto<any>> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const data = await this.transfersService.getOutgoingTransfers(
      schoolId,
      status,
      pageNum,
      limitNum,
      schoolType
    );
    return ResponseDto.ok(data, 'Outgoing transfers retrieved successfully');
  }

  @Get('outgoing/:transferId')
  @RequirePermission(PermissionResource.TRANSFERS, PermissionType.READ)
  @ApiOperation({ summary: 'Get outgoing transfer details' })
  @ApiParam({ name: 'transferId', description: 'Transfer ID' })
  @ApiResponse({ status: 200, description: 'Transfer details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Transfer not found' })
  async getOutgoingTransferDetails(
    @Param('schoolId') schoolId: string,
    @Param('transferId') transferId: string
  ): Promise<ResponseDto<any>> {
    // This would need a separate method in service, but for now we can use the list endpoint
    const data = await this.transfersService.getOutgoingTransfers(schoolId);
    const transfer = data.transfers.find((t: any) => t.id === transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }
    return ResponseDto.ok(transfer, 'Transfer details retrieved successfully');
  }

  @Delete('outgoing/:transferId/revoke')
  @RequirePermission(PermissionResource.TRANSFERS, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Revoke TAC (if not used)' })
  @ApiParam({ name: 'transferId', description: 'Transfer ID' })
  @ApiResponse({ status: 200, description: 'TAC revoked successfully' })
  @ApiResponse({ status: 404, description: 'Transfer not found' })
  @ApiResponse({ status: 409, description: 'TAC has already been used' })
  async revokeTac(
    @Param('schoolId') schoolId: string,
    @Param('transferId') transferId: string
  ): Promise<ResponseDto<any>> {
    const data = await this.transfersService.revokeTac(schoolId, transferId);
    return ResponseDto.ok(data, 'TAC revoked successfully');
  }

  @Get('outgoing/:transferId/historical-grades')
  @RequirePermission(PermissionResource.TRANSFERS, PermissionType.READ)
  @ApiOperation({ summary: 'Get historical grades for a completed transfer' })
  @ApiParam({ name: 'transferId', description: 'Transfer ID' })
  @ApiResponse({ status: 200, description: 'Historical grades retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Transfer not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({
    status: 400,
    description: 'Historical grades only available for completed transfers',
  })
  async getTransferHistoricalGrades(
    @Param('schoolId') schoolId: string,
    @Param('transferId') transferId: string
  ): Promise<ResponseDto<any>> {
    const data = await this.transfersService.getTransferHistoricalGrades(schoolId, transferId);
    return ResponseDto.ok(data, 'Historical grades retrieved successfully');
  }

  // Incoming Transfers

  @Post('incoming/initiate')
  @RequirePermission(PermissionResource.TRANSFERS, PermissionType.WRITE)
  @ApiOperation({ summary: 'Initiate transfer with TAC' })
  @ApiResponse({
    status: 201,
    description: 'Transfer initiated successfully',
    type: ResponseDto<{ transferId: string; studentData: StudentTransferDataDto; message: string }>,
  })
  @ApiResponse({ status: 400, description: 'Invalid TAC or student ID' })
  @ApiResponse({ status: 404, description: 'TAC or student not found' })
  @ApiResponse({ status: 409, description: 'TAC has already been used' })
  async initiateTransfer(
    @Param('schoolId') schoolId: string,
    @Body() dto: InitiateTransferDto
  ): Promise<ResponseDto<any>> {
    const data = await this.transfersService.initiateTransfer(schoolId, dto);
    return ResponseDto.ok(data, 'Transfer initiated successfully');
  }

  @Get('incoming')
  @RequirePermission(PermissionResource.TRANSFERS, PermissionType.READ)
  @ApiOperation({ summary: 'List incoming transfers' })
  @ApiQuery({ name: 'status', enum: TransferStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({
    name: 'schoolType',
    type: String,
    required: false,
    description: 'Filter by school type (PRIMARY, SECONDARY, TERTIARY)',
  })
  @ApiResponse({ status: 200, description: 'Incoming transfers retrieved successfully' })
  async getIncomingTransfers(
    @Param('schoolId') schoolId: string,
    @Query('status') status?: TransferStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('schoolType') schoolType?: string
  ): Promise<ResponseDto<any>> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const data = await this.transfersService.getIncomingTransfers(
      schoolId,
      status,
      pageNum,
      limitNum,
      schoolType
    );
    return ResponseDto.ok(data, 'Incoming transfers retrieved successfully');
  }

  @Post('incoming/:transferId/complete')
  @RequirePermission(PermissionResource.TRANSFERS, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Complete transfer - migrate student data' })
  @ApiParam({ name: 'transferId', description: 'Transfer ID' })
  @ApiResponse({ status: 200, description: 'Transfer completed successfully' })
  @ApiResponse({ status: 404, description: 'Transfer not found' })
  @ApiResponse({ status: 409, description: 'Transfer has already been completed' })
  async completeTransfer(
    @Param('schoolId') schoolId: string,
    @Param('transferId') transferId: string,
    @Body() dto: CompleteTransferDto
  ): Promise<ResponseDto<any>> {
    const data = await this.transfersService.completeTransfer(schoolId, transferId, dto);
    return ResponseDto.ok(data, 'Transfer completed successfully');
  }

  @Post('incoming/:transferId/reject')
  @RequirePermission(PermissionResource.TRANSFERS, PermissionType.ADMIN)
  @ApiOperation({ summary: 'Reject transfer' })
  @ApiParam({ name: 'transferId', description: 'Transfer ID' })
  @ApiResponse({ status: 200, description: 'Transfer rejected successfully' })
  @ApiResponse({ status: 404, description: 'Transfer not found' })
  @ApiResponse({ status: 409, description: 'Cannot reject a completed transfer' })
  async rejectTransfer(
    @Param('schoolId') schoolId: string,
    @Param('transferId') transferId: string,
    @Body() dto: RejectTransferDto
  ): Promise<ResponseDto<any>> {
    const data = await this.transfersService.rejectTransfer(schoolId, transferId, dto);
    return ResponseDto.ok(data, 'Transfer rejected successfully');
  }
}
