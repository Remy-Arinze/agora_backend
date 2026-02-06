import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

/**
 * Generate a unique school ID
 */
function generateSchoolId(): string {
  const uuid = uuidv4().replace(/-/g, '').toUpperCase();
  return `AG-SCH-${uuid}`;
}

/**
 * Generate a unique principal ID
 */
function generatePrincipalId(): string {
  const uuid = uuidv4().replace(/-/g, '').toUpperCase();
  return `AG-PR-${uuid}`;
}

/**
 * Generate a unique admin ID
 */
function generateAdminId(): string {
  const uuid = uuidv4().replace(/-/g, '').toUpperCase();
  return `AG-AD-${uuid}`;
}

/**
 * Generate a unique teacher ID
 */
function generateTeacherId(): string {
  const uuid = uuidv4().replace(/-/g, '').toUpperCase();
  return `AG-TE-${uuid}`;
}

/**
 * Generate a short alphanumeric string (6 characters)
 */
function generateShortId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0, O, I, 1)
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Shorten school name for public ID
 */
function shortenSchoolName(schoolName: string): string {
  const cleaned = schoolName
    .toUpperCase()
    .replace(/\b(SCHOOL|ACADEMY|COLLEGE|UNIVERSITY|INSTITUTE|SECONDARY|PRIMARY|HIGH)\b/gi, '')
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 4);
  
  if (cleaned.length < 3) {
    return schoolName
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .substring(0, 3)
      .padEnd(3, 'X');
  }
  
  return cleaned;
}

/**
 * Generate a unique public ID for admin/teacher
 * Format: AG-{schoolname shortened}-{short alphanumeric}
 */
function generatePublicId(schoolName: string): string {
  const schoolShort = shortenSchoolName(schoolName);
  const shortId = generateShortId();
  return `AG-${schoolShort}-${shortId}`;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Hash password for all test users
  const hashedPassword = await bcrypt.hash('Test1234!', 10);

  // ============================================
  // STEP 1: Create Super Admin
  // ============================================
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@agora.com' },
    update: {},
    create: {
      email: 'superadmin@agora.com',
      phone: '+2348000000001',
      passwordHash: hashedPassword,
      accountStatus: 'ACTIVE',
      role: 'SUPER_ADMIN',
    },
  });
  console.log('✅ Created Super Admin:', superAdmin.email);

  // ============================================
  // STEP 2: Super Admin creates school WITH principal
  // This simulates the super admin school creation flow
  // ============================================
  console.log('\n🏫 Creating school with principal (Super Admin flow)...');
  
  const schoolId = generateSchoolId();
  const principalId = generatePrincipalId();
  const principalPublicId = generatePublicId('Test Academy');

  // Create school and principal in transaction (like super admin service does)
  const { school, principal } = await prisma.$transaction(async (tx) => {
    // Create school
    const newSchool = await tx.school.upsert({
      where: { id: 'test-school-1' },
      update: {
        schoolId: schoolId,
      },
      create: {
        id: 'test-school-1',
        schoolId: schoolId,
        name: 'Test Academy',
        subdomain: 'testacademy',
        address: '123 Education Street',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        phone: '+2348000000100',
        email: 'info@testacademy.com',
      },
    });

    // Create principal user (like super admin service does)
    let principalUser = await tx.user.findUnique({
      where: { email: 'admin@school.com' },
    });

    if (!principalUser) {
      principalUser = await tx.user.create({
        data: {
          email: 'admin@school.com',
          phone: '+2348000000002',
          passwordHash: hashedPassword,
          accountStatus: 'ACTIVE', // ACTIVE for seed, normally SHADOW
          role: 'SCHOOL_ADMIN',
        },
      });
    } else {
      principalUser = await tx.user.update({
        where: { id: principalUser.id },
        data: {
          passwordHash: hashedPassword,
          accountStatus: 'ACTIVE',
          role: 'SCHOOL_ADMIN',
        },
      });
    }

    // Create principal admin record
    const principalAdmin = await tx.schoolAdmin.upsert({
      where: {
        userId_schoolId: {
          userId: principalUser.id,
          schoolId: newSchool.id,
        },
      },
      update: {
        adminId: principalId,
        publicId: principalPublicId,
        role: 'Principal',
        firstName: 'School',
        lastName: 'Administrator',
        phone: '+2348000000002',
        email: 'admin@school.com',
      },
      create: {
        adminId: principalId,
        publicId: principalPublicId,
        userId: principalUser.id,
        schoolId: newSchool.id,
        firstName: 'School',
        lastName: 'Administrator',
        phone: '+2348000000002',
        email: 'admin@school.com',
        role: 'Principal',
      },
    });

    return { school: newSchool, principal: principalAdmin };
  });

  console.log('✅ Created School:', school.name);
  console.log('✅ Created Principal:', principal.email);

  // ============================================
  // STEP 3: Principal adds teacher to school
  // This simulates the principal adding teacher flow
  // ============================================
  console.log('\n👨‍🏫 Adding teacher to school (Principal flow)...');

  const teacherId = generateTeacherId();
  const teacherPublicId = generatePublicId(school.name);

  // Create teacher (like teacher service does)
  const { teacher, teacherProfile } = await prisma.$transaction(async (tx) => {
    // Find or create teacher user
    let teacherUser = await tx.user.findUnique({
      where: { email: 'teacher@school.com' },
    });

    if (!teacherUser) {
      teacherUser = await tx.user.create({
        data: {
          email: 'teacher@school.com',
          phone: '+2348000000003',
          passwordHash: hashedPassword,
          accountStatus: 'ACTIVE', // ACTIVE for seed, normally SHADOW
          role: 'TEACHER',
        },
      });
    } else {
      teacherUser = await tx.user.update({
        where: { id: teacherUser.id },
        data: {
          passwordHash: hashedPassword,
          accountStatus: 'ACTIVE',
          role: 'TEACHER',
        },
      });
    }

    // Create teacher record
    const newTeacher = await tx.teacher.upsert({
      where: {
        userId_schoolId: {
          userId: teacherUser.id,
          schoolId: school.id,
        },
      },
      update: {
        teacherId: teacherId,
        publicId: teacherPublicId,
        firstName: 'John',
        lastName: 'Teacher',
        phone: '+2348000000003',
        email: 'teacher@school.com',
        employeeId: 'TCH-001',
      },
      create: {
        teacherId: teacherId,
        publicId: teacherPublicId,
        userId: teacherUser.id,
        schoolId: school.id,
        firstName: 'John',
        lastName: 'Teacher',
        phone: '+2348000000003',
        email: 'teacher@school.com',
        employeeId: 'TCH-001',
      },
    });

    return { teacher: teacherUser, teacherProfile: newTeacher };
  });

  console.log('✅ Created Teacher:', teacher.email);

  // Create Parent
  const parent = await prisma.user.upsert({
    where: { email: 'parent@example.com' },
    update: {},
    create: {
      email: 'parent@example.com',
      phone: '+2348000000004',
      passwordHash: hashedPassword,
      accountStatus: 'ACTIVE',
      role: 'PARENT',
    },
  });

  await prisma.parent.upsert({
    where: { userId: parent.id },
    update: {},
    create: {
      userId: parent.id,
      firstName: 'Jane',
      lastName: 'Parent',
      phone: '+2348000000004',
      email: 'parent@example.com',
    },
  });
  console.log('✅ Created Parent:', parent.email);

  // Create Student
  const student = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {},
    create: {
      email: 'student@example.com',
      phone: '+2348000000005',
      passwordHash: hashedPassword,
      accountStatus: 'ACTIVE',
      role: 'STUDENT',
    },
  });

  const studentProfile = await prisma.student.upsert({
    where: { userId: student.id },
    update: {},
    create: {
      userId: student.id,
      uid: 'AGO-LAG-2025-0001',
      firstName: 'Alice',
      lastName: 'Student',
      dateOfBirth: new Date('2010-05-15'),
      profileLocked: false,
    },
  });

  // Link Parent to Student
  const parentProfile = await prisma.parent.findUnique({ where: { userId: parent.id } });
  if (parentProfile) {
    // Check if relationship already exists
    const existingGuardian = await prisma.studentGuardian.findFirst({
      where: {
        studentId: studentProfile.id,
        parentId: parentProfile.id,
      },
    });

    if (!existingGuardian) {
      await prisma.studentGuardian.create({
        data: {
          studentId: studentProfile.id,
          parentId: parentProfile.id,
          relationship: 'Mother',
          isPrimary: true,
        },
      });
    }
  }

  // Create Enrollment
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: studentProfile.id,
      schoolId: school.id,
      termId: null,
    },
  });

  if (!existingEnrollment) {
    await prisma.enrollment.create({
      data: {
        studentId: studentProfile.id,
        schoolId: school.id,
        classLevel: 'Grade 5',
        academicYear: '2024-2025',
        enrollmentDate: new Date(),
        isActive: true,
      },
    });
  }
  console.log('✅ Created Student:', student.email);

  // Fetch the created records to get public IDs for display (already have them from transactions)

  // ============================================
  // SEED TOOLS
  // ============================================
  console.log('\n🔧 Seeding Tools...');

  const tools = [
    {
      slug: 'prepmaster',
      name: 'PrepMaster',
      description: 'AI-powered study companion for students. Generate flashcards, summaries, and quizzes from curriculum.',
      icon: '🧠',
      monthlyPrice: 0, // Included in Starter+
      yearlyPrice: 0,
      isCore: false,
      features: [
        { name: 'AI Flashcards', description: 'Generate flashcards from curriculum topics' },
        { name: 'Study Summaries', description: 'AI-generated topic summaries' },
        { name: 'Quick Quizzes', description: 'Self-assessment quizzes' },
        { name: 'Spaced Repetition', description: 'Smart review scheduling' },
        { name: 'Progress Tracking', description: 'Track study progress' },
      ],
      targetRoles: ['STUDENT'],
      sortOrder: 1,
    },
    {
      slug: 'socrates',
      name: 'Socrates',
      description: "The Teacher's Copilot. AI-powered lesson planning, assessment creation, and grading assistance.",
      icon: '🤖',
      monthlyPrice: 0, // Included in Professional+
      yearlyPrice: 0,
      isCore: false,
      features: [
        { name: 'Lesson Plans', description: 'AI-generated NERDC-aligned lesson plans' },
        { name: 'Assessment Builder', description: 'Create tests, assignments, exams' },
        { name: 'AI Question Generation', description: 'Generate questions from curriculum' },
        { name: 'AI Grading', description: 'AI-assisted essay and short answer grading' },
        { name: 'Question Bank', description: 'Reusable question library' },
        { name: 'Rubrics', description: 'Create and manage grading rubrics' },
      ],
      targetRoles: ['TEACHER', 'SCHOOL_ADMIN'],
      sortOrder: 2,
    },
    {
      slug: 'bursary',
      name: 'Bursary Pro',
      description: 'Comprehensive financial management. Track fees, generate invoices, manage payments and expenses.',
      icon: '💸',
      monthlyPrice: 0, // Basic in FREE, full in Starter+
      yearlyPrice: 0,
      isCore: true, // Basic version always available
      features: [
        { name: 'Fee Structures', description: 'Define fees by class and term' },
        { name: 'Invoice Generation', description: 'Auto-generate student invoices' },
        { name: 'Payment Tracking', description: 'Track cash, transfer, and online payments' },
        { name: 'Online Payments', description: 'Paystack integration' },
        { name: 'Expense Tracking', description: 'Track school expenses' },
        { name: 'Financial Reports', description: 'Income, expense, and cash flow reports' },
      ],
      targetRoles: ['SCHOOL_ADMIN'],
      sortOrder: 3,
    },
    {
      slug: 'rollcall',
      name: 'RollCall',
      description: 'Biometric attendance system. Student check-in/out with instant parent SMS notifications.',
      icon: '📍',
      monthlyPrice: 0, // Enterprise only
      yearlyPrice: 0,
      isCore: false,
      features: [
        { name: 'Biometric Registration', description: 'Fingerprint and face registration' },
        { name: 'Gate Attendance', description: 'Clock in/out at school gates' },
        { name: 'Instant SMS', description: 'Notify parents on arrival/departure' },
        { name: 'Late Tracking', description: 'Track late arrivals' },
        { name: 'Absence Alerts', description: 'Alert parents of unexplained absences' },
        { name: 'Reports', description: 'Daily, weekly, monthly attendance reports' },
      ],
      targetRoles: ['SCHOOL_ADMIN'],
      sortOrder: 4,
    },
  ];

  for (const tool of tools) {
    await prisma.tool.upsert({
      where: { slug: tool.slug },
      update: {
        name: tool.name,
        description: tool.description,
        icon: tool.icon,
        features: tool.features,
        targetRoles: tool.targetRoles,
        sortOrder: tool.sortOrder,
      },
      create: tool,
    });
    console.log(`  ✅ Tool: ${tool.name}`);
  }

  // Create FREE subscription for test school with basic bursary access
  console.log('\n📦 Setting up subscription for test school...');
  
  const subscription = await prisma.subscription.upsert({
    where: { schoolId: school.id },
    update: {},
    create: {
      schoolId: school.id,
      tier: 'FREE',
      maxStudents: -1,  // Unlimited
      maxTeachers: -1,  // Unlimited
      maxAdmins: 10,    // FREE tier allows 10 admins
      aiCredits: 0,
      aiCreditsUsed: 0,
    },
  });

  // Grant basic bursary access to FREE tier
  const bursaryTool = await prisma.tool.findUnique({ where: { slug: 'bursary' } });
  if (bursaryTool) {
    await prisma.schoolToolAccess.upsert({
      where: {
        schoolId_toolId: {
          schoolId: school.id,
          toolId: bursaryTool.id,
        },
      },
      update: {},
      create: {
        schoolId: school.id,
        toolId: bursaryTool.id,
        subscriptionId: subscription.id,
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
    });
    console.log('  ✅ Granted Bursary Pro access to test school');
  }

  console.log('\n🎉 Seeding completed!\n');
  console.log('📋 Test Login Credentials:\n');
  console.log('Super Admin:');
  console.log('  Email: superadmin@agora.com');
  console.log('  Password: Test1234!\n');
  console.log('School Admin (Principal):');
  console.log('  Email: admin@school.com (for email login - super admin only)');
  console.log(`  Public ID: ${principal.publicId} (for public ID login)`);
  console.log('  Password: Test1234!\n');
  console.log('Teacher:');
  console.log('  Email: teacher@school.com (for email login - super admin only)');
  console.log(`  Public ID: ${teacherProfile.publicId} (for public ID login)`);
  console.log('  Password: Test1234!\n');
  console.log('Parent:');
  console.log('  Email: parent@example.com');
  console.log('  Password: Test1234!\n');
  console.log('Student:');
  console.log('  Email: student@example.com');
  console.log('  Password: Test1234!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

