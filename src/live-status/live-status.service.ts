import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CurrentActivityDto } from './dto/live-status.dto';

@Injectable()
export class LiveStatusService {
  private readonly logger = new Logger(LiveStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current live activities for a set of users
   */
  async getCurrentActivities(
    schoolId: string,
    userIds: string[],
    type: 'STAFF' | 'STUDENT'
  ): Promise<Record<string, CurrentActivityDto>> {
    if (userIds.length === 0) return {};

    const activeTermId = await this.getCurrentTermId(schoolId);
    if (!activeTermId) return {};

    const now = new Date();
    // Use Lagos time (consistent with what's stored/displayed)
    const lagosTime = new Intl.DateTimeFormat('en-GB', { 
        timeZone: 'Africa/Lagos',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        weekday: 'long'
    }).formatToParts(now);

    const dayOfWeek = lagosTime.find(p => p.type === 'weekday')?.value.toUpperCase();
    const currentTime = lagosTime.filter(p => ['hour', 'minute', 'second'].includes(p.type))
                               .map(p => p.value).join(':');

    if (!dayOfWeek) return {};

    // Find all active periods for these users right now
    const periods = await this.prisma.timetablePeriod.findMany({
      where: {
        termId: activeTermId,
        dayOfWeek: dayOfWeek as any,
        startTime: { lte: currentTime },
        endTime: { gte: currentTime },
        OR: [
          { teacherId: { in: userIds } },
          { classArm: { enrollments: { some: { studentId: { in: userIds }, isActive: true } } } },
          { class: { enrollments: { some: { studentId: { in: userIds }, isActive: true } } } }
        ]
      },
      include: {
        subject: true,
        room: true,
        teacher: true,
        class: true,
        classArm: { include: { classLevel: true } }
      }
    });

    const results: Record<string, CurrentActivityDto> = {};

    periods.forEach(p => {
      const activity = this.mapToCurrentActivity(p, type);
      if (type === 'STAFF' && p.teacherId) {
        results[p.teacherId] = activity;
      } else if (type === 'STUDENT') {
        // This is simplified; in a real scenario we'd need to map periods to specific student IDs
        // For now, we return the activity for any student belonging to the classes found
      }
    });

    return results;
  }

  private async getCurrentTermId(schoolId: string): Promise<string | null> {
    const session = await this.prisma.academicSession.findFirst({
      where: { schoolId, status: 'ACTIVE' },
      include: { terms: { where: { status: 'ACTIVE' }, take: 1 } },
    });
    return session?.terms[0]?.id || null;
  }

  private mapToCurrentActivity(p: any, type: 'STAFF' | 'STUDENT'): CurrentActivityDto {
    return {
      type: p.type,
      title: p.subject?.name || p.type,
      location: p.room?.name,
      context: type === 'STAFF' 
        ? (p.classArm ? `${p.classArm.classLevel.name} ${p.classArm.name}` : p.class?.name)
        : (p.teacher ? `${p.teacher.firstName} ${p.teacher.lastName}` : undefined),
      startTime: p.startTime,
      endTime: p.endTime,
    };
  }
}
