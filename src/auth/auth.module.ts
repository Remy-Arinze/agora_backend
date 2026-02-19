import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpService } from './otp.service';
import { PasswordOtpService } from './password-otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ShadowUserGuard } from './guards/shadow-user.guard';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { CloudinaryModule } from '../storage/cloudinary/cloudinary.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error(
            'JWT_SECRET environment variable is required. Please set it in your .env file.'
          );
        }
        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '1d',
          },
        };
      },
      inject: [ConfigService],
    }),
    DatabaseModule,
    EmailModule,
    CloudinaryModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, PasswordOtpService, JwtStrategy, ShadowUserGuard],
  exports: [AuthService, OtpService, JwtStrategy, PassportModule, ShadowUserGuard],
})
export class AuthModule {}
