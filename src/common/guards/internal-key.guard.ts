import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  private readonly internalKey: string;

  constructor(private readonly configService: ConfigService) {
    this.internalKey = this.configService.get<string>('INTERNAL_API_KEY', '');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-internal-key'];

    if (!apiKey || apiKey !== this.internalKey) {
      throw new UnauthorizedException('Invalid or missing internal service key');
    }

    return true;
  }
}
