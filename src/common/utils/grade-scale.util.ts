export type GradeScaleType = 'PERCENTAGE' | 'A1_F9' | 'CUSTOM' | string;

/** WAEC A1–F9 bands. */
export function toWaecGrade(percentage: number): string {
  if (percentage >= 75) return 'A1';
  if (percentage >= 70) return 'B2';
  if (percentage >= 65) return 'B3';
  if (percentage >= 60) return 'C4';
  if (percentage >= 55) return 'C5';
  if (percentage >= 50) return 'C6';
  if (percentage >= 45) return 'D7';
  if (percentage >= 40) return 'E8';
  return 'F9';
}

/**
 * Convert a percentage to the school's display grade.
 * CUSTOM has no band UI yet — treat as percentage.
 */
export function percentageToDisplayGrade(
  percentage: number,
  scale: GradeScaleType,
  _passMark = 40,
): string {
  if (scale === 'A1_F9') return toWaecGrade(percentage);
  return `${Math.round(percentage)}%`;
}

/** Combine CA (incl. assignments) and exam using school weights. */
export function weightedSubjectPercentage(
  caPct: number | null,
  examPct: number | null,
  caWeight: number,
  examWeight: number,
): number {
  const hasCa = caPct != null && Number.isFinite(caPct);
  const hasExam = examPct != null && Number.isFinite(examPct);
  if (hasCa && hasExam) {
    const total = (caWeight || 0) + (examWeight || 0);
    if (total <= 0) return ((caPct as number) + (examPct as number)) / 2;
    return ((caPct as number) * caWeight + (examPct as number) * examWeight) / total;
  }
  if (hasCa) return caPct as number;
  if (hasExam) return examPct as number;
  return 0;
}
