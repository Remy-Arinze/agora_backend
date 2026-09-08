import {
  inferLevelStream,
  resolveSchoolSubjectStream,
  streamFromAgoraLevelStreams,
  streamFromClassLevel,
  subjectOfferedInStream,
  streamFromClassLevelCode,
} from './subject-level-stream.util';

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

  it('maps catalog levelStreams to JUNIOR, SENIOR, or ALL', () => {
    expect(streamFromAgoraLevelStreams(['JUNIOR'])).toBe('JUNIOR');
    expect(streamFromAgoraLevelStreams(['SENIOR'])).toBe('SENIOR');
    expect(streamFromAgoraLevelStreams(['JUNIOR', 'SENIOR'])).toBe('ALL');
    expect(streamFromAgoraLevelStreams(['PRIMARY'])).toBeNull();
  });

  it('lets catalog streams win over a wrong school levelStream', () => {
    expect(resolveSchoolSubjectStream({
      agoraLevelStreams: ['SENIOR'],
      levelStream: 'ALL',
      code: 'BIO',
    })).toBe('SENIOR');
    expect(resolveSchoolSubjectStream({
      agoraLevelStreams: ['JUNIOR'],
      levelStream: 'SENIOR',
      code: 'BSC',
    })).toBe('JUNIOR');
  });

  it('does not offer Biology on JSS and does offer English on both', () => {
    const biology = resolveSchoolSubjectStream({
      agoraLevelStreams: ['SENIOR'],
      code: 'BIO',
    });
    const english = resolveSchoolSubjectStream({
      agoraLevelStreams: ['JUNIOR', 'SENIOR'],
      code: 'ENG',
    });
    expect(subjectOfferedInStream(biology, 'JUNIOR')).toBe(false);
    expect(subjectOfferedInStream(biology, 'SENIOR')).toBe(true);
    expect(subjectOfferedInStream(english, 'JUNIOR')).toBe(true);
    expect(subjectOfferedInStream(english, 'SENIOR')).toBe(true);
  });

  it('reads JSS vs SS from class names when code is missing', () => {
    expect(streamFromClassLevel({ name: 'JSS 1' })).toBe('JUNIOR');
    expect(streamFromClassLevel({ name: 'SS 2 Gold' })).toBe('SENIOR');
    expect(streamFromClassLevel({ name: 'Primary 3' })).toBeNull();
  });
});
