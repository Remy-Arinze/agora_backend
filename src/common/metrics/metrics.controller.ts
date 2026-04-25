import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { MetricsApiKeyGuard } from './metrics-api-key.guard';

@Controller('metrics')
export class MetricsController extends PrometheusController {
  @Get()
  @SkipThrottle()
  @UseGuards(MetricsApiKeyGuard)
  @Header('Content-Type', 'text/plain')
  async index(@Res() response: Response) {
    return super.index(response);
  }
}
