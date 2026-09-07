/// <reference types="node" />
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
  getDevFreeMaxStudents,
  getDevProMaxStudents,
  isFastSubscriptionMode,
} from '../src/subscriptions/subscription-dev.config';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = 'myschoolbud3@gmail.com';
const SUPER_ADMIN_PHONE = '+2347065605763';
const SUPER_ADMIN_PASSWORD = 'Test1234!';

/**
 * Generate a unique school ID
 */
function generateSchoolId(): string {
  const uuid = uuidv4().replace(/-/g, '').toUpperCase();
  return `AG-SCH-${uuid}`;
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

  // ============================================
  // STEP 1: Super Admin (create only — never overwrite)
  // ============================================
  const existingByEmail = await prisma.user.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
  });

  if (existingByEmail) {
    console.log('⏭️ Super Admin already exists, skipping:', existingByEmail.email);
  } else {
    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
    const phoneTaken = await prisma.user.findFirst({
      where: { phone: SUPER_ADMIN_PHONE },
      select: { id: true },
    });

    const created = await prisma.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        phone: phoneTaken ? null : SUPER_ADMIN_PHONE,
        passwordHash: hashedPassword,
        accountStatus: 'ACTIVE',
        role: 'SUPER_ADMIN',
        firstName: 'Jeremy',
        lastName: 'Arinze',
      },
    });
    console.log('✅ Created Super Admin:', created.email, '(Jeremy Arinze)');
  }


  // ============================================
  // SEED TOOLS
  // ============================================
  console.log('\n🔧 Seeding Tools...');

  const tools = [

    {
      slug: 'agora-ai',
      name: 'Myschoolbud AI',
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
    const existingTool = await prisma.tool.findUnique({
      where: { slug: tool.slug },
    });
    if (existingTool) {
      console.log(`  ⏭️ Tool exists, skipping: ${tool.name}`);
      continue;
    }
    await prisma.tool.create({ data: tool });
    console.log(`  ✅ Tool: ${tool.name}`);
  }

  console.log('\n📊 Seeding Subscription Plans...');

  const plans = [
    {
      tierCode: 'FREE',
      name: 'Free',
      description: 'Get started with the Myschoolbud core',
      monthlyPrice: 0,
      yearlyPrice: 0,
      highlight: false,
      cta: 'Current Plan',
      accent: 'gray',
      isPublic: true,
      maxStudents: getDevFreeMaxStudents(),
      maxTeachers: 10,
      maxAdmins: 2,
      aiCredits: 0,
      features: [
        { text: `${getDevFreeMaxStudents()} Students`, included: true },
        { text: '10 Teachers', included: true },
        { text: '2 Admin Users', included: true },
        { text: 'Core Management Platform', included: true },
        { text: 'Myschoolbud AI Assistant', included: false },
        { text: 'Automated AI Grading', included: false },
        { text: 'Detailed AI Analytics', included: false },
      ],
    },
    {
      tierCode: 'PRO',
      name: 'Pro',
      description: 'Unlock the power of Myschoolbud AI',
      monthlyPrice: 49999,
      yearlyPrice: 499990,
      highlight: true,
      cta: 'Upgrade to Pro',
      accent: 'blue',
      isPublic: true,
      maxStudents: getDevProMaxStudents(),
      maxTeachers: 80,
      maxAdmins: 20,
      aiCredits: 10000,
      features: [
        { text: `${getDevProMaxStudents()} Students`, included: true },
        { text: '80 Teachers', included: true },
        { text: '20 Admin Users', included: true },
        { text: 'Core Management Platform', included: true },
        { text: 'Myschoolbud AI Assistant', included: true, isGlowing: true },
        { text: '10,000 Myschoolbud AI credits / month', included: true },
        { text: 'Automated Essay Grading', included: true },
      ],
    },
    {
      tierCode: 'PRO_PLUS',
      name: 'Pro+',
      description: 'Advanced features for scaling institutions',
      monthlyPrice: 99999,
      yearlyPrice: 999990,
      highlight: false,
      cta: 'Upgrade to Pro+',
      accent: 'amber',
      isPublic: true,
      maxStudents: 2000,
      maxTeachers: 150,
      maxAdmins: 35,
      aiCredits: 25000,
      features: [
        { text: '2,000 Students', included: true },
        { text: '150 Teachers', included: true },
        { text: '35 Admin Users', included: true },
        { text: 'Core Management Platform', included: true },
        { text: 'Myschoolbud AI Assistant', included: true },
        { text: '25,000 Myschoolbud AI credits / month', included: true },
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
      if (
        (plan.tierCode === 'PRO' || plan.tierCode === 'FREE') &&
        createdPlan.maxStudents !== plan.maxStudents
      ) {
        await prisma.subscriptionPlan.update({
          where: { id: createdPlan.id },
          data: { maxStudents: plan.maxStudents },
        });
        console.log(
          `  🔄 Updated ${plan.name} maxStudents -> ${plan.maxStudents}` +
            (isFastSubscriptionMode() ? ' (DEV_FAST_SUBSCRIPTION)' : ''),
        );
      } else {
        console.log(`  ⏭️ Plan exists, skipping: ${plan.name}`);
      }
      if (plan.tierCode === 'FREE') {
        freePlanId = createdPlan.id;
      }
      continue;
    }

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
        isPublic: plan.isPublic,
        maxStudents: plan.maxStudents,
        maxTeachers: plan.maxTeachers,
        maxAdmins: plan.maxAdmins,
        aiCredits: plan.aiCredits,
      }
    });
    console.log(`  ✅ Plan: ${plan.name}`);
    if (plan.tierCode === 'FREE') {
      freePlanId = createdPlan.id;
    }
  }



  console.log('\n🎉 Seeding completed!\n');
  await prisma.budPlan.upsert({
    where: { slug: 'bud-trial' },
    update: {},
    create: {
      slug: 'bud-trial',
      name: 'Bud Trial',
      interval: 'TRIAL',
      priceKobo: 0,
      aiCredits: 200,
      dailyCardLimit: 5,
      chatEnabled: false,
    },
  });
  await prisma.budPlan.upsert({
    where: { slug: 'bud-monthly' },
    update: {},
    create: {
      slug: 'bud-monthly',
      name: 'Bud Monthly',
      interval: 'MONTHLY',
      priceKobo: 250000,
      aiCredits: 8000,
      chatEnabled: true,
    },
  });
  await prisma.budPlan.upsert({
    where: { slug: 'bud-termly' },
    update: {},
    create: {
      slug: 'bud-termly',
      name: 'Bud Termly',
      interval: 'TERMLY',
      priceKobo: 650000,
      aiCredits: 25000,
      chatEnabled: true,
    },
  });

  console.log('📋 Test Login Credentials:\n');
  console.log('Super Admin:');
  console.log(`  Email: ${SUPER_ADMIN_EMAIL}`);
  console.log('  Name: Jeremy Arinze');
  console.log(`  Password: ${SUPER_ADMIN_PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

