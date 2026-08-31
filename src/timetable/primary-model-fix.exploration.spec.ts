/**
 * Bug Condition Exploration Tests — Primary School Model Fix
 *
 * Task 1: Write bug condition exploration tests (BEFORE implementing any fix)
 *
 * CRITICAL: These tests MUST FAIL on unfixed code — failure confirms the bugs exist.
 * DO NOT fix the code or the tests when they fail.
 * These tests encode the expected behavior and will validate fixes when they pass.
 *
 * Requirements: 1.1, 2.1, 3.1, 3.2
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TimetableService } from './timetable.service';
import { PrismaService } from '../database/prisma.service';
import { SchoolRepository } from '../schools/domain/repositories/school.repository';
import { TestUtils } from '../common/test/test-utils';
import { DayOfWeek, PeriodType } from './dto/create-timetable-period.dto';
import { NotificationInboxService } from '../notification/notification-inbox.service';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Helper: Bug Condition predicates (mirror the formal spec from design.md)
// ---------------------------------------------------------------------------

/**
 * REQ-P1 bug condition: teacher section is visible when currentType === 'PRIMARY'.
 * On unfixed code the component always renders the section, so this returns true.
 */
function isBugCondition_P1_inSourceCode(subjectsPageSource: string): boolean {
  // The bug: the entire "Competent Teachers Section" div is NOT wrapped with
  // a `currentType !== 'PRIMARY'` guard on the outer div.
  // We detect this by checking: the comment exists AND the div immediately
  // following it has no PRIMARY guard wrapping it.
  const commentIdx = subjectsPageSource.indexOf('Competent Teachers Section');
  if (commentIdx === -1) return false; // Comment not found — unexpected

  // On unfixed code the line after the comment is `<div className="space-y-2">` with no guard.
  // On fixed code it would be wrapped in `{currentType !== 'PRIMARY' && (`.
  const surroundingCode = subjectsPageSource.substring(
    commentIdx - 200,
    commentIdx + 300,
  );

  // If the outer wrapping guard exists, bug is fixed. If absent, bug is present.
  const hasOuterGuard =
    surroundingCode.includes("currentType !== 'PRIMARY'") &&
    // The guard must be BEFORE the opening div of the section, not inside it
    surroundingCode.indexOf("currentType !== 'PRIMARY'") <
      surroundingCode.indexOf('<div className="space-y-2">');

  // Bug condition is true (bug exists) when guard is ABSENT
  return !hasOuterGuard;
}

/**
 * REQ-P2 bug condition: SubjectMultiSelect renders for PRIMARY in Add Teacher form.
 * On unfixed code the block `{currentType === 'PRIMARY' && schoolId && (<SubjectMultiSelect …)}` is present.
 */
function isBugCondition_P2_inSourceCode(addPageSource: string): boolean {
  // The bug: a block `{currentType === 'PRIMARY' && schoolId && (` that renders SubjectMultiSelect exists.
  // On fixed code this block should be deleted entirely.
  const hasPrimarySubjectBlock =
    addPageSource.includes("currentType === 'PRIMARY' && schoolId") &&
    // Check that it is rendering a SubjectMultiSelect (not just the class arm selector)
    addPageSource.includes('SubjectMultiSelect') &&
    (() => {
      // Find the PRIMARY && schoolId block and verify SubjectMultiSelect is inside it
      const primaryBlockIdx = addPageSource.indexOf("currentType === 'PRIMARY' && schoolId");
      if (primaryBlockIdx === -1) return false;
      // Look for SubjectMultiSelect within the next 400 characters (scope of the block)
      const nearbyCode = addPageSource.substring(primaryBlockIdx, primaryBlockIdx + 400);
      return nearbyCode.includes('SubjectMultiSelect');
    })();

  return hasPrimarySubjectBlock;
}

/**
 * REQ-P2 bug condition (no-subjects banner): banner renders without PRIMARY guard.
 */
function isBugCondition_P2_banner_inSourceCode(addPageSource: string): boolean {
  // The bug: `{schoolId && subjects.length === 0 && (` has no `currentType !== 'PRIMARY'` guard
  // Find the no-subjects warning block
  const bannerBlockIdx = addPageSource.indexOf("subjects.length === 0");
  if (bannerBlockIdx === -1) return false;

  // Get the 200 chars before the match to see if there's a PRIMARY guard
  const preceding = addPageSource.substring(
    Math.max(0, bannerBlockIdx - 200),
    bannerBlockIdx,
  );

  // On fixed code, currentType !== 'PRIMARY' must appear in the same JSX expression
  // On unfixed code, it does NOT appear immediately before
  const bannerExprStart = addPageSource.lastIndexOf('{', bannerBlockIdx);
  if (bannerExprStart === -1) return false;
  const expr = addPageSource.substring(bannerExprStart, bannerBlockIdx + 30);
  const hasPrimaryGuard = expr.includes("currentType !== 'PRIMARY'");

  return !hasPrimaryGuard; // Bug condition = guard is absent
}

// ---------------------------------------------------------------------------
// REQ-P1: SubjectCard teacher section visibility
// Validates: Requirements 1.1
// ---------------------------------------------------------------------------

describe('[BUG-EXPLORATION] REQ-P1 — SubjectCard teacher section visible for PRIMARY', () => {
  /**
   * Property 1: Bug Condition — Teacher section must be ABSENT when currentType === 'PRIMARY'
   * On UNFIXED code this test FAILS (confirming the bug).
   * Validates: Requirements 1.1
   */
  it('P1-BUG-CONDITION: teacher section (space-y-2 div) is wrapped with a PRIMARY guard — EXPECTED TO FAIL ON UNFIXED CODE', () => {
    const subjectsPagePath = path.resolve(
      __dirname,
      '../../../frontend/src/app/dashboard/school/subjects/page.tsx',
    );
    const source = fs.readFileSync(subjectsPagePath, 'utf8');

    const bugConditionHolds = isBugCondition_P1_inSourceCode(source);

    // On unfixed code: bugConditionHolds === true (outer guard is absent).
    // Expected (fixed) behavior: bugConditionHolds === false (outer guard is present).
    // This assertion FAILS on unfixed code, confirming the bug.
    expect(bugConditionHolds).toBe(false);
    /* Counterexample on unfixed code:
     * The "Competent Teachers Section" div has no `{currentType !== 'PRIMARY' && (` wrapper.
     * Result: Teachers: / Competent Teachers: / One teacher only / teacher list + remove buttons
     *         are ALL rendered unconditionally for PRIMARY school admins.
     */
  });

  it('P1-BUG-CONDITION: "(One teacher only)" hint label is not visible for PRIMARY — EXPECTED TO FAIL ON UNFIXED CODE', () => {
    const subjectsPagePath = path.resolve(
      __dirname,
      '../../../frontend/src/app/dashboard/school/subjects/page.tsx',
    );
    const source = fs.readFileSync(subjectsPagePath, 'utf8');

    // On unfixed code the "One teacher only" hint is inside the unconditionally-rendered
    // section and is only conditionally shown via `currentType === 'PRIMARY'`.
    // The OUTER section div must be gated so the hint is never reachable for PRIMARY users.
    // Check: the span with "(One teacher only)" is inside a guarded outer div.
    const oneTeacherOnlyIdx = source.indexOf('One teacher only');
    if (oneTeacherOnlyIdx === -1) {
      return;
    }
    expect(oneTeacherOnlyIdx).toBeGreaterThan(-1);

    // Look for an outer PRIMARY guard wrapping this span
    const before = source.substring(0, oneTeacherOnlyIdx);
    // The last unclosed `{currentType !== 'PRIMARY' && (` before this span
    const lastGuardIdx = before.lastIndexOf("currentType !== 'PRIMARY'");
    // On unfixed code: no such guard exists before the section
    // (the only guard inside is `{currentType !== 'PRIMARY' && ...}` for the ADD button, not the section)
    // The outer space-y-2 div must be the guarded element.
    // We check: the guard is found before the `<div className="space-y-2">` that precedes the hint.
    const spaceY2Idx = before.lastIndexOf('<div className="space-y-2">');

    // On unfixed code: lastGuardIdx is either -1 or comes AFTER spaceY2Idx
    // (meaning the guard is for the add-teacher button inside the div, not wrapping the div).
    // Expected (fixed): lastGuardIdx > spaceY2Idx would be wrong...
    // Actually: On fixed code there IS an outer guard wrapping the entire div.
    // We assert: there is a guard that comes BEFORE the div.
    const outerGuardPresent = lastGuardIdx !== -1 && lastGuardIdx > spaceY2Idx
      ? false // guard is after the div start — it's an inner guard
      : lastGuardIdx !== -1 && lastGuardIdx < spaceY2Idx; // guard before div

    // On unfixed code: outerGuardPresent === false  →  this assertion FAILS
    expect(outerGuardPresent).toBe(true);
    /* Counterexample: "One teacher only" text is rendered in the DOM when currentType='PRIMARY'
     * because the outer space-y-2 div has no PRIMARY exclusion guard.
     */
  });
});

// ---------------------------------------------------------------------------
// REQ-P2: SubjectMultiSelect absent from PRIMARY Add Teacher form
// Validates: Requirements 2.1
// ---------------------------------------------------------------------------

describe('[BUG-EXPLORATION] REQ-P2 — SubjectMultiSelect rendered for PRIMARY in Add Teacher form', () => {
  /**
   * Property 2: Bug Condition — SubjectMultiSelect must NOT render when currentType === 'PRIMARY'
   * On UNFIXED code this test FAILS (confirming the bug).
   * Validates: Requirements 2.1
   */
  it('P2-BUG-CONDITION: PRIMARY SubjectMultiSelect block has been removed from source — EXPECTED TO FAIL ON UNFIXED CODE', () => {
    const addPagePath = path.resolve(
      __dirname,
      '../../../frontend/src/app/dashboard/school/staff/add/page.tsx',
    );
    const source = fs.readFileSync(addPagePath, 'utf8');

    const bugConditionHolds = isBugCondition_P2_inSourceCode(source);

    // On unfixed code: bugConditionHolds === true (PRIMARY SubjectMultiSelect block exists).
    // Expected (fixed) behavior: bugConditionHolds === false (block has been removed).
    // This assertion FAILS on unfixed code, confirming the bug.
    expect(bugConditionHolds).toBe(false);
    /* Counterexample on unfixed code:
     * The block `{currentType === 'PRIMARY' && schoolId && (<SubjectMultiSelect maxSelections={1} .../>)}`
     * is present in the source. A PRIMARY school admin opening the Add Teacher form sees a
     * SubjectMultiSelect for subject-specialist assignment, which is conceptually wrong.
     */
  });

  it('P2-BUG-CONDITION: no-subjects banner has a currentType !== PRIMARY guard — EXPECTED TO FAIL ON UNFIXED CODE', () => {
    const addPagePath = path.resolve(
      __dirname,
      '../../../frontend/src/app/dashboard/school/staff/add/page.tsx',
    );
    const source = fs.readFileSync(addPagePath, 'utf8');

    const bannerBugConditionHolds = isBugCondition_P2_banner_inSourceCode(source);

    // On unfixed code: bannerBugConditionHolds === true (no PRIMARY guard on the banner).
    // Expected (fixed) behavior: bannerBugConditionHolds === false (guard is present).
    expect(bannerBugConditionHolds).toBe(false);
    /* Counterexample on unfixed code:
     * The "⚠️ No subjects found" warning banner is rendered via
     * `{schoolId && subjects.length === 0 && (...)}` with NO `currentType !== 'PRIMARY'` guard.
     * A PRIMARY school admin with no subjects sees this confusing banner.
     */
  });
});

// ---------------------------------------------------------------------------
// REQ-P3: PRIMARY LESSON periods auto-populated with class teacher
// Validates: Requirements 3.1, 3.2
// ---------------------------------------------------------------------------

describe('[BUG-EXPLORATION] REQ-P3 — PRIMARY LESSON periods created with null teacherId', () => {
  let service: TimetableService;
  let prisma: jest.Mocked<PrismaService>;
  let schoolRepository: jest.Mocked<SchoolRepository>;

  const SCHOOL_ID = 'school-primary-1';
  const CLASS_ARM_ID = 'arm-primary-1';
  const TERM_ID = 'term-1';
  const CT_TEACHER_ID = 'ct-teacher-id'; // The class teacher's id

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableService,
        {
          provide: PrismaService,
          useValue: TestUtils.createMockPrismaService(),
        },
        {
          provide: SchoolRepository,
          useValue: { findById: jest.fn() },
        },
        {
          provide: NotificationInboxService,
          useValue: { createAndFanOut: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TimetableService>(TimetableService);
    prisma = module.get(PrismaService);
    schoolRepository = module.get(SchoolRepository);
  });

  /**
   * Setup helper: configure mocks for a PRIMARY arm scenario.
   * - classArm resolves to a PRIMARY class level
   * - classTeacher resolves to a record with teacherId = CT_TEACHER_ID
   * - term and school mocks are configured
   */
  function setupPrimaryArmMocks() {
    const mockSchool = TestUtils.createMockSchool({ id: SCHOOL_ID });
    schoolRepository.findById.mockResolvedValue(mockSchool as any);

    const mockTerm = {
      id: TERM_ID,
      academicSession: { schoolId: SCHOOL_ID },
    };
    (prisma.term.findUnique as jest.Mock).mockResolvedValue(mockTerm as any);

    // classArm.findUnique → PRIMARY arm
    const mockClassArm = {
      id: CLASS_ARM_ID,
      classLevel: {
        id: 'level-1',
        type: 'PRIMARY',
        schoolId: SCHOOL_ID,
      },
    };
    (prisma.classArm.findUnique as jest.Mock).mockResolvedValue(mockClassArm as any);

    // classTeacher.findFirst → primary class teacher exists
    const mockClassTeacher = {
      id: 'ct-1',
      classArmId: CLASS_ARM_ID,
      teacherId: CT_TEACHER_ID,
      isPrimary: true,
    };
    (prisma.classTeacher.findFirst as jest.Mock).mockResolvedValue(mockClassTeacher as any);
  }

  /**
   * Helper: build the mock period object that timetablePeriod.create returns.
   * We capture what was passed to `create` so we can inspect teacherId.
   */
  function makeCreateMock(teacherIdInResponse: string | null) {
    return jest.fn().mockImplementation((args: any) => {
      // The period is stored with whatever teacherId was in args.data
      return Promise.resolve({
        id: 'period-new-1',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '08:00',
        endTime: '09:00',
        type: PeriodType.LESSON,
        classArmId: CLASS_ARM_ID,
        termId: TERM_ID,
        subjectId: null,
        courseId: null,
        teacherId: args.data?.teacherId ?? teacherIdInResponse,
        roomId: null,
        classId: null,
        subject: null,
        course: null,
        class: null,
        teacher: null,
        room: null,
        classArm: {
          id: CLASS_ARM_ID,
          name: 'Arm A',
          classLevel: { id: 'level-1', type: 'PRIMARY', name: 'Primary 1' },
        },
      });
    });
  }

  /**
   * Property 3: Bug Condition — createPeriod for PRIMARY LESSON arm with class teacher
   * MUST return period.teacherId === CT_TEACHER_ID (auto-filled).
   *
   * On UNFIXED code: teacherId is null → test FAILS, confirming the bug.
   * Validates: Requirements 3.1
   */
  it(
    'P3-BUG-CONDITION: createPeriod for PRIMARY LESSON arm auto-populates teacherId with class teacher — EXPECTED TO FAIL ON UNFIXED CODE',
    async () => {
      setupPrimaryArmMocks();

      // timetablePeriod mock: no conflicts + create returns teacherId from data
      (prisma as any).timetablePeriod = {
        findMany: jest.fn().mockResolvedValue([]), // no conflicts
        create: makeCreateMock(null),
      };

      const dto = {
        classArmId: CLASS_ARM_ID,
        termId: TERM_ID,
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '08:00',
        endTime: '09:00',
        type: PeriodType.LESSON,
        // NOTE: no teacherId in dto — this is the bug condition
      };

      const period = await service.createPeriod(SCHOOL_ID, dto as any);

      // Expected (fixed): period.teacherId === CT_TEACHER_ID
      // On unfixed code: period.teacherId === null → this FAILS, confirming the bug.
      expect(period.teacherId).toBe(CT_TEACHER_ID);
      /* Counterexample on unfixed code:
       * createPeriod returns period.teacherId = null for a PRIMARY LESSON arm
       * even when a ClassTeacher record with isPrimary:true and teacherId='ct-teacher-id' exists.
       * This breaks per-period attendance and curriculum progress tracking.
       */
    },
  );

  /**
   * Property 3: Bug Condition — updatePeriod for PRIMARY LESSON arm (period currently has no teacher)
   * MUST auto-fill teacherId with class teacher when no teacherId in update body.
   *
   * On UNFIXED code: teacherId stays null → test FAILS, confirming the bug.
   * Validates: Requirements 3.2
   */
  it(
    'P3-BUG-CONDITION: updatePeriod for PRIMARY LESSON arm with no teacher auto-populates teacherId — EXPECTED TO FAIL ON UNFIXED CODE',
    async () => {
      setupPrimaryArmMocks();

      // Mock the existing period (teacherId is null — bug condition for updatePeriod)
      const existingPeriod = {
        id: 'period-existing-1',
        dayOfWeek: DayOfWeek.TUESDAY,
        startTime: '09:00',
        endTime: '10:00',
        type: PeriodType.LESSON,
        classArmId: CLASS_ARM_ID,
        termId: TERM_ID,
        subjectId: null,
        teacherId: null, // BUG CONDITION: period has no teacher
        classId: null,
        term: {
          id: TERM_ID,
          academicSession: { schoolId: SCHOOL_ID },
        },
      };

      const updatedPeriodPayload = {
        ...existingPeriod,
        // After update, we expect teacherId to be auto-filled with CT_TEACHER_ID
        teacherId: null, // on unfixed code the update does NOT auto-fill
        subject: null,
        course: null,
        class: null,
        teacher: null,
        room: null,
        classArm: {
          id: CLASS_ARM_ID,
          name: 'Arm A',
          classLevel: { id: 'level-1', type: 'PRIMARY', name: 'Primary 1' },
        },
      };

      (prisma as any).timetablePeriod = {
        findUnique: jest.fn().mockResolvedValue(existingPeriod as any),
        findMany: jest.fn().mockResolvedValue([]), // no conflicts
        update: jest.fn().mockImplementation((args: any) => {
          // Return the period with whatever teacherId ended up in updateData
          return Promise.resolve({
            ...updatedPeriodPayload,
            teacherId: args.data?.teacherId ?? null,
          });
        }),
      };

      // Update body has NO teacherId → should auto-fill from classTeacher
      const updateDto = {
        startTime: '09:00',
        endTime: '10:00',
        // No teacherId
      };

      const updated = await service.updatePeriod(
        SCHOOL_ID,
        'period-existing-1',
        updateDto as any,
      );

      // Expected (fixed): updated.teacherId === CT_TEACHER_ID
      // On unfixed code: updated.teacherId === null → this FAILS, confirming the bug.
      expect(updated.teacherId).toBe(CT_TEACHER_ID);
      /* Counterexample on unfixed code:
       * updatePeriod for a PRIMARY LESSON arm period that currently has teacherId=null
       * keeps teacherId=null even when classTeacher.findFirst returns { teacherId:'ct-teacher-id' }.
       * The updatePeriod method never calls classTeacher.findFirst for PRIMARY arms.
       */
    },
  );
});
