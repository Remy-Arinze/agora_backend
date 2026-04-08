import { Module, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { VECTOR_QUEUE_NAME } from './vector.processor';

/**
 * BullMQ vector and curriculum queues: memory-optimized for Azure Redis.
 * - Small job payloads (chunk id only). removeOnComplete/removeOnFail to limit memory.
 * - Exponential backoff for OpenAI rate limits.
 * - Supports Redis Cluster (Azure Enterprise) with graceful degradation.
 * Processor is registered in AiModule to avoid circular dependency.
 */
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('VectorQueueModule');

        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          return {
            connection: redisUrl as any,
          };
        }

        const host = config.get<string>('REDIS_HOST', 'localhost');
        const port = Number(config.get<string>('REDIS_PORT', '6379'));
        const password = config.get<string>('REDIS_PASSWORD');
        const tls = config.get<string>('REDIS_TLS') === 'true';

        const isCluster =
          config.get<string>('REDIS_IS_CLUSTER') === 'true' ||
          config.get<boolean>('REDIS_IS_CLUSTER') === true ||
          port === 10000;

        if (isCluster) {
          logger.log(
            `Connecting to Redis Cluster at ${host}:${port} (TLS=${tls})`,
          );

          const cluster = new Redis.Cluster(
            [{ host, port }],
            {
              enableReadyCheck: false,
              lazyConnect: true,
              slotsRefreshTimeout: 15000,
              clusterRetryStrategy: (times: number) => {
                if (times > 3) {
                  logger.warn(
                    'Redis Cluster max connection retries reached. ' +
                    'Background embedding jobs will not process until Redis is reachable.',
                  );
                  return null; // stop retrying
                }
                return Math.min(times * 2000, 10000);
              },
              redisOptions: {
                password,
                tls: tls
                  ? { servername: host, rejectUnauthorized: false }
                  : undefined,
                maxRetriesPerRequest: null,
                connectTimeout: 15000,
                enableAutoPipelining: true,
              },
            },
          );

          // Prevent unhandled 'error' events from crashing the process
          cluster.on('error', (err) => {
            logger.warn(`Redis Cluster error (non-fatal): ${err.message}`);
          });

          return { connection: cluster };
        }

        // Standard (non-cluster) Redis connection
        logger.log(`Connecting to Redis at ${host}:${port} (TLS=${tls})`);
        return {
          connection: {
            host,
            port,
            password,
            tls: tls ? { rejectUnauthorized: false } : undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: true,
            lazyConnect: true,
            connectTimeout: 20000,
            autoResubscribe: true,
            autoResendUnfulfilledCommands: true,
            retryStrategy: (times: number) => {
              const delay = Math.min(times * 1000, 10000);
              logger.warn(`Redis connection lost. Retrying in ${delay}ms... (attempt ${times})`);
              return delay;
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: VECTOR_QUEUE_NAME,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    }),
    BullModule.registerQueue({
      name: 'curriculum-processing',
      defaultJobOptions: {
        attempts: 1,        // No retries: failed jobs should not re-run and block other jobs in the queue
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    }),
    BullModule.registerQueue({
      name: 'curriculum-consolidation',
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    }),
    BullBoardModule.forFeature(
      {
        name: VECTOR_QUEUE_NAME,
        adapter: BullMQAdapter,
      },
      {
        name: 'curriculum-processing',
        adapter: BullMQAdapter,
      },
      {
        name: 'curriculum-consolidation',
        adapter: BullMQAdapter,
      },
    ),
  ],
  exports: [BullModule],
})
export class VectorQueueModule {}
