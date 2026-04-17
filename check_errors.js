
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const errors = await prisma.applicationError.findMany({
    orderBy: { lastSeen: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(errors, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
