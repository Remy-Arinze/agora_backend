import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // Support both MAIL_* and SMTP_* environment variable names
    const host =
      this.configService.get<string>('MAIL_HOST') || this.configService.get<string>('SMTP_HOST');
    // Parse port as number, default to 587 for standard SMTP, but Mailtrap uses 2525
    const portRaw =
      this.configService.get<string>('MAIL_PORT') || this.configService.get<string>('SMTP_PORT');
    const port = portRaw ? parseInt(portRaw, 10) : 587;
    const user =
      this.configService.get<string>('MAIL_USER') || this.configService.get<string>('SMTP_USER');
    const password =
      this.configService.get<string>('MAIL_PASSWORD') ||
      this.configService.get<string>('SMTP_PASSWORD');
    // Mailtrap uses secure: false, so default to false if not specified
    const secureRaw =
      this.configService.get<string>('MAIL_SECURE') ||
      this.configService.get<string>('SMTP_SECURE');
    const secure = secureRaw === 'true';

    // Log configuration (without sensitive data)
    this.logger.log(`Initializing email service with host: ${host}, port: ${port}`);

    if (!host || !user || !password) {
      this.logger.warn(
        'Email service configuration incomplete. Some environment variables may be missing.'
      );
      this.logger.warn(
        `Host: ${host ? '✓' : '✗'}, User: ${user ? '✓' : '✗'}, Password: ${password ? '✓' : '✗'}`
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: secure, // true for 465, false for other ports (Mailtrap uses false)
      auth: {
        user,
        pass: password,
      },
    });

    // Verify connection on startup
    this.verifyConnection().catch((error) => {
      this.logger.error('Initial SMTP connection verification failed:', error);
    });
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
    role: string,
    schools?: Array<{ name: string; publicId: string; role: string }>,
    publicId?: string, // Legacy parameter for backward compatibility
    schoolName?: string // Legacy parameter for backward compatibility
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error(
        'No FROM email address configured. Check MAIL_FROM or SMTP_FROM environment variable.'
      );
      throw new Error('Email configuration error: No FROM address');
    }

    // Build schools section HTML
    let schoolsSection = '';
    if (schools && schools.length > 0) {
      if (schools.length === 1) {
        // Single school - show simple format
        schoolsSection = `
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #1e40af; font-weight: bold;">School: <strong>${schools[0].name}</strong></p>
            <p style="margin: 10px 0 0 0; color: #1e40af; font-weight: bold;">Your Public ID: <code style="background-color: white; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${schools[0].publicId}</code></p>
            <p style="margin: 10px 0 0 0; color: #1e40af; font-size: 14px;">Use this Public ID along with your password to log in to your account.</p>
          </div>
        `;
      } else {
        // Multiple schools - show all
        const schoolsList = schools
          .map(
            (school) => `
          <div style="background-color: white; padding: 12px; margin: 8px 0; border-radius: 4px; border: 1px solid #dbeafe;">
            <p style="margin: 0; color: #1e40af; font-weight: bold;">${school.name} (${school.role})</p>
            <p style="margin: 5px 0 0 0; color: #1e40af; font-size: 14px;">Public ID: <code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-size: 14px;">${school.publicId}</code></p>
          </div>
        `
          )
          .join('');

        schoolsSection = `
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #1e40af; font-weight: bold; font-size: 16px;">Your Schools & Public IDs:</p>
            <p style="margin: 10px 0; color: #1e40af; font-size: 14px;">You have accounts at multiple schools. After resetting your password, you can log in using:</p>
            <div style="margin-top: 15px;">
              ${schoolsList}
            </div>
            <p style="margin: 15px 0 0 0; color: #1e40af; font-size: 14px;">
              <strong>Note:</strong> Resetting your password will update it for <strong>all schools</strong>. You can log in with your email (goes to first school) or any Public ID above (goes to that specific school).
            </p>
          </div>
        `;
      }
    } else if (publicId && schoolName) {
      // Legacy format for backward compatibility
      schoolsSection = `
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #1e40af; font-weight: bold;">Your Public ID: <code style="background-color: white; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${publicId}</code></p>
          <p style="margin: 10px 0 0 0; color: #1e40af; font-size: 14px;">Use this Public ID along with your password to log in to your account.</p>
        </div>
      `;
    }

    // Determine if this is a password reset request or new account setup
    // If schools array is provided (even with 1 school), it's a password reset request
    // If schools is undefined but schoolName/publicId are provided, it's a new account setup
    const isPasswordReset = schools !== undefined; // schools array provided = password reset
    const isNewAccount = !isPasswordReset && (schoolName || publicId); // legacy params = new account

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: isPasswordReset
        ? 'Reset Your Password - Agora Education Platform'
        : 'Set Your Password - Agora Education Platform',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${isPasswordReset ? 'Reset Your Password' : 'Set Your Password'}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 2px solid #e5e7eb;">
            <h1 style="color: #1f2937; margin: 0; font-size: 24px;">Agora Education Platform</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            ${
              isPasswordReset
                ? `
            <h2 style="color: #1f2937; margin-top: 0;">Password Reset Request</h2>
            <p>Hello ${name},</p>
            <p>We received a request to reset your password for your <strong>${role}</strong> account on the Agora Education Platform.</p>
            <p>If you didn't make this request, you can safely ignore this email. Your password will remain unchanged.</p>
            `
                : `
            <h2 style="color: #1f2937; margin-top: 0;">Welcome, ${name}!</h2>
            <p>Your account has been created${schoolName ? ` at <strong>${schoolName}</strong>` : ''} on the Agora Education Platform as a <strong>${role}</strong>.</p>
            <p>To get started, please set your password using the link below.</p>
            `
            }
            ${schoolsSection}
            <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 25px 0;">
              <p style="margin: 0 0 15px 0; color: #374151; font-weight: 600;">${isPasswordReset ? 'Click the button below to reset your password:' : 'Click the button below to set your password:'}</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">${isPasswordReset ? 'Reset Password' : 'Set Password'}</a>
              </div>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              <strong>Alternative:</strong> Copy and paste this link into your browser:
            </p>
            <p style="color: #6b7280; font-size: 12px; word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace;">${resetUrl}</p>
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 25px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-size: 13px;">
                <strong>⏱️ Important:</strong> This link will expire in ${isPasswordReset ? '1 hour' : '24 hours'}. ${isPasswordReset ? 'For security reasons, password reset links expire quickly.' : 'Please set your password as soon as possible.'}
              </p>
            </div>
            ${
              isPasswordReset
                ? `
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              <strong>Security Tip:</strong> If you didn't request this password reset, please ignore this email. Your account remains secure, and no changes will be made.
            </p>
            `
                : ''
            }
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      this.logger.log(`Attempting to send password reset email to ${email} from ${fromEmail}`);
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Password reset email sent successfully to ${email}. MessageId: ${result.messageId}`
      );
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${email}:`, error);
      this.logger.error(`Error details: ${error.message}`);
      if (error.response) {
        this.logger.error(`SMTP Response: ${error.response}`);
      }
      if (error.code) {
        this.logger.error(`Error code: ${error.code}`);
      }
      throw error;
    }
  }

  async sendPasswordResetConfirmationEmail(
    email: string,
    name: string,
    publicId?: string,
    schoolName?: string
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error(
        'No FROM email address configured. Check MAIL_FROM or SMTP_FROM environment variable.'
      );
      throw new Error('Email configuration error: No FROM address');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/auth/login`;

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: 'Password Successfully Changed - Agora Education Platform',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #10b981; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Agora Education Platform</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Password Successfully Changed</h2>
            <p>Hello ${name},</p>
            <p>Your password has been successfully changed${schoolName ? ` for your account at <strong>${schoolName}</strong>` : ''} on <strong>${new Date().toLocaleString()}</strong>.</p>
            ${
              publicId
                ? `
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #1e40af; font-weight: bold;">Your Public ID: <code style="background-color: white; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${publicId}</code></p>
              <p style="margin: 10px 0 0 0; color: #1e40af; font-size: 14px;">Use this Public ID along with your password to log in.</p>
            </div>
            `
                : ''
            }
            <p>You can now log in to your account using your ${publicId ? 'Public ID or ' : ''}email and your new password.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Log In</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>Security Notice:</strong> If you did not change your password, please contact support immediately.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      this.logger.log(
        `Attempting to send password reset confirmation email to ${email} from ${fromEmail}`
      );
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Password reset confirmation email sent successfully to ${email}. MessageId: ${result.messageId}`
      );
    } catch (error: any) {
      this.logger.error(`Failed to send confirmation email to ${email}:`, error);
      this.logger.error(`Error details: ${error.message}`);
      if (error.response) {
        this.logger.error(`SMTP Response: ${error.response}`);
      }
      if (error.code) {
        this.logger.error(`Error code: ${error.code}`);
      }
      throw error;
    }
  }

  async sendRoleChangeEmail(
    email: string,
    name: string,
    oldRole: string,
    newRole: string,
    publicId?: string,
    schoolName?: string
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error(
        'No FROM email address configured. Check MAIL_FROM or SMTP_FROM environment variable.'
      );
      throw new Error('Email configuration error: No FROM address');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/auth/login`;

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `Role Change Notification - ${newRole} - Agora Education Platform`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Role Change Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #8b5cf6; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Agora Education Platform</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Role Change Notification</h2>
            <p>Hello ${name},</p>
            ${schoolName ? `<p>Your role at <strong>${schoolName}</strong> has been updated.</p>` : '<p>Your role has been updated.</p>'}
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-weight: bold;">Previous Role: ${oldRole}</p>
              <p style="margin: 10px 0 0 0; color: #92400e; font-weight: bold;">New Role: <span style="color: #059669;">${newRole}</span></p>
            </div>
            ${
              publicId
                ? `
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #1e40af; font-weight: bold;">Your Public ID: <code style="background-color: white; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${publicId}</code></p>
              <p style="margin: 10px 0 0 0; color: #1e40af; font-size: 14px;">Use this Public ID and your password to log in to your account.</p>
            </div>
            `
                : ''
            }
            <p>You can now access your account with your new role permissions. Please log in using your ${publicId ? 'Public ID and password' : 'email and password'} to see the updated dashboard.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Log In</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>Note:</strong> If you have any questions about this role change, please contact your school administrator.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      this.logger.log(`Attempting to send role change email to ${email} from ${fromEmail}`);
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Role change email sent successfully to ${email}. MessageId: ${result.messageId}`
      );
    } catch (error: any) {
      this.logger.error(`Failed to send role change email to ${email}:`, error);
      this.logger.error(`Error details: ${error.message}`);
      if (error.response) {
        this.logger.error(`SMTP Response: ${error.response}`);
      }
      if (error.code) {
        this.logger.error(`Error code: ${error.code}`);
      }
      throw error;
    }
  }

  async sendTransferInitiationEmail(
    email: string,
    studentName: string,
    tac: string,
    studentId: string,
    schoolName: string,
    expiresAt: Date
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error(
        'No FROM email address configured. Check MAIL_FROM or SMTP_FROM environment variable.'
      );
      throw new Error('Email configuration error: No FROM address');
    }

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `Transfer Access Code (TAC) Generated - ${schoolName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Transfer Access Code Generated</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #3b82f6; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Agora Education Platform</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Transfer Access Code Generated</h2>
            <p>Hello ${studentName},</p>
            <p>A Transfer Access Code (TAC) has been generated for your transfer from <strong>${schoolName}</strong>.</p>
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #1e40af; font-weight: bold; font-size: 14px;">Transfer Access Code (TAC):</p>
              <p style="margin: 10px 0 0 0; color: #1e40af;">
                <code style="background-color: white; padding: 8px 12px; border-radius: 4px; font-size: 18px; font-weight: bold; letter-spacing: 1px;">${tac}</code>
              </p>
            </div>
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-weight: bold; font-size: 14px;">Student ID:</p>
              <p style="margin: 10px 0 0 0; color: #92400e;">
                <code style="background-color: white; padding: 8px 12px; border-radius: 4px; font-size: 16px;">${studentId}</code>
              </p>
            </div>
            <p style="color: #1f2937; margin-top: 20px;">
              <strong>Important Information:</strong>
            </p>
            <ul style="color: #4b5563; padding-left: 20px;">
              <li>Share this TAC and your Student ID with the receiving school</li>
              <li>This TAC will expire on <strong>${expiresAt.toLocaleString()}</strong></li>
              <li>The TAC can only be used once</li>
              <li>Do not share this code with anyone other than the receiving school</li>
            </ul>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>Next Steps:</strong> The receiving school will use this TAC along with your Student ID to initiate the transfer process. Once the transfer is completed, you will be enrolled in your new school.
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              <strong>Note:</strong> If you did not request this transfer, please contact <strong>${schoolName}</strong> immediately.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      this.logger.log(`Attempting to send transfer initiation email to ${email} from ${fromEmail}`);
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Transfer initiation email sent successfully to ${email}. MessageId: ${result.messageId}`
      );
    } catch (error: any) {
      this.logger.error(`Failed to send transfer initiation email to ${email}:`, error);
      this.logger.error(`Error details: ${error.message}`);
      if (error.response) {
        this.logger.error(`SMTP Response: ${error.response}`);
      }
      if (error.code) {
        this.logger.error(`Error code: ${error.code}`);
      }
      throw error;
    }
  }

  async sendTransferRevocationEmail(
    email: string,
    studentName: string,
    schoolName: string
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error(
        'No FROM email address configured. Check MAIL_FROM or SMTP_FROM environment variable.'
      );
      throw new Error('Email configuration error: No FROM address');
    }

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `Transfer Access Code Revoked - ${schoolName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Transfer Access Code Revoked</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ef4444; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Agora Education Platform</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Transfer Access Code Revoked</h2>
            <p>Hello ${studentName},</p>
            <p>The Transfer Access Code (TAC) that was previously generated for your transfer from <strong>${schoolName}</strong> has been revoked.</p>
            <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #991b1b; font-weight: bold;">What this means:</p>
              <ul style="margin: 10px 0 0 20px; color: #991b1b; padding-left: 0;">
                <li>The previously issued TAC is no longer valid</li>
                <li>You will need to request a new TAC if you still wish to transfer</li>
                <li>The receiving school cannot use the old TAC to initiate your transfer</li>
              </ul>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>Next Steps:</strong> If you still need to transfer, please contact <strong>${schoolName}</strong> to request a new Transfer Access Code.
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              <strong>Note:</strong> If you did not expect this revocation, please contact <strong>${schoolName}</strong> for more information.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      this.logger.log(`Attempting to send transfer revocation email to ${email} from ${fromEmail}`);
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Transfer revocation email sent successfully to ${email}. MessageId: ${result.messageId}`
      );
    } catch (error: any) {
      this.logger.error(`Failed to send transfer revocation email to ${email}:`, error);
      this.logger.error(`Error details: ${error.message}`);
      if (error.response) {
        this.logger.error(`SMTP Response: ${error.response}`);
      }
      if (error.code) {
        this.logger.error(`Error code: ${error.code}`);
      }
      throw error;
    }
  }

  async sendTeacherClassAssignmentEmail(
    email: string,
    teacherName: string,
    className: string,
    classLevel: string | null,
    subject: string | null,
    isPrimary: boolean,
    schoolName: string,
    academicYear: string
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error(
        'No FROM email address configured. Check MAIL_FROM or SMTP_FROM environment variable.'
      );
      throw new Error('Email configuration error: No FROM address');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/auth/login`;

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `Class Assignment - ${schoolName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Class Assignment</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #3b82f6; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Agora Education Platform</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Class Assignment Notification</h2>
            <p>Hello ${teacherName},</p>
            <p>You have been assigned to a class at <strong>${schoolName}</strong>.</p>
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #1e40af; font-weight: bold; font-size: 14px;">Class Details:</p>
              <p style="margin: 10px 0 0 0; color: #1e40af;">
                <strong>Class Name:</strong> ${className}<br>
                ${classLevel ? `<strong>Class Level:</strong> ${classLevel}<br>` : ''}
                ${subject ? `<strong>Subject:</strong> ${subject}<br>` : ''}
                <strong>Academic Year:</strong> ${academicYear}<br>
                ${isPrimary ? '<strong>Role:</strong> Primary Class Teacher' : ''}
              </p>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              You can now access your class dashboard to manage students, grades, and class activities.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Access Dashboard</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              <strong>Note:</strong> If you have any questions about this assignment, please contact your school administrator.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      this.logger.log(
        `Attempting to send teacher class assignment email to ${email} from ${fromEmail}`
      );
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Teacher class assignment email sent successfully to ${email}. MessageId: ${result.messageId}`
      );
    } catch (error: any) {
      this.logger.error(`Failed to send teacher class assignment email to ${email}:`, error);
      this.logger.error(`Error details: ${error.message}`);
      if (error.response) {
        this.logger.error(`SMTP Response: ${error.response}`);
      }
      if (error.code) {
        this.logger.error(`Error code: ${error.code}`);
      }
      throw error;
    }
  }

  async sendTeacherClassRemovalEmail(
    email: string,
    teacherName: string,
    className: string,
    classLevel: string | null,
    subject: string | null,
    schoolName: string
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error(
        'No FROM email address configured. Check MAIL_FROM or SMTP_FROM environment variable.'
      );
      throw new Error('Email configuration error: No FROM address');
    }

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `Class Assignment Removed - ${schoolName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Class Assignment Removed</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ef4444; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Agora Education Platform</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Class Assignment Removed</h2>
            <p>Hello ${teacherName},</p>
            <p>Your assignment to a class at <strong>${schoolName}</strong> has been removed.</p>
            <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 14px;">Removed Assignment:</p>
              <p style="margin: 10px 0 0 0; color: #991b1b;">
                <strong>Class Name:</strong> ${className}<br>
                ${classLevel ? `<strong>Class Level:</strong> ${classLevel}<br>` : ''}
                ${subject ? `<strong>Subject:</strong> ${subject}` : ''}
              </p>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              You will no longer have access to manage this class. If you believe this is an error, please contact your school administrator.
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              <strong>Note:</strong> If you have any questions about this change, please contact <strong>${schoolName}</strong>.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      this.logger.log(
        `Attempting to send teacher class removal email to ${email} from ${fromEmail}`
      );
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Teacher class removal email sent successfully to ${email}. MessageId: ${result.messageId}`
      );
    } catch (error: any) {
      this.logger.error(`Failed to send teacher class removal email to ${email}:`, error);
      this.logger.error(`Error details: ${error.message}`);
      if (error.response) {
        this.logger.error(`SMTP Response: ${error.response}`);
      }
      if (error.code) {
        this.logger.error(`Error code: ${error.code}`);
      }
      throw error;
    }
  }

  async sendPermissionAssignmentEmail(
    email: string,
    adminName: string,
    permissions: Array<{ resource: string; type: string; description?: string }>,
    schoolName: string
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error(
        'No FROM email address configured. Check MAIL_FROM or SMTP_FROM environment variable.'
      );
      throw new Error('Email configuration error: No FROM address');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/auth/login`;

    // Group permissions by resource
    const permissionsByResource: Record<string, Array<{ type: string; description?: string }>> = {};
    permissions.forEach((perm) => {
      if (!permissionsByResource[perm.resource]) {
        permissionsByResource[perm.resource] = [];
      }
      permissionsByResource[perm.resource].push({ type: perm.type, description: perm.description });
    });

    const permissionsList = Object.entries(permissionsByResource)
      .map(([resource, perms]) => {
        const types = perms.map((p) => p.type).join(', ');
        return `<li><strong>${resource}:</strong> ${types}</li>`;
      })
      .join('');

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `Permissions Updated - ${schoolName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Permissions Updated</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #8b5cf6; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Agora Education Platform</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Permissions Updated</h2>
            <p>Hello ${adminName},</p>
            <p>Your permissions have been updated at <strong>${schoolName}</strong>.</p>
            <div style="background-color: #f3e8ff; border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #6b21a8; font-weight: bold; font-size: 14px;">Your Updated Permissions:</p>
              <ul style="margin: 10px 0 0 20px; color: #6b21a8; padding-left: 0;">
                ${permissionsList}
              </ul>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              You can now access the corresponding sections in your dashboard based on your assigned permissions.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Access Dashboard</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              <strong>Note:</strong> If you have any questions about your permissions, please contact your school administrator.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      this.logger.log(
        `Attempting to send permission assignment email to ${email} from ${fromEmail}`
      );
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Permission assignment email sent successfully to ${email}. MessageId: ${result.messageId}`
      );
    } catch (error: any) {
      this.logger.error(`Failed to send permission assignment email to ${email}:`, error);
      this.logger.error(`Error details: ${error.message}`);
      if (error.response) {
        this.logger.error(`SMTP Response: ${error.response}`);
      }
      if (error.code) {
        this.logger.error(`Error code: ${error.code}`);
      }
      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified');
      return true;
    } catch (error) {
      this.logger.error('SMTP connection failed:', error);
      return false;
    }
  }

  /**
   * Send session start notification email to all school members
   */
  async sendSessionStartEmail(
    email: string,
    recipientName: string,
    role: string,
    sessionName: string,
    termName: string,
    startDate: Date,
    endDate: Date,
    schoolName: string
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error('No FROM email address configured.');
      throw new Error('Email configuration error: No FROM address');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/auth/login`;

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `New Academic Session Started - ${sessionName} - ${schoolName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Academic Session Started</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #10b981; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">🎓 New Session Started!</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Welcome to ${sessionName}</h2>
            <p>Hello ${recipientName},</p>
            <p>A new academic session has begun at <strong>${schoolName}</strong>. We're excited to have you as part of this journey!</p>
            <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #065f46; font-weight: bold; font-size: 16px;">📅 Session Details</p>
              <table style="margin-top: 10px; color: #065f46;">
                <tr><td style="padding: 5px 15px 5px 0;"><strong>Session:</strong></td><td>${sessionName}</td></tr>
                <tr><td style="padding: 5px 15px 5px 0;"><strong>Current Term:</strong></td><td>${termName}</td></tr>
                <tr><td style="padding: 5px 15px 5px 0;"><strong>Start Date:</strong></td><td>${startDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                <tr><td style="padding: 5px 15px 5px 0;"><strong>End Date:</strong></td><td>${endDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
              </table>
            </div>
            <p>As a <strong>${role}</strong>, you can now access your dashboard for the new session.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Go to Dashboard</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              We wish you a productive and successful academic session!
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Session start email sent successfully to ${email}`);
    } catch (error: any) {
      this.logger.error(`Failed to send session start email to ${email}:`, error.message);
      throw error;
    }
  }

  /**
   * Send term start notification email to all school members
   */
  async sendTermStartEmail(
    email: string,
    recipientName: string,
    role: string,
    sessionName: string,
    termName: string,
    startDate: Date,
    endDate: Date,
    schoolName: string
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error('No FROM email address configured.');
      throw new Error('Email configuration error: No FROM address');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/auth/login`;

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `${termName} Has Started - ${sessionName} - ${schoolName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Term Started</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #3b82f6; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">📚 ${termName} Has Started!</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Welcome Back!</h2>
            <p>Hello ${recipientName},</p>
            <p>A new term has begun at <strong>${schoolName}</strong>. Get ready for an exciting period of learning and growth!</p>
            <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #1e40af; font-weight: bold; font-size: 16px;">📅 Term Details</p>
              <table style="margin-top: 10px; color: #1e40af;">
                <tr><td style="padding: 5px 15px 5px 0;"><strong>Session:</strong></td><td>${sessionName}</td></tr>
                <tr><td style="padding: 5px 15px 5px 0;"><strong>Term:</strong></td><td>${termName}</td></tr>
                <tr><td style="padding: 5px 15px 5px 0;"><strong>Start Date:</strong></td><td>${startDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                <tr><td style="padding: 5px 15px 5px 0;"><strong>End Date:</strong></td><td>${endDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
              </table>
            </div>
            <p>As a <strong>${role}</strong>, you can now access your dashboard for the new term.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Go to Dashboard</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              We wish you a productive term ahead!
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Term start email sent successfully to ${email}`);
    } catch (error: any) {
      this.logger.error(`Failed to send term start email to ${email}:`, error.message);
      throw error;
    }
  }

  /**
   * Send student promotion notification email
   */
  async sendStudentPromotionEmail(
    email: string,
    studentName: string,
    previousClass: string,
    newClass: string,
    sessionName: string,
    schoolName: string
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error('No FROM email address configured.');
      throw new Error('Email configuration error: No FROM address');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/auth/login`;

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `🎉 Congratulations! You've Been Promoted - ${schoolName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Class Promotion</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #8b5cf6; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">🎉 Congratulations!</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">You've Been Promoted!</h2>
            <p>Dear ${studentName},</p>
            <p>We are thrilled to inform you that you have been successfully promoted to the next class level at <strong>${schoolName}</strong>!</p>
            <div style="background-color: #f3e8ff; border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #6b21a8; font-weight: bold; font-size: 16px;">🏆 Your Promotion Details</p>
              <table style="margin-top: 10px; color: #6b21a8;">
                <tr><td style="padding: 5px 15px 5px 0;"><strong>Previous Class:</strong></td><td>${previousClass}</td></tr>
                <tr><td style="padding: 5px 15px 5px 0;"><strong>New Class:</strong></td><td style="font-weight: bold; color: #059669;">${newClass}</td></tr>
                <tr><td style="padding: 5px 15px 5px 0;"><strong>Session:</strong></td><td>${sessionName}</td></tr>
              </table>
            </div>
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e;">
                🌟 This achievement reflects your hard work and dedication. Keep up the excellent effort in your new class!
              </p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Your Dashboard</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              Best wishes for a successful academic year ahead!
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Promotion email sent successfully to ${email}`);
    } catch (error: any) {
      this.logger.error(`Failed to send promotion email to ${email}:`, error.message);
      throw error;
    }
  }

  /**
   * Send bulk emails (for session/term notifications)
   * Sends emails in batches to avoid overwhelming the SMTP server
   */
  async sendBulkEmails(
    emails: Array<{
      to: string;
      name: string;
      role: string;
    }>,
    emailType: 'session' | 'term',
    sessionName: string,
    termName: string,
    startDate: Date,
    endDate: Date,
    schoolName: string
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (recipient) => {
          try {
            if (emailType === 'session') {
              await this.sendSessionStartEmail(
                recipient.to,
                recipient.name,
                recipient.role,
                sessionName,
                termName,
                startDate,
                endDate,
                schoolName
              );
            } else {
              await this.sendTermStartEmail(
                recipient.to,
                recipient.name,
                recipient.role,
                sessionName,
                termName,
                startDate,
                endDate,
                schoolName
              );
            }
            sent++;
          } catch (error) {
            this.logger.error(`Failed to send ${emailType} email to ${recipient.to}`);
            failed++;
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < emails.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.log(`Bulk ${emailType} emails completed: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  /**
   * Send school profile edit verification email
   */
  async sendSchoolProfileEditVerificationEmail(
    email: string,
    name: string,
    schoolName: string,
    token: string,
    verificationUrl: string,
    changes: any
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error(
        'No FROM email address configured. Check MAIL_FROM or SMTP_FROM environment variable.'
      );
      throw new Error('Email configuration error: No FROM address');
    }

    // Format changes for display
    const changesList: string[] = [];
    if (changes.levels) {
      if (changes.levels.primary !== undefined) {
        changesList.push(`Primary School: ${changes.levels.primary ? 'Enable' : 'Disable'}`);
      }
      if (changes.levels.secondary !== undefined) {
        changesList.push(`Secondary School: ${changes.levels.secondary ? 'Enable' : 'Disable'}`);
      }
      if (changes.levels.tertiary !== undefined) {
        changesList.push(`Tertiary/University: ${changes.levels.tertiary ? 'Enable' : 'Disable'}`);
      }
    }
    if (changes.name) changesList.push(`School Name: ${changes.name}`);
    if (changes.address) changesList.push(`Address: ${changes.address}`);
    if (changes.city) changesList.push(`City: ${changes.city}`);
    if (changes.state) changesList.push(`State: ${changes.state}`);
    if (changes.phone) changesList.push(`Phone: ${changes.phone}`);
    if (changes.email) changesList.push(`Email: ${changes.email}`);

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `Verify School Profile Changes - ${schoolName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify School Profile Changes</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #3b82f6; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Agora Education Platform</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Verify School Profile Changes</h2>
            <p>Hello ${name},</p>
            <p>A request has been made to update the profile information for <strong>${schoolName}</strong>.</p>
            
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin-top: 0; color: #1e40af;">Proposed Changes:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #1e40af;">
                ${changesList.map((change) => `<li>${change}</li>`).join('')}
              </ul>
            </div>

            <p>To verify and apply these changes, please click the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Verify Changes</a>
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Security Token:</strong><br>
                <code style="background-color: white; padding: 8px; border-radius: 4px; font-size: 12px; word-break: break-all; display: inline-block; margin-top: 8px;">${token}</code>
              </p>
            </div>

            <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${verificationUrl}</p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>Note:</strong> This verification link will expire in 24 hours. If you didn't request these changes, please ignore this email or contact support immediately.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      this.logger.log(`Attempting to send school profile edit verification email to ${email}`);
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `School profile edit verification email sent successfully to ${email}. MessageId: ${result.messageId}`
      );
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Send login OTP email
   */
  async sendLoginOtpEmail(
    email: string,
    name: string,
    otpCode: string,
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      this.configService.get<string>('SMTP_USER');

    if (!fromEmail) {
      this.logger.error(
        'No FROM email address configured. Check MAIL_FROM or SMTP_FROM environment variable.',
      );
      throw new Error('Email configuration error: No FROM address');
    }

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: 'Your Agora Login Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Login Verification Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #3b82f6; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Agora Education Platform</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Login Verification Code</h2>
            <p>Hello ${name},</p>
            <p>You've requested to log in to your Agora account. Use the verification code below to complete your login:</p>
            
            <div style="background-color: #eff6ff; border: 2px solid #3b82f6; padding: 20px; margin: 30px 0; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 600; letter-spacing: 2px; font-size: 32px; font-family: 'Courier New', monospace;">
                ${otpCode}
              </p>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              <strong>Important:</strong> This code will expire in 10 minutes. Do not share this code with anyone.
            </p>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>⚠️ Security Notice:</strong> If you didn't request this code, please ignore this email or contact support immediately.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Agora Education Platform. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    try {
      this.logger.log(`Attempting to send login OTP email to ${email}`);
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Login OTP email sent successfully to ${email}. MessageId: ${result.messageId}`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to send login OTP email to ${email}:`, error);
      throw error;
    }
  }
}
