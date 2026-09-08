export const CURRICULUM_PROCESSING_QUEUE = 'curriculum-processing';
export const CURRICULUM_CONSOLIDATION_QUEUE = 'curriculum-consolidation';

export const JOB_PROCESS_SOURCE = 'process-source';
export const JOB_CONSOLIDATE_BATCH = 'consolidate-batch';

export interface ProcessSourcePayload {
  sourceId: string;
  batchId?: string;
}

export interface ConsolidateBatchPayload {
  batchId?: string;
  curriculumId?: string;
  sourceIds?: string[];
  subjectId: string;
  gradeLevel: string;
  uploadedBy: string;
}
