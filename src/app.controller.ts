import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AppService } from './app.service';

/**
 * Standard: 300 req/min for root and health checks.
 * Health check is skipped to allow for monitoring tools.
 */
@ApiTags('health')
@Controller()
@Throttle({ standard: {} })
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'API is healthy' })
  getHealth(): { status: string; timestamp: string } {
    return this.appService.getHealth();
  }
}
