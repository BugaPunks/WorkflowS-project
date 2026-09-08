## Why

Three PUT endpoints pass `req.body` directly to Prisma without field whitelisting (mass assignment). An attacker can send unexpected fields (e.g., `projectId`, `id`) in update requests to modify data they should not control. This is the last remaining high-severity finding (A-1) from the security analysis.

## What Changes

- **BREAKING**: Add Zod schemas for PUT bodies in `sprints.ts`, `projects.ts`, `user-stories.ts` with explicit field whitelisting
- Replace raw `data: req.body` and `data: { ...rest }` patterns with destructured, validated fields
- Only writable fields are accepted; extra fields are silently ignored or rejected

## Capabilities

### New Capabilities
- `input-sanitization`: Zod validation schemas for PUT endpoints to prevent mass assignment attacks

### Modified Capabilities

_(none)_

## Impact

**Affected Code:**
- `src/server/routes/sprints.ts` — PUT `/:id`: replace `data: req.body` with validated fields
- `src/server/routes/projects.ts` — PUT `/:id`: replace `data: { ...rest }` with validated fields
- `src/server/routes/user-stories.ts` — PUT `/:id`: replace `Record<string, unknown>` spread with validated fields

**API Changes:**
- PUT `/api/sprints/:id`: only `name`, `description`, `startDate`, `endDate`, `status` accepted
- PUT `/api/projects/:id`: only `name`, `description`, `startDate`, `endDate` accepted
- PUT `/api/user-stories/:id`: only `title`, `description`, `acceptance`, `assigneeId`, `priority`, `storyPoints`, `status` accepted
- Extra fields in any PUT body are silently dropped (safe destructuring)

**Dependencies:**
- Zod already available in the project (no new deps needed)

**Systems:**
- Backend input validation layer
