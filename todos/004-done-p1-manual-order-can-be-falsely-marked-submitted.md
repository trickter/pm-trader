---
status: done
priority: p1
issue_id: "004"
tags: [code-review, correctness, audit, trading]
dependencies: []
---

# Prevent false local SUBMITTED orders when manual live placement fails

## Problem Statement

Manual live orders are written to the local database as `SUBMITTED` before the remote CLOB call succeeds. If the upstream request throws, the local record remains wrong.

## Findings

- `src/app/actions.ts:139-177` creates the local order before `placeLimitOrder()`.
- The initial status is `SUBMITTED` for non-dry-run orders.
- If `placeLimitOrder()` throws, no reconciliation path updates the local record to `REJECTED` or `FAILED`.

## Proposed Solutions

### Option 1: Create as `PENDING`, finalize after remote response
**Approach:** Insert local order with `PENDING`, then update to `SUBMITTED`/`REJECTED` after the exchange call completes.
**Pros:** Aligns DB state with reality.
**Cons:** Requires one more explicit state transition.
**Effort:** Small
**Risk:** Low

### Option 2: Wrap remote call in transaction-aware compensation
**Approach:** Catch remote failures and immediately update the created row to `REJECTED` with error payload.
**Pros:** Minimal code movement.
**Cons:** Still creates a row before knowing whether remote placement is possible.
**Effort:** Small
**Risk:** Low

## Recommended Action

## Acceptance Criteria

- [ ] Non-dry-run local orders never remain `SUBMITTED` after an upstream exception
- [ ] Failure payloads are captured in the local audit trail
- [ ] Open orders/history views no longer show ghost submitted orders

## Work Log

### 2026-03-17 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed manual order submission flow
- Confirmed exception path leaves local state inconsistent

**Learnings:**
- This is both a correctness and operator-trust issue because the local audit view becomes misleading

