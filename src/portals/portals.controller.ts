import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ResponseDto } from '../common/dto/response.dto';
import { PortalsService, PortalBrandingDto, SlugAvailability } from './portals.service';

@ApiTags('public')
@Controller('public/portals')
export class PortalsController {
  constructor(private readonly portals: PortalsService) {}

  @Get('slug-available')
  @Throttle({ standard: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Check whether a school portal slug is available' })
  @ApiQuery({ name: 'slug', required: true })
  async slugAvailable(@Query('slug') slug: string): Promise<ResponseDto<SlugAvailability>> {
    if (!slug) {
      throw new BadRequestException('slug is required');
    }
    const data = await this.portals.checkSlugAvailable(slug);
    return ResponseDto.ok(data, data.available ? 'Available' : 'Not available');
  }

  @Get('by-host')
  @ApiOperation({ summary: 'Resolve live school branding from a hostname' })
  @ApiQuery({ name: 'host', required: true })
  async byHost(
    @Query('host') host: string,
  ): Promise<ResponseDto<PortalBrandingDto | null>> {
    if (!host) {
      throw new BadRequestException('host is required');
    }
    const data = await this.portals.resolveByHost(host);
    return ResponseDto.ok(data, data ? 'Portal found' : 'No live portal for this host');
  }
}
