import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SchoolLifecycleService } from './school-lifecycle.service';

@Processor('school-lifecycle-queue')
export class SchoolLifecycleProcessor extends WorkerHost {
  private readonly logger = new Logger(SchoolLifecycleProcessor.name);

  constructor(private readonly lifecycle: SchoolLifecycleService) {
    super();
  }

  async process(job: Job<{ schoolId: string }>): Promise<void> {
    const schoolId = job.data?.schoolId;
    if (!schoolId) return;
    this.logger.log(`Lifecycle job ${job.name} for school ${schoolId}`);
    if (job.name === 'apply-deactivation') {
      await this.lifecycle.applyDeactivation(schoolId);
      return;
    }
    if (job.name === 'issue-closure-tacs') {
      await this.lifecycle.issueClosureTacs(schoolId);
    }
  }
}
