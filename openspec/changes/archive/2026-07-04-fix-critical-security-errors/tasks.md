## 1. Environment Configuration

- [x] 1.1 Add JWT_SECRET to .env.example and require it in application startup
- [x] 1.2 Remove hardcoded JWT_SECRET fallback from auth.ts
- [x] 1.3 Add helmet and express-rate-limit dependencies to package.json

## 2. Authentication Middleware

- [x] 2.1 Create src/server/middleware/auth.ts with authenticateToken middleware
- [x] 2.2 Implement JWT token extraction from Authorization header (Bearer scheme)
- [x] 2.3 Add user context (userId, email, role) to request object after validation
- [x] 2.4 Create unit tests for authentication middleware

## 3. System-Level Authorization Middleware

- [x] 3.1 Create src/server/middleware/system-rbac.ts with requireSystemRole middleware
- [x] 3.2 Implement role validation against req.user.role
- [x] 3.3 Create unit tests for system-level RBAC middleware

## 4. Project-Level Authorization Middleware

- [x] 4.1 Create src/server/middleware/project-rbac.ts with requireProjectRole middleware
- [x] 4.2 Implement default projectId resolver (params.projectId → params.id → body.projectId)
- [x] 4.3 Design resolver function signature to allow custom per-route projectId resolution
- [x] 4.4 Implement Prisma query to find ProjectMember by projectId + userId
- [x] 4.5 Add ADMIN bypass (teachers can access any project without being members)
- [x] 4.6 Attach membership context (req.projectMembership) for downstream use
- [x] 4.7 Create unit tests for project-level RBAC middleware

## 5. Apply Authentication to Routes

- [x] 5.1 Add authenticateToken middleware to all protected routes
- [x] 5.2 Exempt public routes (login, register, health) from authentication
- [x] 5.3 Test all routes with valid and invalid tokens

## 6. Apply Authorization to Routes

- [x] 6.1 Apply requireSystemRole (ADMIN) to user management endpoints
- [x] 6.2 Apply requireSystemRole (ADMIN) to project CRUD and member management
- [x] 6.3 Apply requireSystemRole (ADMIN) to evaluation, rubric, and metrics export endpoints
- [x] 6.4 Apply requireProjectRole to sprint management endpoints
- [x] 6.5 Apply requireProjectRole to task and user-story management endpoints
- [x] 6.6 Apply requireProjectRole to document upload and chat endpoints
- [x] 6.7 Apply requireProjectRole to retrospective endpoints
- [x] 6.8 Test role-based access for all user roles (ADMIN, TEAM_DEVELOPER, SCRUM_MASTER, PRODUCT_OWNER)
- [x] 6.9 Update frontend to handle 401 Unauthorized and 403 Forbidden responses

## 7. Frontend Token Management

- [x] 7.1 Update useSession.tsx to store JWT token in localStorage on login
- [x] 7.2 Update api/client.ts to read token from localStorage and inject Authorization header
- [x] 7.3 Update LoginForm.tsx to capture token from login response and pass to session
- [x] 7.4 Add token removal on logout in useSession.tsx
- [x] 7.5 Test end-to-end auth flow (login → API call → logout)

## 8. Security Hardening

- [x] 8.1 Add helmet middleware to src/server/index.ts
- [x] 8.2 Configure rate limiting for login endpoint (5 attempts/15min)
- [x] 8.3 Configure rate limiting for registration endpoint (10 attempts/hour)
- [x] 8.4 Configure rate limiting for general API endpoints (100 requests/15min)
- [x] 8.5 Replace wide-open cors() with origin-restricted configuration via CORS_ORIGINS env var
- [x] 8.6 Add input validation with Zod for user registration
- [x] 8.7 Add input validation for all POST/PUT endpoints

## 9. Fix Sensitive Data Exposure

- [x] 9.1 Remove console.log of request body in auth.ts
- [x] 9.2 Add select clause to exclude password from user queries in users.ts
- [x] 9.3 Test user endpoints to ensure no password exposure
- [x] 9.4 Update error responses to hide internal details in production (remove details field)

## 10. Secure File Uploads

- [x] 10.1 Add file size limit (10MB) to multer configuration
- [x] 10.2 Add file type filter for allowed document types (PDF, DOCX, PNG, JPG, etc.)
- [x] 10.3 Test file upload with oversized files
- [x] 10.4 Test file upload with disallowed file types

## 11. Authenticated File Serving

- [x] 11.1 Remove `app.use("/uploads", express.static("uploads"))` from src/server/index.ts
- [x] 11.2 Add GET /api/files/:filename download endpoint in documents.ts with authenticateToken middleware
- [x] 11.3 Implement project access check (ADMIN bypass or ProjectMember lookup) in the download handler
- [x] 11.4 Update URL construction in POST /api/documents/:projectId to use `/api/files/` prefix instead of external URL
- [x] 11.5 Test file download with authenticated user (project member)
- [x] 11.6 Test file download with authenticated user (non-member, expect 403)
- [x] 11.7 Test file download without authentication (expect 401)

## 12. Input Validation and Sanitization

- [x] 12.1 Create Zod validation schemas for all POST/PUT inputs
- [x] 12.2 Add mass assignment protection by whitelisting allowed fields per endpoint (avoid ...req.body spreads)
- [x] 12.3 Test input validation with malicious payloads (extra fields, type mismatches)

## 13. Fix CSV Injection

- [x] 13.1 Add sanitizeCsvCell helper in metrics.ts to escape leading dangerous characters (=, +, -, @)
- [x] 13.2 Apply sanitization to all dynamic values in CSV generation
- [x] 13.3 Test CSV export with malicious task titles

## 14. Testing and Quality Assurance

- [x] 14.1 Run all existing tests to ensure no regressions
- [x] 14.2 Add integration tests for JWT authentication flow (valid, invalid, expired tokens)
- [x] 14.3 Add integration tests for system-level RBAC (admin vs non-admin endpoints)
- [x] 14.4 Add integration tests for project-level RBAC (different roles in different projects)
- [x] 14.5 Add integration tests for rate limiting on auth endpoints
- [x] 14.6 Add integration tests for authenticated file download
- [x] 14.7 Run biome for code quality and formatting
- [x] 14.8 Fix any biome errors or warnings

## 15. Documentation and Deployment

- [x] 15.1 Update API documentation with authentication and authorization requirements
- [x] 15.2 Update README with security configuration instructions (JWT_SECRET, CORS_ORIGINS)
- [x] 15.3 Create deployment checklist for security changes
- [x] 15.4 Test deployment in staging environment
