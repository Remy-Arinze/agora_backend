import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KNOWLEDGE_EVENTS, KnowledgeEntityType } from '../ai/knowledge-events.constants';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private _extendedClient: any;

  constructor(private eventEmitter: EventEmitter2) {
    super();
  }

  get client() {
    if (!this._extendedClient) {
      this._extendedClient = this.$extends({
        query: {
          $allModels: {
            async $allOperations({ model, operation, args, query }) {
              const result = await query(args);
              
              const indexableModels: Record<string, KnowledgeEntityType> = {
                'Student': 'student',
                'Teacher': 'teacher',
                'School': 'school',
                'Class': 'class',
                'Grade': 'grade',
                'Attendance': 'attendance',
                'Assessment': 'assessment',
              };

              const eventType = indexableModels[model];
              if (eventType && ['create', 'update', 'upsert', 'updateMany'].includes(operation)) {
                const id = (result && typeof result === 'object' && 'id' in result) ? (result as any).id : (args as any).where?.id;
                if (id) {
                  // We use a timeout to ensure transaction has committed before indexing starts (Eventually Consistent)
                  setTimeout(() => {
                    const event = operation === 'create' ? KNOWLEDGE_EVENTS.ENTITY_CREATED : KNOWLEDGE_EVENTS.ENTITY_UPDATED;
                    // Note: We use the parent closure's eventEmitter
                    this.eventEmitter.emit(event, { type: eventType, id });
                  }, 0);
                }
              }
              return result;
            },
          },
        },
      });
    }
    return this._extendedClient;
  }

  // NOTE: To utilize the extension, we need all services to use prismaService.client instead of this directly.
  // However, simpler is to just use the existing $use (for now) but emit events from it, 
  // or use the new Prisma Client Extensions but re-assigned.
  // Actually, Middleware ($use) is easier to inject with EventEmitter without breaking inheritance.

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
      
      // Layer 1 — Event-Driven Indexing via Middleware (covers all services)
      this.$use(async (params, next) => {
        const result = await next(params);
        
        const indexableModels: Record<string, KnowledgeEntityType> = {
          'Student': 'student',
          'Teacher': 'teacher',
          'School': 'school',
          'Class': 'class',
          'Grade': 'grade',
          'Attendance': 'attendance',
          'Assessment': 'assessment',
        };

        const targetType = indexableModels[params.model || ''];
        if (targetType && ['create', 'update', 'upsert'].includes(params.action)) {
          const id = (result && typeof result === 'object' && 'id' in result) ? (result as any).id : params.args?.where?.id;
          if (id) {
            const event = params.action === 'create' ? KNOWLEDGE_EVENTS.ENTITY_CREATED : KNOWLEDGE_EVENTS.ENTITY_UPDATED;
            this.eventEmitter.emit(event, { type: targetType, id });
          }
        }
        
        return result;
      });

    } catch (error) {
      this.logger.error('❌ Failed to connect to database.');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
