import { inferLevelStream, subjectOfferedInStream, streamFromClassLevelCode } from './subject-level-stream.util';

describe('subject-level-stream.util', () => {
  it('keeps an explicit JUNIOR/SENIOR/ALL stream', () => {
    expect(inferLevelStream({ levelStream: 'JUNIOR', code: 'PHY' })).toBe('JUNIOR');
    expect(inferLevelStream({ levelStream: 'SENIOR' })).toBe('SENIOR');
    expect(inferLevelStream({ levelStream: 'ALL', code: 'PHY' })).toBe('ALL');
  });

  it('infers JSS vs SS from class level and subject code', () => {
    expect(inferLevelStream({ classLevelCode: 'JSS_1' })).toBe('JUNIOR');
    expect(inferLevelStream({ classLevelCode: 'SS_2' })).toBe('SENIOR');
    expect(inferLevelStream({ code: 'BSC' })).toBe('JUNIOR');
    expect(inferLevelStream({ code: 'PHY' })).toBe('SENIOR');
    expect(inferLevelStream({ code: 'MTH' })).toBe('ALL');
  });

  it('matches offer rules used by the subjects filter', () => {
    expect(subjectOfferedInStream('JUNIOR', 'JUNIOR')).toBe(true);
    expect(subjectOfferedInStream('SENIOR', 'JUNIOR')).toBe(false);
    expect(subjectOfferedInStream('ALL', 'SENIOR')).toBe(true);
    expect(streamFromClassLevelCode('JSS_3')).toBe('JUNIOR');
    expect(streamFromClassLevelCode('SS_1')).toBe('SENIOR');
  });
});
