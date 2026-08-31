import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CsvSerializer } from './csv-serializer';
import { PdfBuilder } from './pdf-builder';
import { OpenObserveLogger } from '../common/logger/openobserve-logger.service';

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly csv: CsvSerializer,
    private readonly pdf: PdfBuilder,
    private readonly logger: OpenObserveLogger,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private formatDate(date: Date | null | undefined): string {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  }

  private writeAuditLog(
    requestingUserId: string,
    schoolId: string,
    exportType: 'ROSTER' | 'ATTENDANCE' | 'GRADES' | 'FEES',
  ): void {
    if (requestingUserId === 'BACKUP') return;
    this.logger.log(
      {
        event: 'EXPORT_GENERATED',
        userId: requestingUserId,
        schoolId,
        exportType,
        timestamp: new Date().toISOString(),
      },
      'ExportService',
    );
  }

  // ── Task 7.1: Roster CSV ───────────────────────────────────────────────────

  /**
   * Exports all active enrollments for a school and academic year as CSV.
   * Columns: first_name, last_name, public_id, class_level, class_arm,
   *          enrollment_date, enrollment_status, academic_year
   */
  async exportRoster(
    schoolId: string,
    academicYear: string,
    requestingUserId: string,
  ): Promise<Buffer> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { schoolId, academicYear, isActive: true },
      include: {
        student: true,
        class: true,
        classArm: true,
      },
    });

    const columns = [
      'first_name',
      'last_name',
      'public_id',
      'class_level',
      'class_arm',
      'enrollment_date',
      'enrollment_status',
      'academic_year',
    ];

    const rows = enrollments.map((e) => ({
      first_name: e.student.firstName,
      last_name: e.student.lastName,
      public_id: e.student.publicId ?? '',
      class_level: e.classLevel,
      class_arm: e.classArm?.name ?? '',
      enrollment_date: this.formatDate(e.enrollmentDate),
      enrollment_status: e.isActive ? 'ACTIVE' : 'INACTIVE',
      academic_year: e.academicYear,
    }));

    const buffer = await this.csv.serialize(columns, rows);

    this.writeAuditLog(requestingUserId, schoolId, 'ROSTER');

    return buffer;
  }

  // ── Task 7.2: Attendance CSV ───────────────────────────────────────────────

  /**
   * Exports attendance records for a class/classArm within a term date range.
   * Columns: first_name, last_name, public_id, date, status, remarks
   */
  async exportAttendance(
    schoolId: string,
    classId: string,
    classType: 'CLASS' | 'CLASS_ARM',
    termId: string,
    requestingUserId: string,
  ): Promise<Buffer> {
    // Validate termId belongs to this school via Term -> AcademicSession -> School
    const term = await this.prisma.term.findFirst({
      where: {
        id: termId,
        academicSession: { schoolId },
      },
    });
    if (!term) {
      throw new ForbiddenException('Term does not belong to this school');
    }

    // Validate classId belongs to this school
    if (classType === 'CLASS') {
      const cls = await this.prisma.class.findFirst({
        where: { id: classId, schoolId },
      });
      if (!cls) {
        throw new ForbiddenException('Class does not belong to this school');
      }
    } else {
      const arm = await this.prisma.classArm.findFirst({
        where: {
          id: classId,
          classLevel: { schoolId },
        },
      });
      if (!arm) {
        throw new ForbiddenException('Class arm does not belong to this school');
      }
    }

    // Build enrollment filter based on classType
    const enrollmentWhere =
      classType === 'CLASS_ARM'
        ? { classArmId: classId, schoolId }
        : { classId, schoolId };

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        enrollment: enrollmentWhere,
        date: {
          gte: term.startDate,
          lte: term.endDate,
        },
      },
      include: {
        enrollment: {
          include: { student: true },
        },
      },
      orderBy: [{ date: 'asc' }],
    });

    const columns = [
      'first_name',
      'last_name',
      'public_id',
      'date',
      'status',
      'remarks',
    ];

    const rows = attendanceRecords.map((a) => ({
      first_name: a.enrollment.student.firstName,
      last_name: a.enrollment.student.lastName,
      public_id: a.enrollment.student.publicId ?? '',
      date: this.formatDate(a.date),
      status: a.status,
      remarks: a.remarks ?? '',
    }));

    const buffer = await this.csv.serialize(columns, rows);

    this.writeAuditLog(requestingUserId, schoolId, 'ATTENDANCE');

    return buffer;
  }

  // ── Task 7.3: Grades CSV ───────────────────────────────────────────────────

  /**
   * Exports grade records for enrollments in a class for a term.
   * Columns: first_name, last_name, public_id, subject, assessment_name,
   *          grade_type, score, max_score, percentage, academic_year,
   *          term_name, is_published
   */
  async exportGrades(
    schoolId: string,
    classId: string,
    termId: string,
    requestingUserId: string,
  ): Promise<Buffer> {
    // Validate classId belongs to this school
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, schoolId },
    });
    if (!cls) {
      throw new ForbiddenException('Class does not belong to this school');
    }

    // Validate termId belongs to this school via Term -> AcademicSession -> School
    const term = await this.prisma.term.findFirst({
      where: {
        id: termId,
        academicSession: { schoolId },
      },
    });
    if (!term) {
      throw new ForbiddenException('Term does not belong to this school');
    }

    const grades = await this.prisma.grade.findMany({
      where: {
        termId,
        enrollment: { classId, schoolId },
      },
      include: {
        enrollment: {
          include: { student: true },
        },
      },
      orderBy: [{ enrollment: { student: { lastName: 'asc' } } }],
    });

    const columns = [
      'first_name',
      'last_name',
      'public_id',
      'subject',
      'assessment_name',
      'grade_type',
      'score',
      'max_score',
      'percentage',
      'academic_year',
      'term_name',
      'is_published',
    ];

    const rows = grades.map((g) => {
      const score = Number(g.score);
      const maxScore = Number(g.maxScore);
      const percentage =
        maxScore > 0 ? ((score / maxScore) * 100).toFixed(2) : '0.00';

      return {
        first_name: g.enrollment.student.firstName,
        last_name: g.enrollment.student.lastName,
        public_id: g.enrollment.student.publicId ?? '',
        subject: g.subject,
        assessment_name: g.assessmentName ?? '',
        grade_type: g.gradeType,
        score,
        max_score: maxScore,
        percentage,
        academic_year: g.academicYear,
        term_name: term.name,
        is_published: g.isPublished ? 'true' : 'false',
      };
    });

    const buffer = await this.csv.serialize(columns, rows);

    this.writeAuditLog(requestingUserId, schoolId, 'GRADES');

    return buffer;
  }

  // ── Task 7.4: Fees CSV ─────────────────────────────────────────────────────

  /**
   * Exports fee records for a school filtered to enrollments in a given term.
   * Columns: first_name, last_name, public_id, class_level, fee_description,
   *          amount, amount_paid, balance, due_date, paid_date, status
   */
  async exportFees(
    schoolId: string,
    termId: string,
    requestingUserId: string,
  ): Promise<Buffer> {
    // Validate termId belongs to this school via Term -> AcademicSession -> School
    const term = await this.prisma.term.findFirst({
      where: {
        id: termId,
        academicSession: { schoolId },
      },
    });
    if (!term) {
      throw new ForbiddenException('Term does not belong to this school');
    }

    const fees = await this.prisma.fee.findMany({
      where: {
        schoolId,
        enrollment: { termId },
      },
      include: {
        enrollment: {
          include: { student: true },
        },
      },
      orderBy: [{ enrollment: { student: { lastName: 'asc' } } }],
    });

    const columns = [
      'first_name',
      'last_name',
      'public_id',
      'class_level',
      'fee_description',
      'amount',
      'amount_paid',
      'balance',
      'due_date',
      'paid_date',
      'status',
    ];

    const rows = fees.map((f) => {
      const amount = Number(f.amount);
      // amount_paid defaults to 0 in v1 (payment integration pending)
      const amountPaid = 0;
      const balance = amount - amountPaid;

      return {
        first_name: f.enrollment.student.firstName,
        last_name: f.enrollment.student.lastName,
        public_id: f.enrollment.student.publicId ?? '',
        class_level: f.enrollment.classLevel,
        fee_description: f.description,
        amount,
        amount_paid: amountPaid,
        balance,
        due_date: this.formatDate(f.dueDate),
        paid_date: this.formatDate(f.paidDate) ?? '',
        status: f.status,
      };
    });

    const buffer = await this.csv.serialize(columns, rows);

    this.writeAuditLog(requestingUserId, schoolId, 'FEES');

    return buffer;
  }

  // ── Task 8.1: Report Card PDF ──────────────────────────────────────────────

  /**
   * Exports a student's term report card as a PDF.
   * Only includes published grades for the requested term.
   */
  async exportReportCard(studentUserId: string, termId: string): Promise<Buffer> {
    // Find student by userId
    const student = await this.prisma.student.findFirst({
      where: { userId: studentUserId },
    });
    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    // Verify enrollment for the term (403 if not found)
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId: student.id, termId },
    });
    if (!enrollment) {
      throw new ForbiddenException('Student is not enrolled in the requested term.');
    }

    // Query published grades
    const grades = await this.prisma.grade.findMany({
      where: { enrollmentId: enrollment.id, isPublished: true },
      include: {
        enrollment: { include: { student: true } },
      },
    });
    if (grades.length === 0) {
      throw new NotFoundException('No published grades found for the requested term.');
    }

    // Get term with academic session (for academic year name) and school name
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicSession: { include: { school: true } } },
    });

    const schoolName = term?.academicSession?.school?.name ?? '';
    const academicYear = term?.academicSession?.name ?? enrollment.academicYear;
    const termName = term?.name ?? '';

    // Compute per-grade percentages and overall average
    const gradeRows = grades.map((g) => {
      const score = Number(g.score);
      const maxScore = Number(g.maxScore);
      const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
      return { g, score, maxScore, pct };
    });

    const overallAvg =
      gradeRows.length > 0
        ? gradeRows.reduce((sum, r) => sum + r.pct, 0) / gradeRows.length
        : 0;

    const studentFullName = `${student.firstName} ${student.lastName}`;
    const exportTs = new Date();

    const buffer = await this.pdf.build(
      {
        title: 'Term Report Card',
        subtitle: `${academicYear} — ${termName}`,
        schoolName,
        exportTimestamp: exportTs,
      },
      (doc) => {
        // Student info block
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(`Student: ${studentFullName}`, { continued: true })
          .font('Helvetica')
          .text(`   ID: ${student.publicId ?? '—'}`);
        doc.moveDown(1);

        // Table header
        const colWidths = [120, 110, 70, 40, 50, 55];
        const headers = ['Subject', 'Assessment', 'Type', 'Score', 'Max', 'Percentage'];
        const leftMargin = doc.page.margins.left;
        let x = leftMargin;

        doc.font('Helvetica-Bold').fontSize(9);
        headers.forEach((h, i) => {
          doc.text(h, x, doc.y, { width: colWidths[i], lineBreak: false });
          x += colWidths[i];
        });
        doc.moveDown(0.4);

        // Divider line
        const pageWidth =
          doc.page.width - doc.page.margins.left - doc.page.margins.right;
        doc
          .moveTo(leftMargin, doc.y)
          .lineTo(leftMargin + pageWidth, doc.y)
          .stroke();
        doc.moveDown(0.3);

        // Data rows
        doc.font('Helvetica').fontSize(9);
        gradeRows.forEach(({ g, score, maxScore, pct }) => {
          x = leftMargin;
          const rowY = doc.y;
          const cells = [
            g.subject,
            g.assessmentName ?? '',
            g.gradeType,
            String(score),
            String(maxScore),
            `${pct.toFixed(1)}%`,
          ];
          cells.forEach((cell, i) => {
            doc.text(cell, x, rowY, { width: colWidths[i], lineBreak: false });
            x += colWidths[i];
          });
          doc.moveDown(0.5);
        });

        // Overall average
        doc.moveDown(0.5);
        doc
          .moveTo(leftMargin, doc.y)
          .lineTo(leftMargin + pageWidth, doc.y)
          .stroke();
        doc.moveDown(0.5);
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(`Overall Average: ${overallAvg.toFixed(1)}%`);
      },
    );

    return buffer;
  }

  // ── Task 8.2: Attendance Summary PDF ──────────────────────────────────────

  /**
   * Exports a student's attendance summary for a term as a PDF.
   */
  async exportAttendanceSummary(studentUserId: string, termId: string): Promise<Buffer> {
    // Find student by userId
    const student = await this.prisma.student.findFirst({
      where: { userId: studentUserId },
    });
    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    // Verify enrollment for the term (403 if not found)
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId: student.id, termId },
    });
    if (!enrollment) {
      throw new ForbiddenException('Student is not enrolled in the requested term.');
    }

    // Get term details
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicSession: { include: { school: true } } },
    });

    const schoolName = term?.academicSession?.school?.name ?? '';
    const academicYear = term?.academicSession?.name ?? enrollment.academicYear;
    const termName = term?.name ?? '';
    const startDate = term?.startDate ?? new Date(0);
    const endDate = term?.endDate ?? new Date();

    // Query attendance records
    const attendances = await this.prisma.attendance.findMany({
      where: {
        enrollmentId: enrollment.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    if (attendances.length === 0) {
      throw new NotFoundException('No attendance records found for the requested term.');
    }

    // Compute summary stats
    const totalDays = attendances.length;
    const presentCount = attendances.filter((a) => a.status === 'PRESENT').length;
    const absentCount = attendances.filter((a) => a.status === 'ABSENT').length;
    const lateCount = attendances.filter((a) => a.status === 'LATE').length;
    const excusedCount = attendances.filter((a) => a.status === 'EXCUSED').length;
    const sickCount = attendances.filter((a) => a.status === 'SICK').length;
    const attendancePct = totalDays > 0 ? ((presentCount / totalDays) * 100).toFixed(1) : '0.0';

    const studentFullName = `${student.firstName} ${student.lastName}`;

    const buffer = await this.pdf.build(
      {
        title: 'Attendance Summary',
        subtitle: `${academicYear} — ${termName}`,
        schoolName,
        exportTimestamp: new Date(),
      },
      (doc) => {
        const leftMargin = doc.page.margins.left;
        const pageWidth = doc.page.width - leftMargin - doc.page.margins.right;

        // Student info block
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(`Student: ${studentFullName}`, { continued: true })
          .font('Helvetica')
          .text(`   ID: ${student.publicId ?? '—'}`);
        doc.moveDown(1);

        // Summary table
        doc.font('Helvetica-Bold').fontSize(10).text('Attendance Summary');
        doc.moveDown(0.4);

        const summaryRows = [
          ['Total School Days', String(totalDays)],
          ['Days Present', String(presentCount)],
          ['Days Absent', String(absentCount)],
          ['Days Late', String(lateCount)],
          ['Days Excused', String(excusedCount)],
          ['Days Sick', String(sickCount)],
          ['Attendance Percentage', `${attendancePct}%`],
        ];

        doc.font('Helvetica').fontSize(9);
        summaryRows.forEach(([label, value]) => {
          const rowY = doc.y;
          doc.text(label, leftMargin, rowY, { width: 180, lineBreak: false });
          doc.text(value, leftMargin + 180, rowY, { width: 100, lineBreak: false });
          doc.moveDown(0.5);
        });

        doc.moveDown(1);

        // Chronological log table header
        doc.font('Helvetica-Bold').fontSize(10).text('Attendance Log');
        doc.moveDown(0.4);

        const logColWidths = [100, 80, 260];
        const logHeaders = ['Date', 'Status', 'Remarks'];
        let x = leftMargin;

        doc.font('Helvetica-Bold').fontSize(9);
        logHeaders.forEach((h, i) => {
          doc.text(h, x, doc.y, { width: logColWidths[i], lineBreak: false });
          x += logColWidths[i];
        });
        doc.moveDown(0.4);

        doc
          .moveTo(leftMargin, doc.y)
          .lineTo(leftMargin + pageWidth, doc.y)
          .stroke();
        doc.moveDown(0.3);

        // Log rows
        doc.font('Helvetica').fontSize(9);
        attendances.forEach((a) => {
          x = leftMargin;
          const rowY = doc.y;
          const cells = [
            this.formatDate(a.date),
            a.status,
            a.remarks ?? '',
          ];
          cells.forEach((cell, i) => {
            doc.text(cell, x, rowY, { width: logColWidths[i], lineBreak: false });
            x += logColWidths[i];
          });
          doc.moveDown(0.5);
        });
      },
    );

    return buffer;
  }

  // ── Task 8.3: Transcript PDF ───────────────────────────────────────────────

  /**
   * Exports a student's full academic transcript across all schools as a PDF.
   */
  async exportTranscript(studentUserId: string): Promise<Buffer> {
    // Find student by userId
    const student = await this.prisma.student.findFirst({
      where: { userId: studentUserId },
    });
    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    // Query all enrollments across all schools with published grades
    const enrollments = await this.prisma.enrollment.findMany({
      where: { student: { userId: studentUserId } },
      include: {
        school: true,
        student: true,
        class: true,
        grades: { where: { isPublished: true } },
        term: true,
      },
      orderBy: [{ academicYear: 'asc' }],
    });

    // Filter out enrollments with no published grades
    const enrollmentsWithGrades = enrollments.filter((e) => e.grades.length > 0);

    if (enrollmentsWithGrades.length === 0) {
      throw new NotFoundException('No published academic records found for this student.');
    }

    // Grade letter computation: ≥70=A, ≥60=B, ≥50=C, ≥40=D, <40=F
    const toLetterGrade = (pct: number): string => {
      if (pct >= 70) return 'A';
      if (pct >= 60) return 'B';
      if (pct >= 50) return 'C';
      if (pct >= 40) return 'D';
      return 'F';
    };

    // Group enrollments: school → academicYear → term
    const schoolMap = new Map<
      string,
      {
        schoolName: string;
        years: Map<
          string,
          {
            termName: string;
            enrollmentId: string;
            grades: typeof enrollmentsWithGrades[0]['grades'];
          }[]
        >;
      }
    >();

    for (const e of enrollmentsWithGrades) {
      const schoolId = e.schoolId;
      if (!schoolMap.has(schoolId)) {
        schoolMap.set(schoolId, { schoolName: e.school.name, years: new Map() });
      }
      const schoolEntry = schoolMap.get(schoolId)!;
      const year = e.academicYear;
      if (!schoolEntry.years.has(year)) {
        schoolEntry.years.set(year, []);
      }
      schoolEntry.years.get(year)!.push({
        termName: e.term?.name ?? e.academicYear,
        enrollmentId: e.id,
        grades: e.grades,
      });
    }

    // Compute per-term averages for GPA summary
    const termAverages: { schoolName: string; year: string; termName: string; avg: number }[] = [];
    for (const [, schoolEntry] of schoolMap) {
      for (const [year, terms] of schoolEntry.years) {
        for (const termEntry of terms) {
          if (termEntry.grades.length > 0) {
            const pcts = termEntry.grades.map((g) => {
              const score = Number(g.score);
              const max = Number(g.maxScore);
              return max > 0 ? (score / max) * 100 : 0;
            });
            const avg = pcts.reduce((s, p) => s + p, 0) / pcts.length;
            termAverages.push({ schoolName: schoolEntry.schoolName, year, termName: termEntry.termName, avg });
          }
        }
      }
    }

    const cumulativeGpa =
      termAverages.length > 0
        ? termAverages.reduce((s, t) => s + t.avg, 0) / termAverages.length
        : 0;

    const studentFullName = `${student.firstName} ${student.lastName}`;
    const dob = student.dateOfBirth ? this.formatDate(student.dateOfBirth) : '—';

    const buffer = await this.pdf.build(
      {
        title: 'Academic Transcript',
        subtitle: studentFullName,
        exportTimestamp: new Date(),
      },
      (doc) => {
        const leftMargin = doc.page.margins.left;
        const pageWidth = doc.page.width - leftMargin - doc.page.margins.right;

        // Student header
        doc.font('Helvetica-Bold').fontSize(12).text('Student Information');
        doc.moveDown(0.4);
        doc.font('Helvetica').fontSize(10);
        doc.text(`Full Name:    ${studentFullName}`);
        doc.text(`Student ID:   ${student.publicId ?? '—'}`);
        doc.text(`Date of Birth: ${dob}`);
        doc.moveDown(1);

        // Per-school sections
        for (const [, schoolEntry] of schoolMap) {
          doc
            .font('Helvetica-Bold')
            .fontSize(12)
            .text(schoolEntry.schoolName, { underline: true });
          doc.moveDown(0.5);

          for (const [year, terms] of schoolEntry.years) {
            doc.font('Helvetica-Bold').fontSize(10).text(`Academic Year: ${year}`);
            doc.moveDown(0.4);

            for (const termEntry of terms) {
              doc.font('Helvetica-Bold').fontSize(9).text(`Term: ${termEntry.termName}`);
              doc.moveDown(0.3);

              // Grade table header
              const colWidths = [120, 110, 45, 45, 60, 40];
              const headers = ['Subject', 'Assessment', 'Score', 'Max', 'Percentage', 'Grade'];
              let x = leftMargin;

              doc.font('Helvetica-Bold').fontSize(8);
              headers.forEach((h, i) => {
                doc.text(h, x, doc.y, { width: colWidths[i], lineBreak: false });
                x += colWidths[i];
              });
              doc.moveDown(0.35);

              doc
                .moveTo(leftMargin, doc.y)
                .lineTo(leftMargin + pageWidth, doc.y)
                .stroke();
              doc.moveDown(0.25);

              // Grade rows
              doc.font('Helvetica').fontSize(8);
              termEntry.grades.forEach((g) => {
                const score = Number(g.score);
                const max = Number(g.maxScore);
                const pct = max > 0 ? (score / max) * 100 : 0;
                const letter = toLetterGrade(pct);
                x = leftMargin;
                const rowY = doc.y;
                [
                  g.subject,
                  g.assessmentName ?? '',
                  String(score),
                  String(max),
                  `${pct.toFixed(1)}%`,
                  letter,
                ].forEach((cell, i) => {
                  doc.text(cell, x, rowY, { width: colWidths[i], lineBreak: false });
                  x += colWidths[i];
                });
                doc.moveDown(0.45);
              });

              doc.moveDown(0.5);
            }

            doc.moveDown(0.5);
          }

          doc.moveDown(0.5);
        }

        // GPA Summary section
        doc
          .moveTo(leftMargin, doc.y)
          .lineTo(leftMargin + pageWidth, doc.y)
          .stroke();
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(12).text('Academic Summary');
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold').fontSize(9);
        const gpaColWidths = [140, 120, 100, 80];
        const gpaHeaders = ['School', 'Academic Year', 'Term', 'Average'];
        let gx = leftMargin;
        gpaHeaders.forEach((h, i) => {
          doc.text(h, gx, doc.y, { width: gpaColWidths[i], lineBreak: false });
          gx += gpaColWidths[i];
        });
        doc.moveDown(0.4);

        doc
          .moveTo(leftMargin, doc.y)
          .lineTo(leftMargin + pageWidth, doc.y)
          .stroke();
        doc.moveDown(0.3);

        doc.font('Helvetica').fontSize(9);
        termAverages.forEach((t) => {
          gx = leftMargin;
          const rowY = doc.y;
          [t.schoolName, t.year, t.termName, `${t.avg.toFixed(1)}%`].forEach((cell, i) => {
            doc.text(cell, gx, rowY, { width: gpaColWidths[i], lineBreak: false });
            gx += gpaColWidths[i];
          });
          doc.moveDown(0.5);
        });

        doc.moveDown(0.8);
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(`Cumulative GPA: ${cumulativeGpa.toFixed(1)}%`);
      },
    );

    return buffer;
  }
}
