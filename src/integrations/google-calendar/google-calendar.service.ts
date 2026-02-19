import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { EventDto } from '../../events/dto/event.dto';
import * as crypto from 'crypto';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly oauth2Client: OAuth2Client;
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    // Redirect URI should be the backend callback endpoint
    // Format: http://localhost:4000/api/integrations/google-calendar/callback
    const baseUrl = this.configService.get<string>('API_URL') || 'http://localhost:4000';
    const redirectUri =
      this.configService.get<string>('GOOGLE_REDIRECT_URI') ||
      `${baseUrl}/api/integrations/google-calendar/callback`;

    if (!clientId || !clientSecret) {
      this.logger.warn('Google Calendar credentials not configured');
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Use a fixed encryption key from env or generate one (for production, use a secure key)
    this.encryptionKey =
      this.configService.get<string>('GOOGLE_ENCRYPTION_KEY') ||
      'default-encryption-key-change-in-production-32-chars!!';
  }

  /**
   * Generate OAuth URL for user authorization
   */
  getAuthUrl(userId: string, schoolId: string): string {
    // Create state token with userId and schoolId
    const state = this.encryptState({ userId, schoolId });

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      state,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Handle OAuth callback and store tokens
   */
  async handleCallback(code: string, state: string): Promise<{ userId: string; schoolId: string }> {
    const { userId, schoolId } = this.decryptState(state);

    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new BadRequestException('Failed to obtain tokens from Google');
      }

      // Store tokens securely
      await this.prisma.googleCalendarSync.upsert({
        where: {
          userId_schoolId: {
            userId,
            schoolId,
          },
        },
        create: {
          userId,
          schoolId,
          googleCalendarId: 'primary',
          accessToken: this.encrypt(tokens.access_token),
          refreshToken: this.encrypt(tokens.refresh_token),
          tokenExpiry: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : new Date(Date.now() + 3600 * 1000), // Default 1 hour
          syncEnabled: true,
        },
        update: {
          accessToken: this.encrypt(tokens.access_token),
          refreshToken: this.encrypt(tokens.refresh_token),
          tokenExpiry: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : new Date(Date.now() + 3600 * 1000),
          syncEnabled: true,
          lastSyncAt: new Date(),
        },
      });

      this.logger.log(`Google Calendar connected for user ${userId} in school ${schoolId}`);

      return { userId, schoolId };
    } catch (error) {
      this.logger.error('Failed to handle OAuth callback', error);
      throw new BadRequestException('Failed to connect Google Calendar');
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  private async getValidAccessToken(sync: any): Promise<string> {
    // Check if token is expired or expires soon (within 5 minutes)
    const now = new Date();
    const expiresSoon = new Date(sync.tokenExpiry.getTime() - 5 * 60 * 1000);

    if (now < expiresSoon) {
      // Token is still valid
      return this.decrypt(sync.accessToken);
    }

    // Token expired, refresh it
    this.oauth2Client.setCredentials({
      refresh_token: this.decrypt(sync.refreshToken),
    });

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      await this.prisma.googleCalendarSync.update({
        where: { id: sync.id },
        data: {
          accessToken: this.encrypt(credentials.access_token!),
          tokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : new Date(Date.now() + 3600 * 1000),
        },
      });

      return credentials.access_token!;
    } catch (error) {
      this.logger.error('Failed to refresh access token', error);
      throw new BadRequestException('Failed to refresh Google Calendar access token');
    }
  }

  /**
   * Sync event to Google Calendar
   */
  async syncEventToGoogle(
    event: EventDto,
    userId: string,
    schoolId: string
  ): Promise<string | null> {
    const sync = await this.prisma.googleCalendarSync.findUnique({
      where: {
        userId_schoolId: {
          userId,
          schoolId,
        },
      },
    });

    if (!sync || !sync.syncEnabled) {
      return null;
    }

    try {
      const accessToken = await this.getValidAccessToken(sync);
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const googleEvent: any = {
        summary: event.title,
        description: event.description || '',
        start: event.isAllDay
          ? {
              date: new Date(event.startDate).toISOString().split('T')[0],
            }
          : {
              dateTime: new Date(event.startDate).toISOString(),
              timeZone: 'UTC',
            },
        end: event.isAllDay
          ? {
              date: new Date(event.endDate).toISOString().split('T')[0],
            }
          : {
              dateTime: new Date(event.endDate).toISOString(),
              timeZone: 'UTC',
            },
        location: event.location || event.roomName || '',
        colorId: this.mapEventTypeToColor(event.type),
      };

      let googleEventId: string;

      if (event.googleEventId) {
        // Update existing event
        const response = await calendar.events.update({
          calendarId: sync.googleCalendarId,
          eventId: event.googleEventId,
          requestBody: googleEvent,
        });
        googleEventId = response.data.id!;
      } else {
        // Create new event
        const response = await calendar.events.insert({
          calendarId: sync.googleCalendarId,
          requestBody: googleEvent,
        });
        googleEventId = response.data.id!;
      }

      this.logger.log(`Synced event ${event.id} to Google Calendar as ${googleEventId}`);
      return googleEventId;
    } catch (error: any) {
      this.logger.error(`Failed to sync event ${event.id} to Google Calendar`, error);
      throw error;
    }
  }

  /**
   * Delete event from Google Calendar
   */
  async deleteEventFromGoogle(
    googleEventId: string,
    userId: string,
    schoolId: string
  ): Promise<void> {
    const sync = await this.prisma.googleCalendarSync.findUnique({
      where: {
        userId_schoolId: {
          userId,
          schoolId,
        },
      },
    });

    if (!sync || !sync.syncEnabled) {
      return;
    }

    try {
      const accessToken = await this.getValidAccessToken(sync);
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      await calendar.events.delete({
        calendarId: sync.googleCalendarId,
        eventId: googleEventId,
      });

      this.logger.log(`Deleted event ${googleEventId} from Google Calendar`);
    } catch (error: any) {
      // If event not found in Google Calendar, that's okay (might have been deleted manually)
      if (error.code === 404) {
        this.logger.warn(`Event ${googleEventId} not found in Google Calendar`);
        return;
      }
      this.logger.error(`Failed to delete event ${googleEventId} from Google Calendar`, error);
      throw error;
    }
  }

  /**
   * Disconnect Google Calendar
   */
  async disconnect(userId: string, schoolId: string): Promise<void> {
    await this.prisma.googleCalendarSync.deleteMany({
      where: {
        userId,
        schoolId,
      },
    });

    this.logger.log(`Google Calendar disconnected for user ${userId} in school ${schoolId}`);
  }

  /**
   * Get sync status
   */
  async getSyncStatus(userId: string, schoolId: string): Promise<any | null> {
    const sync = await this.prisma.googleCalendarSync.findUnique({
      where: {
        userId_schoolId: {
          userId,
          schoolId,
        },
      },
      select: {
        id: true,
        syncEnabled: true,
        lastSyncAt: true,
        syncDirection: true,
        createdAt: true,
      },
    });

    return sync;
  }

  /**
   * Map event type to Google Calendar color
   */
  private mapEventTypeToColor(type: string): string {
    const colorMap: Record<string, string> = {
      ACADEMIC: '9', // Blue
      EVENT: '10', // Green
      EXAM: '11', // Red
      MEETING: '3', // Purple
      HOLIDAY: '8', // Gray
    };
    return colorMap[type] || '1';
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey.substring(0, 32).padEnd(32, '0')),
      iv
    );
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey.substring(0, 32).padEnd(32, '0')),
      iv
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Encrypt state for OAuth flow
   */
  private encryptState(data: { userId: string; schoolId: string }): string {
    const json = JSON.stringify(data);
    return Buffer.from(json).toString('base64url');
  }

  /**
   * Decrypt state from OAuth flow
   */
  private decryptState(state: string): { userId: string; schoolId: string } {
    try {
      const json = Buffer.from(state, 'base64url').toString('utf8');
      return JSON.parse(json);
    } catch (error) {
      throw new BadRequestException('Invalid state parameter');
    }
  }
}
