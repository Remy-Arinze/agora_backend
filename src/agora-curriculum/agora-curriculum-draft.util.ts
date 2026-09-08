import { FULL_YEAR_WEEKS } from './full-year-curriculum.util';

export function shouldReuseInFlightDraft(
  latest: {
    status: string;
    topicCount: number;
  } | null,
  options?: { forceNewVersion?: boolean },
): boolean {
  if (!latest || latest.status !== 'DRAFT') return false;
  if (options?.forceNewVersion) return latest.topicCount === 0;
  return latest.topicCount < FULL_YEAR_WEEKS;
}

export function nextCurriculumVersion(latest: { version: number } | null): number {
  return latest ? latest.version + 1 : 1;
}
