import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// NERDC Subject Definitions
// ============================================

const NERDC_SUBJECTS = [
  // Core Subjects (All School Types)
  { code: 'ENG', name: 'English Language', category: 'CORE', schoolTypes: ['PRIMARY', 'SECONDARY'] },
  { code: 'MTH', name: 'Mathematics', category: 'CORE', schoolTypes: ['PRIMARY', 'SECONDARY'] },
  
  // Primary School Subjects
  { code: 'BSC', name: 'Basic Science', category: 'CORE', schoolTypes: ['PRIMARY'] },
  { code: 'SST', name: 'Social Studies', category: 'CORE', schoolTypes: ['PRIMARY'] },
  { code: 'CCA', name: 'Cultural & Creative Arts', category: 'CORE', schoolTypes: ['PRIMARY'] },
  { code: 'PHE', name: 'Physical & Health Education', category: 'CORE', schoolTypes: ['PRIMARY'] },
  { code: 'RKS', name: 'Religious Knowledge Studies', category: 'CORE', schoolTypes: ['PRIMARY'] },
  { code: 'NLG', name: 'Nigerian Language', category: 'CORE', schoolTypes: ['PRIMARY'] },
  { code: 'BTC', name: 'Basic Technology', category: 'CORE', schoolTypes: ['PRIMARY'] },
  { code: 'CIV', name: 'Civic Education', category: 'CORE', schoolTypes: ['PRIMARY', 'SECONDARY'] },
  
  // Secondary School Core Subjects
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
  
  // Secondary School Elective Subjects
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

// ============================================
// Sample NERDC Curriculum (Mathematics Primary 1 Term 1)
// ============================================

const SAMPLE_MATH_PRIMARY1_TERM1 = {
  subjectCode: 'MTH',
  classLevel: 'PRIMARY_1',
  term: 1,
  description: 'NERDC Mathematics Curriculum for Primary 1, First Term',
  weeks: [
    {
      weekNumber: 1,
      topic: 'Number Names and Numerals (1-10)',
      subTopics: ['Counting 1-10', 'Writing numerals 1-10', 'Matching numbers to quantities'],
      objectives: [
        'Count objects from 1 to 10',
        'Write numerals 1 to 10 correctly',
        'Match numerals to the correct number of objects'
      ],
      activities: [
        'Counting songs and rhymes',
        'Number tracing exercises',
        'Matching games with objects and numbers'
      ],
      resources: ['Number cards', 'Counting beads', 'Number charts', 'Worksheets'],
      assessment: 'Oral counting and numeral writing exercise',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 2,
      topic: 'Number Names and Numerals (11-20)',
      subTopics: ['Counting 11-20', 'Writing numerals 11-20', 'Number sequence'],
      objectives: [
        'Count objects from 11 to 20',
        'Write numerals 11 to 20 correctly',
        'Identify numbers in sequence'
      ],
      activities: [
        'Group counting activities',
        'Number line exercises',
        'Fill in the missing number games'
      ],
      resources: ['Number line', 'Place value blocks', 'Counting sticks'],
      assessment: 'Written exercise on numerals 11-20',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 3,
      topic: 'Ordering Numbers (1-20)',
      subTopics: ['Ascending order', 'Descending order', 'Before and after'],
      objectives: [
        'Arrange numbers in ascending order',
        'Arrange numbers in descending order',
        'Identify numbers before and after a given number'
      ],
      activities: [
        'Number ordering games',
        'Standing in number order activity',
        'Worksheet exercises'
      ],
      resources: ['Number cards', 'Interactive whiteboard', 'Worksheets'],
      assessment: 'Ordering numbers exercise',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 4,
      topic: 'Addition of Numbers (Sum up to 10)',
      subTopics: ['Concept of addition', 'Addition using objects', 'Addition symbols'],
      objectives: [
        'Understand the concept of addition',
        'Add numbers with sum up to 10',
        'Use the + and = symbols correctly'
      ],
      activities: [
        'Adding counters and objects',
        'Story problems involving addition',
        'Simple addition worksheets'
      ],
      resources: ['Counters', 'Addition cards', 'Story problem cards'],
      assessment: 'Addition exercise (sum up to 10)',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 5,
      topic: 'Addition of Numbers (Sum up to 20)',
      subTopics: ['Adding with regrouping', 'Mental addition strategies', 'Word problems'],
      objectives: [
        'Add numbers with sum up to 20',
        'Use mental strategies for simple addition',
        'Solve simple word problems involving addition'
      ],
      activities: [
        'Number line addition',
        'Partner addition games',
        'Word problem solving'
      ],
      resources: ['Number line', 'Addition flashcards', 'Worksheet'],
      assessment: 'Addition test (sum up to 20)',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 6,
      topic: 'Subtraction of Numbers (Within 10)',
      subTopics: ['Concept of subtraction', 'Subtraction using objects', 'Subtraction symbols'],
      objectives: [
        'Understand the concept of subtraction (taking away)',
        'Subtract numbers within 10',
        'Use the - and = symbols correctly'
      ],
      activities: [
        'Taking away counters activity',
        'Subtraction songs',
        'Simple subtraction worksheets'
      ],
      resources: ['Counters', 'Subtraction cards', 'Visual aids'],
      assessment: 'Subtraction exercise (within 10)',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 7,
      topic: 'Mid-Term Review and Assessment',
      subTopics: ['Review of numbers 1-20', 'Review of addition', 'Review of subtraction'],
      objectives: [
        'Consolidate knowledge of numbers 1-20',
        'Practice addition and subtraction skills',
        'Identify areas needing improvement'
      ],
      activities: [
        'Review games',
        'Practice exercises',
        'Mid-term assessment'
      ],
      resources: ['Review worksheets', 'Assessment materials'],
      assessment: 'Mid-term examination',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 8,
      topic: 'Subtraction of Numbers (Within 20)',
      subTopics: ['Subtraction strategies', 'Counting back', 'Word problems'],
      objectives: [
        'Subtract numbers within 20',
        'Use counting back as a subtraction strategy',
        'Solve simple word problems involving subtraction'
      ],
      activities: [
        'Number line subtraction',
        'Subtraction games',
        'Word problem practice'
      ],
      resources: ['Number line', 'Subtraction cards', 'Story problems'],
      assessment: 'Subtraction test (within 20)',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 9,
      topic: 'Shapes (2D Shapes)',
      subTopics: ['Circle', 'Square', 'Triangle', 'Rectangle'],
      objectives: [
        'Identify basic 2D shapes',
        'Name the properties of basic shapes',
        'Recognize shapes in the environment'
      ],
      activities: [
        'Shape hunt in the classroom',
        'Drawing shapes',
        'Shape sorting activities'
      ],
      resources: ['Shape cards', 'Shape manipulatives', 'Drawing materials'],
      assessment: 'Shape identification test',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 10,
      topic: 'Measurement (Length)',
      subTopics: ['Long and short', 'Tall and short', 'Comparing lengths'],
      objectives: [
        'Compare objects by length',
        'Use vocabulary: long, short, tall, taller, shorter',
        'Order objects by length'
      ],
      activities: [
        'Comparing pencils and rulers',
        'Height comparison activities',
        'Ordering objects by length'
      ],
      resources: ['Rulers', 'Measuring tape', 'Objects of various lengths'],
      assessment: 'Practical length comparison exercise',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 11,
      topic: 'Money (Nigerian Currency)',
      subTopics: ['Identifying Nigerian coins', 'Identifying Nigerian notes', 'Simple buying and selling'],
      objectives: [
        'Identify Nigerian coins (50k, N1, N2, N5, N10)',
        'Identify Nigerian notes (N5, N10, N20)',
        'Participate in simple buying and selling activities'
      ],
      activities: [
        'Coin and note identification',
        'Classroom shop simulation',
        'Money sorting games'
      ],
      resources: ['Toy money', 'Real currency samples', 'Shop items'],
      assessment: 'Money identification exercise',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 12,
      topic: 'Time (Days of the Week)',
      subTopics: ['Days of the week', 'Yesterday, today, tomorrow', 'Daily activities'],
      objectives: [
        'Name the days of the week in order',
        'Use yesterday, today, tomorrow correctly',
        'Relate days to daily activities'
      ],
      activities: [
        'Days of the week song',
        'Calendar activities',
        'Daily routine discussions'
      ],
      resources: ['Calendar', 'Days of the week chart', 'Activity cards'],
      assessment: 'Days of the week ordering test',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 13,
      topic: 'Revision and End of Term Examination',
      subTopics: ['Comprehensive review', 'Practice tests', 'End of term examination'],
      objectives: [
        'Review all topics covered in the term',
        'Prepare for end of term examination',
        'Demonstrate mastery of term objectives'
      ],
      activities: [
        'Comprehensive revision',
        'Practice test sessions',
        'End of term examination'
      ],
      resources: ['Revision worksheets', 'Examination materials'],
      assessment: 'End of term examination',
      duration: '5 periods of 30 minutes'
    },
  ],
};

// ============================================
// Sample NERDC Curriculum (English Primary 1 Term 1)
// ============================================

const SAMPLE_ENGLISH_PRIMARY1_TERM1 = {
  subjectCode: 'ENG',
  classLevel: 'PRIMARY_1',
  term: 1,
  description: 'NERDC English Language Curriculum for Primary 1, First Term',
  weeks: [
    {
      weekNumber: 1,
      topic: 'Greetings and Introduction',
      subTopics: ['Good morning', 'Good afternoon', 'Introducing oneself'],
      objectives: [
        'Greet appropriately at different times of day',
        'Introduce themselves using simple sentences',
        'Respond to greetings politely'
      ],
      activities: ['Role play greetings', 'Self-introduction circle', 'Greeting songs'],
      resources: ['Picture cards', 'Greeting posters', 'Audio recordings'],
      assessment: 'Oral greeting and introduction exercise',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 2,
      topic: 'Phonics - Letter Sounds (A-E)',
      subTopics: ['Sound of A', 'Sound of B', 'Sound of C', 'Sound of D', 'Sound of E'],
      objectives: [
        'Identify and produce the sounds of letters A-E',
        'Recognize letters in simple words',
        'Write letters A-E correctly'
      ],
      activities: ['Letter sound games', 'Tracing letters', 'Identifying sounds in words'],
      resources: ['Alphabet cards', 'Letter tracing sheets', 'Phonics audio'],
      assessment: 'Letter sound identification test',
      duration: '5 periods of 30 minutes'
    },
    {
      weekNumber: 3,
      topic: 'Phonics - Letter Sounds (F-J)',
      subTopics: ['Sound of F', 'Sound of G', 'Sound of H', 'Sound of I', 'Sound of J'],
      objectives: [
        'Identify and produce the sounds of letters F-J',
        'Blend sounds to make simple words',
        'Write letters F-J correctly'
      ],
      activities: ['Sound blending games', 'Letter writing practice', 'Word building'],
      resources: ['Alphabet cards', 'Word cards', 'Writing materials'],
      assessment: 'Letter writing and sound test',
      duration: '5 periods of 30 minutes'
    },
    // ... additional weeks would follow the same pattern
  ],
};

// ============================================
// Seed Function
// ============================================

async function seedNerdcData() {
  console.log('🌱 Seeding NERDC data...\n');

  // Seed subjects
  console.log('📚 Creating NERDC subjects...');
  for (const subject of NERDC_SUBJECTS) {
    await (prisma as any).nerdcSubject.upsert({
      where: { code: subject.code },
      update: {
        name: subject.name,
        category: subject.category,
        schoolTypes: subject.schoolTypes,
      },
      create: subject,
    });
    console.log(`  ✓ ${subject.code}: ${subject.name}`);
  }

  // Seed sample Mathematics curriculum
  console.log('\n📖 Creating sample Mathematics curriculum (Primary 1, Term 1)...');
  const mathSubject = await (prisma as any).nerdcSubject.findUnique({
    where: { code: 'MTH' },
  });

  if (mathSubject) {
    const existingMathCurriculum = await (prisma as any).nerdcCurriculum.findFirst({
      where: {
        subjectId: mathSubject.id,
        classLevel: SAMPLE_MATH_PRIMARY1_TERM1.classLevel,
        term: SAMPLE_MATH_PRIMARY1_TERM1.term,
      },
    });

    if (existingMathCurriculum) {
      // Delete existing weeks
      await (prisma as any).nerdcCurriculumWeek.deleteMany({
        where: { curriculumId: existingMathCurriculum.id },
      });
      
      // Update curriculum and create new weeks
      await (prisma as any).nerdcCurriculum.update({
        where: { id: existingMathCurriculum.id },
        data: {
          description: SAMPLE_MATH_PRIMARY1_TERM1.description,
          weeks: {
            create: SAMPLE_MATH_PRIMARY1_TERM1.weeks,
          },
        },
      });
    } else {
      await (prisma as any).nerdcCurriculum.create({
        data: {
          subjectId: mathSubject.id,
          classLevel: SAMPLE_MATH_PRIMARY1_TERM1.classLevel,
          term: SAMPLE_MATH_PRIMARY1_TERM1.term,
          description: SAMPLE_MATH_PRIMARY1_TERM1.description,
          weeks: {
            create: SAMPLE_MATH_PRIMARY1_TERM1.weeks,
          },
        },
      });
    }
    console.log('  ✓ Mathematics Primary 1 Term 1 curriculum created');
  }

  // Seed sample English curriculum
  console.log('\n📖 Creating sample English curriculum (Primary 1, Term 1)...');
  const engSubject = await (prisma as any).nerdcSubject.findUnique({
    where: { code: 'ENG' },
  });

  if (engSubject) {
    const existingEngCurriculum = await (prisma as any).nerdcCurriculum.findFirst({
      where: {
        subjectId: engSubject.id,
        classLevel: SAMPLE_ENGLISH_PRIMARY1_TERM1.classLevel,
        term: SAMPLE_ENGLISH_PRIMARY1_TERM1.term,
      },
    });

    if (existingEngCurriculum) {
      await (prisma as any).nerdcCurriculumWeek.deleteMany({
        where: { curriculumId: existingEngCurriculum.id },
      });
      
      await (prisma as any).nerdcCurriculum.update({
        where: { id: existingEngCurriculum.id },
        data: {
          description: SAMPLE_ENGLISH_PRIMARY1_TERM1.description,
          weeks: {
            create: SAMPLE_ENGLISH_PRIMARY1_TERM1.weeks,
          },
        },
      });
    } else {
      await (prisma as any).nerdcCurriculum.create({
        data: {
          subjectId: engSubject.id,
          classLevel: SAMPLE_ENGLISH_PRIMARY1_TERM1.classLevel,
          term: SAMPLE_ENGLISH_PRIMARY1_TERM1.term,
          description: SAMPLE_ENGLISH_PRIMARY1_TERM1.description,
          weeks: {
            create: SAMPLE_ENGLISH_PRIMARY1_TERM1.weeks,
          },
        },
      });
    }
    console.log('  ✓ English Primary 1 Term 1 curriculum created');
  }

  console.log('\n✅ NERDC data seeding complete!');
}

// Run seed
seedNerdcData()
  .catch((e) => {
    console.error('Error seeding NERDC data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { seedNerdcData };

