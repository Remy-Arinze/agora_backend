/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
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
  // Check if user with email exists
  const existingByEmail = await prisma.user.findUnique({
    where: { email: 'remyarinze@gmail.com' },
  });

  // Check if user with phone exists (and it's not the same user)
  const existingByPhone = await prisma.user.findFirst({
    where: {
      phone: '+2348000000001',
      ...(existingByEmail ? { id: { not: existingByEmail.id } } : {}),
    },
  });

  let superAdmin;

  if (existingByEmail) {
    // If phone is taken by another user, clear it first
    if (existingByPhone) {
      await prisma.user.update({
        where: { id: existingByPhone.id },
        data: { phone: null },
      });
    }
    // User exists with this email, update it
    superAdmin = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        phone: '+2348000000001',
        passwordHash: hashedPassword,
        accountStatus: 'ACTIVE',
        role: 'SUPER_ADMIN',
        firstName: 'Jeremy',
        lastName: 'Arinze',
      },
    });
  } else if (existingByPhone) {
    // User exists with this phone but different email
    // First, clear the phone from this user to avoid conflict
    await prisma.user.update({
      where: { id: existingByPhone.id },
      data: { phone: null },
    });
    // Now create the super admin
    superAdmin = await prisma.user.create({
      data: {
        email: 'remyarinze@gmail.com',
        phone: '+2348000000001',
        passwordHash: hashedPassword,
        accountStatus: 'ACTIVE',
        role: 'SUPER_ADMIN',
        firstName: 'Jeremy',
        lastName: 'Arinze',
      },
    });
  } else {
    // No existing user, create new
    superAdmin = await prisma.user.create({
      data: {
        email: 'remyarinze@gmail.com',
        phone: '+2348000000001',
        passwordHash: hashedPassword,
        accountStatus: 'ACTIVE',
        role: 'SUPER_ADMIN',
        firstName: 'Jeremy',
        lastName: 'Arinze',
      },
    });
  }
  console.log('✅ Created/Updated Super Admin:', superAdmin.email, '(Jeremy Arinze)');

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
    // Using Gmail alias: remyarinze+admin@gmail.com
    let principalUser = await tx.user.findFirst({
      where: {
        OR: [
          { email: 'remyarinze+admin@gmail.com' },
          { phone: '+2348000000002' },
        ],
      },
    });

    if (!principalUser) {
      principalUser = await tx.user.create({
        data: {
          email: 'remyarinze+admin@gmail.com',
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
          email: 'remyarinze+admin@gmail.com',
          phone: '+2348000000002',
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
        email: 'remyarinze+admin@gmail.com',
      },
      create: {
        adminId: principalId,
        publicId: principalPublicId,
        userId: principalUser.id,
        schoolId: newSchool.id,
        firstName: 'School',
        lastName: 'Administrator',
        phone: '+2348000000002',
        email: 'remyarinze+admin@gmail.com',
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
    // Using Gmail alias: remyarinze+teacher@gmail.com
    let teacherUser = await tx.user.findFirst({
      where: {
        OR: [
          { email: 'remyarinze+teacher@gmail.com' },
          { phone: '+2348000000003' },
        ],
      },
    });

    if (!teacherUser) {
      teacherUser = await tx.user.create({
        data: {
          email: 'remyarinze+teacher@gmail.com',
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
          email: 'remyarinze+teacher@gmail.com',
          phone: '+2348000000003',
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
        email: 'remyarinze+teacher@gmail.com',
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
        email: 'remyarinze+teacher@gmail.com',
        employeeId: 'TCH-001',
      },
    });

    return { teacher: teacherUser, teacherProfile: newTeacher };
  });

  console.log('✅ Created Teacher:', teacher.email);

  // Create Student
  // Using Gmail alias: remyarinze+student@gmail.com
  let student = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'remyarinze+student@gmail.com' },
        { phone: '+2348000000005' },
      ],
    },
  });

  if (student) {
    student = await prisma.user.update({
      where: { id: student.id },
      data: {
        email: 'remyarinze+student@gmail.com',
        phone: '+2348000000005',
        passwordHash: hashedPassword,
        accountStatus: 'ACTIVE',
        role: 'STUDENT',
      },
    });
  } else {
    student = await prisma.user.create({
      data: {
        email: 'remyarinze+student@gmail.com',
        phone: '+2348000000005',
        passwordHash: hashedPassword,
        accountStatus: 'ACTIVE',
        role: 'STUDENT',
      },
    });
  }

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

  // Note: Parent role has been removed from the system
  // Student guardianship can be managed through the admin interface if needed

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
      slug: 'agora-ai',
      name: 'Agora AI',
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

  console.log('\n📊 Seeding Subscription Plans...');

  const plans = [
    {
      tierCode: 'FREE',
      name: 'Free',
      description: 'Get started with the Agora core',
      monthlyPrice: 0,
      yearlyPrice: 0,
      highlight: false,
      cta: 'Current Plan',
      accent: 'gray',
      isPublic: true,
      maxStudents: 100,
      maxTeachers: 10,
      maxAdmins: 2,
      aiCredits: 0,
      features: [
        { text: '100 Students', included: true },
        { text: '10 Teachers', included: true },
        { text: '2 Admin Users', included: true },
        { text: 'Core Management Platform', included: true },
        { text: 'Agora AI Generation', included: false },
        { text: 'Automated AI Grading', included: false },
        { text: 'Detailed AI Analytics', included: false },
      ],
    },
    {
      tierCode: 'PRO',
      name: 'Pro',
      description: 'Unlock the power of Agora AI',
      monthlyPrice: 15000,
      yearlyPrice: 150000,
      highlight: true,
      cta: 'Upgrade to Pro',
      accent: 'blue',
      isPublic: true,
      maxStudents: 500,
      maxTeachers: 50,
      maxAdmins: 10,
      aiCredits: 5000,
      features: [
        { text: '500 Students', included: true },
        { text: '50 Teachers', included: true },
        { text: '10 Admin Users', included: true },
        { text: 'Core Management Platform', included: true },
        { text: 'Agora AI Assistant', included: true, isGlowing: true },
        { text: '5,000 AI Credits/month', included: true },
        { text: 'Automated Essay Grading', included: true },
      ],
    },
    {
      tierCode: 'PRO_PLUS',
      name: 'Pro+',
      description: 'Advanced features for scaling institutions',
      monthlyPrice: 45000,
      yearlyPrice: 450000,
      highlight: false,
      cta: 'Upgrade to Pro+',
      accent: 'amber',
      isPublic: true,
      maxStudents: 2000,
      maxTeachers: 200,
      maxAdmins: 25,
      aiCredits: 20000,
      features: [
        { text: '2,000 Students', included: true },
        { text: '200 Teachers', included: true },
        { text: '25 Admin Users', included: true },
        { text: 'Core Management Platform', included: true },
        { text: 'Agora AI Assistant', included: true },
        { text: '20,000 AI Credits/month', included: true },
        { text: 'Dedicated Support', included: true },
      ],
    }
  ];

  let freePlanId = null;

  for (const plan of plans) {
    let createdPlan = await prisma.subscriptionPlan.findFirst({
      where: { tierCode: plan.tierCode as any, isPublic: true },
    });

    if (createdPlan) {
      createdPlan = await prisma.subscriptionPlan.update({
        where: { id: createdPlan.id },
        data: {
          name: plan.name,
          description: plan.description,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          features: plan.features as any,
          highlight: plan.highlight,
          cta: plan.cta,
          accent: plan.accent,
          isPublic: plan.isPublic
        }
      });
    } else {
      createdPlan = await prisma.subscriptionPlan.create({
        data: {
          tierCode: plan.tierCode as any,
          name: plan.name,
          description: plan.description,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          features: plan.features as any,
          highlight: plan.highlight,
          cta: plan.cta,
          accent: plan.accent,
          isPublic: plan.isPublic
        }
      });
    }
    console.log(`  ✅ Plan: ${plan.name}`);
    if (plan.tierCode === 'FREE') {
      freePlanId = createdPlan.id;
    }
  }

  // Create FREE subscription for test school with basic bursary access
  console.log('\n📦 Setting up subscription for test school...');

  const subscription = await prisma.subscription.upsert({
    where: { schoolId: school.id },
    update: {
      planId: freePlanId
    },
    create: {
      schoolId: school.id,
      tier: 'FREE',
      planId: freePlanId,
      maxStudents: 100,
      maxTeachers: 10,
      maxAdmins: 2,
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
  console.log('  Email: remyarinze@gmail.com');
  console.log('  Name: Jeremy Arinze');
  console.log('  Password: Test1234!\n');
  console.log('School Admin (Principal):');
  console.log('  Email: remyarinze+admin@gmail.com');
  console.log(`  Public ID: ${principal.publicId} (for public ID login)`);
  console.log('  Password: Test1234!\n');
  console.log('Teacher:');
  console.log('  Email: remyarinze+teacher@gmail.com');
  console.log(`  Public ID: ${teacherProfile.publicId} (for public ID login)`);
  console.log('  Password: Test1234!\n');
  console.log('Student:');
  console.log('  Email: remyarinze+student@gmail.com');
  console.log('  Password: Test1234!\n');
  console.log('Note: All emails use Gmail aliases pointing to remyarinze@gmail.com');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

