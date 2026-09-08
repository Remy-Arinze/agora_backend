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

  const fromClass = streamFromClassLevel({
    code: opts.classLevelCode,
    name: opts.classLevelName,
  });
  if (fromClass) return fromClass;

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

export function streamFromClassLevel(opts: {
  code?: string | null;
  name?: string | null;
}): LevelStream | null {
  const fromCode = streamFromClassLevelCode(opts.code);
  if (fromCode) return fromCode;

  const name = (opts.name || '').toUpperCase();
  if (!name) return null;
  if (name.includes('JSS') || name.includes('JUNIOR')) return 'JUNIOR';
  if (/(^|\s)SS\s*[1-3]/.test(name) || name.includes('SENIOR')) return 'SENIOR';
  return null;
}

/** Map AgoraSubject.levelStreams to the school Subject JUNIOR/SENIOR/ALL split. */
export function streamFromAgoraLevelStreams(streams?: string[] | null): LevelStream | null {
  if (!streams?.length) return null;
  const upper = streams.map((s) => s.toUpperCase());
  const hasJunior = upper.includes('JUNIOR');
  const hasSenior = upper.includes('SENIOR');
  if (hasJunior && hasSenior) return 'ALL';
  if (hasJunior) return 'JUNIOR';
  if (hasSenior) return 'SENIOR';
  return null;
}

/** Catalog streams win over a stored school levelStream. */
export function resolveSchoolSubjectStream(opts: {
  agoraLevelStreams?: string[] | null;
  levelStream?: string | null;
  classLevelCode?: string | null;
  classLevelName?: string | null;
  code?: string | null;
}): LevelStream {
  const fromCatalog = streamFromAgoraLevelStreams(opts.agoraLevelStreams);
  if (fromCatalog) return fromCatalog;
  return inferLevelStream(opts);
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
