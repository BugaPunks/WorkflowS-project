## Context

Three PUT endpoints accept arbitrary request body fields and pass them to Prisma. An attacker can modify fields like `projectId`, `id`, `assigneeId` (on wrong endpoint), or any other model field by simply including it in the JSON body.

Current vulnerable code:

```typescript
// sprints.ts — data: req.body (entire body passed to Prisma)
router.put("/:id", ..., async (req, res) => {
  const sprint = await prisma.sprint.update({
    where: { id: req.params.id },
    data: req.body,   // ← mass assignment
  });
});

// projects.ts — ...rest spread (everything except startDate/endDate)
router.put("/:id", ..., async (req, res) => {
  const { startDate, endDate, ...rest } = req.body;
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: { ...rest, ... },  // ← mass assignment via spread
  });
});

// user-stories.ts — Record<string, unknown> spread
router.put("/:id", ..., async (req, res) => {
  const { status, ...updateData } = req.body;
  const dataToUpdate: Record<string, unknown> = { ...updateData };  // ← mass assignment
  ...
});
```

## Goals / Non-Goals

**Goals:**
- Prevent mass assignment in PUT /sprints/:id, PUT /projects/:id, PUT /user-stories/:id
- Whitelist only the fields each endpoint is supposed to accept
- Keep existing behavior for accepted fields

**Non-Goals:**
- Not modifying routes that already use Zod schemas (POST endpoints in these files are already safe)
- Not adding XSS sanitization or error detail cleanup (separate proposal)
- Not modifying GET, POST, DELETE endpoints

## Decisions

### Decision 1: Zod schemas with destructuring (not `pick`)

Use the same pattern as existing POST schemas: define a Zod schema per endpoint, parse with `safeParse`, then destructure only the needed fields.

```typescript
// sprints.ts
const sprintUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
});

router.put("/:id", ..., async (req, res) => {
  const parsed = sprintUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  const { name, description, startDate, endDate, status } = parsed.data;

  const sprint = await prisma.sprint.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: new Date(endDate) }),
      ...(status !== undefined && { status }),
    },
  });
});
```

**Alternatives considered:**
- **`omit` from Prisma**: Prisma doesn't have built-in field omit for updates
- **Manual whitelist via array filter**: More verbose and error-prone than Zod
- **`partial()` on existing schemas**: Possible but requires more refactoring; keeping separate update schemas is clearer

### Decision 2: All fields optional in update schemas

Update schemas use `.optional()` on every field since PUT is a partial update (PATCH-style). Required fields only apply to POST (creation).

### Decision 3: Extra fields silently dropped

Zod ignores extra fields by default (no `strip` needed). This is safe: unknown fields are discarded, not rejected. No breaking change for well-behaved clients.

## Risks / Trade-offs

**Risk: Date format validation**
- Date strings are passed through without format validation (just via `new Date()`)
- **Mitigation**: Prisma will reject invalid dates at the database level; the error is caught by the existing try/catch

**Risk: Behavior change for status transitions**
- `sprints.ts` PUT currently handles status updates; the new schema accepts `status` as-is
- `user-stories.ts` PUT handles `completedAt` logic when status changes to COMPLETED/DONE — this logic stays untouched
- **Mitigation**: No behavior change; only the body parsing changes

**Risk: Client sends unexpected fields that were previously ignored**
- Previously `data: req.body` would persist extra fields to the database (if they matched Prisma fields)
- Now extra fields are dropped
- **Mitigation**: This is the desired fix — fields that shouldn't be modifiable are no longer accepted
