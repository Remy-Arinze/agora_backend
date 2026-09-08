/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import { levelStreamsForAgoraCode } from '../src/common/utils/subject-level-stream.util';

const prisma = new PrismaClient();

/**
 * National subject bank. schoolTypes = which school can offer it.
 * levelStreams = PRIMARY / JUNIOR (JSS) / SENIOR (SS) — Nigerian NERDC/WAEC split.
 * Basic Science & Basic Technology are JSS, not SS. Physics/Chem/Bio are SS, not JSS.
 */
const AGORA_SUBJECTS = [
  { code: 'ENG', name: 'English Language', category: 'CORE', schoolTypes: ['PRIMARY', 'SECONDARY'] },
  { code: 'MTH', name: 'Mathematics', category: 'CORE', schoolTypes: ['PRIMARY', 'SECONDARY'] },

  { code: 'BSC', name: 'Basic Science', category: 'CORE', schoolTypes: ['PRIMARY', 'SECONDARY'] },
  { code: 'SST', name: 'Social Studies', category: 'CORE', schoolTypes: ['PRIMARY', 'SECONDARY'] },
  { code: 'CCA', name: 'Cultural & Creative Arts', category: 'CORE', schoolTypes: ['PRIMARY', 'SECONDARY'] },
  { code: 'PHE', name: 'Physical & Health Education', category: 'CORE', schoolTypes: ['PRIMARY', 'SECONDARY'] },
  { code: 'RKS', name: 'Religious Knowledge Studies', category: 'CORE', schoolTypes: ['PRIMARY'] },
  { code: 'NLG', name: 'Nigerian Language', category: 'CORE', schoolTypes: ['PRIMARY', 'SECONDARY'] },
  { code: 'BTC', name: 'Basic Technology', category: 'CORE', schoolTypes: ['SECONDARY'] },
  { code: 'CIV', name: 'Civic Education', category: 'CORE', schoolTypes: ['PRIMARY', 'SECONDARY'] },

  { code: 'PHY', name: 'Physics', category: 'CORE', schoolTypes: ['SECONDARY'] },
  { code: 'CHM', name: 'Chemistry', category: 'CORE', schoolTypes: ['SECONDARY'] },
  { code: 'BIO', name: 'Biology', category: 'CORE', schoolTypes: ['SECONDARY'] },
  { code: 'LIT', name: 'Literature in English', category: 'CORE', schoolTypes: ['SECONDARY'] },
  { code: 'GEO', name: 'Geography', category: 'CORE', schoolTypes: ['SECONDARY'] },
  { code: 'HIS', name: 'History', category: 'CORE', schoolTypes: ['SECONDARY'] },
  { code: 'ECO', name: 'Economics', category: 'CORE', schoolTypes: ['SECONDARY'] },
  { code: 'GOV', name: 'Government', category: 'CORE', schoolTypes: ['SECONDARY'] },
  { code: 'AGR', name: 'Agricultural Science', category: 'CORE', schoolTypes: ['SECONDARY'] },
  { code: 'CRS', name: 'Christian Religious Studies', category: 'CORE', schoolTypes: ['SECONDARY'] },
  { code: 'IRS', name: 'Islamic Religious Studies', category: 'CORE', schoolTypes: ['SECONDARY'] },

  { code: 'FMT', name: 'Further Mathematics', category: 'ELECTIVE', schoolTypes: ['SECONDARY'] },
  { code: 'CSC', name: 'Computer Science', category: 'ELECTIVE', schoolTypes: ['SECONDARY'] },
  { code: 'ACC', name: 'Accounting', category: 'ELECTIVE', schoolTypes: ['SECONDARY'] },
  { code: 'COM', name: 'Commerce', category: 'ELECTIVE', schoolTypes: ['SECONDARY'] },
  { code: 'FRN', name: 'French', category: 'ELECTIVE', schoolTypes: ['SECONDARY'] },
  { code: 'TDR', name: 'Technical Drawing', category: 'ELECTIVE', schoolTypes: ['SECONDARY'] },
  { code: 'FNA', name: 'Fine Arts', category: 'ELECTIVE', schoolTypes: ['SECONDARY'] },
  { code: 'MUS', name: 'Music', category: 'ELECTIVE', schoolTypes: ['SECONDARY'] },
  { code: 'FNT', name: 'Food & Nutrition', category: 'ELECTIVE', schoolTypes: ['SECONDARY'] },
  { code: 'HOM', name: 'Home Economics', category: 'ELECTIVE', schoolTypes: ['SECONDARY'] },
];

async function seedAgoraSubjects() {
  console.log('🌱 Seeding Agora Subjects...\n');

  const subjectModel = (prisma as any).agoraSubject || (prisma as any).nerdcSubject;

  if (!subjectModel) {
    throw new Error('❌ Could not find agoraSubject or nerdcSubject model on Prisma client');
  }

  console.log('📚 Upserting global subjects (school types + JSS/SS streams)...');
  for (const subject of AGORA_SUBJECTS) {
    const levelStreams = levelStreamsForAgoraCode(subject.code, subject.schoolTypes);
    await subjectModel.upsert({
      where: { code: subject.code },
      create: { ...subject, levelStreams },
      update: {
        name: subject.name,
        category: subject.category,
        schoolTypes: subject.schoolTypes,
        levelStreams,
      },
    });
    console.log(`  ✓ ${subject.code}: ${subject.name} [${levelStreams.join(', ')}]`);
  }

  console.log('\n✅ Agora Subjects seeding complete!');
}

seedAgoraSubjects()
  .catch((e) => {
    console.error('Error seeding subjects:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { seedAgoraSubjects };
