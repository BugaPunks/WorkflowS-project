## 1. Fix PUT /api/sprints/:id — field whitelist

- [x] 1.1 Add `sprintUpdateSchema` Zod schema with optional fields: `name`, `description`, `startDate`, `endDate`, `status`
- [x] 1.2 Replace `data: req.body` with destructured parsed fields using conditional spreads (`...(name !== undefined && { name })`)
- [x] 1.3 Add validation error response (400) when no valid fields are provided

## 2. Fix PUT /api/projects/:id — field whitelist

- [x] 2.1 Add `projectUpdateSchema` Zod schema with optional fields: `name`, `description`, `startDate`, `endDate`
- [x] 2.2 Replace `const { startDate, endDate, ...rest } = req.body; data: { ...rest, ... }` with destructured parsed fields
- [x] 2.3 Add validation error response (400) when no valid fields are provided

## 3. Fix PUT /api/user-stories/:id — field whitelist

- [x] 3.1 Add `userStoryUpdateSchema` Zod schema with optional fields: `title`, `description`, `acceptance`, `assigneeId`, `priority`, `storyPoints`, `status`
- [x] 3.2 Replace `Record<string, unknown> = { ...updateData }` with destructured parsed fields
- [x] 3.3 Preserve existing `completedAt` logic for status transitions (COMPLETED → set, BACKLOG → clear)
- [x] 3.4 Add validation error response (400) when no valid fields are provided

## 4. Verification

- [x] 4.1 Verify each endpoint only accepts whitelisted fields (send extra fields, confirm they are ignored)
- [x] 4.2 Verify empty bodies return 400
- [x] 4.3 Verify existing update behavior is preserved for valid fields
- [x] 4.4 Run existing tests to confirm no regressions
