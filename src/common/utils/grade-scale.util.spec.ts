import {
  percentageToDisplayGrade,
  toWaecGrade,
  weightedSubjectPercentage,
} from './grade-scale.util';

describe('grade-scale.util', () => {
  it('maps WAEC A1–F9 bands', () => {
    expect(toWaecGrade(90)).toBe('A1');
    expect(toWaecGrade(72)).toBe('B2');
    expect(toWaecGrade(51)).toBe('C6');
    expect(toWaecGrade(20)).toBe('F9');
  });

  it('uses A1–F9 scale or percentage', () => {
    expect(percentageToDisplayGrade(80, 'A1_F9')).toBe('A1');
    expect(percentageToDisplayGrade(80, 'PERCENTAGE')).toBe('80%');
    expect(percentageToDisplayGrade(80, 'CUSTOM')).toBe('80%');
  });

  it('weights CA and exam', () => {
    expect(weightedSubjectPercentage(50, 100, 40, 60)).toBe(80);
    expect(weightedSubjectPercentage(70, null, 40, 60)).toBe(70);
    expect(weightedSubjectPercentage(null, 90, 40, 60)).toBe(90);
  });
});
