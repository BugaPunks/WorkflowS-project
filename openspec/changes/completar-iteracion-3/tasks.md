## 1. Preparation and safety

- [x] 1.1 Copy `dev.db` to `dev.db.bak-iteracion3` and confirm the copy opens with `npx prisma studio` (read-only check)
- [x] 1.2 Grep `prisma/seed.ts`, `e2e/` and `src/` for notification type literals (`TASK_ASSIGNED`, `MESSAGE`, `PROJECT_ASSIGNED`, `RETROSPECTIVE_ITEM`, `EVALUATION_COMPLETED`) and record every place that writes `Notification.type`
- [x] 1.3 Run the full E2E suite once and record the baseline (`npx playwright test`) so regressions are attributable
- [x] 1.4 Record the corrected RF numbering in `docs/iteracion3.md` §3 before touching code: RF8 = Métricas y Reportes, RF9.2/RF9.3 = Notificaciones, dashboard = HU-10; note that the traceability matrix entries `RF12.1*` and `RF10.1*` are placeholders to be unified

## 2. Schema and migrations

- [x] 2.1 Convert `Notification.type` from `String` to a Prisma enum with the seven types (`TASK_ASSIGNED`, `USER_STORY_ASSIGNED`, `EVALUATION_COMPLETED`, `MESSAGE`, `PROJECT_ASSIGNED`, `RETROSPECTIVE_ITEM`, `SPRINT_COMPLETED`), keeping `@map("notifications")`
- [x] 2.2 Add `entityType String?` and `entityId String?` to `Notification` (design D7)
- [x] 2.3 Add the `NotificationPreference` model (`userId`, `type`, `enabled`, unique on `userId`+`type`, relation to `User` with cascade delete, `@@map("notification_preferences")`) (design D3)
- [x] 2.4 Add `dashboardModules String?` to `User` for the visible-module configuration (design D9)
- [x] 2.5 Run `npx prisma migrate dev --name iteracion3_notifications_and_dashboard` and inspect the generated SQL before applying
- [x] 2.6 Verify the existing seeded notifications migrate without loss (`npx prisma migrate status` and a row count on `notifications`)

## 3. Defect fixes (restore intended behaviour)

- [x] 3.1 Change `description` to `z.string().min(1)` in `src/server/routes/user-stories.ts` create and update schemas so a missing description returns 400 instead of 500
- [x] 3.2 Guard the burn-down day computation against `daysDiff <= 0`: return an empty series when the end date precedes the start, and a single point with `ideal = totalPoints` when both dates fall on the same calendar day; no `NaN` or `Infinity` may reach the response (design D5, spec `metrics-computation`)
- [x] 3.3 Replace the truthiness checks at `src/pages/ProjectDetail.tsx:1074` and `:1178` with a null check so a story with 0 story points renders the value
- [x] 3.4 Re-run `npx playwright test` and confirm 44/44 still green after the `description` change (design risk: 500 → 400)

## 4. Metrics extraction and unit tests (deliverable §5/§7a)

- [x] 4.1 Install `vitest` as a devDependency and add `"test:unit": "vitest run"` plus `"test:unit:watch": "vitest"` to `package.json`
- [x] 4.2 Add `src/server/lib/metrics.ts` with pure `computeBurndown(sprint)`, `computeVelocity(sprints)` and `computeContribution(tasks)` taking and returning plain data, with no Prisma import
- [x] 4.3 Move the burn-down arithmetic from `src/server/routes/metrics.ts:35-82` into `computeBurndown` and make the route a thin loader/delegator
- [x] 4.4 Move the velocity computation from `src/server/routes/metrics.ts:147-171` into `computeVelocity`, ordering dated sprints ascending and keeping undated sprints after them
- [x] 4.5 Move the contribution computation from `src/server/routes/metrics.ts:90-137` into `computeContribution`, omitting members with no completed tasks and reporting unassigned completed tasks separately
- [x] 4.6 Write `src/server/lib/metrics.test.ts` covering the §7a case: 100 total points over 10 elapsed days yields exactly 50 at day index 5
- [x] 4.7 Cover day-index semantics: 9 elapsed days produce 10 points indexed 0-9, and the ideal value at the final index is 0
- [x] 4.8 Cover the actual line: a 40-point story completed on day 3 gives 60 from day 3 onward; future indices report null; a story completed before the sprint start is excluded from day 0; no actual value is negative
- [x] 4.9 Cover degenerate inputs: same-day sprint, end date before start date, sprint without dates, sprint without stories
- [x] 4.10 Cover velocity and contribution: committed vs completed, ordering by start date, empty project, member with no completed tasks, tasks counted only for the requested project
- [x] 4.11 Run `npm run test:unit` and confirm all cases pass

## 5. Notification preferences (RF9.3)

- [x] 5.1 Create `src/server/lib/notify.ts` exporting `notify({ userId, type, title, message, entityType?, entityId? })` that resolves the recipient's preference and persists only when the type is enabled (design D1)
- [x] 5.2 Add `GET /api/notifications/preferences` returning every type of the taxonomy with its state, resolving absent rows as enabled (design D3)
- [x] 5.3 Add `PUT /api/notifications/preferences/:type` that upserts a single preference, is idempotent for repeated identical updates, restricts access to the caller, and returns 400 for a type outside the taxonomy
- [x] 5.4 Migrate the existing emitters to `notify()`: `src/server/routes/tasks.ts:110` (task assigned), `tasks.ts:233` (task graded), `chat.ts:217` (direct message), `projects.ts:204` (member added), `retrospectives.ts:100` (retrospective note)
- [x] 5.5 Store the navigable reference in each emitter: `entityType`/`entityId` for the assigned task, graded task, message conversation, assigned project and retrospective sprint
- [x] 5.6 Add a preferences settings surface to the notification centre listing every type with its enabled state and a toggle that persists, and reflects stored state after reload
- [x] 5.7 Add `e2e/notification-preferences.spec.ts`: disabling a type suppresses its notification, re-enabling restores it, and one user's setting does not affect another

## 6. Notification centre completion

- [x] 6.1 Emit `SPRINT_COMPLETED` to every member of the sprint's project when a sprint transitions to `COMPLETED` in `src/server/routes/sprints.ts:117`, and emit nothing when the sprint was already `COMPLETED` (through `notify()`)
- [x] 6.2 Add `GET /api/notifications/unread-count` with a SQL count over all unread notifications of the caller, without `take` (design D6)
- [x] 6.3 Add `PUT /api/notifications/read-all` marking every unread notification of the caller as read, touching no other user
- [x] 6.4 Update `src/components/NotificationBell.tsx` to use the unread-count endpoint instead of counting over the fetched page
- [x] 6.5 Add an `entityType` → route map in `NotificationBell.tsx` and make an item with a reference activable: mark read and navigate; items without a reference only mark read (design D7)
- [x] 6.6 Add a "mark all as read" control to the panel
- [x] 6.7 Use `USER_STORY_ASSIGNED` in `src/server/routes/user-stories.ts:178` instead of reusing `TASK_ASSIGNED`
- [x] 6.8 Add an E2E case for the sprint-completion trigger and one for navigation from a task notification

## 7. Role dashboard (HU-10)

- [x] 7.1 Create `src/server/routes/dashboard.ts` with `GET /api/dashboard/summary` resolving the caller's projects, filtering out projects whose end date has passed, and returning active projects, the caller's own non-completed tasks and nearest upcoming due dates; return empty collections when the caller belongs to no project
- [x] 7.2 Add `GET` and `PATCH /api/dashboard/preferences` persisting the visible-module selection on the user, with all modules visible by default and a valid empty state
- [x] 7.3 Mount the dashboard router in `src/server/index.ts`
- [x] 7.4 Replace the static content of `src/components/dashboards/TeacherDashboard.tsx` with the summary figures, keeping the teacher-only links
- [x] 7.5 Replace the static content of `src/islands/TeamDeveloperWelcomeOptions.tsx` with the summary figures, keeping the developer-only links
- [x] 7.6 Add module visibility toggles driven by `DashboardLayout` that persist across sessions and handle the all-hidden case
- [x] 7.7 Add an E2E test asserting a member sees their own pending tasks, that other members' tasks never appear, and that hiding a module persists across a reload

## 8. Role-based access control (RNF3.2)

- [x] 8.1 Guard `GET /api/metrics/projects/:projectId/contribution` in `src/server/routes/metrics.ts` so only ADMIN receives it, returning 403 otherwise
- [x] 8.2 Guard the evaluations API in `src/server/routes/evaluations.ts` so the list endpoints are ADMIN-only while a member keeps access to their own records
- [x] 8.3 Move `/evaluations` out of the unprotected `DashboardLayout` routes in `src/App.tsx:61` into a role-protected route that redirects non-ADMIN users
- [x] 8.4 Add an E2E test asserting a member is denied `/evaluations` and the contribution endpoint with 403, and that ADMIN keeps access
- [x] 8.5 Migrate `DASH-04` in `e2e/dashboards.spec.ts`, which currently asserts the student CAN reach `/evaluations`, into a rejection test per design risk note
- [x] 8.6 Add an E2E test that a member still receives their own evaluations after the restriction

## 9. Test infrastructure

- [x] 9.1 Add `e2e/**/*.{ts,tsx}` to `files.includes` in `biome.json`
- [x] 9.2 Run `npx biome check e2e` in report mode to size the formatting diff, review it, and apply the formatting in a commit separate from the functional changes
- [x] 9.3 Resolve the `fullyParallel: true` / `workers: 1` contradiction in `playwright.config.ts`: either keep serial execution and document why, or isolate data per worker and enable parallelism
- [x] 9.4 Resolve the database path in a single configuration point so the suite can run against a dedicated test database, keeping `dev.db` as the default when unset
- [x] 9.5 Add a cleanup step that removes the users and projects created by the suite, or document that `dev.db` accumulates test data

## 10. Verification

- [x] 10.1 Run `npx tsc --noEmit` and `npm run check` and fix every issue
- [x] 10.2 Run `npm run test:unit` and confirm the metrics suite passes
- [x] 10.3 Run `npx playwright test` and confirm the full suite passes, including the new preference, navigation, sprint-trigger and access-control cases
- [x] 10.4 Manually verify with `npm run dev:all` that each of the six notification triggers fires, that a disabled preference suppresses delivery, and that the dashboard shows real data for ADMIN and for a member
  - Sustituido por `scripts/verify-notification-triggers.mjs`, que comprueba los siete tipos vía API (13/13), incluida la supresión por preferencia y el aislamiento entre usuarios.
- [x] 10.5 Re-run the full E2E suite three times consecutively to confirm no flakiness returns (the `ECONNRESET` precedent)
  - 47 passed / 0 failed en las tres ejecuciones (3.3m, 3.4m, 3.3m). Sin `ECONNRESET`.

## 11. Documentation and traceability

- [x] 11.1 Rewrite `docs/INFORME_ITERACION_3.md` to use the canonical RF numbering, correct the earlier misattribution of Story Points to RF8, and record the final state of RF8, RF9.2, RF9.3, HU-10 and RNF3.2 with the test that proves each
- [x] 11.2 Update `docs/iteracion3.md` §3 and the traceability matrix so RF, HU and test script agree, removing the `RF12.1*` / `RF10.1*` placeholders flagged at lines 77-81
- [x] 11.3 Document in `docs/iteracion3.md` §6a that the day index is elapsed days, that the series has `elapsedDays + 1` points, and that a sprint from the 1st to the 10th therefore has 9 elapsed days — so future tests do not read "10-day sprint" as 10 elapsed days
- [x] 11.4 Update `docs/Estado_Implementacion.md` for RF9.3, the sprint trigger, navigation, the real dashboard and RNF3.2
- [x] 11.5 Record the Story Points interface as technical debt with the reason (not part of HU-08/09/10) and the workaround (assignment via API) in `docs/INFORME_ITERACION_3.md`
- [x] 11.6 Produce the "Reporte de exactitud de métricas" deliverable from the unit test results of section 4
  - Publicado en `docs/REPORTE_EXACTITUD_METRICAS.md`.