import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, name: true } });
  console.log('Users:', JSON.stringify(users, null, 2));
  const projects = await prisma.project.findMany();
  console.log('Projects:', JSON.stringify(projects, null, 2));
  await prisma.$disconnect();
}

main();
