import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateExamTimetableSlotDto,
  ExamTimetableSlotDto,
  UpdateExamTimetableSlotDto,
} from './dto/exam-timetable.dto';
import { SchemeOfWorkStatus } from '@prisma/client';
import {
  isExamScheduleActive,
  isTermInExamPeriod,
  startOfLocalDay,
} from '../common/utils/term-phase.util';

@Injectable()
export class ExamTimetableService {
  constructor(private readonly prisma: PrismaService) {}

  async listSlots(
    schoolId: string,
    termId: string,
    options: { publishedOnly?: boolean } = {},
  ): Promise<ExamTimetableSlotDto[]> {
    await this.assertTermBelongsToSchool(schoolId, termId);
    if (options.publishedOnly) {
      const term = await this.prisma.term.findUnique({ where: { id: termId } });
      if (!term?.examTimetablePublishedAt) return [];
    }
    const slots = await this.prisma.examTimetableSlot.findMany({
      where: { termId },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true } },
        classArm: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
        room: { select: { name: true } },
      },
      orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
    });
    return slots.map((s) => this.mapSlot(s));
  }

  async listSlotsForStudent(
    schoolId: string,
    studentId: string,
    termId?: string,
  ): Promise<ExamTimetableSlotDto[]> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, isActive: true, schoolId },
      select: { classArmId: true, classId: true },
    });
    if (!enrollment) return [];

    const resolvedTermId = termId || (await this.resolveActiveTermId(schoolId));
    if (!resolvedTermId) return [];

    const term = await this.prisma.term.findUnique({ where: { id: resolvedTermId } });
    if (!term?.examTimetablePublishedAt) return [];

    const where: any = { termId: resolvedTermId };
    if (enrollment.classArmId) {
      where.OR = [{ classArmId: enrollment.classArmId }, { classArmId: null }];
    } else if (enrollment.classId) {
      where.OR = [{ classId: enrollment.classId }, { classId: null }];
    }

    const slots = await this.prisma.examTimetableSlot.findMany({
      where,
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true } },
        classArm: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
        room: { select: { name: true } },
      },
      orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
    });
    return slots.map((s) => this.mapSlot(s));
  }

  async listSlotsForTeacher(
    schoolId: string,
    teacherId: string,
    termId: string,
  ): Promise<ExamTimetableSlotDto[]> {
    await this.assertTermBelongsToSchool(schoolId, termId);
    const term = await this.prisma.term.findUnique({ where: { id: termId } });
    if (!term?.examTimetablePublishedAt) return [];

    const slots = await this.prisma.examTimetableSlot.findMany({
      where: { termId, teacherId },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true } },
        classArm: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
        room: { select: { name: true } },
      },
      orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
    });
    return slots.map((s) => this.mapSlot(s));
  }

  async createSlot(schoolId: string, dto: CreateExamTimetableSlotDto): Promise<ExamTimetableSlotDto> {
    const term = await this.assertTermBelongsToSchool(schoolId, dto.termId);
    this.assertExamWindowSet(term);
    this.assertDateInExamWindow(new Date(dto.examDate), term);
    if (term.examTimetablePublishedAt) {
      throw new BadRequestException(
        'Unpublish the exam timetable before adding or editing slots.',
      );
    }

    const slot = await this.prisma.examTimetableSlot.create({
      data: {
        termId: dto.termId,
        examDate: startOfLocalDay(new Date(dto.examDate)),
        startTime: dto.startTime,
        endTime: dto.endTime,
        subjectId: dto.subjectId,
        classId: dto.classId,
        classArmId: dto.classArmId,
        teacherId: dto.teacherId,
        roomId: dto.roomId,
        notes: dto.notes,
      },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true } },
        classArm: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
        room: { select: { name: true } },
      },
    });
    return this.mapSlot(slot);
  }

  async updateSlot(
    schoolId: string,
    slotId: string,
    dto: UpdateExamTimetableSlotDto,
  ): Promise<ExamTimetableSlotDto> {
    const existing = await this.prisma.examTimetableSlot.findUnique({
      where: { id: slotId },
      include: { term: { include: { academicSession: true } } },
    });
    if (!existing || existing.term.academicSession.schoolId !== schoolId) {
      throw new NotFoundException('Exam slot not found');
    }
    if (existing.term.examTimetablePublishedAt) {
      throw new BadRequestException('Unpublish the exam timetable before editing slots.');
    }
    if (dto.examDate) {
      this.assertDateInExamWindow(new Date(dto.examDate), existing.term);
    }

    const slot = await this.prisma.examTimetableSlot.update({
      where: { id: slotId },
      data: {
        ...(dto.examDate && { examDate: startOfLocalDay(new Date(dto.examDate)) }),
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.endTime && { endTime: dto.endTime }),
        ...(dto.subjectId && { subjectId: dto.subjectId }),
        ...(dto.classId !== undefined && { classId: dto.classId || null }),
        ...(dto.classArmId !== undefined && { classArmId: dto.classArmId || null }),
        ...(dto.teacherId !== undefined && { teacherId: dto.teacherId || null }),
        ...(dto.roomId !== undefined && { roomId: dto.roomId || null }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true } },
        classArm: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
        room: { select: { name: true } },
      },
    });
    return this.mapSlot(slot);
  }

  async deleteSlot(schoolId: string, slotId: string): Promise<void> {
    const existing = await this.prisma.examTimetableSlot.findUnique({
      where: { id: slotId },
      include: { term: { include: { academicSession: true } } },
    });
    if (!existing || existing.term.academicSession.schoolId !== schoolId) {
      throw new NotFoundException('Exam slot not found');
    }
    if (existing.term.examTimetablePublishedAt) {
      throw new BadRequestException('Unpublish the exam timetable before deleting slots.');
    }
    await this.prisma.examTimetableSlot.delete({ where: { id: slotId } });
  }

  async publishExamTimetable(schoolId: string, termId: string, userId: string) {
    const term = await this.assertTermBelongsToSchool(schoolId, termId);
    this.assertExamWindowSet(term);

    const slotCount = await this.prisma.examTimetableSlot.count({ where: { termId } });
    if (slotCount === 0) {
      throw new BadRequestException(
        'Add at least one exam slot before publishing the exam timetable.',
      );
    }

    const updated = await this.prisma.term.update({
      where: { id: termId },
      data: {
        examTimetablePublishedAt: new Date(),
        examTimetablePublishedBy: userId,
      },
    });
    return {
      termId,
      examTimetablePublishedAt: updated.examTimetablePublishedAt,
      slotCount,
    };
  }

  async unpublishExamTimetable(schoolId: string, termId: string) {
    await this.assertTermBelongsToSchool(schoolId, termId);
    const updated = await this.prisma.term.update({
      where: { id: termId },
      data: {
        examTimetablePublishedAt: null,
        examTimetablePublishedBy: null,
      },
    });
    return { termId, examTimetablePublishedAt: updated.examTimetablePublishedAt };
  }

  /** Whether a teacher may publish an EXAM assessment for subject/class in this term. */
  async assertCanPublishExamAssessment(input: {
    schoolId: string;
    termId: string;
    subjectId: string;
    classId?: string;
    classArmId?: string;
  }): Promise<{ ok: true } | { ok: false; blockers: string[] }> {
    const blockers: string[] = [];
    const term = await this.prisma.term.findUnique({
      where: { id: input.termId },
      include: { academicSession: { select: { schoolId: true } } },
    });
    if (!term || term.academicSession.schoolId !== input.schoolId) {
      blockers.push('Term not found.');
      return { ok: false, blockers };
    }
    if (!term.examStart || !term.examEnd) {
      blockers.push('School admin has not set exam dates for this term.');
    }
    if (!term.examTimetablePublishedAt) {
      blockers.push('Exam timetable has not been published by the school admin.');
    }
    const today = new Date();
    if (term.examStart && startOfLocalDay(today).getTime() < startOfLocalDay(term.examStart).getTime()) {
      blockers.push('Exam period has not started yet.');
    }
    if (term.examEnd && startOfLocalDay(today).getTime() > startOfLocalDay(term.examEnd).getTime()) {
      blockers.push('Exam period has ended.');
    }
    if (!isTermInExamPeriod(term, today)) {
      blockers.push('Today is outside the exam period.');
    }

    const coverage = await this.getSchemeCoverageForSubject({
      schoolId: input.schoolId,
      termId: input.termId,
      subjectId: input.subjectId,
      classId: input.classId,
      classArmId: input.classArmId,
    });
    if (!coverage.found) {
      blockers.push('No scheme of work found for this subject.');
    } else if (!coverage.fullyDelivered) {
      blockers.push(
        `Scheme of work not fully covered (${coverage.deliveredWeeks}/${coverage.totalWeeks} weeks delivered).`,
      );
    }

    if (blockers.length > 0) return { ok: false, blockers };
    return { ok: true };
  }

  async getSchemeCoverageForSubject(input: {
    schoolId: string;
    termId: string;
    subjectId: string;
    classId?: string;
    classArmId?: string;
  }): Promise<{
    found: boolean;
    fullyDelivered: boolean;
    deliveredWeeks: number;
    totalWeeks: number;
  }> {
    const or: any[] = [];
    if (input.classArmId) or.push({ classArmId: input.classArmId });
    if (input.classId) or.push({ classId: input.classId });

    const scheme = await this.prisma.schemeOfWork.findFirst({
      where: {
        schoolId: input.schoolId,
        termId: input.termId,
        subjectId: input.subjectId,
        status: { in: [SchemeOfWorkStatus.PUBLISHED, SchemeOfWorkStatus.APPROVED] },
        ...(or.length ? { OR: or } : {}),
      },
      include: { weeks: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!scheme || scheme.weeks.length === 0) {
      return { found: false, fullyDelivered: false, deliveredWeeks: 0, totalWeeks: 0 };
    }

    const deliveredWeeks = scheme.weeks.filter((w) => w.isDelivered).length;
    const totalWeeks = scheme.weeks.length;
    return {
      found: true,
      fullyDelivered: deliveredWeeks >= totalWeeks,
      deliveredWeeks,
      totalWeeks,
    };
  }

  private async assertTermBelongsToSchool(schoolId: string, termId: string) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicSession: true },
    });
    if (!term || term.academicSession.schoolId !== schoolId) {
      throw new NotFoundException('Term not found');
    }
    return term;
  }

  private assertExamWindowSet(term: { examStart: Date | null; examEnd: Date | null }) {
    if (!term.examStart || !term.examEnd) {
      throw new BadRequestException('Set exam start and end dates on the term before managing exam slots.');
    }
  }

  private assertDateInExamWindow(
    date: Date,
    term: { examStart: Date | null; examEnd: Date | null },
  ) {
    if (!term.examStart || !term.examEnd) return;
    const t = startOfLocalDay(date).getTime();
    if (
      t < startOfLocalDay(term.examStart).getTime() ||
      t > startOfLocalDay(term.examEnd).getTime()
    ) {
      throw new BadRequestException('Exam slot date must fall within the term exam window.');
    }
  }

  private async resolveActiveTermId(schoolId: string): Promise<string | null> {
    const session = await this.prisma.academicSession.findFirst({
      where: { schoolId, status: 'ACTIVE' },
      include: { terms: { where: { status: 'ACTIVE' }, take: 1 } },
    });
    return session?.terms[0]?.id ?? null;
  }

  private mapSlot(slot: any): ExamTimetableSlotDto {
    return {
      id: slot.id,
      termId: slot.termId,
      examDate: slot.examDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subjectId: slot.subjectId,
      subjectName: slot.subject?.name,
      classId: slot.classId ?? undefined,
      classArmId: slot.classArmId ?? undefined,
      className: slot.class?.name,
      classArmName: slot.classArm?.name,
      teacherId: slot.teacherId ?? undefined,
      teacherName: slot.teacher
        ? `${slot.teacher.firstName} ${slot.teacher.lastName}`.trim()
        : undefined,
      roomId: slot.roomId ?? undefined,
      roomName: slot.room?.name,
      notes: slot.notes ?? undefined,
    };
  }
}

export { isExamScheduleActive, isTermInExamPeriod };
