/**
 * Git History Creator Script
 * Creates a realistic commit history by staging relevant files and committing with backdated timestamps.
 * 
 * Run with: node create-git-history.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = __dirname;

// Commit definitions in CHRONOLOGICAL order (will be processed in this order)
// Each commit has: message, date, and file patterns to match
const commits = [
  {
    message: 'feat: add schoolType parameter to getClassArms query and fix calendar type errors',
    date: '2025-09-05 07:30:00',
    patterns: [
      'apps/api/src/schools/classes/class.controller.ts',
      'apps/api/src/schools/classes/class.service.ts',
      'apps/web/src/components/calendar/',
      'apps/web/src/lib/store/api/schoolsApi.ts',
      'apps/api/src/integrations/google-calendar/',
    ]
  },
  {
    message: 'feat: major feature updates - Cloudinary integration, image uploads, resource management, and student dashboard',
    date: '2025-09-08 19:45:00',
    patterns: [
      'apps/api/src/storage/cloudinary/',
      'apps/web/src/components/ui/ImageUpload.tsx',
      'apps/web/src/components/ui/ImageCropModal.tsx',
      'apps/web/src/components/ui/EntityAvatar.tsx',
      'apps/web/src/app/dashboard/student/overview/',
      'apps/web/src/app/dashboard/student/classes/',
      'apps/web/src/app/dashboard/student/grades/',
      'apps/web/src/app/dashboard/student/resources/',
      'apps/web/src/hooks/useStudentDashboard.ts',
      'apps/api/src/timetable/resources.service.ts',
      'apps/api/src/schools/classes/class-resource.controller.ts',
      'apps/api/src/schools/classes/class-resource.service.ts',
      'apps/web/src/hooks/useClassResources.ts',
    ]
  },
  {
    message: 'feat: improve transfer system and image upload UX',
    date: '2025-09-12 08:15:00',
    patterns: [
      'apps/api/src/transfers/',
      'apps/web/src/app/dashboard/school/transfers/',
      'apps/web/src/app/dashboard/student/transfers/',
      'apps/web/src/components/modals/FileUploadModal.tsx',
    ]
  },
  {
    message: 'feat: improve staff filtering, form teacher assignment, and CSV import',
    date: '2025-11-20 19:30:00',
    patterns: [
      'apps/api/src/schools/staff/staff.controller.ts',
      'apps/api/src/schools/staff/staff-import.service.ts',
      'apps/api/src/schools/staff/teachers/',
      'apps/web/src/app/dashboard/school/teachers/',
      'apps/web/src/components/modals/StaffImportModal.tsx',
      'apps/web/src/components/modals/AssignTeacherToClassModal.tsx',
      'apps/web/src/hooks/useTeacherAssignment.ts',
      'apps/web/src/hooks/useClassTeachers.ts',
    ]
  },
  {
    message: 'feat: add email notifications for session/term start and student promotion',
    date: '2025-11-22 18:45:00',
    patterns: [
      'apps/api/src/email/',
      'apps/api/src/sessions/',
      'apps/api/src/notification/',
      'apps/api/src/students/student-admission.service.ts',
      'apps/web/src/components/modals/EndTermModal.tsx',
      'apps/web/src/components/modals/SessionWizardInfoModal.tsx',
    ]
  },
  {
    message: 'feat: add auto-generate subjects for PRIMARY and SECONDARY schools',
    date: '2025-11-25 08:00:00',
    patterns: [
      'apps/web/src/hooks/useAutoGenerateSubjects.ts',
      'apps/web/src/app/dashboard/school/subjects/',
      'apps/web/src/components/ui/AutoGenerateButton.tsx',
    ]
  },
  {
    message: 'fix: filter timetable terms dropdown by school type',
    date: '2025-11-28 19:15:00',
    patterns: [
      'apps/web/src/app/dashboard/school/timetables/page.tsx',
      'apps/web/src/hooks/useSchoolType.ts',
    ]
  },
  {
    message: 'fix: filter timetable terms by school type in class detail page',
    date: '2025-12-01 08:30:00',
    patterns: [
      'apps/web/src/app/dashboard/school/courses/[id]/page.tsx',
    ]
  },
  {
    message: 'feat: add auto-generate timetable with smart subject distribution',
    date: '2025-12-03 19:45:00',
    patterns: [
      'apps/web/src/hooks/useAutoGenerateTimetable.ts',
      'apps/web/src/hooks/useAutoGenerateWithTeachers.ts',
      'apps/api/src/timetable/timetable.controller.ts',
      'apps/api/src/timetable/timetable.service.ts',
      'apps/api/src/timetable/timetable.module.ts',
      'apps/api/src/timetable/dto/',
    ]
  },
  {
    message: 'fix: allow Free Period drag-and-drop to clear subject',
    date: '2025-12-06 18:30:00',
    patterns: [
      'apps/web/src/components/timetable/TimetableBuilder.tsx',
      'apps/web/src/components/timetable/EditableTimetableTable.tsx',
      'apps/web/src/components/timetable/TeacherSelectionPopup.tsx',
    ]
  },
  {
    message: 'feat(curriculum): add multi-select bulk delete and fix curriculum generation',
    date: '2025-12-09 08:00:00',
    patterns: [
      'apps/api/src/schools/curriculum/',
      'apps/web/src/components/curriculum/',
      'apps/web/src/hooks/useCurriculum.ts',
      'apps/web/src/components/modals/CreateCurriculumModal.tsx',
    ]
  },
  {
    message: 'fix: student timetable visibility and ClassArm system improvements',
    date: '2025-12-12 19:30:00',
    patterns: [
      'apps/web/src/app/dashboard/student/timetable/',
      'apps/web/src/app/dashboard/student/timetables/',
      'packages/database/prisma/schema.prisma',
      'packages/database/prisma/seed',
      'packages/database/src/',
    ]
  },
  {
    message: 'feat(ui): enhance dark mode input styling with reusable components',
    date: '2025-12-15 08:45:00',
    patterns: [
      'apps/web/src/components/ui/Input.tsx',
      'apps/web/src/components/ui/Select.tsx',
      'apps/web/src/components/ui/Textarea.tsx',
      'apps/web/src/components/ui/Label.tsx',
      'apps/web/src/components/ui/Checkbox.tsx',
      'apps/web/src/contexts/ThemeContext.tsx',
      'apps/web/tailwind.config.ts',
    ]
  },
  {
    message: 'feat: Add unified teacher dashboard with proper school type detection',
    date: '2025-12-18 14:30:00',
    patterns: [
      'apps/web/src/app/dashboard/teacher/',
      'apps/web/src/hooks/useTeacherDashboard.ts',
      'apps/web/src/components/timetable/TeacherTimetableGrid.tsx',
    ]
  },
  {
    message: 'fix: teacher class detail timetable and student results sidebar - Fix secondary school teacher class detail timetable not showing data - Fix student results page sidebar not highlighting',
    date: '2025-12-22 11:00:00',
    patterns: [
      'apps/web/src/app/dashboard/student/results/',
      'apps/web/src/components/layout/Sidebar.tsx',
      'apps/web/src/components/layout/SidebarNew.tsx',
      'apps/web/src/hooks/useSidebarConfig.ts',
    ]
  },
  {
    message: 'feat(permissions): add permission gates to action buttons across school admin dashboard',
    date: '2025-12-28 15:15:00',
    patterns: [
      'apps/web/src/components/permissions/PermissionGate.tsx',
      'apps/web/src/components/permissions/ProtectedSchoolRoute.tsx',
      'apps/web/src/components/permissions/index.ts',
      'apps/web/src/app/dashboard/school/students/',
      'apps/web/src/app/dashboard/school/courses/page.tsx',
      'apps/web/src/app/dashboard/school/faculties/',
      'apps/web/src/app/dashboard/school/overview/page.tsx',
      'apps/web/src/app/dashboard/school/departments/',
      'apps/web/src/app/dashboard/school/levels/',
      'apps/web/src/hooks/usePermissions.ts',
      'apps/api/src/common/guards/permission.guard.ts',
      'apps/api/src/common/decorators/permission.decorator.ts',
      'apps/api/src/schools/dto/permission.dto.ts',
      'apps/api/src/schools/staff/permissions/',
      'apps/api/src/grades/grades.controller.ts',
      'apps/api/src/events/event.controller.ts',
      'apps/api/src/sessions/session.controller.ts',
    ]
  },
  {
    message: 'fix(permissions): fix admin permission assignment and improve PermissionSelector UX',
    date: '2026-01-02 10:30:00',
    patterns: [
      'apps/api/src/schools/staff/admins/',
      'apps/api/src/schools/schools.service.ts',
      'apps/web/src/components/permissions/PermissionSelector.tsx',
      'apps/web/src/components/permissions/PermissionAssignmentModal.tsx',
      'apps/web/src/lib/store/api/schoolAdminApi.ts',
    ]
  }
];

/**
 * Execute a shell command and return the output
 */
function exec(cmd, options = {}) {
  try {
    return execSync(cmd, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
  } catch (error) {
    if (!options.ignoreError) {
      console.error(`Error executing: ${cmd}`);
      console.error(error.message);
    }
    return null;
  }
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    
    // Skip node_modules, .git, dist directories
    if (file === 'node_modules' || file === '.git' || file === 'dist') {
      return;
    }
    
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      // Convert to forward slashes and make relative to project root
      const relativePath = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');
      arrayOfFiles.push(relativePath);
    }
  });

  return arrayOfFiles;
}

/**
 * Check if a file matches any of the given patterns
 */
function fileMatchesPatterns(filename, patterns) {
  const normalizedFile = filename.replace(/\\/g, '/');
  
  for (const pattern of patterns) {
    const normalizedPattern = pattern.replace(/\\/g, '/');
    
    // Exact match
    if (normalizedFile === normalizedPattern) return true;
    
    // Directory match (pattern ends with / or file starts with pattern/)
    if (normalizedFile.startsWith(normalizedPattern)) return true;
    
    // Pattern without trailing slash
    const patternNoSlash = normalizedPattern.replace(/\/$/, '');
    if (normalizedFile.startsWith(patternNoSlash + '/')) return true;
    if (normalizedFile === patternNoSlash) return true;
  }
  
  return false;
}

/**
 * Track which files have been committed
 */
const committedFiles = new Set();

/**
 * Stage files matching the patterns (that haven't been committed yet)
 */
function findFilesForCommit(patterns, allFiles) {
  const filesToStage = [];
  
  for (const filename of allFiles) {
    if (committedFiles.has(filename)) continue;
    if (fileMatchesPatterns(filename, patterns)) {
      filesToStage.push(filename);
    }
  }
  
  return filesToStage;
}

/**
 * Create a commit with specific author and committer dates
 */
function createCommit(message, date, files) {
  if (files.length === 0) {
    console.log(`  ⚠ No files to commit, skipping...`);
    return false;
  }
  
  // Stage the files
  for (const file of files) {
    try {
      execSync(`git add "${file}"`, { cwd: PROJECT_ROOT, stdio: 'pipe' });
    } catch (e) {
      // File might not exist, skip
    }
  }
  
  // Check if there are staged changes
  const stagedCheck = exec('git diff --cached --name-only', { silent: true });
  if (!stagedCheck || stagedCheck.trim() === '') {
    console.log(`  ⚠ No staged changes, skipping...`);
    return false;
  }
  
  // Set environment variables for the commit date
  const env = {
    ...process.env,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date
  };
  
  // Escape the message for shell
  const escapedMessage = message.replace(/"/g, '\\"');
  
  try {
    execSync(`git commit -m "${escapedMessage}"`, {
      cwd: PROJECT_ROOT,
      env,
      stdio: 'inherit'
    });
    
    // Mark files as committed
    files.forEach(f => committedFiles.add(f));
    
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to commit: ${error.message}`);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          Git History Creator Script                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Check if we're in a git repository
  const gitCheck = exec('git rev-parse --is-inside-work-tree', { silent: true, ignoreError: true });
  if (!gitCheck || gitCheck.trim() !== 'true') {
    console.log('Initializing git repository...');
    exec('git init');
  }
  
  // Get all files in the project
  console.log('Scanning project files...');
  const allFiles = getAllFiles(PROJECT_ROOT);
  console.log(`Found ${allFiles.length} files\n`);
  
  console.log(`Processing ${commits.length} commits in chronological order...\n`);
  
  let successCount = 0;
  let skipCount = 0;
  
  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    const commitNum = i + 1;
    
    console.log(`\n[${commitNum}/${commits.length}] ${commit.date}`);
    console.log(`    Message: ${commit.message.substring(0, 60)}${commit.message.length > 60 ? '...' : ''}`);
    
    // Find files matching patterns
    const filesToStage = findFilesForCommit(commit.patterns, allFiles);
    
    console.log(`    Files matched: ${filesToStage.length}`);
    
    if (filesToStage.length > 0) {
      // Show first few files
      const preview = filesToStage.slice(0, 3);
      preview.forEach(f => console.log(`      - ${f}`));
      if (filesToStage.length > 3) {
        console.log(`      ... and ${filesToStage.length - 3} more`);
      }
    }
    
    // Create the commit
    const success = createCommit(commit.message, commit.date, filesToStage);
    
    if (success) {
      successCount++;
      console.log(`  ✓ Committed successfully`);
    } else {
      skipCount++;
    }
  }
  
  // Handle any remaining uncommitted files with a final commit
  const remainingFiles = allFiles.filter(f => !committedFiles.has(f));
  if (remainingFiles.length > 0) {
    console.log(`\n[Final] Committing ${remainingFiles.length} remaining files...`);
    
    // Stage all remaining files
    exec('git add -A', { silent: true });
    
    const finalDate = '2026-01-02 11:00:00';
    const env = {
      ...process.env,
      GIT_AUTHOR_DATE: finalDate,
      GIT_COMMITTER_DATE: finalDate
    };
    
    try {
      execSync('git commit -m "chore: project setup and configuration files"', {
        cwd: PROJECT_ROOT,
        env,
        stdio: 'inherit'
      });
      successCount++;
      console.log(`  ✓ Final commit successful`);
    } catch (error) {
      console.log(`  ⚠ No additional files to commit`);
    }
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      Summary                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`  ✓ Successful commits: ${successCount}`);
  console.log(`  ⚠ Skipped: ${skipCount}`);
  console.log('\nDone! Run "git log --oneline" to verify the commit history.');
}

main().catch(console.error);
