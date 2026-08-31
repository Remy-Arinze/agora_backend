import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { Dropbox, DropboxAuth } from 'dropbox';
import { Storage } from 'megajs';
import archiver from 'archiver';
import { Readable } from 'stream';
import { PrismaService } from '../database/prisma.service';
import { OpenObserveLogger } from '../common/logger/openobserve-logger.service';
import { ExportService } from '../export/export.service';
import { EncryptionService } from './encryption.service';

@Injectable()
export class BackupService {
  constructor(
    private readonly exportService: ExportService,
    private readonly encryption: EncryptionService,
    private readonly prisma: PrismaService,
    private readonly logger: OpenObserveLogger,
    private readonly configService: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Task 11.1 — getOAuthUrl() and handleOAuthCallback()
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns the OAuth authorisation URL for Google Drive or Dropbox.
   * The `state` param encodes schoolId as base64 JSON so the callback
   * can recover context without a server-side session.
   */
  async getOAuthUrl(
    schoolId: string,
    provider: 'GOOGLE_DRIVE' | 'DROPBOX',
  ): Promise<string> {
    if (provider === 'GOOGLE_DRIVE') {
      return this.getGoogleDriveAuthUrl(schoolId);
    }
    return this.getDropboxAuthUrl(schoolId);
  }

  /**
   * Handles the OAuth callback from Google Drive or Dropbox.
   * Exchanges the authorisation code for tokens, encrypts them, and
   * upserts a SchoolCloudBackup record.
   */
  async handleOAuthCallback(
    schoolId: string,
    provider: 'GOOGLE_DRIVE' | 'DROPBOX',
    code: string,
  ): Promise<void> {
    if (provider === 'GOOGLE_DRIVE') {
      return this.handleGoogleDriveCallback(schoolId, code);
    }
    return this.handleDropboxCallback(schoolId, code);
  }

  // ── Google Drive ──────────────────────────────────────────────────────────

  private buildGoogleOAuth2Client(schoolId: string) {
    const clientId = this.configService.get<string>('GOOGLE_DRIVE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_DRIVE_CLIENT_SECRET');
    const apiUrl = this.configService.get<string>('API_URL') ?? 'http://localhost:4000';
    const redirectUri =
      this.configService.get<string>('GOOGLE_DRIVE_REDIRECT_URI') ??
      `${apiUrl}/api/schools/${schoolId}/export/backup/google-drive/callback`;

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private getGoogleDriveAuthUrl(schoolId: string): string {
    const oauth2Client = this.buildGoogleOAuth2Client(schoolId);
    const state = Buffer.from(JSON.stringify({ schoolId })).toString('base64');

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      state,
      prompt: 'consent',
    });
  }

  private async handleGoogleDriveCallback(schoolId: string, code: string): Promise<void> {
    const oauth2Client = this.buildGoogleOAuth2Client(schoolId);

    let tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null };
    try {
      const result = await oauth2Client.getToken(code);
      tokens = result.tokens;
    } catch (err) {
      this.logger.error('Failed to exchange Google Drive OAuth code', String(err), 'BackupService');
      throw new BadRequestException('Failed to obtain tokens from Google Drive');
    }

    if (!tokens.access_token) {
      throw new BadRequestException('Google Drive did not return an access token');
    }

    const accessToken = this.encryption.encrypt(tokens.access_token);
    const refreshToken = tokens.refresh_token
      ? this.encryption.encrypt(tokens.refresh_token)
      : undefined;
    const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;

    await this.prisma.schoolCloudBackup.upsert({
      where: { schoolId_provider: { schoolId, provider: 'GOOGLE_DRIVE' } },
      create: {
        schoolId,
        provider: 'GOOGLE_DRIVE',
        isConnected: true,
        accessToken,
        refreshToken,
        tokenExpiry,
      },
      update: {
        isConnected: true,
        accessToken,
        refreshToken,
        tokenExpiry,
      },
    });

    this.logger.log(`Google Drive connected for school ${schoolId}`, 'BackupService');
  }

  // ── Dropbox ───────────────────────────────────────────────────────────────

  private buildDropboxAuth(schoolId: string): DropboxAuth {
    const clientId = this.configService.get<string>('DROPBOX_CLIENT_ID');
    const clientSecret = this.configService.get<string>('DROPBOX_CLIENT_SECRET');

    return new DropboxAuth({ clientId, clientSecret });
  }

  private getDropboxRedirectUri(schoolId: string): string {
    const apiUrl = this.configService.get<string>('API_URL') ?? 'http://localhost:4000';
    return (
      this.configService.get<string>('DROPBOX_REDIRECT_URI') ??
      `${apiUrl}/api/schools/${schoolId}/export/backup/dropbox/callback`
    );
  }

  private async getDropboxAuthUrl(schoolId: string): Promise<string> {
    const dbxAuth = this.buildDropboxAuth(schoolId);
    const redirectUri = this.getDropboxRedirectUri(schoolId);
    const state = Buffer.from(JSON.stringify({ schoolId })).toString('base64');

    // getAuthenticationUrl returns string | URL — normalise to string
    const url = await dbxAuth.getAuthenticationUrl(
      redirectUri,
      state,
      'code',
      'offline',
      undefined,
      undefined,
      false,
    );

    return url.toString();
  }

  private async handleDropboxCallback(schoolId: string, code: string): Promise<void> {
    const dbxAuth = this.buildDropboxAuth(schoolId);
    const redirectUri = this.getDropboxRedirectUri(schoolId);

    let tokenResponse: any;
    try {
      tokenResponse = await dbxAuth.getAccessTokenFromCode(redirectUri, code);
    } catch (err) {
      this.logger.error('Failed to exchange Dropbox OAuth code', String(err), 'BackupService');
      throw new BadRequestException('Failed to obtain tokens from Dropbox');
    }

    const result = tokenResponse?.result ?? tokenResponse;
    const accessTokenValue: string | undefined = result?.access_token;
    const refreshTokenValue: string | undefined = result?.refresh_token;

    if (!accessTokenValue) {
      throw new BadRequestException('Dropbox did not return an access token');
    }

    const accessToken = this.encryption.encrypt(accessTokenValue);
    const refreshToken = refreshTokenValue
      ? this.encryption.encrypt(refreshTokenValue)
      : undefined;

    await this.prisma.schoolCloudBackup.upsert({
      where: { schoolId_provider: { schoolId, provider: 'DROPBOX' } },
      create: {
        schoolId,
        provider: 'DROPBOX',
        isConnected: true,
        accessToken,
        refreshToken,
      },
      update: {
        isConnected: true,
        accessToken,
        refreshToken,
      },
    });

    this.logger.log(`Dropbox connected for school ${schoolId}`, 'BackupService');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Task 11.2 — connectMega()
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Saves AES-256-GCM encrypted MEGA credentials.
   * Both email and password are stored encrypted so the backup job can
   * authenticate without requiring the user to re-enter credentials.
   */
  async connectMega(schoolId: string, email: string, password: string): Promise<void> {
    const megaEmail = this.encryption.encrypt(email);
    const megaPassword = this.encryption.encrypt(password);

    await this.prisma.schoolCloudBackup.upsert({
      where: { schoolId_provider: { schoolId, provider: 'MEGA' } },
      create: {
        schoolId,
        provider: 'MEGA',
        isConnected: true,
        megaEmail,
        megaPassword,
      },
      update: {
        isConnected: true,
        megaEmail,
        megaPassword,
      },
    });

    this.logger.log(`MEGA connected for school ${schoolId}`, 'BackupService');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Task 11.3 — getStatus() and disconnect()
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns the connection status for the given provider.
   * Returns { isConnected: false, lastBackupAt: null, lastBackupStatus: null }
   * when no record exists yet.
   */
  async getStatus(
    schoolId: string,
    provider: string,
  ): Promise<{
    isConnected: boolean;
    lastBackupAt: Date | null;
    lastBackupStatus: string | null;
  }> {
    const record = await this.prisma.schoolCloudBackup.findUnique({
      where: { schoolId_provider: { schoolId, provider } },
      select: {
        isConnected: true,
        lastBackupAt: true,
        lastBackupStatus: true,
      },
    });

    if (!record) {
      return { isConnected: false, lastBackupAt: null, lastBackupStatus: null };
    }

    return {
      isConnected: record.isConnected,
      lastBackupAt: record.lastBackupAt,
      lastBackupStatus: record.lastBackupStatus,
    };
  }

  /**
   * Clears all token/credential fields and sets isConnected = false.
   * Uses upsert so the call is safe even when the record does not yet exist.
   */
  async disconnect(schoolId: string, provider: string): Promise<void> {
    await this.prisma.schoolCloudBackup.upsert({
      where: { schoolId_provider: { schoolId, provider } },
      create: {
        schoolId,
        provider,
        isConnected: false,
      },
      update: {
        isConnected: false,
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        megaEmail: null,
        megaPassword: null,
      },
    });

    this.logger.log(`${provider} disconnected for school ${schoolId}`, 'BackupService');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Task 11.4 — backupNow()
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generates all CSV exports for the current academic context, packages them
   * into a ZIP archive, uploads to the specified cloud provider, and records
   * the backup result (SUCCESS or FAILED) in SchoolCloudBackup.
   */
  async backupNow(
    schoolId: string,
    provider: 'GOOGLE_DRIVE' | 'DROPBOX' | 'MEGA',
  ): Promise<void> {
    try {
      // 1. Resolve current academic context
      const currentSession = await this.prisma.academicSession.findFirst({
        where: { schoolId, status: 'ACTIVE' },
        include: { terms: { where: { status: 'ACTIVE' }, take: 1 } },
      });

      if (!currentSession) {
        throw new BadRequestException('No active academic session found for backup');
      }

      const currentAcademicYear = currentSession.name;
      const currentTermId = currentSession.terms[0]?.id;

      if (!currentTermId) {
        throw new BadRequestException('No active term found for backup');
      }

      // 2. Generate roster and fees CSV buffers
      const rosterBuf = await this.exportService.exportRoster(
        schoolId,
        currentAcademicYear,
        'BACKUP',
      );
      const feesBuf = await this.exportService.exportFees(schoolId, currentTermId, 'BACKUP');

      // 3. Get all class arms for the school and generate per-arm attendance/grades
      const classArms = await this.prisma.classArm.findMany({
        where: { classLevel: { schoolId } },
        include: { classLevel: true },
      });

      const attBuffers = await Promise.all(
        classArms.map((arm) =>
          this.exportService.exportAttendance(
            schoolId,
            arm.id,
            'CLASS_ARM',
            currentTermId,
            'BACKUP',
          ),
        ),
      );

      // For grades, use distinct Class IDs from active enrollments in this term
      // (ClassArm.classLevelId maps to ClassLevel, not Class; grades are on Class level)
      const enrollmentsForTerm = await this.prisma.enrollment.findMany({
        where: { schoolId, termId: currentTermId, isActive: true },
        select: { classId: true },
        distinct: ['classId'],
      });

      const distinctClassIds = enrollmentsForTerm
        .map((e) => e.classId)
        .filter((id): id is string => Boolean(id));

      const gradeBuffers = await Promise.all(
        distinctClassIds.map((classId) =>
          this.exportService.exportGrades(schoolId, classId, currentTermId, 'BACKUP'),
        ),
      );

      // 4. Assemble ZIP
      const zipBuffer = await this.assembleZip(schoolId, currentTermId, {
        roster: rosterBuf,
        fees: feesBuf,
        attendance: attBuffers.map((buf, i) => ({ buf, armId: classArms[i].id })),
        grades: gradeBuffers.map((buf, i) => ({ buf, classId: distinctClassIds[i] })),
      });

      // 5. Upload to provider
      await this.uploadToProvider(schoolId, provider, zipBuffer);

      // 6. Record success
      await this.prisma.schoolCloudBackup.update({
        where: { schoolId_provider: { schoolId, provider } },
        data: { lastBackupAt: new Date(), lastBackupStatus: 'SUCCESS' },
      });

      this.logger.log(
        `Backup to ${provider} succeeded for school ${schoolId}`,
        'BackupService',
      );
    } catch (err) {
      // Record failure before re-throwing
      try {
        await this.prisma.schoolCloudBackup.update({
          where: { schoolId_provider: { schoolId, provider } },
          data: { lastBackupStatus: 'FAILED' },
        });
      } catch (updateErr) {
        this.logger.error(
          'Failed to record backup failure status',
          String(updateErr),
          'BackupService',
        );
      }
      throw err;
    }
  }

  // ── ZIP Assembly ──────────────────────────────────────────────────────────

  private async assembleZip(
    schoolId: string,
    termId: string,
    data: {
      roster: Buffer;
      fees: Buffer;
      attendance: { buf: Buffer; armId: string }[];
      grades: { buf: Buffer; classId: string }[];
    },
  ): Promise<Buffer> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      // Roster
      archive.append(data.roster, {
        name: `student-roster-${schoolId}-${today}.csv`,
      });

      // Attendance — one file per class arm
      data.attendance.forEach(({ buf, armId }) => {
        archive.append(buf, {
          name: `attendance-${armId}-${termId}-${today}.csv`,
        });
      });

      // Grades — one file per class
      data.grades.forEach(({ buf, classId }) => {
        archive.append(buf, {
          name: `grades-${classId}-${termId}-${today}.csv`,
        });
      });

      // Fees
      archive.append(data.fees, {
        name: `fees-${schoolId}-${termId}-${today}.csv`,
      });

      archive.finalize();
    });

    return zipBuffer;
  }

  // ── Provider Upload ───────────────────────────────────────────────────────

  private async uploadToProvider(
    schoolId: string,
    provider: 'GOOGLE_DRIVE' | 'DROPBOX' | 'MEGA',
    zipBuffer: Buffer,
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const filename = `agora-backup-${schoolId}-${today}.zip`;

    const record = await this.prisma.schoolCloudBackup.findUnique({
      where: { schoolId_provider: { schoolId, provider } },
    });

    if (!record || !record.isConnected) {
      throw new BadRequestException(`${provider} is not connected for this school`);
    }

    if (provider === 'GOOGLE_DRIVE') {
      await this.uploadToGoogleDrive(schoolId, record, zipBuffer, filename);
    } else if (provider === 'DROPBOX') {
      await this.uploadToDropbox(record, zipBuffer, filename);
    } else {
      await this.uploadToMega(record, zipBuffer, filename);
    }
  }

  private async uploadToGoogleDrive(
    schoolId: string,
    record: { accessToken: string | null; refreshToken: string | null; tokenExpiry: Date | null },
    zipBuffer: Buffer,
    filename: string,
  ): Promise<void> {
    if (!record.accessToken) {
      throw new BadRequestException('Google Drive access token is missing');
    }

    const oauth2Client = this.buildGoogleOAuth2Client(schoolId);
    oauth2Client.setCredentials({
      access_token: this.encryption.decrypt(record.accessToken),
      refresh_token: record.refreshToken ? this.encryption.decrypt(record.refreshToken) : undefined,
      expiry_date: record.tokenExpiry ? record.tokenExpiry.getTime() : undefined,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const stream = Readable.from(zipBuffer);

    await drive.files.create({
      requestBody: {
        name: filename,
        mimeType: 'application/zip',
      },
      media: {
        mimeType: 'application/zip',
        body: stream,
      },
    });
  }

  private async uploadToDropbox(
    record: { accessToken: string | null },
    zipBuffer: Buffer,
    filename: string,
  ): Promise<void> {
    if (!record.accessToken) {
      throw new BadRequestException('Dropbox access token is missing');
    }

    const accessToken = this.encryption.decrypt(record.accessToken);
    const dbx = new Dropbox({ accessToken });

    await dbx.filesUpload({
      path: `/${filename}`,
      contents: zipBuffer,
    });
  }

  private async uploadToMega(
    record: { megaEmail: string | null; megaPassword: string | null },
    zipBuffer: Buffer,
    filename: string,
  ): Promise<void> {
    if (!record.megaEmail || !record.megaPassword) {
      throw new BadRequestException('MEGA credentials are missing');
    }

    const email = this.encryption.decrypt(record.megaEmail);
    const password = this.encryption.decrypt(record.megaPassword);

    // keepalive: false — this is a one-shot backup, not a long-lived session
    const storage = new Storage({ email, password, keepalive: false });

    try {
      // Login errors reject `ready`; Storage.on() is not typed for 'error'
      await storage.ready;
      await storage.upload({ name: filename, size: zipBuffer.length }, zipBuffer).complete;
    } finally {
      await storage.close().catch(() => undefined);
    }
  }
}
