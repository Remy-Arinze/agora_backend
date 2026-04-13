const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const curricula = await prisma.agoraCurriculum.findMany({
    select: { gradeLevel: true, status: true },
    distinct: ['gradeLevel']
  });
  console.log(JSON.stringify(curricula, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
