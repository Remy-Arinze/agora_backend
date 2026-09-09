import { analyzeTimetableGeneration, solveTimetable } from './timetable-curator.solver';
import type { CuratorSolveInput, CuratorSubject, CuratorTeacher } from './timetable-curator.types';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

const SCHEDULE: CuratorSolveInput['schedule'] = [
  { startTime: '08:00', endTime: '08:15', type: 'ASSEMBLY' },
  { startTime: '08:15', endTime: '09:00', type: 'LESSON' },
  { startTime: '09:00', endTime: '09:45', type: 'LESSON' },
  { startTime: '09:45', endTime: '10:30', type: 'LESSON' },
  { startTime: '10:30', endTime: '11:00', type: 'BREAK' },
];

const classTeacher: CuratorTeacher = { id: 'ct-1', firstName: 'Ada', lastName: 'Okafor' };
const lightTeacher: CuratorTeacher = { id: 't-light', firstName: 'Bola', lastName: 'Ade', periodCount: 2 };
const heavyTeacher: CuratorTeacher = { id: 't-heavy', firstName: 'Chidi', lastName: 'Eze', periodCount: 20 };

const english: CuratorSubject = {
  id: 'eng',
  name: 'English Language',
  teachers: [lightTeacher, heavyTeacher],
};
const math: CuratorSubject = {
  id: 'math',
  name: 'Mathematics',
  teachers: [lightTeacher],
};
const french: CuratorSubject = { id: 'fr', name: 'French', teachers: [] };

function seededRandom(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function baseInput(overrides: Partial<CuratorSolveInput> = {}): CuratorSolveInput {
  return {
    schoolType: 'SECONDARY',
    subjects: [english, math],
    existingPeriods: [],
    schedule: SCHEDULE,
    workingDays: [...DAYS],
    random: seededRandom(42),
    maxSameSubjectPerDay: 2,
    freePeriodsPerDay: 1,
    maxPeriodsPerTeacherPerDay: 6,
    ...overrides,
  };
}

describe('solveTimetable', () => {
  it('assigns the class teacher on PRIMARY lesson slots', () => {
    const periods = solveTimetable(
      baseInput({
        schoolType: 'PRIMARY',
        primaryClassTeacher: classTeacher,
        subjects: [english, math],
      }),
    );
    const lessons = periods.filter((p) => p.type === 'LESSON' && p.subjectId);
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.every((p) => p.teacherId === 'ct-1')).toBe(true);
    expect(periods.some((p) => p.type === 'ASSEMBLY')).toBe(true);
  });

  it('picks the least-loaded secondary teacher and warns when a subject has none', () => {
    const periods = solveTimetable(
      baseInput({
        subjects: [english, math, french],
        freePeriodsPerDay: 0,
      }),
    );
    const englishLessons = periods.filter((p) => p.subjectId === 'eng' && p.teacherId);
    const frenchLessons = periods.filter((p) => p.subjectId === 'fr');
    expect(englishLessons.length).toBeGreaterThan(0);
    expect(englishLessons.every((p) => p.teacherId === 't-light')).toBe(true);
    if (frenchLessons.length > 0) {
      expect(frenchLessons.some((p) => p.hasTeacherWarning)).toBe(true);
    }
  });

  it('does not overwrite existing subject assignments (fill-empty)', () => {
    const periods = solveTimetable(
      baseInput({
        existingPeriods: [
          {
            dayOfWeek: 'MONDAY',
            startTime: '08:15',
            endTime: '09:00',
            type: 'LESSON',
            subjectId: 'math',
            subjectName: 'Mathematics',
            teacherId: 't-light',
            teacherName: 'Bola Ade',
          },
        ],
      }),
    );
    const locked = periods.find(
      (p) => p.dayOfWeek === 'MONDAY' && p.startTime === '08:15' && p.endTime === '09:00',
    );
    expect(locked?.subjectId).toBe('math');
    expect(locked?.teacherId).toBe('t-light');
  });
});

describe('analyzeTimetableGeneration', () => {
  it('reports missing teachers', () => {
    const periods = solveTimetable(
      baseInput({
        subjects: [french],
        freePeriodsPerDay: 0,
      }),
    );
    const analysis = analyzeTimetableGeneration(periods, {
      requiresTeacherAssignment: true,
      subjects: [french],
    });
    expect(analysis.unassignedTeacher).toBeGreaterThan(0);
    expect(analysis.subjectsWithoutTeachers.some((s) => s.id === 'fr')).toBe(true);
    expect(analysis.warnings.length).toBeGreaterThan(0);
  });
});
