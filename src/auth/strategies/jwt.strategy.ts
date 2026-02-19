import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayload, UserWithContext } from '../types/user-with-context.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_SECRET environment variable is required. Please set it in your .env file.'
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<UserWithContext> {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    // Invalidate token if password was changed after this token was issued (log out other sessions)
    if (
      user.passwordChangedAt &&
      (payload.pwdChangedAt == null ||
        payload.pwdChangedAt < Math.floor(user.passwordChangedAt.getTime() / 1000))
    ) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    return {
      ...user,
      currentSchoolId: payload.schoolId,
      currentPublicId: payload.publicId,
      currentProfileId: payload.profileId,
    };
  }
}
