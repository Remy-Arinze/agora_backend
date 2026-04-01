import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(IpWhitelistGuard.name);
  private readonly allowedIps: string[];

  constructor(private readonly configService: ConfigService) {
    const ips = this.configService.get<string>('PAYMENT_WEBHOOK_ALLOWED_IPS', '');
    this.allowedIps = ips.split(',').map((ip) => ip.trim()).filter((ip) => ip.length > 0);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const forwardedFor = request.headers['x-forwarded-for'];
    const ip = forwardedFor 
      ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(',')[0].trim() 
      : request.ip || request.connection?.remoteAddress;

    const eventType = request.body?.event || 'unknown_webhook_event';

    const isAllowed = this.allowedIps.includes(ip) || this.allowedIps.length === 0; // Length 0 means no restriction for dev

    if (!isAllowed) {
      this.logger.warn(`Rejected webhook request from unauthorized IP: ${ip} | Event: ${eventType}`);
      throw new ForbiddenException(`IP ${ip} is not authorized to call this webhook`);
    }

    this.logger.log(`Accepted webhook request from authorized IP: ${ip} | Event: ${eventType}`);
    return true;
  }
}
