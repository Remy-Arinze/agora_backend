import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const school = await prisma.school.findFirst();
  console.log(`Using school: ${school?.name} (${school?.id})`);
  
  if (school) {
    console.log('Starting indexing...');
    const students = await prisma.student.findMany({
        where: { enrollments: { some: { schoolId: school.id } } },
        select: { id: true }
    });

    console.log(`Indexing ${students.length} students...`);
    // Note: I can't call the service directly here easily without Nest context, 
    // but I can see if I can run the indexing via the API or just wait.
  }
  await prisma.$disconnect();
}

main();
