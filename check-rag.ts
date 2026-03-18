import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const count = await prisma.knowledgeChunk.count();
  console.log(`KnowledgeChunk count: ${count}`);
  const samples = await prisma.knowledgeChunk.findMany({ take: 5 });
  console.log('Sample metadata:', JSON.stringify(samples.map(s => s.metadata), null, 2));
  await prisma.$disconnect();
}

main();
