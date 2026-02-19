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
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto, VerifyOtpDto, VerifyLoginOtpDto, AuthTokensDto, LoginResponseDto } from './dto/login.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-reset.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestChangePasswordDto } from './dto/request-change-password.dto';
import { ConfirmChangePasswordDto } from './dto/confirm-change-password.dto';
import { VerifyResetPasswordDto } from './dto/verify-reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ResponseDto } from '../common/dto/response.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

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
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Request password reset – sends OTP to email' })
  @ApiBody({ type: RequestPasswordResetDto })
  @ApiResponse({ status: 200, description: 'If an account exists, a verification code has been sent' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto
  ): Promise<ResponseDto<void>> {
    await this.authService.requestPasswordReset(requestPasswordResetDto);
    return ResponseDto.ok(
      undefined,
      'If an account exists with this email, a verification code has been sent. Use it with your new password on the verify-reset-password step.'
    );
  }

  @Post('verify-reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Verify reset OTP and set new password (forgot-password flow)' })
  @ApiBody({ type: VerifyResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully. All other sessions invalidated.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 429, description: 'Too many attempts.' })
  async verifyResetPassword(@Body() dto: VerifyResetPasswordDto): Promise<ResponseDto<void>> {
    await this.authService.verifyResetPasswordWithOtp(dto);
    return ResponseDto.ok(undefined, 'Password reset successfully. You can log in with your new password. All other sessions have been signed out.');
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Reset password using link token (e.g. admin-sent link)' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiResponse({ status: 429, description: 'Too many attempts.' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<ResponseDto<void>> {
    await this.authService.resetPassword(resetPasswordDto);
    return ResponseDto.ok(undefined, 'Password reset successfully. All other sessions have been signed out.');
  }

  @Post('request-change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request password change – sends OTP to email (step 1)' })
  @ApiBody({ type: RequestChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Verification code sent to your email. Use confirm-change-password with sessionId and code.' })
  @ApiResponse({ status: 401, description: 'Current password incorrect or not authenticated' })
  @ApiResponse({ status: 429, description: 'Too many attempts.' })
  async requestChangePassword(
    @Req() req: Request,
    @Body() dto: RequestChangePasswordDto,
  ): Promise<ResponseDto<{ sessionId: string }>> {
    const userId = (req.user as any)?.sub || (req.user as any)?.id;
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const result = await this.authService.requestChangePassword(userId, dto);
    return ResponseDto.ok(result, 'Verification code sent to your email. Use it with your new password on confirm-change-password.');
  }

  @Post('confirm-change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm password change with OTP (step 2)' })
  @ApiBody({ type: ConfirmChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully. All other sessions invalidated.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 429, description: 'Too many attempts.' })
  async confirmChangePassword(
    @Body() dto: ConfirmChangePasswordDto,
  ): Promise<ResponseDto<void>> {
    await this.authService.confirmChangePasswordWithOtp(dto);
    return ResponseDto.ok(undefined, 'Password changed successfully. You can continue using this session. All other sessions have been signed out.');
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (legacy single-step; prefer request-change-password + confirm-change-password with OTP)' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or new password same as current' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  @ApiResponse({ status: 429, description: 'Too many attempts.' })
  async changePassword(
    @Req() req: Request,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<ResponseDto<void>> {
    const userId = (req.user as any)?.sub || (req.user as any)?.id;
    if (!userId) throw new UnauthorizedException('User not authenticated');
    await this.authService.changePassword(userId, changePasswordDto);
    return ResponseDto.ok(undefined, 'Password changed successfully');
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

  @Post('profile/upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
    })
  )
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload super admin profile image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile image uploaded successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - SUPER_ADMIN role required' })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large' })
  @ApiResponse({ status: 500, description: 'Failed to upload image. Please try again later.' })
  async uploadProfileImage(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File
  ): Promise<ResponseDto<{ profileImage: string }>> {
    try {
      const userId = (req.user as any)?.sub || (req.user as any)?.id;
      
      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }

      if (!file) {
        throw new BadRequestException('No file provided. Please select an image to upload.');
      }

      // Validate file size early (before service call) for better UX
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        throw new BadRequestException(
          `File size (${fileSizeMB}MB) exceeds the maximum limit of 5MB. Please choose a smaller image.`
        );
      }

      // Validate file type early
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type (${file.mimetype}). Only JPEG, PNG, GIF, and WebP images are allowed.`
        );
      }

      const data = await this.authService.uploadProfileImage(userId, file);
      return ResponseDto.ok(data, 'Profile image uploaded successfully');
    } catch (error: any) {
      // Re-throw known HTTP exceptions as-is (they already have proper messages)
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        // Log warnings for client errors (not full stack traces)
        this.logger.warn(
          `[PROFILE_IMAGE_UPLOAD] ${error.constructor.name}: ${error.message}`
        );
        throw error;
      }

      // Log unexpected errors for debugging
      this.logger.error(
        '[PROFILE_IMAGE_UPLOAD] Unexpected error:',
        error instanceof Error ? error.stack : error
      );

      // Handle Cloudinary/timeout errors with user-friendly messages
      if (error?.http_code === 499 || error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
        throw new BadRequestException(
          'Image upload timed out. Please try again with a smaller image or check your internet connection.'
        );
      }

      // Handle Cloudinary configuration errors
      if (error?.message?.includes('Cloudinary is not configured') || error?.message?.includes('CLOUDINARY')) {
        throw new BadRequestException(
          'Image upload service is temporarily unavailable. Please contact support if this issue persists.'
        );
      }

      // Handle file buffer errors
      if (error?.message?.includes('File buffer is not available')) {
        throw new BadRequestException(
          'Failed to process image. Please try uploading again.'
        );
      }

      // Generic error with user-friendly message
      throw new BadRequestException(
        'Failed to upload image. Please ensure the file is a valid image and try again.'
      );
    }
  }
}
