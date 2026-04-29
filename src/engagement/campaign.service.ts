import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { Campaign, CampaignStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createCampaign(dto: CreateCampaignDto, userId: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.create({
      data: {
        ...dto,
        createdBy: userId,
      },
    });

    if (campaign.status === CampaignStatus.ACTIVE) {
      this.eventEmitter.emit('campaign.activated', campaign.id);
    }

    return campaign;
  }

  async findAll(): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async activate(id: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.ACTIVE },
    });
    this.eventEmitter.emit('campaign.activated', campaign.id);
    return campaign;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.campaign.delete({ where: { id } });
  }
}
