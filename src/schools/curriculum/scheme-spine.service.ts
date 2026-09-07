import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AgoraCurriculumPublishStatus,
  SchemeGenerationMode,
  SchemeOfWorkStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  buildHalfTermRange,
  DEFAULT_WORKING_DAYS,
  holidayRangesFromEvents,
  WorkingDay,
} from '../../common/utils/instructional-day.util';
import { schemeActiveKey } from '../../common/utils/topic-stable-key.util';
import { SchoolSettingsService } from '../../school-settings/school-settings.service';
import {
  flattenPackedWeekTopic,
  packTopicsOntoCalendar,
  PackableTopic,
  buildInstructionalWeekRanges,
} from './scheme-calendar-packer.util';

@Injectable()
export class SchemeSpineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolSettings: SchoolSettingsService,
  ) {}

  async archiveLiveScheme(existingId: string, userId: string) {
    await this.prisma.schemeOfWork.update({
      where: { id: existingId },
      data: {
        status: SchemeOfWorkStatus.ARCHIVED,
        archivedAt: new Date(),
        archivedBy: userId,
        activeKey: null,
      },
    });
  }

  async findLiveScheme(schoolId: string, subjectId: string, termId: string, classLevelId?: string | null) {
    return this.prisma.schemeOfWork.findFirst({
      where: {
        schoolId,
        subjectId,
        termId,
        classLevelId: classLevelId || undefined,
        status: { not: SchemeOfWorkStatus.ARCHIVED },
      },
    });
  }

  async resolveInitialStatus(schoolId: string, mode: SchemeGenerationMode): Promise<SchemeOfWorkStatus> {
    if (mode !== SchemeGenerationMode.AGORA_ONLY) return SchemeOfWorkStatus.DRAFT;
    const policy = await this.schoolSettings.getCurriculumPolicy(schoolId);
    return policy.schemeApprovalRequired ? SchemeOfWorkStatus.DRAFT : SchemeOfWorkStatus.PUBLISHED;
  }

  async buildWeekRanges(schoolId: string, termId: string) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicSession: { select: { name: true } } },
    });
    if (!term) throw new BadRequestException('Invalid term');
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { workingDays: true },
    });
    const events = await this.prisma.event.findMany({
      where: {
        schoolId,
        type: 'HOLIDAY',
        startDate: { lte: term.endDate },
        endDate: { gte: term.startDate },
      },
      select: { type: true, startDate: true, endDate: true },
    });
    const workingDays = (school?.workingDays?.length
      ? school.workingDays
      : DEFAULT_WORKING_DAYS) as WorkingDay[];
    const ranges = buildInstructionalWeekRanges(term.startDate, term.endDate, {
      workingDays,
      nonInstructionalRanges: [
        buildHalfTermRange(term.halfTermStart, term.halfTermEnd),
        ...holidayRangesFromEvents(events),
      ],
    });
    if (!ranges.length) {
      throw new BadRequestException('This term has no instructional weeks to pack a scheme onto.');
    }
    return { term, ranges };
  }

  async persistPackedWeeks(schemeId: string, topics: PackableTopic[], schoolId: string, termId: string) {
    const { ranges } = await this.buildWeekRanges(schoolId, termId);
    const packed = packTopicsOntoCalendar(topics, ranges);

    await this.prisma.schemeOfWorkWeek.deleteMany({ where: { schemeOfWorkId: schemeId } });

    for (const week of packed) {
      const flat = flattenPackedWeekTopic(week);
      const created = await this.prisma.schemeOfWorkWeek.create({
        data: {
          schemeOfWorkId: schemeId,
          weekNumber: week.weekNumber,
          calendarStartDate: week.calendarStartDate,
          calendarEndDate: week.calendarEndDate,
          topic: flat.topic,
          subTopics: flat.subTopics,
          learningOutcomes: flat.learningOutcomes,
          studentFriendlyOutcomes: flat.studentFriendlyOutcomes,
          suggestedActivities: flat.suggestedActivities,
          resources: flat.resources,
          assessmentType: flat.assessmentType,
          order: week.weekNumber,
        },
      });
      if (week.topics.length) {
        await this.prisma.schemeOfWorkWeekTopic.createMany({
          data: week.topics.map((t, i) => ({
            schemeOfWorkWeekId: created.id,
            agoraTopicId: t.agoraTopicId || null,
            schoolTopicId: t.schoolTopicId || null,
            stableKey: t.stableKey,
            order: i,
          })),
        });
      }
    }
    return packed.length;
  }

  async snapshotAgoraOnly(params: {
    schoolId: string;
    subjectId: string;
    termId: string;
    classLevelId?: string | null;
    classId?: string | null;
    agoraCurriculumId: string;
    userId: string;
    forceOverwrite?: boolean;
  }) {
    const agora = await this.prisma.agoraCurriculum.findUnique({
      where: { id: params.agoraCurriculumId },
      include: {
        topics: { where: { deprecatedAt: null }, orderBy: { weekNumber: 'asc' } },
        subject: true,
      },
    });
    if (!agora) throw new NotFoundException('Bud library Curriculum not found.');
    if (agora.status !== AgoraCurriculumPublishStatus.PUBLISHED) {
      throw new BadRequestException('Only published Bud library curricula can be imported.');
    }

    const term = await this.prisma.term.findUnique({
      where: { id: params.termId },
      select: { number: true },
    });
    if (!term) throw new BadRequestException('Invalid term sequence.');

    const termTopics = agora.topics.filter((t) => t.term === term.number);
    if (!termTopics.length) {
      throw new BadRequestException(
        `No published topics for term ${term.number} in this library curriculum.`,
      );
    }

    const existing = await this.findLiveScheme(
      params.schoolId,
      params.subjectId,
      params.termId,
      params.classLevelId,
    );
    if (existing) {
      if (!params.forceOverwrite) {
        throw new ConflictException(
          'A Scheme of Work already exists for this subject and term. Pass forceOverwrite to replace it.',
        );
      }
      await this.archiveLiveScheme(existing.id, params.userId);
    }

    const status = await this.resolveInitialStatus(params.schoolId, SchemeGenerationMode.AGORA_ONLY);
    const activeKey = schemeActiveKey(
      params.schoolId,
      params.subjectId,
      params.termId,
      params.classLevelId,
    );

    const scheme = await this.prisma.schemeOfWork.create({
      data: {
        schoolId: params.schoolId,
        classLevelId: params.classLevelId || null,
        classId: params.classId || null,
        subjectId: params.subjectId,
        termId: params.termId,
        generationMode: SchemeGenerationMode.AGORA_ONLY,
        agoraCurriculumId: agora.id,
        agoraCurriculumVersion: agora.version,
        status,
        activeKey,
        publishedAt: status === SchemeOfWorkStatus.PUBLISHED ? new Date() : null,
        publishedBy: status === SchemeOfWorkStatus.PUBLISHED ? params.userId : null,
      },
    });

    const packable: PackableTopic[] = termTopics.map((t) => ({
      stableKey: t.stableKey,
      agoraTopicId: t.id,
      title: t.title,
      topic: t.topic,
      description: t.description,
      subTopics: t.subTopics,
      learningOutcomes: t.learningOutcomes,
      studentFriendlyOutcomes: t.studentFriendlyOutcomes,
      suggestedActivities: t.suggestedActivities,
      resources: t.resources,
      assessmentType: t.assessmentType,
      weekNumber: t.weekNumber,
      order: t.order,
    }));

    await this.persistPackedWeeks(scheme.id, packable, params.schoolId, params.termId);
    return scheme;
  }

  async libraryDiff(schoolId: string, schemeId: string) {
    const scheme = await this.prisma.schemeOfWork.findFirst({
      where: { id: schemeId, schoolId },
      include: {
        weeks: { include: { topics: true }, orderBy: { weekNumber: 'asc' } },
        agoraCurriculum: { include: { topics: { where: { deprecatedAt: null } } } },
      },
    });
    if (!scheme) throw new NotFoundException('Scheme not found');
    if (!scheme.agoraCurriculum) return { schemeId, changed: [], added: [], removed: [] };

    const liveKeys = new Set(scheme.weeks.flatMap((w) => w.topics.map((t) => t.stableKey)));
    const libKeys = new Map(scheme.agoraCurriculum.topics.map((t) => [t.stableKey, t]));
    const changed: string[] = [];
    const removed: string[] = [];
    const added: string[] = [];

    for (const week of scheme.weeks) {
      for (const link of week.topics) {
        const lib = libKeys.get(link.stableKey);
        if (!lib) removed.push(link.stableKey);
        else if (lib.title !== week.topic) changed.push(link.stableKey);
      }
    }
    for (const [key] of libKeys) {
      if (!liveKeys.has(key) && scheme.agoraCurriculum.topics.find((t) => t.stableKey === key && t.term)) {
        added.push(key);
      }
    }
    return {
      schemeId,
      pinnedVersion: scheme.agoraCurriculumVersion,
      libraryVersion: scheme.agoraCurriculum.version,
      changed,
      added,
      removed,
    };
  }
}
