import { Injectable, LoggerService as NestLoggerService, ConsoleLogger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  trace?: string;
  [key: string]: any;
}

@Injectable()
export class OpenObserveLogger extends ConsoleLogger implements NestLoggerService {
  private axiosInstance: AxiosInstance | null = null;
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly bufferSize = 10;
  private readonly flushIntervalMs = 5000; // 5 seconds
  private enabled = false;

  constructor() {
    super();
    this.initializeOpenObserve();
  }

  private initializeOpenObserve() {
    const endpoint = process.env.OPENOBSERVE_ENDPOINT;
    const accessKey = process.env.OPENOBSERVE_ACCESS_KEY;
    const isProduction = process.env.NODE_ENV === 'production';

    // Only ship logs to OpenObserve in production — never from dev or staging
    // to avoid polluting observability data with noise.
    if (!isProduction) {
      return;
    }

    if (!endpoint || !accessKey) {
      console.warn('⚠️ OpenObserve not configured - logs will only output to console');
      return;
    }

    this.enabled = true;
    this.axiosInstance = axios.create({
      baseURL: endpoint,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${accessKey}`,
      },
      timeout: 5000,
    });

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);

    console.log('📊 OpenObserve logger initialized');
  }

  private async sendToOpenObserve(logs: LogEntry[]): Promise<void> {
    if (!this.axiosInstance || !this.enabled || logs.length === 0) {
      return;
    }

    try {
      await this.axiosInstance.post('', logs);
    } catch (error: any) {
      // Don't spam console with OpenObserve errors
      if (error.response?.status !== 200) {
        console.error('Failed to send logs to OpenObserve:', error.message);
      }
    }
  }

  private addToBuffer(entry: LogEntry) {
    if (!this.enabled) return;

    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const logsToSend = [...this.buffer];
    this.buffer = [];

    await this.sendToOpenObserve(logsToSend);
  }

  private createLogEntry(level: string, message: any, context?: string, trace?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
      context,
      trace,
      application: 'agora-backend',
      environment: process.env.NODE_ENV || 'development',
      hostname: process.env.HOSTNAME || 'unknown',
    };
  }

  log(message: any, context?: string) {
    super.log(message, context);
    this.addToBuffer(this.createLogEntry('info', message, context));
  }

  error(message: any, trace?: string, context?: string) {
    super.error(message, trace, context);
    this.addToBuffer(this.createLogEntry('error', message, context, trace));
  }

  warn(message: any, context?: string) {
    super.warn(message, context);
    this.addToBuffer(this.createLogEntry('warn', message, context));
  }

  debug(message: any, context?: string) {
    super.debug(message, context);
    this.addToBuffer(this.createLogEntry('debug', message, context));
  }

  verbose(message: any, context?: string) {
    super.verbose(message, context);
    this.addToBuffer(this.createLogEntry('verbose', message, context));
  }

  // Ensure logs are flushed before app shutdown
  async onApplicationShutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
}
