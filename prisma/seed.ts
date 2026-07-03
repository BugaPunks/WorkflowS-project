import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;

let adapter;
if (connectionString?.startsWith('postgresql')) {
  adapter = new PrismaPg(new Pool({ connectionString }));
} else if (connectionString?.startsWith('file:')) {
  adapter = new PrismaBetterSqlite3({ url: connectionString });
}

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
  ...(adapter && { adapter }),
});

async function main() {
  console.log('🌱 Starting COMPREHENSIVE seed (Enhanced for Doc Mgmt)...');

  // --- 1. USERS ---
  const password = await bcrypt.hash('password123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@workflow.com' },
    update: {},
    create: {
      email: 'admin@workflow.com',
      name: 'Admin Docente',
      password: adminPassword,
      role: 'ADMIN',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
    },
  });

  const users = [
    { email: 'dev1@workflow.com', name: 'Ana Developer', role: 'TEAM_DEVELOPER' },
    { email: 'dev2@workflow.com', name: 'Carlos Backend', role: 'TEAM_DEVELOPER' },
    { email: 'sm@workflow.com', name: 'Sarah Master', role: 'TEAM_DEVELOPER' },
    { email: 'po@workflow.com', name: 'Pedro Owner', role: 'TEAM_DEVELOPER' },
  ];

  const createdUsers = [];
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        password,
        role: u.role,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name.replace(' ', '')}`,
      },
    });
    createdUsers.push(user);
  }

  const [dev1, dev2, sm, po] = createdUsers;

  // --- 2. GLOBAL RUBRIC ---
  const globalRubric = await prisma.rubric.create({
    data: {
      name: 'Rúbrica General de Desarrollo ' + Date.now(),
      description: 'Estándares de calidad de código y documentación',
      criteria: {
        create: [
          { name: 'Calidad de Código', description: 'Clean Code, patrones de diseño', maxScore: 40, weight: 4 },
          { name: 'Documentación', description: 'Comentarios y documentación técnica', maxScore: 30, weight: 3 },
          { name: 'Testing', description: 'Cobertura de pruebas unitarias', maxScore: 30, weight: 3 },
        ],
      },
    },
    include: { criteria: true }
  });

   // --- 3. PROJECT 1: Sistema de Gestión Académica (ACTIVE) ---
   const project1 = await prisma.project.create({
     data: {
       name: 'Sistema de Gestión Académica ' + Date.now(),
       description: 'Plataforma para gestión de notas y asistencia',
       status: 'ACTIVE',
       ownerId: admin.id,
       startDate: new Date('2026-04-10'),
        endDate: new Date('2026-07-15'),
      members: {
        create: [
          { userId: dev1.id, role: 'TEAM_DEVELOPER' },
          { userId: dev2.id, role: 'TEAM_DEVELOPER' },
          { userId: sm.id, role: 'SCRUM_MASTER' },
          { userId: po.id, role: 'PRODUCT_OWNER' },
        ],
      },
    },
  });

  // 3a. Project 1 Documents (Enhanced Versioning)
  // 3a.1 Spec Chain (3 versions)
  const docSpecV1 = await prisma.document.create({
    data: {
      projectId: project1.id,
      name: 'Especificación_Requisitos_v1.pdf',
      url: 'https://example.com/sga/specs/v1.pdf',
      type: 'application/pdf',
      size: 2048,
      version: 1,
    }
  });

  const docSpecV2 = await prisma.document.create({
    data: {
      projectId: project1.id,
      name: 'Especificación_Requisitos_v2.pdf',
      url: 'https://example.com/sga/specs/v2.pdf',
      type: 'application/pdf',
      size: 2500,
      version: 2,
      parentId: docSpecV1.id,
    }
  });

  await prisma.document.create({
    data: {
      projectId: project1.id,
      name: 'Especificación_Requisitos_FINAL.pdf',
      url: 'https://example.com/sga/specs/final.pdf',
      type: 'application/pdf',
      size: 3100,
      version: 3,
      parentId: docSpecV2.id,
    }
  });

  // 3a.2 Architecture Diagrams (Single versions)
  await prisma.document.create({
    data: {
      projectId: project1.id,
      name: 'Diagrama_Clases.png',
      url: 'https://example.com/sga/diagrams/classes.png',
      type: 'image/png',
      size: 500,
      version: 1,
    }
  });

  await prisma.document.create({
    data: {
      projectId: project1.id,
      name: 'Diagrama_ER.png',
      url: 'https://example.com/sga/diagrams/er.png',
      type: 'image/png',
      size: 550,
      version: 1,
    }
  });

  // 3a.3 Technical Guides (DOCX)
  await prisma.document.create({
    data: {
      projectId: project1.id,
      name: 'Guia_Instalacion.docx',
      url: 'https://example.com/sga/docs/install.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 1500,
      version: 1,
    }
  });

  // 3b. Project 1 Chat
  await prisma.chat.create({
    data: {
      projectId: project1.id,
      type: 'PROJECT',
      title: 'General SGA',
      participants: {
        create: [
          { userId: dev1.id },
          { userId: dev2.id },
          { userId: sm.id },
          { userId: po.id },
        ]
      },
      messages: {
        create: [
          { userId: po.id, content: 'Bienvenidos al proyecto SGA. El objetivo es entregar el MVP en 2 meses.' },
          { userId: sm.id, content: 'Entendido. Empezamos con el Sprint 1 mañana.' },
          { userId: dev1.id, content: 'Listo para empezar con el backend.' },
        ]
      }
    }
  });

  // 3c. Project 1 Rubric
  const p1Rubric = await prisma.rubric.create({
    data: {
      projectId: project1.id,
      name: 'Rúbrica de Backend SGA',
      description: 'Evaluación específica del módulo de backend',
      criteria: {
        create: [
          { name: 'API RESTful', description: 'Diseño correcto de endpoints', maxScore: 50, weight: 5 },
          { name: 'Seguridad', description: 'Implementación de JWT y roles', maxScore: 50, weight: 5 },
        ],
      },
    },
    include: { criteria: true }
  });

  // 3d. Sprint 1 (Completed) & Retrospectives
   const sprint1 = await prisma.sprint.create({
     data: {
       projectId: project1.id,
       name: 'Sprint 1: Autenticación',
       description: 'Implementación del sistema de login y roles',
       status: 'COMPLETED',
       startDate: new Date('2026-04-12'),
       endDate: new Date('2026-04-26'),
     },
   });

  // Retrospectives for Sprint 1
  await prisma.retrospectiveItem.createMany({
    data: [
      { sprintId: sprint1.id, userId: dev1.id, type: 'GOOD', content: 'Logramos implementar JWT a tiempo.' },
      { sprintId: sprint1.id, userId: dev2.id, type: 'BAD', content: 'La documentación de la API se retrasó.' },
      { sprintId: sprint1.id, userId: sm.id, type: 'ACTION', content: 'Mejorar la comunicación en las dailies.' },
    ]
  });

  // 3e. Stories & Tasks Sprint 1
   const story1 = await prisma.userStory.create({
     data: {
       projectId: project1.id,
       sprintId: sprint1.id,
       title: 'Login de Usuarios',
       description: 'Como usuario quiero loguearme para acceder al sistema',
       priority: 'HIGH',
        storyPoints: 5,
        status: 'COMPLETED',
        completedAt: new Date('2026-04-23'),
        assigneeId: dev1.id,
     },
   });

   const task1 = await prisma.task.create({
     data: {
       projectId: project1.id,
       sprintId: sprint1.id,
       userStoryId: story1.id,
       title: 'Diseñar tabla de usuarios',
       status: 'COMPLETED',
       priority: 'HIGH',
       assigneeId: dev1.id,
       completedAt: new Date('2026-04-18'),
        deadline: new Date('2026-04-23'),
     },
   });

  // 3f. Evaluations (Task & Sprint)
  if (globalRubric.criteria.length > 0) {
      await prisma.evaluation.create({
        data: {
          projectId: project1.id,
          taskId: task1.id,
          evaluatorId: admin.id,
          status: 'COMPLETED',
          score: 90,
          feedback: 'Buen diseño de base de datos, faltaron índices.',
          criteria: {
            create: [
              { criteriaId: globalRubric.criteria[0].id, score: 90, comment: 'Casi perfecto' },
            ],
          },
        },
      });
  }

  if (p1Rubric.criteria.length >= 2) {
      await prisma.evaluation.create({
        data: {
            projectId: project1.id,
            sprintId: sprint1.id,
            evaluatorId: admin.id,
            status: 'COMPLETED',
            score: 85,
            feedback: 'Buen sprint, pero se entregó un día tarde.',
            criteria: {
                create: [
                    { criteriaId: p1Rubric.criteria[0].id, score: 80, comment: 'API bien documentada' },
                    { criteriaId: p1Rubric.criteria[1].id, score: 90, comment: 'Seguridad robusta' }
                ]
            }
        }
      });
  }

   // 3g. Sprint 2 (Active)
   const sprint2 = await prisma.sprint.create({
     data: {
       projectId: project1.id,
       name: 'Sprint 2: Dashboard',
       description: 'Panel principal para alumnos y docentes',
       status: 'ACTIVE',
       startDate: new Date('2026-04-27'),
        endDate: new Date('2026-05-11'),
     },
   });

   const story2 = await prisma.userStory.create({
     data: {
       projectId: project1.id,
       sprintId: sprint2.id,
       title: 'Ver calificaciones',
       description: 'Como alumno quiero ver mis notas',
       priority: 'MEDIUM',
       storyPoints: 8,
       status: 'IN_PROGRESS',
       assigneeId: dev2.id,
     },
   });

   await prisma.task.create({
     data: {
       projectId: project1.id,
       sprintId: sprint2.id,
       userStoryId: story2.id,
       title: 'Frontend Componente Tabla',
       status: 'IN_PROGRESS',
       assigneeId: dev2.id,
       deadline: new Date('2026-05-08'),
     },
   });

   // --- 4. PROJECT 2: E-Commerce App (PLANNING) ---
   const project2 = await prisma.project.create({
     data: {
       name: 'App de Comercio Electrónico ' + Date.now(),
       description: 'Tienda en línea con carrito de compras',
       status: 'ACTIVE',
       ownerId: admin.id,
       startDate: new Date('2026-04-20'),
        endDate: new Date('2026-07-20'),
      members: {
        create: [
          { userId: dev1.id, role: 'PRODUCT_OWNER' },
          { userId: sm.id, role: 'TEAM_DEVELOPER' },
        ],
      },
    },
  });

  // 4a. Documents for Project 2
  await prisma.document.create({
    data: {
      projectId: project2.id,
      name: 'Wireframes_Home.fig',
      url: 'https://example.com/ecommerce/wireframes.fig',
      type: 'application/octet-stream',
      size: 5000,
      version: 1,
    }
  });

  await prisma.userStory.create({
    data: {
      projectId: project2.id,
      title: 'Catálogo de Productos',
      description: 'Listado de productos con filtros',
      priority: 'HIGH',
      status: 'BACKLOG',
      storyPoints: 13,
    },
  });

   await prisma.userStory.create({
    data: {
      projectId: project2.id,
      title: 'Carrito de Compras',
      description: 'Persistencia del carrito',
      priority: 'HIGH',
      status: 'BACKLOG',
    },
  });

  // --- 5. DIRECT MESSAGING & NOTIFICATIONS ---

  // Direct Chat (DM) between Dev1 and Scrum Master
  await prisma.chat.create({
    data: {
      type: 'DIRECT',
      participants: {
        create: [
          { userId: dev1.id },
          { userId: sm.id }
        ]
      },
      messages: {
        create: [
          { userId: sm.id, content: 'Hola Ana, ¿cómo vas con el login?' },
          { userId: dev1.id, content: 'Todo bien, ya casi termino los tests.' }
        ]
      }
    }
  });

  // Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: dev1.id,
        title: 'Nueva Tarea Asignada',
        message: 'Se te ha asignado la tarea: Diseñar tabla de usuarios',
        type: 'TASK_ASSIGNED',
        read: true
      },
      {
        userId: dev1.id,
        title: 'Evaluación Completada',
        message: 'Tu tarea "Diseñar tabla de usuarios" ha sido calificada.',
        type: 'EVALUATION_COMPLETED',
        read: false
      },
      {
        userId: sm.id,
        title: 'Nuevo Mensaje',
        message: 'Ana Developer te ha enviado un mensaje.',
        type: 'MESSAGE',
        read: false
      }
    ]
  });

  console.log('✅ Comprehensive Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
