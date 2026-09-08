## Why

The WorkflowS backend has **no authentication or authorization** on any route, allowing unauthenticated access to all CRUD operations. Additionally, JWT secrets are hardcoded, users can self-register as admins, and sensitive data is exposed. These are critical security vulnerabilities that must be addressed immediately to prevent unauthorized access and data breaches.

## What Changes

- **BREAKING**: Implement JWT authentication middleware for all protected routes
- **BREAKING**: Add dual-level RBAC — system-level (`User.role`) for admin operations and project-level (`ProjectMember.role`) for project operations
- Remove hardcoded JWT_SECRET fallback; require environment variable configuration
- Remove ADMIN option from registration form and backend role validation
- Exclude password hashes from user API responses
- Remove console.log of request bodies containing passwords
- Add input validation and sanitization to prevent mass assignment and XSS
- Implement rate limiting on authentication endpoints (login + registration)
- Add security headers (helmet) and restrict CORS origins
- Configure file upload limits and type validation
- Replace public `express.static("uploads")` with authenticated download endpoint
- Fix CSV injection in metrics export
- Update frontend API client to include JWT token in all requests

## Capabilities

### New Capabilities
- `jwt-authentication`: Middleware for validating JWT tokens on protected routes
- `system-rbac`: Authorization middleware to restrict system-level actions by `User.role`
- `project-rbac`: Authorization middleware to restrict project-level actions by `ProjectMember.role`
- `security-hardening`: Input validation, rate limiting, security headers, CORS restriction, and secure file uploads

### Modified Capabilities
- `user-management`: Modify user queries to exclude password hashes; restrict registration roles
- `authentication`: Remove console.log of sensitive data; require JWT_SECRET environment variable
- `frontend-api-client`: Include JWT token in `Authorization` header for all API requests

## Impact

**Affected Code:**
- `src/server/middleware/auth.ts` — JWT authentication middleware (NEW)
- `src/server/middleware/system-rbac.ts` — system-level RBAC middleware (NEW)
- `src/server/middleware/project-rbac.ts` — project-level RBAC middleware (NEW)
- `src/server/routes/*.ts` (13 route files) — add auth + RBAC middleware
- `src/server/index.ts` — add helmet, rate limiting, CORS config
- `src/server/routes/auth.ts` — remove password logging, fix JWT_SECRET, restrict roles
- `src/server/routes/users.ts` — exclude password from responses
- `src/server/routes/documents.ts` — add authenticated download endpoint
- `src/server/index.ts` — remove public `express.static("uploads")`
- `src/server/routes/metrics.ts` — fix CSV injection
- `src/auth/RegisterForm.tsx` — remove ADMIN option
- `src/hooks/useSession.tsx` — store JWT token alongside user data
- `src/api/client.ts` — inject `Authorization: Bearer <token>` header on all requests

**API Changes:**
- All protected endpoints now require `Authorization: Bearer <token>` header
- Registration endpoint no longer accepts `role` parameter from client
- User endpoint no longer returns password hash
- Project-scoped endpoints validate against `ProjectMember.role`, not `User.role`

**Dependencies:**
- Add `helmet` for security headers
- Add `express-rate-limit` for rate limiting
- Add input validation library (e.g., `zod` or `joi`)

**Systems:**
- Backend authentication and dual-level authorization flow
- Frontend token management (store + send JWT)
- File upload functionality (now authenticated)