
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { OpenObserveLogger } from './openobserve-logger.service';

const POLL_INTERVAL_MS = 30_000;

/**
 * Pings Redis every 30 seconds and ships a structured health snapshot to OpenObserve.
 *
 * Snapshot shape:
 * {
 *   event:              "redis.health",
 *   status:             "ok" | "error",
 *   latency_ms:         4,
 *   connected_clients:  7,
 *   used_memory_mb:     12.4,
 *   used_memory_peak_mb: 18.1,
 *   uptime_seconds:     86400,
 *   blocked_clients:    0,
 *   keyspace_hits:      12000,
 *   keyspace_misses:    300,
 *   ops_per_sec:        45,
 *   rejected_connections: 0,
 * }
 */
@Injectable()
export class RedisHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisHealthService.name);
  private client: Redis | null = null;
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly oo: OpenObserveLogger,
  ) {}

  onModuleInit() {
    this.client = this.createClient();
    this.poll();
    this.interval = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.logger.log('Redis health monitor started (30s interval)');
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
    this.client?.disconnect();
  }

  private createClient(): Redis {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      return new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
      });
    }

    return new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: Number(this.config.get<string>('REDIS_PORT', '6379')),
      password: this.config.get<string>('REDIS_PASSWORD'),
      tls: this.config.get<string>('REDIS_TLS') === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }

  private async poll() {
    if (!this.client) return;

    const t0 = Date.now();
    try {
      await this.client.ping();
      const latency = Date.now() - t0;

      // Pull INFO stats
      const info = await this.client.info('all');
      const parsed = this.parseRedisInfo(info);

      this.oo.log(
        JSON.stringify({
          event:               'redis.health',
          status:              'ok',
          latency_ms:          latency,
          connected_clients:   parsed.connected_clients,
          blocked_clients:     parsed.blocked_clients,
          used_memory_mb:      parsed.used_memory_mb,
          used_memory_peak_mb: parsed.used_memory_peak_mb,
          uptime_seconds:      parsed.uptime_in_seconds,
          keyspace_hits:       parsed.keyspace_hits,
          keyspace_misses:     parsed.keyspace_misses,
          ops_per_sec:         parsed.instantaneous_ops_per_sec,
          rejected_connections: parsed.rejected_connections,
          role:                parsed.role,
        }),
        'RedisHealth',
      );

      // Warn on high latency
      if (latency > 100) {
        this.oo.warn(
          JSON.stringify({ event: 'redis.high_latency', latency_ms: latency }),
          'RedisHealth',
        );
      }

      // Warn if connections are high (potential leak)
      if (parsed.connected_clients > 50) {
        this.oo.warn(
          JSON.stringify({
            event: 'redis.high_connections',
            connected_clients: parsed.connected_clients,
          }),
          'RedisHealth',
        );
      }
    } catch (err: any) {
      this.oo.error(
        JSON.stringify({
          event:   'redis.health',
          status:  'error',
          message: err?.message,
        }),
        err?.stack,
        'RedisHealth',
      );
    }
  }

  /** Parse Redis INFO output into a flat key/value map */
  private parseRedisInfo(raw: string): Record<string, any> {
    const result: Record<string, any> = {};
    for (const line of raw.split('\r\n')) {
      if (!line || line.startsWith('#')) continue;
      const [key, value] = line.split(':');
      if (key && value !== undefined) {
        const num = parseFloat(value);
        result[key.trim()] = isNaN(num) ? value.trim() : num;
      }
    }
    // Normalise memory to MB
    if (result.used_memory) {
      result.used_memory_mb = parseFloat((result.used_memory / 1_048_576).toFixed(2));
    }
    if (result.used_memory_peak) {
      result.used_memory_peak_mb = parseFloat((result.used_memory_peak / 1_048_576).toFixed(2));
    }
    return result;
  }
}
