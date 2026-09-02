import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import {
  DASHBOARD_CACHE_INVALIDATE,
  DASHBOARD_CACHE_TTL_SECONDS,
  dashboardCachePrefix,
} from './dashboard-cache.events';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    try {
      this.client = this.createClient();
      this.client.on('error', (err) => {
        this.logger.warn(`Redis error (non-fatal): ${err.message}`);
      });
    } catch (err: any) {
      this.logger.warn(`Redis unavailable; dashboard cache disabled: ${err?.message}`);
      this.client = null;
    }
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err: any) {
      this.logger.warn(`Redis get failed for ${key}: ${err?.message}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds = DASHBOARD_CACHE_TTL_SECONDS): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err: any) {
      this.logger.warn(`Redis set failed for ${key}: ${err?.message}`);
    }
  }

  @OnEvent(DASHBOARD_CACHE_INVALIDATE)
  async invalidateDashboard(payload: { schoolId?: string }) {
    const schoolId = payload?.schoolId;
    if (!schoolId || !this.client) return;
    const prefix = dashboardCachePrefix(schoolId);
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 50);
        cursor = next;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err: any) {
      this.logger.warn(`Dashboard cache invalidate failed: ${err?.message}`);
    }
  }

  private createClient(): Redis {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      return new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: false,
      });
    }

    return new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: Number(this.config.get<string>('REDIS_PORT', '6379')),
      password: this.config.get<string>('REDIS_PASSWORD'),
      tls:
        this.config.get<string>('REDIS_TLS') === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: false,
    });
  }
}
