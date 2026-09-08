import {
  agoraGradeLevelCandidates,
  getClassLevelCode,
  resolveClassLevelCode,
} from './nerdc-curriculum.dto';

describe('agoraGradeLevelCandidates', () => {
  it('maps a Primary 1 class name to the super-admin PRIMARY_1 key', () => {
    const keys = agoraGradeLevelCandidates('Primary 1');
    expect(keys).toEqual(expect.arrayContaining(['PRIMARY_1', 'Primary_1', 'Primary 1']));
  });

  it('includes class-name form when the stored key is PRIMARY_1', () => {
    const keys = agoraGradeLevelCandidates('PRIMARY_1');
    expect(keys).toEqual(expect.arrayContaining(['PRIMARY_1', 'Primary_1', 'Primary 1']));
  });

  it('includes PRIMARY_1 for the E2E seed key Primary_1', () => {
    expect(agoraGradeLevelCandidates('Primary_1')).toEqual(
      expect.arrayContaining(['PRIMARY_1', 'Primary_1']),
    );
  });

  it('maps JSS 1 to JSS_1 without changing case of the canonical code', () => {
    expect(agoraGradeLevelCandidates('JSS 1')).toEqual(expect.arrayContaining(['JSS_1', 'JSS 1']));
  });

  it('returns empty for blank input', () => {
    expect(agoraGradeLevelCandidates('  ')).toEqual([]);
  });
});

describe('resolveClassLevelCode', () => {
  it.each([
    ['Primary 1', 'PRIMARY_1'],
    ['Primary_1', 'PRIMARY_1'],
    ['PRIMARY_1', 'PRIMARY_1'],
    ['Pry 1', 'PRIMARY_1'],
    ['JSS 1', 'JSS_1'],
    ['SS_2', 'SS_2'],
  ])('resolves %s → %s', (input, expected) => {
    expect(resolveClassLevelCode(input)).toBe(expected);
  });

  it('respects schoolType so JSS 1 is not a primary code', () => {
    expect(getClassLevelCode('JSS 1', 'PRIMARY')).toBeNull();
    expect(getClassLevelCode('Primary 1', 'PRIMARY')).toBe('PRIMARY_1');
    expect(getClassLevelCode('Primary_1', 'PRIMARY')).toBe('PRIMARY_1');
  });
});
