# api-rate-limiting

## ADDED Requirements

### Requirement: The API applies a per-IP request limit to non-exempt endpoints
The server SHALL apply a rate limiter to `/api`, keyed by client IP over a rolling window, and SHALL respond `429` with an error message when a client exceeds the limit on a non-exempt endpoint; the request SHALL NOT be processed. The default maximum SHALL be `1000` requests per `900000` ms (15 minutes). This limiter SHALL be independent from the stricter credential limiters, which SHALL keep their own limits: `POST /api/auth/login` SHALL allow at most 5 requests per 15 minutes, and `POST /api/auth/register` SHALL allow at most 10 requests per hour.

#### Scenario: Exceeding the general limit is rejected
- **WHEN** a client sends more requests than the configured maximum within the window to a non-exempt endpoint
- **THEN** the server responds `429` with an error message and does not process the surplus requests

#### Scenario: Requests within the limit are processed
- **WHEN** a client stays within the configured maximum for the window
- **THEN** the server processes every request normally

#### Scenario: Credential limiters remain stricter than the general limit
- **WHEN** `POST /api/auth/login` is called more than 5 times within 15 minutes
- **THEN** the server responds `429` even though the general limit has not been reached

#### Scenario: Rate limiting can be disabled outside production
- **WHEN** the server runs with `DISABLE_RATE_LIMIT=true` or `NODE_ENV=test`
- **THEN** the limiters do not block any request

### Requirement: Read-only polling endpoints are exempt from the general limit
The general rate limiter SHALL NOT count nor block authenticated read-only requests to the endpoints the client polls. The exempt requests SHALL be exactly the `GET` method on `GET /api/notifications`, `GET /api/notifications/unread-count`, `GET /api/chat/:projectId/messages` and `GET /api/chat/conversation/:chatId/messages`. Mutating methods on those same paths SHALL remain subject to the general limit, and no other endpoint SHALL be exempt.

#### Scenario: Polling notifications does not exhaust the budget
- **WHEN** a client polls `GET /api/notifications` and `GET /api/notifications/unread-count` every 10 seconds for the whole window
- **THEN** none of those requests receives `429`

#### Scenario: Polling chat messages does not exhaust the budget
- **WHEN** a client polls `GET /api/chat/:projectId/messages` and `GET /api/chat/conversation/:chatId/messages` every 5 seconds for the whole window
- **THEN** none of those requests receives `429`

#### Scenario: A mutation on an exempt path is still limited
- **WHEN** a client sends more `POST` requests than the maximum to a path whose `GET` is exempt
- **THEN** the server responds `429`

#### Scenario: A non-exempt endpoint is still limited
- **WHEN** a client sends more `GET /api/projects` requests than the maximum within the window
- **THEN** the server responds `429`

### Requirement: Rate limit values are configurable through the environment
The server SHALL read the general maximum from `API_RATE_LIMIT_MAX` and the window length in milliseconds from `API_RATE_LIMIT_WINDOW_MS`. When a variable is unset or is not a valid number, the server SHALL fall back to its default: `1000` for `API_RATE_LIMIT_MAX` and `900000` for `API_RATE_LIMIT_WINDOW_MS`.

#### Scenario: Defaults apply when the variables are unset
- **WHEN** the server starts with neither `API_RATE_LIMIT_MAX` nor `API_RATE_LIMIT_WINDOW_MS` set
- **THEN** the general limit is 1000 requests per 900000 ms

#### Scenario: Environment overrides the defaults
- **WHEN** the server starts with `API_RATE_LIMIT_MAX=3` and `API_RATE_LIMIT_WINDOW_MS=60000`
- **THEN** the fourth non-exempt request within a minute receives `429`

#### Scenario: An invalid value falls back to the default
- **WHEN** the server starts with `API_RATE_LIMIT_MAX` set to a non-numeric value
- **THEN** the general maximum used is the default `1000`