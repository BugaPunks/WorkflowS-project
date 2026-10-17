import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: "admin@workflow.com" } });
  const dev1 = await prisma.user.findUnique({ where: { email: "dev1@workflow.com" } });
  const dev2 = await prisma.user.findUnique({ where: { email: "dev2@workflow.com" } });
  const sm = await prisma.user.findUnique({ where: { email: "sm@workflow.com" } });
  const po = await prisma.user.findUnique({ where: { email: "po@workflow.com" } });

  if (!admin || !dev1 || !dev2 || !sm || !po) {
    throw new Error("Faltan usuarios base. Ejecuta primero el seed principal.");
  }

  const members = [
    { user: dev1, role: "TEAM_DEVELOPER" },
    { user: dev2, role: "TEAM_DEVELOPER" },
    { user: sm, role: "SCRUM_MASTER" },
    { user: po, role: "PRODUCT_OWNER" },
  ];

  const project = await prisma.project.create({
    data: {
      name: "Proyecto 4 Sprints",
      description: "Proyecto creado para pruebas con 4 sprints (3 completados).",
      status: "ACTIVE",
      ownerId: admin.id,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-04-30"),
      members: {
        create: members.map((m) => ({ userId: m.user.id, role: m.role })),
      },
    },
  });

  const sprintStarts = [
    new Date("2026-01-01"),
    new Date("2026-01-15"),
    new Date("2026-01-29"),
    new Date("2026-02-12"),
  ];
  const sprintEnds = [
    new Date("2026-01-14"),
    new Date("2026-01-28"),
    new Date("2026-02-11"),
    new Date("2026-02-25"),
  ];

  for (let i = 1; i <= 4; i++) {
    const completed = i <= 3;
    const sprint = await prisma.sprint.create({
      data: {
        projectId: project.id,
        name: `Sprint ${i}`,
        description: `Sprint número ${i}`,
        status: completed ? "COMPLETED" : "ACTIVE",
        startDate: sprintStarts[i - 1],
        endDate: sprintEnds[i - 1],
      },
    });

    for (let h = 1; h <= 2; h++) {
      const story = await prisma.userStory.create({
        data: {
          projectId: project.id,
          sprintId: sprint.id,
          title: `Historia ${h} - Sprint ${i}`,
          description: `Historia de usuario ${h} del sprint ${i}`,
          priority: "HIGH",
          storyPoints: 5,
          status: completed ? "COMPLETED" : "IN_PROGRESS",
          assigneeId: members[(h - 1) % members.length].user.id,
          completedAt: completed ? new Date() : undefined,
        },
      });

      for (const m of members) {
        await prisma.task.create({
          data: {
            projectId: project.id,
            sprintId: sprint.id,
            userStoryId: story.id,
            title: `Tarea de ${m.user.name} - HU ${h}`,
            description: `Tarea asignada a ${m.user.name}`,
            priority: "MEDIUM",
            status: completed ? "COMPLETED" : "TODO",
            assigneeId: m.user.id,
            deadline: sprintEnds[i - 1],
            completedAt: completed ? new Date() : undefined,
          },
        });
      }
    }
  }

  console.log(`✅ Proyecto creado: ${project.name} (${project.id})`);
  console.log("   - 4 sprints (3 completados, 1 activo)");
  console.log("   - 2 HU por sprint");
  console.log("   - 4 tareas por HU (una por usuario)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
