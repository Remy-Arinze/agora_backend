/**
 * Verifies that the failed migration 20241222120000_add_class_arms_optimization
 * is fully applied in the database (so we can safely mark it resolved without losing data).
 *
 * Usage (from backend root):
 *   npm run db:check-failed-migration              # Check only; report what's in DB
 *   npm run db:resolve-failed-migration            # If check passes, mark migration applied then run deploy
 */

import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Load .env from backend root (no dotenv dependency)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const MIGRATION_NAME = '20241222120000_add_class_arms_optimization';

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

async function main() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error('DB_URL is not set in .env');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  const results: CheckResult[] = [];

  try {
    // --- 1. Columns ---
    const columnsToCheck: [string, string][] = [
      ['ClassArm', 'academicYear'],
      ['ClassArm', 'classTeacherId'],
      ['ClassTeacher', 'classArmId'],
      ['ClassResource', 'classArmId'],
      ['ClassResource', 'classLevelId'],
      ['Curriculum', 'classLevelId'],
    ];

    for (const [table, column] of columnsToCheck) {
      const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        table,
        column
      );
      results.push({
        name: `Column ${table}.${column}`,
        ok: rows.length > 0,
        detail: rows.length ? 'exists' : 'MISSING',
      });
    }

    // --- 2. Indexes ---
    const indexesToCheck: [string, string][] = [
      ['ClassArm', 'ClassArm_academicYear_idx'],
      ['ClassArm', 'ClassArm_classTeacherId_idx'],
      ['ClassTeacher', 'ClassTeacher_classArmId_idx'],
      ['ClassResource', 'ClassResource_classArmId_idx'],
      ['ClassResource', 'ClassResource_classLevelId_idx'],
      ['Curriculum', 'Curriculum_classLevelId_idx'],
    ];

    for (const [table, indexName] of indexesToCheck) {
      const rows = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = $1 AND indexname = $2`,
        table,
        indexName
      );
      results.push({
        name: `Index ${indexName}`,
        ok: rows.length > 0,
        detail: rows.length ? 'exists' : 'MISSING',
      });
    }

    // --- 3. Unique indexes (new constraints from migration) ---
    const uniqueIndexes: [string, string][] = [
      ['ClassArm', 'ClassArm_classLevelId_name_academicYear_key'],
      ['ClassTeacher', 'ClassTeacher_classId_classArmId_teacherId_subject_key'],
      ['Curriculum', 'Curriculum_classId_classLevelId_subject_academicYear_termId_key'],
    ];

    for (const [table, indexName] of uniqueIndexes) {
      const rows = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = $1 AND indexname = $2`,
        table,
        indexName
      );
      results.push({
        name: `Unique index ${indexName}`,
        ok: rows.length > 0,
        detail: rows.length ? 'exists' : 'MISSING',
      });
    }

    // --- 4. Foreign keys ---
    const fkNames = [
      'ClassArm_classTeacherId_fkey',
      'ClassTeacher_classArmId_fkey',
      'ClassResource_classArmId_fkey',
      'ClassResource_classLevelId_fkey',
      'Curriculum_classLevelId_fkey',
    ];

    for (const fkName of fkNames) {
      const rows = await prisma.$queryRawUnsafe<{ constraint_name: string }[]>(
        `SELECT constraint_name FROM information_schema.table_constraints
         WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY' AND constraint_name = $1`,
        fkName
      );
      results.push({
        name: `FK ${fkName}`,
        ok: rows.length > 0,
        detail: rows.length ? 'exists' : 'MISSING',
      });
    }
  } finally {
    await prisma.$disconnect();
  }

  // --- Report ---
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);

  console.log('\n--- Migration check: ' + MIGRATION_NAME + ' ---\n');
  for (const r of results) {
    console.log(r.ok ? '  OK   ' : '  FAIL ', r.name, r.detail ? `(${r.detail})` : '');
  }
  console.log('\n--- Summary ---');
  console.log('Passed:', passed.length, '| Failed:', failed.length);

  if (failed.length > 0) {
    console.log('\nNot safe to resolve: some changes from the migration are missing in the DB.');
    console.log('Do NOT run "prisma migrate resolve --applied". Fix the DB or re-apply the migration manually.');
    process.exit(1);
  }

  console.log('\nAll changes from this migration are present in the database.');
  console.log('Safe to mark the migration as applied.');

  // Auto-resolve if --resolve flag
  const shouldResolve = process.argv.includes('--resolve') || process.env.RESOLVE === '1';
  if (shouldResolve) {
    console.log('Running prisma migrate resolve --applied ...');
    execSync(`npx prisma migrate resolve --applied "${MIGRATION_NAME}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
    console.log('Done. You can now run: npx prisma migrate deploy');
    process.exit(0);
  }

  console.log('\nTo mark as applied and then deploy remaining migrations, run:');
  console.log('  npm run db:resolve-failed-migration');
  console.log('  npx prisma migrate deploy');
  console.log('\nOr manually:');
  console.log('  npx prisma migrate resolve --applied "' + MIGRATION_NAME + '"');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
