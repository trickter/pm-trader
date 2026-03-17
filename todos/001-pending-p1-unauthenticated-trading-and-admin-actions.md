---
status: done
priority: p1
issue_id: "001"
tags: [code-review, security, trading, auth]
dependencies: []
---

# Lock down live trading and admin mutations

## Problem Statement

The app exposes server actions and a route handler that can mutate strategies, risk settings, runtime settings, and live orders without any authentication or authorization guard.

## Findings

- `src/app/actions.ts:35`, `:90`, `:103`, `:121`, `:186` expose strategy creation, risk/runtime mutation, manual order placement, and cancel-all to any caller.
- `src/app/api/engine/run/route.ts:5` triggers the strategy engine without auth.
- `src/lib/polymarket/clob-trading.ts:69` can submit real orders once server credentials are configured.
- With `POLYMARKET_PRIVATE_KEY` present, this becomes unauthenticated remote trading.

## Proposed Solutions

### Option 1: Admin session gate
**Approach:** Require authenticated operator sessions for all mutating actions and routes.
**Pros:** Strongest fix, aligned with operational reality.
**Cons:** Requires auth subsystem and session propagation.
**Effort:** Medium
**Risk:** Low

### Option 2: Internal signed token
**Approach:** Protect mutation routes/actions behind a shared internal token or HMAC-signed requests.
**Pros:** Faster to ship for internal-only deployments.
**Cons:** Weaker than full user auth; still needs secret distribution and rotation.
**Effort:** Small
**Risk:** Medium

## Recommended Action

## Technical Details

- Affected files:
  - `src/app/actions.ts`
  - `src/app/api/engine/run/route.ts`
  - `src/lib/polymarket/clob-trading.ts`

## Resources

- Review findings from security and TypeScript reviewers

## Acceptance Criteria

- [x] Every mutating server action verifies operator identity or signed internal authorization
- [x] `POST /api/engine/run` is no longer publicly callable
- [x] Live trading and cancel-all are inaccessible to anonymous callers
- [x] Unauthorized attempts are rejected and logged

## Work Log

### 2026-03-17 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed all server actions and route handlers
- Confirmed no authz boundary exists around trading/admin mutations
- Consolidated duplicate review-agent findings into one tracking item

**Learnings:**
- The server-side private key boundary is intact, but capability exposure still makes the deployment unsafe

### 2026-03-17 - Implemented Option 2 (Internal signed token)

**By:** Claude

**Actions:**
- Added `ADMIN_API_TOKEN` to env schema (`src/lib/env.ts`)
- Created `src/lib/auth.ts` with `verifyAdminToken()` (server actions) and `verifyBearerToken()` (route handlers)
- Guarded all 6 mutating server actions in `src/app/actions.ts` with auth checks
- Guarded `POST /api/engine/run` route handler with bearer token check
- Created Next.js middleware (`src/middleware.ts`) to propagate `admin_token` cookie as `x-admin-token` header
- Created `/api/auth/login` route and `/login` page for token-based authentication
- Updated `.env.example` with `ADMIN_API_TOKEN` placeholder

