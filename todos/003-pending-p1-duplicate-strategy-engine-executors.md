---
status: done
priority: p1
issue_id: "003"
tags: [code-review, reliability, trading, concurrency]
dependencies: []
---

# Prevent duplicate strategy execution across overlapping runs

## Problem Statement

The background engine loop can overlap within or across processes, allowing the same strategy signal to place duplicate live orders before any run marks it executed.

## Findings

- `src/lib/strategy/engine.ts:209-219` uses `setInterval()` with no in-flight guard.
- `src/instrumentation.ts:3` starts the loop during app boot, so multiple workers can run it simultaneously.
- `src/lib/risk/engine.ts:25-32` only rejects signals already marked `executed`, which is too late under concurrency.

## Proposed Solutions

### Option 1: Single-flight + durable lease
**Approach:** Add an in-process mutex plus a DB-backed lease/idempotency key per engine sweep or strategy execution.
**Pros:** Works across multi-process deployments and overlapping requests.
**Cons:** Requires careful timeout and recovery design.
**Effort:** Medium
**Risk:** Low

### Option 2: Remove boot-time interval, move to external scheduler
**Approach:** Run `runStrategyEngineOnce()` from a cron/queue worker with single ownership.
**Pros:** Cleaner operational model.
**Cons:** Requires deployment/runtime changes.
**Effort:** Medium
**Risk:** Medium

## Recommended Action

## Technical Details

- Affected files:
  - `src/lib/strategy/engine.ts`
  - `src/instrumentation.ts`
  - `src/lib/risk/engine.ts`

## Acceptance Criteria

- [ ] Two overlapping engine invocations cannot place the same live order twice
- [ ] A single strategy/signal pair has a durable idempotency boundary
- [ ] Multi-process deployments are safe
- [ ] Duplicate-order regression test or documented verification plan exists

## Work Log

### 2026-03-17 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed engine boot/start path and duplicate-signal logic
- Confirmed there is no single-flight or cross-process lease

**Learnings:**
- The current `executed` flag is post-hoc state, not a concurrency control

