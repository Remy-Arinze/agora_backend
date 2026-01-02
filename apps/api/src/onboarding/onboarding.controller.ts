import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant.decorator';
import { OnboardingService } from './onboarding.service';
import { ImportSummaryDto } from './dto/bulk-import.dto';
import { ResponseDto } from '../common/dto/response.dto';

@ApiTags('onboarding')
@Controller('onboarding')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth('JWT-auth')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('bulk-import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Bulk import students from Excel/CSV file',
    description:
      'Upload an Excel file with columns: firstName, lastName, dateOfBirth, class, parentPhone, parentEmail. Creates shadow profiles for students and parents.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Bulk import completed',
    type: ResponseDto<ImportSummaryDto>,
  })
  @ApiResponse({ status: 400, description: 'Invalid file format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @TenantId() tenantId: string
  ): Promise<ResponseDto<ImportSummaryDto>> {
    const data = await this.onboardingService.bulkImport(file, tenantId);
    return ResponseDto.ok(data, 'Bulk import completed');
  }
}

