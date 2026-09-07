const STOP = new Set([
  'THE', 'AND', 'OF', 'A', 'AN', 'TO', 'IN', 'FOR', 'ON', 'WITH', 'AT',
]);

function slugPart(value: string, max = 24): string {
  const cleaned = (value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const tokens = cleaned.split('-').filter((t) => t && !STOP.has(t));
  const joined = (tokens.length ? tokens : [cleaned || 'TOPIC']).join('-');
  return joined.slice(0, max) || 'TOPIC';
}

export function buildTopicStableKey(input: {
  subjectCode?: string | null;
  gradeLevel?: string | null;
  term?: number | null;
  weekNumber?: number | null;
  title: string;
}): string {
  const subject = slugPart(input.subjectCode || 'SUB', 8);
  const grade = slugPart(input.gradeLevel || 'G', 10);
  const term = Math.max(1, Number(input.term) || 1);
  const week = Math.max(0, Number(input.weekNumber) || 0);
  const title = slugPart(input.title, 28);
  const weekPart = week > 0 ? `W${String(week).padStart(2, '0')}` : 'WX';
  return `${subject}-${grade}-T${term}-${weekPart}-${title}`;
}

export function allocateUniqueStableKey(
  preferred: string,
  existing: Set<string>,
): string {
  if (!existing.has(preferred)) {
    existing.add(preferred);
    return preferred;
  }
  let i = 2;
  while (existing.has(`${preferred}-${i}`)) i += 1;
  const next = `${preferred}-${i}`;
  existing.add(next);
  return next;
}

export function schemeActiveKey(
  schoolId: string,
  subjectId: string,
  termId: string,
  classLevelId: string | null | undefined,
): string {
  return `${schoolId}:${subjectId}:${termId}:${classLevelId || 'none'}`;
}
