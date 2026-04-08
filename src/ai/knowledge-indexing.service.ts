import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../database/prisma.service';
import { VECTOR_QUEUE_NAME, JOB_INDEX_RECORD } from './vector.processor';
import { KNOWLEDGE_EVENTS, KnowledgeEntityType } from './knowledge-events.constants';

@Injectable()
export class KnowledgeIndexingService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeIndexingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(VECTOR_QUEUE_NAME) private readonly vectorQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('Knowledge Indexing Service initialized (Event-Driven Mode)');
    // No more Prisma Middleware here. Triggers move to Domain Events/Prisma Extension.
  }

  /**
   * Layer 2 — Scheduled Sync (Safety Net)
   * Runs daily at 3:00 AM to catch missing or stale embeddings.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleNightlySync() {
    this.logger.log('[Safety Net] Starting nightly knowledge sync...');
    
    // 1. Sync Schools
    const schools = await this.prisma.school.findMany({ select: { id: true } });
    for (const s of schools) {
      await this.queueIndexing('school', s.id);
    }

    // 2. Sync Students with missing or old knowledge chunks
    const students = await this.prisma.student.findMany({ select: { id: true } });
    for (const s of students) {
      await this.queueIndexing('student', s.id);
    }

    // ... Could add logic to only sync if KnowledgeChunk is missing/old ...
    
    this.logger.log(`[Safety Net] Dispatched indexing jobs for ${schools.length} schools and ${students.length} students.`);
  }

  /**
   * Layer 1 Helper — Used by services to trigger indexing
   */
  async triggerEntitySync(type: KnowledgeEntityType, id: string) {
    this.eventEmitter.emit(KNOWLEDGE_EVENTS.ENTITY_UPDATED, { type, id });
  }

  /**
   * Helper to queue an indexing job directly (Layer 2)
   */
  private async queueIndexing(type: KnowledgeEntityType, id: string) {
    await this.vectorQueue.add(
      JOB_INDEX_RECORD,
      { type, id },
      { priority: 10, removeOnComplete: true }
    );
  }

  /**
   * Manual trigger for a school's full sync (e.g. from Admin UI)
   */
  async syncSchool(schoolId: string) {
    this.logger.log(`Manual sync requested for school: ${schoolId}`);
    
    // Queue school info
    await this.queueIndexing('school', schoolId);
    
    // Queue teachers
    const teachers = await this.prisma.teacher.findMany({ where: { schoolId }, select: { id: true } });
    for (const t of teachers) await this.queueIndexing('teacher', t.id);
    
    // Queue classes
    const classes = await this.prisma.class.findMany({ where: { schoolId }, select: { id: true } });
    for (const c of classes) await this.queueIndexing('class', c.id);

    return { queued: 1 + teachers.length + classes.length };
  }
}
