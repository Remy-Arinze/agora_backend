import {
  CURATOR_CORE_SUBJECTS,
  CURATOR_WORKLOAD_THRESHOLDS,
  type CuratorAnalysis,
  type CuratorDay,
  type CuratorGeneratedPeriod,
  type CuratorPeriodType,
  type CuratorSolveInput,
  type CuratorTeacher,
  type CuratorTeacherAssignment,
  type CuratorWorkloadStatus,
} from './timetable-curator.types';

function workloadStatus(periodCount: number): CuratorWorkloadStatus {
  if (periodCount < CURATOR_WORKLOAD_THRESHOLDS.LOW) return 'LOW';
  if (periodCount <= CURATOR_WORKLOAD_THRESHOLDS.NORMAL) return 'NORMAL';
  if (periodCount <= CURATOR_WORKLOAD_THRESHOLDS.HIGH) return 'HIGH';
  return 'OVERLOADED';
}

function selectLeastLoadedTeacher(
  teachers: CuratorTeacher[],
  workloadTracker: Map<string, number>,
): CuratorTeacher | null {
  if (teachers.length === 0) return null;
  let leastLoaded = teachers[0];
  let minLoad = (leastLoaded.periodCount || 0) + (workloadTracker.get(leastLoaded.id) || 0);
  for (const teacher of teachers) {
    const currentLoad = (teacher.periodCount || 0) + (workloadTracker.get(teacher.id) || 0);
    if (currentLoad < minLoad) {
      minLoad = currentLoad;
      leastLoaded = teacher;
    }
  }
  return leastLoaded;
}

function teacherDisplayName(t: CuratorTeacher): string {
  return `${t.firstName} ${t.lastName}`.trim();
}

function asPeriodType(type?: string): CuratorPeriodType {
  if (type === 'BREAK' || type === 'LUNCH' || type === 'ASSEMBLY') return type;
  return 'LESSON';
}

/**
 * Deterministic-enough timetable fill. Randomness is injected so tests can seed it.
 * Existing subject/course assignments are never overwritten.
 */
export function solveTimetable(input: CuratorSolveInput): CuratorGeneratedPeriod[] {
  const {
    schoolType,
    subjects,
    existingPeriods,
    schedule,
    workingDays,
    maxSameSubjectPerDay = 2,
    freePeriodsPerDay = 1,
    maxPeriodsPerTeacherPerDay = 6,
    primaryClassTeacher,
    random = Math.random,
  } = input;

  const DAYS = workingDays.length ? workingDays : (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as CuratorDay[]);
  const requiresTeacherAssignment = schoolType === 'SECONDARY';
  const isTertiary = schoolType === 'TERTIARY';
  const isPrimary = schoolType === 'PRIMARY';
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const result: CuratorGeneratedPeriod[] = [];
  const workloadTracker = new Map<string, number>();
  const dailyLoadTracker = new Map<string, number>();
  const hasExistingTimetable = existingPeriods.length > 0;

  existingPeriods.forEach((p) => {
    result.push({
      dayOfWeek: p.dayOfWeek,
      startTime: p.startTime,
      endTime: p.endTime,
      subjectId: p.subjectId || undefined,
      subjectName: p.subjectName || undefined,
      courseId: p.courseId || undefined,
      courseName: p.courseName || undefined,
      teacherId: p.teacherId || undefined,
      teacherName: p.teacherName || undefined,
      type: asPeriodType(p.type),
    });
    if (p.teacherId) {
      workloadTracker.set(p.teacherId, (workloadTracker.get(p.teacherId) || 0) + 1);
      const dailyKey = `${p.teacherId}:${p.dayOfWeek}`;
      dailyLoadTracker.set(dailyKey, (dailyLoadTracker.get(dailyKey) || 0) + 1);
    }
  });

  const hasSubjectAssigned = (day: CuratorDay, startTime: string, endTime: string) =>
    result.some(
      (p) =>
        p.dayOfWeek === day &&
        p.startTime === startTime &&
        p.endTime === endTime &&
        (p.subjectId || p.courseId),
    );

  const hasPeriodAtTime = (day: CuratorDay, startTime: string, endTime: string) =>
    result.some((p) => p.dayOfWeek === day && p.startTime === startTime && p.endTime === endTime);

  const countSubjectOnDay = (day: CuratorDay, subjectId: string) =>
    result.filter((p) => p.dayOfWeek === day && (p.subjectId === subjectId || p.courseId === subjectId)).length;

  const getPreviousSubject = (day: CuratorDay, startTime: string): string | undefined => {
    const sorted = result
      .filter((p) => p.dayOfWeek === day && p.type === 'LESSON' && (p.subjectId || p.courseId))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const previous = sorted.filter((p) => p.startTime < startTime);
    if (previous.length === 0) return undefined;
    const prev = previous[previous.length - 1];
    return prev.subjectId || prev.courseId;
  };

  const updatePeriodInResult = (
    day: CuratorDay,
    startTime: string,
    endTime: string,
    updates: Partial<CuratorGeneratedPeriod>,
  ) => {
    const index = result.findIndex(
      (p) => p.dayOfWeek === day && p.startTime === startTime && p.endTime === endTime,
    );
    if (index !== -1) {
      result[index] = { ...result[index], ...updates };
      return true;
    }
    return false;
  };

  if (!hasExistingTimetable) {
    schedule.forEach((period) => {
      if (period.type !== 'LESSON') {
        DAYS.forEach((day) => {
          result.push({
            dayOfWeek: day,
            startTime: period.startTime,
            endTime: period.endTime,
            type: period.type,
          });
        });
      }
    });
  }

  const existingLessonSlots = new Map<string, { startTime: string; endTime: string }>();
  existingPeriods
    .filter((p) => p.type === 'LESSON' || !p.type)
    .forEach((p) => {
      const key = `${p.startTime}-${p.endTime}`;
      if (!existingLessonSlots.has(key)) {
        existingLessonSlots.set(key, { startTime: p.startTime, endTime: p.endTime });
      }
    });

  const lessonPeriods = hasExistingTimetable
    ? Array.from(existingLessonSlots.values()).sort((a, b) => a.startTime.localeCompare(b.startTime))
    : schedule.filter((p) => p.type === 'LESSON');

  const createWeightedPool = (): { id: string; name: string }[] => {
    const pool: { id: string; name: string }[] = [];
    subjects.forEach((item) => {
      const isCore = CURATOR_CORE_SUBJECTS.some((core) => item.name.toLowerCase().includes(core));
      const weight = item.weight ?? (isCore ? 3 : 2);
      for (let i = 0; i < Math.max(1, Math.round(weight)); i++) {
        pool.push({ id: item.id, name: item.name });
      }
    });
    return pool;
  };

  const shuffle = <T>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const assignTeacher = (
    selected: { id: string; name: string },
    day: CuratorDay,
    periodData: Partial<CuratorGeneratedPeriod>,
  ) => {
    if (isPrimary && primaryClassTeacher) {
      periodData.teacherId = primaryClassTeacher.id;
      periodData.teacherName = teacherDisplayName(primaryClassTeacher);
      workloadTracker.set(
        primaryClassTeacher.id,
        (workloadTracker.get(primaryClassTeacher.id) || 0) + 1,
      );
      const dailyKey = `${primaryClassTeacher.id}:${day}`;
      dailyLoadTracker.set(dailyKey, (dailyLoadTracker.get(dailyKey) || 0) + 1);
      return;
    }

    if (!requiresTeacherAssignment || isTertiary) return;

    const subject = subjectMap.get(selected.id);
    const teachers = subject?.teachers || [];
    if (teachers.length === 0) {
      periodData.hasTeacherWarning = true;
      periodData.warningMessage = `No teachers assigned to ${selected.name}`;
      return;
    }

    const selectedTeacher = selectLeastLoadedTeacher(
      teachers.filter((t) => {
        const dailyKey = `${t.id}:${day}`;
        const daily = dailyLoadTracker.get(dailyKey) || 0;
        return daily < maxPeriodsPerTeacherPerDay;
      }),
      workloadTracker,
    );

    if (selectedTeacher) {
      periodData.teacherId = selectedTeacher.id;
      periodData.teacherName = teacherDisplayName(selectedTeacher);
      workloadTracker.set(selectedTeacher.id, (workloadTracker.get(selectedTeacher.id) || 0) + 1);
      const dailyKey = `${selectedTeacher.id}:${day}`;
      dailyLoadTracker.set(dailyKey, (dailyLoadTracker.get(dailyKey) || 0) + 1);
      const totalLoad =
        (selectedTeacher.periodCount || 0) + (workloadTracker.get(selectedTeacher.id) || 0);
      const dailyLoad = dailyLoadTracker.get(dailyKey) || 0;
      if (dailyLoad >= maxPeriodsPerTeacherPerDay) {
        periodData.hasTeacherWarning = true;
        periodData.warningMessage = `${periodData.teacherName} reached the daily period cap (${maxPeriodsPerTeacherPerDay})`;
      } else if (totalLoad > CURATOR_WORKLOAD_THRESHOLDS.HIGH) {
        periodData.hasTeacherWarning = true;
        periodData.warningMessage = `${periodData.teacherName} has ${totalLoad} periods (high load)`;
      }
    } else {
      periodData.hasTeacherWarning = true;
      periodData.warningMessage = `All teachers for ${selected.name} are at the daily period cap`;
    }
  };

  DAYS.forEach((day) => {
    let freePeriodsAddedToday = 0;
    const maxFreeToday = freePeriodsPerDay + (random() > 0.5 ? 1 : 0);
    const totalLessonsToday = lessonPeriods.length;

    lessonPeriods.forEach((period, periodIndex) => {
      if (hasSubjectAssigned(day, period.startTime, period.endTime)) return;

      const periodExists = hasPeriodAtTime(day, period.startTime, period.endTime);
      const pool = shuffle(createWeightedPool());

      if (pool.length === 0) {
        if (!periodExists) {
          result.push({
            dayOfWeek: day,
            startTime: period.startTime,
            endTime: period.endTime,
            type: 'LESSON',
            subjectName: 'Free Period',
          });
        }
        return;
      }

      const remainingSlots = Math.max(1, totalLessonsToday - periodIndex);
      const shouldBeFree =
        freePeriodsAddedToday < maxFreeToday && random() < maxFreeToday / remainingSlots;

      if (shouldBeFree) {
        freePeriodsAddedToday++;
        if (!periodExists) {
          result.push({
            dayOfWeek: day,
            startTime: period.startTime,
            endTime: period.endTime,
            type: 'LESSON',
            subjectName: 'Free Period',
          });
        }
        return;
      }

      const previousSubject = getPreviousSubject(day, period.startTime);
      let selected = pool.find(
        (candidate) =>
          candidate.id !== previousSubject &&
          countSubjectOnDay(day, candidate.id) < maxSameSubjectPerDay,
      );
      if (!selected && pool.length > 0) selected = pool[0];

      if (selected) {
        const periodData: Partial<CuratorGeneratedPeriod> = {
          type: 'LESSON',
          subjectId: !isTertiary ? selected.id : undefined,
          subjectName: !isTertiary ? selected.name : undefined,
          courseId: isTertiary ? selected.id : undefined,
          courseName: isTertiary ? selected.name : undefined,
        };
        assignTeacher(selected, day, periodData);
        if (periodExists) {
          updatePeriodInResult(day, period.startTime, period.endTime, periodData);
        } else {
          result.push({
            dayOfWeek: day,
            startTime: period.startTime,
            endTime: period.endTime,
            ...periodData,
          } as CuratorGeneratedPeriod);
        }
      } else if (!periodExists) {
        result.push({
          dayOfWeek: day,
          startTime: period.startTime,
          endTime: period.endTime,
          type: 'LESSON',
          subjectName: 'Free Period',
        });
      }
    });
  });

  return result.sort((a, b) => {
    const dayOrder = DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek);
    if (dayOrder !== 0) return dayOrder;
    return a.startTime.localeCompare(b.startTime);
  });
}

export function analyzeTimetableGeneration(
  periods: CuratorGeneratedPeriod[],
  options: {
    requiresTeacherAssignment: boolean;
    subjects: CuratorSolveInput['subjects'];
  },
): CuratorAnalysis {
  const { requiresTeacherAssignment, subjects } = options;
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const lessonPeriods = periods.filter((p) => p.type === 'LESSON');
  const freePeriods = lessonPeriods.filter(
    (p) => p.subjectName === 'Free Period' || (!p.subjectId && !p.courseId),
  );

  const teacherAssignmentMap = new Map<
    string,
    {
      teacherId: string;
      teacherName: string;
      subjects: Map<string, { id: string; name: string; count: number }>;
      totalPeriods: number;
    }
  >();
  const subjectMissingTeacher = new Map<string, { id: string; name: string; periodCount: number }>();
  const usedSubjects = new Set<string>();
  let assignedWithTeacher = 0;
  let unassignedTeacher = 0;

  lessonPeriods.forEach((period) => {
    if (!period.subjectId) return;
    usedSubjects.add(period.subjectId);
    if (period.teacherId && period.teacherName) {
      assignedWithTeacher++;
      if (!teacherAssignmentMap.has(period.teacherId)) {
        teacherAssignmentMap.set(period.teacherId, {
          teacherId: period.teacherId,
          teacherName: period.teacherName,
          subjects: new Map(),
          totalPeriods: 0,
        });
      }
      const teacherData = teacherAssignmentMap.get(period.teacherId)!;
      teacherData.totalPeriods++;
      if (!teacherData.subjects.has(period.subjectId)) {
        teacherData.subjects.set(period.subjectId, {
          id: period.subjectId,
          name: period.subjectName || 'Unknown',
          count: 0,
        });
      }
      teacherData.subjects.get(period.subjectId)!.count++;
    } else if (requiresTeacherAssignment) {
      unassignedTeacher++;
      if (!subjectMissingTeacher.has(period.subjectId)) {
        subjectMissingTeacher.set(period.subjectId, {
          id: period.subjectId,
          name: period.subjectName || 'Unknown',
          periodCount: 0,
        });
      }
      subjectMissingTeacher.get(period.subjectId)!.periodCount++;
    }
  });

  const teacherAssignments: CuratorTeacherAssignment[] = [];
  teacherAssignmentMap.forEach((data) => {
    data.subjects.forEach((subject) => {
      const subjectData = subjectMap.get(subject.id);
      const teacherInfo = subjectData?.teachers?.find((t) => t.id === data.teacherId);
      const baseLoad = teacherInfo?.periodCount || 0;
      const totalLoad = baseLoad + data.totalPeriods;
      teacherAssignments.push({
        teacherId: data.teacherId,
        teacherName: data.teacherName,
        subjectId: subject.id,
        subjectName: subject.name,
        periodCount: subject.count,
        totalLoad,
        status: workloadStatus(totalLoad),
      });
    });
  });
  teacherAssignments.sort((a, b) => b.totalLoad - a.totalLoad);

  const warnings: string[] = [];
  if (unassignedTeacher > 0) {
    warnings.push(`${unassignedTeacher} periods have no teacher assigned`);
  }
  teacherAssignments.forEach((ta) => {
    if (ta.status === 'OVERLOADED') {
      warnings.push(`${ta.teacherName} is overloaded with ${ta.totalLoad} periods`);
    } else if (ta.status === 'HIGH') {
      warnings.push(`${ta.teacherName} has high workload (${ta.totalLoad} periods)`);
    }
  });
  subjectMissingTeacher.forEach((subject) => {
    warnings.push(`"${subject.name}" has ${subject.periodCount} periods without a teacher`);
  });

  return {
    totalPeriods: lessonPeriods.length - freePeriods.length,
    assignedWithTeacher,
    unassignedTeacher,
    freePeriods: freePeriods.length,
    subjectsUsed: usedSubjects.size,
    teachersInvolved: teacherAssignmentMap.size,
    teacherAssignments,
    subjectsWithoutTeachers: Array.from(subjectMissingTeacher.values()),
    warnings,
  };
}
