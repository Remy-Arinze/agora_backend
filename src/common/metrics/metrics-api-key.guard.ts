import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MetricsApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-metrics-api-key'];
    const expectedApiKey = this.configService.get<string>('METRICS_API_KEY');

    if (!expectedApiKey) {
      // If no key configured in dev, skip protection
      const isDev = this.configService.get<string>('NODE_ENV') !== 'production';
      if (isDev) return true;
      throw new UnauthorizedException('Metrics API Key not configured');
    }

    if (apiKeyHeader !== expectedApiKey) {
      throw new UnauthorizedException('Invalid Metrics API Key');
    }

    return true;
  }
}
