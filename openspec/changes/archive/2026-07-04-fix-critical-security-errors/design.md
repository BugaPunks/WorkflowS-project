## Context

The WorkflowS backend currently has no authentication or authorization mechanisms. The server generates JWT tokens during login but never validates them on subsequent requests. All 13 route files expose their endpoints publicly without any access control. Additionally, JWT secrets are hardcoded, registration allows self-admin assignment, and sensitive data like password hashes are exposed in API responses.

### Role Model (Dual-Level)

The system has **two independent role dimensions** that must be respected by the authorization layer:

**Level 1 — System Role (`User.role`):**
- `ADMIN` — Docente (teacher). Full system access: user management, project creation/deletion, evaluations.
- `TEAM_DEVELOPER` — Estudiante (student) by default at system level.

**Level 2 — Project Role (`ProjectMember.role`):**
- Assigned by the teacher per project when adding members.
- Values: `TEAM_DEVELOPER`, `SCRUM_MASTER`, `PRODUCT_OWNER`.
- A single user can have different project roles in different projects.

**Example from seed data:**
```
Usuario "sm@workflow.com"
├── System-role: TEAM_DEVELOPER
├── Project-role in P1: SCRUM_MASTER
└── Project-role in P2: TEAM_DEVELOPER
```

The authorization middleware must check the **correct dimension** depending on the operation:
- System-wide operations (user management, project CRUD, evaluations) → check `User.role`
- Project-scoped operations (sprints, tasks, stories, chat) → check `ProjectMember.role` for that project

Current state:
- Backend: Express.js with Prisma ORM
- Authentication: JWT tokens generated but not validated
- Authorization: None (frontend has role checks but backend doesn't)
- Security: No rate limiting, no security headers, no input validation

## Goals / Non-Goals

**Goals:**
- Implement JWT authentication middleware that validates tokens on all protected routes
- Add dual-level RBAC: system-level (`User.role`) for admin ops, project-level (`ProjectMember.role`) for project ops
- Remove hardcoded JWT_SECRET and require environment variable configuration
- Eliminate admin role self-registration vulnerability
- Remove password hashes from API responses
- Implement rate limiting on authentication endpoints (login + registration)
- Add security headers (helmet) and restrict CORS origins
- Add input validation and sanitization (including mass assignment prevention)
- Configure secure file uploads (size + type)
- Fix CSV injection in metrics export
- Update frontend to store and send JWT token

**Non-Goals:**
- Implementing OAuth/SSO (out of scope for this change)
- Changing the database schema
- Implementing CSRF protection (JWT in Authorization header, not cookies, eliminates CSRF risk)
- Email verification system
- HTTPS enforcement (assumes reverse proxy in production)

## Decisions

### 1. Authentication Middleware Approach

**Decision**: Create a single `authenticateToken` middleware that validates JWT and attaches user to request object.

**Rationale**: 
- Single responsibility: validates token and adds user context
- Applied per-route or globally with exemptions for public routes
- Alternative considered: Global middleware with route exemptions - rejected because it's harder to maintain exemptions list

**Implementation**:
```typescript
// src/server/middleware/auth.ts
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};
```

### 2. Authorization Middleware Approach (Dual-Level)

**Decision**: Create two separate middleware factories — one for **system-level** RBAC (`User.role`) and one for **project-level** RBAC (`ProjectMember.role`).

**Rationale**:
- The domain has two independent role dimensions that apply to different operations
- System-level: user management, project lifecycle, evaluations (teacher/ADMIN domain)
- Project-level: sprints, tasks, stories, chat, documents (student team domain)
- A user can be `TEAM_DEVELOPER` at system level but `SCRUM_MASTER` within a project
- Alternative considered: Single middleware checking both — rejected because it conflates two concerns and requires every route to know which dimension to check

**Implementation — System-Level RBAC**:
```typescript
// src/server/middleware/system-rbac.ts
export const requireSystemRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.sendStatus(401);
    if (!roles.includes(req.user.role)) return res.sendStatus(403);
    next();
  };
};
```

**Implementation — Project-Level RBAC**:

The middleware accepts an optional **projectId resolver function** because `:id` in different routes refers to different entities (sprint, task, userStory, document), not always a projectId.

```typescript
// src/server/middleware/project-rbac.ts

type ProjectIdResolver = (req: Request) => string | null | Promise<string | null>;

const defaultResolver: ProjectIdResolver = (req) =>
  req.params.projectId || req.params.id || req.body.projectId || null;

export const requireProjectRole = (
  roles: string[],
  resolver: ProjectIdResolver = defaultResolver
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.sendStatus(401);

    // ADMIN bypass: teachers can access any project
    if (req.user.role === "ADMIN") return next();

    const projectId = await resolver(req);
    if (!projectId) return res.status(400).json({ error: "projectId required" });

    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: req.user.userId,
        },
      },
    });

    if (!membership || !roles.includes(membership.role)) {
      return res.sendStatus(403);
    }

    req.projectMembership = membership;
    next();
  };
};
```

**Custom resolvers for routes where `:id` is NOT the projectId:**

```typescript
// PUT /api/sprints/:id  →  :id is sprintId
router.put("/:id",
  authenticateToken,
  requireProjectRole(
    ["SCRUM_MASTER", "PRODUCT_OWNER"],
    async (req) => {
      const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id } });
      return sprint?.projectId ?? null;
    }
  ),
  handler
);

// PUT /api/tasks/:id  →  :id is taskId (POST /evaluate is ADMIN-only via requireSystemRole)
router.put("/:id",
  authenticateToken,
  requireProjectRole(
    ["TEAM_DEVELOPER", "SCRUM_MASTER", "PRODUCT_OWNER"],
    async (req) => {
      const task = await prisma.task.findUnique({ where: { id: req.params.id } });
      return task?.projectId ?? null;
    }
  ),
  handler
);

// PUT /api/user-stories/:id  →  :id is userStoryId
router.put("/:id",
  authenticateToken,
  requireProjectRole(
    ["PRODUCT_OWNER", "SCRUM_MASTER"],
    async (req) => {
      const us = await prisma.userStory.findUnique({ where: { id: req.params.id } });
      return us?.projectId ?? null;
    }
  ),
  handler
);

// DELETE /api/documents/:id  →  :id is documentId
router.delete("/:id",
  authenticateToken,
  requireProjectRole(
    ["SCRUM_MASTER", "PRODUCT_OWNER"],
    async (req) => {
      const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
      return doc?.projectId ?? null;
    }
  ),
  handler
);
```

**Permissions Matrix (per endpoint)**:

| Method | Endpoint | Middleware | Allowed Roles | Dimension |
|--------|----------|-----------|---------------|-----------|
| POST | `/api/auth/register` | public | — | — |
| POST | `/api/auth/login` | public (rate-limited) | — | — |
| POST | `/api/auth/logout` | `authenticateToken` | any authenticated | system |
| GET | `/api/users` | `requireSystemRole` | ADMIN | system |
| GET | `/api/users/:id` | `requireSystemRole` | ADMIN | system |
| POST | `/api/users` | `requireSystemRole` | ADMIN | system |
| PUT | `/api/users/:id` | `requireSystemRole` | ADMIN | system |
| DELETE | `/api/users/:id` | `requireSystemRole` | ADMIN | system |
| GET | `/api/projects` | `authenticateToken` | any authenticated | system |
| GET | `/api/projects/:id` | `authenticateToken` | any authenticated | system |
| POST | `/api/projects` | `requireSystemRole` | ADMIN | system |
| PUT | `/api/projects/:id` | `requireSystemRole` | ADMIN | system |
| DELETE | `/api/projects/:id` | `requireSystemRole` | ADMIN | system |
| POST | `/api/projects/:id/members` | `requireSystemRole` | ADMIN | system |
| DELETE | `/api/projects/:id/members/:userId` | `requireSystemRole` | ADMIN | system |
| GET | `/api/sprints` | `authenticateToken` | any authenticated | system |
| POST | `/api/sprints` | `requireProjectRole` | SCRUM_MASTER, PRODUCT_OWNER | project |
| PUT | `/api/sprints/:id` | `requireProjectRole` | SCRUM_MASTER, PRODUCT_OWNER | project |
| DELETE | `/api/sprints/:id` | `requireSystemRole` | ADMIN | system |
| POST | `/api/sprints/:id/add-story` | `requireProjectRole` | SCRUM_MASTER, PRODUCT_OWNER | project |
| GET | `/api/tasks` | `authenticateToken` | any authenticated | system |
| POST | `/api/tasks` | `requireProjectRole` | TEAM_DEVELOPER, SCRUM_MASTER, PRODUCT_OWNER | project |
| PUT | `/api/tasks/:id` | `requireProjectRole` | TEAM_DEVELOPER, SCRUM_MASTER, PRODUCT_OWNER | project |
| DELETE | `/api/tasks/:id` | `requireSystemRole` | ADMIN | system |
| POST | `/api/tasks/:id/evaluate` | `requireSystemRole` | ADMIN | system |
| GET | `/api/user-stories` | `authenticateToken` | any authenticated | system |
| POST | `/api/user-stories` | `requireProjectRole` | PRODUCT_OWNER, SCRUM_MASTER | project |
| PUT | `/api/user-stories/:id` | `requireProjectRole` | PRODUCT_OWNER, SCRUM_MASTER | project |
| DELETE | `/api/user-stories/:id` | `requireSystemRole` | ADMIN | system |
| POST | `/api/evaluations` | `requireSystemRole` | ADMIN | system |
| PUT | `/api/evaluations/:id` | `requireSystemRole` | ADMIN | system |
| POST | `/api/rubrics` | `requireSystemRole` | ADMIN | system |
| PUT | `/api/rubrics/:id` | `requireSystemRole` | ADMIN | system |
| DELETE | `/api/rubrics/:id` | `requireSystemRole` | ADMIN | system |
| POST | `/api/documents/:projectId` | `requireProjectRole` | TEAM_DEVELOPER, SCRUM_MASTER, PRODUCT_OWNER | project |
| DELETE | `/api/documents/:id` | `requireProjectRole` | SCRUM_MASTER, PRODUCT_OWNER | project |
| POST | `/api/chat/:projectId/messages` | `requireProjectRole` | TEAM_DEVELOPER, SCRUM_MASTER, PRODUCT_OWNER | project |
| GET | `/api/metrics/sprints/:sprintId/burndown` | `authenticateToken` | any authenticated | system |
| GET | `/api/metrics/projects/:projectId/contribution` | `authenticateToken` | any authenticated | system |
| GET | `/api/metrics/projects/:projectId/velocity` | `authenticateToken` | any authenticated | system |
| GET | `/api/metrics/export/projects/:projectId` | `requireSystemRole` | ADMIN | system |
| GET | `/api/notifications` | `authenticateToken` + owner check | same user or ADMIN | system |
| PUT | `/api/notifications/:id/read` | `authenticateToken` + owner check | same user or ADMIN | system |
| GET | `/api/retrospectives/:sprintId` | `requireProjectRole` | TEAM_DEVELOPER, SCRUM_MASTER, PRODUCT_OWNER | project (resolve via sprint) |
| POST | `/api/retrospectives` | `requireProjectRole` | TEAM_DEVELOPER, SCRUM_MASTER, PRODUCT_OWNER | project (resolve via sprint) |
| DELETE | `/api/retrospectives/:id` | `requireProjectRole` | TEAM_DEVELOPER, SCRUM_MASTER, PRODUCT_OWNER | project (resolve via item→sprint) |

**ADMIN bypass**: The `requireProjectRole` middleware grants access if `req.user.role === "ADMIN"` (see `if (req.user.role === "ADMIN") return next();` above), since teachers need visibility into all projects without being formal `ProjectMember` records.

**Owner check** (notifications): Routes like `GET /api/notifications` and `PUT /api/notifications/:id/read` need a resource ownership check — a user can only see their own notifications. This is handled by comparing `req.query.userId` (or the notification's userId) against `req.user.userId`, with ADMIN bypass.

### 3. Frontend Token Management

**Decision**: Store JWT in `localStorage` and inject it into all API requests via the existing `api/client.ts`.

**Rationale**:
- The existing `useSession.tsx` already uses `localStorage` for user data; extending it to store the token is consistent
- The `api/client.ts` is the single entry point for all backend calls — adding the `Authorization` header there avoids duplicating logic in every component
- `localStorage` is accessible to any JavaScript in the same origin; XSS prevention via CSP (helmet) mitigates this risk

**Changes to `useSession.tsx`**:
```typescript
const login = (userData: User, token: string) => {
  // Store both user data and token
  localStorage.setItem("user", JSON.stringify(userData));
  localStorage.setItem("token", token);
  setSession(userData);
};
```

**Changes to `api/client.ts`**:
```typescript
async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  // ... rest remains the same
}
```

### 4. Input Validation Strategy

**Decision**: Use Zod for runtime validation and TypeScript interfaces for type safety.

**Rationale**:
- Zod provides runtime validation with TypeScript integration
- Can generate validation schemas from TypeScript types
- Alternative considered: Manual validation - rejected for verbosity and error-prone

**Implementation**:
```typescript
// Example for user registration
const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  // Role removed - handled server-side
});
```

### 5. Rate Limiting Strategy

**Decision**: Use express-rate-limit with different limits for different endpoint categories.

**Rationale**:
- Login endpoint: stricter limits (5 attempts per 15 minutes)
- Registration endpoint: moderate limits (10 attempts per hour)
- General API endpoints: moderate limits (100 requests per 15 minutes)
- Alternative considered: Fixed limits for all - rejected for poor UX on registration

### 6. Security Headers & CORS

**Decision**: Use helmet with default configuration plus custom CSP. Restrict CORS to configured origins.

**Rationale**:
- Helmet provides industry-standard security headers
- Default configuration is secure for most applications
- Custom CSP needed for frontend assets
- CORS should be restricted via environment variable `CORS_ORIGINS` instead of wide-open `app.use(cors())`

**Implementation**:
```typescript
const corsOrigins = process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"];
app.use(cors({ origin: corsOrigins }));
app.use(helmet());
```

### 7. Authenticated File Serving

**Decision**: Replace public `express.static("uploads")` with an authenticated download endpoint `GET /api/files/:filename`.

**Rationale**:
- Currently any file in `/uploads` is publicly accessible to anyone who knows the URL (`index.ts:34`)
- The filename includes a random suffix, but this is security by obscurity, not real access control
- Files contain project data (documents, reports) that should be restricted to project members and teachers
- The `Document` model already links files to projects via `projectId`, making authorization checks straightforward

**Implementation**:

1. Remove public static serving from `src/server/index.ts`:
```typescript
// DELETE this line:
// app.use("/uploads", express.static("uploads"));
```

2. Add authenticated download endpoint to `src/server/routes/documents.ts`:
```typescript
import path from "node:path";
import fs from "node:fs";

router.get("/download/:filename",
  authenticateToken,
  async (req, res) => {
    const { filename } = req.params;
    const filePath = path.join("uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }

    // Find the document by matching the filename portion of its stored URL
    const document = await prisma.document.findFirst({
      where: { url: { contains: filename } },
    });

    if (!document) {
      return res.status(404).json({ error: "Documento no encontrado" });
    }

    // Check project access (ADMIN bypass for teachers)
    if (req.user.role !== "ADMIN") {
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: document.projectId,
            userId: req.user.userId,
          },
        },
      });
      if (!membership) return res.sendStatus(403);
    }

    res.sendFile(path.resolve(filePath));
  },
);
```

3. Update URL construction for new uploads in the POST handlers:
```typescript
// Instead of full external URL, store API path:
const url = `/api/files/${file.filename}`;
```

**Permissions matrix addition**:

| Method | Endpoint | Middleware | Allowed Roles | Dimension |
|--------|----------|-----------|---------------|-----------|
| GET | `/api/files/:filename` | `authenticateToken` + project check | project member or ADMIN | project (resolve via document DB lookup) |

### 8. CSV Injection Fix

**Decision**: Sanitize cell values in CSV export to prevent formula injection.

**Implementation**:
```typescript
const sanitizeCsvCell = (value: string): string => {
  const dangerous = ["=", "+", "-", "@", "\t", "\n"];
  if (dangerous.some((c) => value.startsWith(c))) {
    return `'${value}`;
  }
  return value;
};
```

## Risks / Trade-offs

**Risk: Breaking existing API clients**
- All protected endpoints now require authentication
- Frontend must be updated to include JWT in requests
- **Mitigation**: Implement in phases: auth first, then frontend updates

**Risk: Performance impact**
- JWT validation on every request adds overhead
- Project-level RBAC requires a DB query for membership lookup
- Rate limiting requires in-memory store (not distributed)
- **Mitigation**: JWT validation is fast; use Redis for rate limiting and cache membership lookups in production

**Risk: Overly restrictive RBAC**
- May block legitimate user actions
- **Mitigation**: Start with minimum restrictions defined in the permissions matrix, expand based on usage patterns

**Risk: Zod validation complexity**
- Learning curve for team
- **Mitigation**: Create validation utilities and examples

**Risk: Project-level RBAC requires `projectId` resolution**
- Routes like `PUT /api/sprints/:id` have `:id` as sprintId, not projectId
- Requires an additional DB query to resolve the parent project before checking membership
- **Mitigation**: Custom resolver function per route; the overhead is minimal (one extra `findUnique` per request)

## Migration Plan

**Phase 1: Backend Authentication (Day 1-2)**
1. Add JWT_SECRET to environment variables (required)
2. Create authentication middleware
3. Apply to all protected routes
4. Update frontend to store and send JWT token

**Phase 2: Authorization (Day 3-4)**
1. Create `requireSystemRole` middleware
2. Create `requireProjectRole` middleware
3. Apply RBAC per the permissions matrix
4. Update frontend to handle 401/403 responses

**Phase 3: Security Hardening (Day 5-8)**
1. Add helmet and rate limiting
2. Add CORS configuration
3. Implement input validation with Zod
4. Fix password exposure and logging issues
5. Secure file uploads (size + type limits)
6. Replace public `express.static("uploads")` with authenticated download endpoint
7. Fix CSV injection in metrics export
8. End-to-end testing of auth + RBAC

**Rollback Strategy**:
- Keep old routes as fallback during transition
- Use feature flags to toggle new security measures
- Monitor error rates for authentication failures