import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { KNOWLEDGE_EVENTS, KnowledgeEntityEvent } from './knowledge-events.constants';
import { VECTOR_QUEUE_NAME, JOB_INDEX_RECORD } from './vector.processor';

@Injectable()
export class KnowledgeEventService {
  private readonly logger = new Logger(KnowledgeEventService.name);

  constructor(
    @InjectQueue(VECTOR_QUEUE_NAME) private readonly vectorQueue: Queue,
  ) {}

  /**
   * Listen for any knowledge entity creation/update and queue for background indexing.
   * Leverages BullMQ priority for "Idle-Only" processing.
   * We use fire-and-forget (not awaiting queue.add) to avoid blocking the main event loop
   * during intensive curriculum processing.
   */
  @OnEvent(KNOWLEDGE_EVENTS.ENTITY_CREATED)
  handleEntityCreated(event: KnowledgeEntityEvent) {
    this.vectorQueue.add(JOB_INDEX_RECORD, { type: event.type, id: event.id }, { 
      priority: 10, 
      removeOnComplete: true, 
      removeOnFail: { count: 100 } 
    }).catch(err => this.logger.error(`[AI Indexing] Failed to queue creation event for ${event.type} ${event.id}: ${err.message}`));
  }

  @OnEvent(KNOWLEDGE_EVENTS.ENTITY_UPDATED)
  handleEntityUpdated(event: KnowledgeEntityEvent) {
    this.vectorQueue.add(JOB_INDEX_RECORD, { type: event.type, id: event.id }, { 
      priority: 10, 
      removeOnComplete: true, 
      removeOnFail: { count: 100 } 
    }).catch(err => this.logger.error(`[AI Indexing] Failed to queue update event for ${event.type} ${event.id}: ${err.message}`));
  }

  @OnEvent(KNOWLEDGE_EVENTS.ENTITY_DELETED)
  handleEntityDeleted(event: KnowledgeEntityEvent) {
    // Optional: Add logic to remove from vector store if needed
    this.logger.log(`Entity deleted: ${event.type}:${event.id}. Vector removal not implemented yet.`);
  }
}
