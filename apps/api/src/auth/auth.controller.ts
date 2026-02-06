import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto, VerifyOtpDto, VerifyLoginOtpDto, AuthTokensDto, LoginResponseDto } from './dto/login.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-reset.dto';
import { ResponseDto } from '../common/dto/response.dto';

// Cookie configuration constants
const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
  }

  /**
   * Set refresh token as httpOnly cookie
   */
  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: this.isProduction, // HTTPS only in production
      sameSite: this.isProduction ? 'strict' : 'lax', // CSRF protection
      maxAge: REFRESH_TOKEN_MAX_AGE,
      path: '/api/auth', // Only sent to auth endpoints
    });
  }

  /**
   * Clear refresh token cookie
   */
  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'strict' : 'lax',
      path: '/api/auth',
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 login attempts per minute
  @ApiOperation({ summary: 'Login with email/publicId and password - requires OTP verification' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Credentials validated. OTP sent to email. Session ID returned for OTP verification.',
    type: ResponseDto<LoginResponseDto>,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts. Please try again later.' })
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<ResponseDto<LoginResponseDto>> {
    this.logger.log(`[LOGIN] Received login request for: ${loginDto.emailOrPublicId}`);
    
    try {
      const data = await this.authService.login(loginDto);
      
      // Verify that we're returning the correct response structure
      if (!data.requiresOtp || !data.sessionId) {
        this.logger.error(`[LOGIN] Invalid response structure: ${JSON.stringify(data)}`);
        throw new Error('Invalid login response - OTP flow not initiated');
      }
      
      this.logger.log(`[LOGIN] Login initiated for ${loginDto.emailOrPublicId}, OTP required: ${data.requiresOtp}, sessionId: ${data.sessionId?.substring(0, 8)}...`);
      
      return ResponseDto.ok(
        data,
        'OTP sent to your email. Please verify to complete login.',
      );
    } catch (error) {
      this.logger.error('[LOGIN] Login error:', error instanceof Error ? error.stack : error);
      // DO NOT fall back to legacy login - always throw the error
      throw error;
    }
  }

  @Post('verify-login-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 OTP attempts per minute
  @ApiOperation({ summary: 'Verify login OTP and complete authentication' })
  @ApiBody({ type: VerifyLoginOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP verified. Login successful. Refresh token is set as httpOnly cookie.',
    type: ResponseDto<AuthTokensDto>,
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({
    status: 429,
    description: 'Too many OTP verification attempts. Please try again later.',
  })
  async verifyLoginOtp(
    @Body() verifyOtpDto: VerifyLoginOtpDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<ResponseDto<Omit<AuthTokensDto, 'refreshToken'> & { refreshToken?: string }>> {
    try {
      const data = await this.authService.verifyLoginOtp(verifyOtpDto);

      // Set refresh token as httpOnly cookie
      this.setRefreshTokenCookie(res, data.refreshToken);

      return ResponseDto.ok(
        {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        },
        'Login successful'
      );
    } catch (error) {
      this.logger.error('Verify login OTP error:', error instanceof Error ? error.stack : error);
      throw error;
    }
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 OTP attempts per minute
  @ApiOperation({ summary: 'Verify OTP and activate shadow parent account' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP verified and account activated. Refresh token is set as httpOnly cookie.',
    type: ResponseDto<AuthTokensDto>,
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({
    status: 429,
    description: 'Too many OTP verification attempts. Please try again later.',
  })
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<ResponseDto<Omit<AuthTokensDto, 'refreshToken'> & { refreshToken?: string }>> {
    const data = await this.authService.verifyOtp(verifyOtpDto);

    // Set refresh token as httpOnly cookie
    this.setRefreshTokenCookie(res, data.refreshToken);

    return ResponseDto.ok(
      {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken, // TODO: Remove after frontend migration
        user: data.user,
      },
      'Account activated successfully'
    );
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 password reset requests per minute
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiBody({ type: RequestPasswordResetDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent if user exists',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many password reset requests. Please try again later.',
  })
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto
  ): Promise<ResponseDto<void>> {
    await this.authService.requestPasswordReset(requestPasswordResetDto);
    return ResponseDto.ok(
      undefined,
      'If an account exists with this email, a password reset link has been sent'
    );
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 password reset attempts per minute
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiResponse({
    status: 429,
    description: 'Too many password reset attempts. Please try again later.',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<ResponseDto<void>> {
    await this.authService.resetPassword(resetPasswordDto);
    return ResponseDto.ok(undefined, 'Password reset successfully');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 30 } }) // 30 refresh requests per minute (more generous for legitimate use)
  @ApiOperation({
    summary: 'Refresh access token using refresh token from httpOnly cookie or body',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'JWT refresh token (optional if using httpOnly cookie)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully. New refresh token is set as httpOnly cookie.',
    type: ResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 429, description: 'Too many refresh requests. Please try again later.' })
  async refresh(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response
  ): Promise<ResponseDto<{ accessToken: string; refreshToken?: string }>> {
    // Get refresh token from httpOnly cookie first, fallback to body for backwards compatibility
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || body.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const data = await this.authService.refreshToken(refreshToken);

    // Set new refresh token as httpOnly cookie
    this.setRefreshTokenCookie(res, data.refreshToken);

    return ResponseDto.ok(
      {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken, // TODO: Remove after frontend migration
      },
      'Token refreshed successfully'
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear refresh token cookie' })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
  })
  async logout(@Res({ passthrough: true }) res: Response): Promise<ResponseDto<void>> {
    // Clear the refresh token cookie
    this.clearRefreshTokenCookie(res);
    return ResponseDto.ok(undefined, 'Logged out successfully');
  }
}
