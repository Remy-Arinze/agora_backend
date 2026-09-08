/** JSS-only under Nigerian basic/senior secondary (NERDC / WAEC split). */
export const JUNIOR_SECONDARY_CODES = new Set([
  'BSC', 'SST', 'CCA', 'PHE', 'BTC', 'NLG', 'RKS', 'HOM',
]);

/** SS-only (senior secondary / WAEC). */
export const SENIOR_SECONDARY_CODES = new Set([
  'PHY', 'CHM', 'BIO', 'LIT', 'GEO', 'HIS', 'ECO', 'GOV',
  'FMT', 'ACC', 'COM', 'TDR', 'FNT',
]);

export type LevelStream = 'JUNIOR' | 'SENIOR' | 'ALL';

export function inferLevelStream(opts: {
  levelStream?: string | null;
  classLevelCode?: string | null;
  classLevelName?: string | null;
  code?: string | null;
}): LevelStream {
  const stored = (opts.levelStream || '').toUpperCase();
  if (stored === 'JUNIOR' || stored === 'SENIOR' || stored === 'ALL') {
    return stored;
  }

  const levelCode = (opts.classLevelCode || '').toUpperCase();
  const levelName = (opts.classLevelName || '').toUpperCase();
  if (levelCode.startsWith('JSS') || levelName.includes('JSS') || levelName.includes('JUNIOR')) {
    return 'JUNIOR';
  }
  if (
    (levelCode.startsWith('SS') && !levelCode.startsWith('JSS')) ||
    /(^|\s)SS\s*[1-3]/.test(levelName) ||
    levelName.includes('SENIOR')
  ) {
    return 'SENIOR';
  }

  const subjectCode = (opts.code || '').toUpperCase();
  if (JUNIOR_SECONDARY_CODES.has(subjectCode)) return 'JUNIOR';
  if (SENIOR_SECONDARY_CODES.has(subjectCode)) return 'SENIOR';
  return 'ALL';
}

export function subjectOfferedInStream(subjectStream: LevelStream, target: LevelStream): boolean {
  if (target === 'ALL' || subjectStream === 'ALL') return true;
  return subjectStream === target;
}

export function streamFromClassLevelCode(code?: string | null): LevelStream | null {
  const c = (code || '').toUpperCase();
  if (c.startsWith('JSS')) return 'JUNIOR';
  if (c.startsWith('SS') && !c.startsWith('JSS')) return 'SENIOR';
  return null;
}

export function levelStreamsForAgoraCode(code: string, schoolTypes: string[]): string[] {
  const streams: string[] = [];
  if (schoolTypes.includes('PRIMARY')) streams.push('PRIMARY');
  if (schoolTypes.includes('SECONDARY')) {
    if (JUNIOR_SECONDARY_CODES.has(code)) streams.push('JUNIOR');
    else if (SENIOR_SECONDARY_CODES.has(code)) streams.push('SENIOR');
    else streams.push('JUNIOR', 'SENIOR');
  }
  return [...new Set(streams)];
}
