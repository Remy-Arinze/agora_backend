import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Engagement Campaigns')
@Controller('engagement/campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@ApiBearerAuth()
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new retention or promotional campaign' })
  async create(@Body() dto: CreateCampaignDto, @Req() req: any) {
    return this.campaignService.createCampaign(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all campaigns' })
  async findAll() {
    return this.campaignService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific campaign' })
  async findOne(@Param('id') id: string) {
    return this.campaignService.findOne(id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a campaign (starts sending)' })
  async activate(@Param('id') id: string) {
    return this.campaignService.activate(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a campaign' })
  async delete(@Param('id') id: string) {
    return this.campaignService.delete(id);
  }
}
