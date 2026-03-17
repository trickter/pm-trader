---
status: done
priority: p2
issue_id: "005"
tags: [code-review, performance, database, positions]
dependencies: []
---

# Remove PositionSnapshot writes from read-only position fetches

## Problem Statement

`getPositions()` is used as a read helper, but it performs DB inserts on every call. This causes write amplification on page loads, risk checks, and sync actions.

## Findings

- `src/lib/polymarket/data.ts:29-56` inserts up to 10 `PositionSnapshot` rows every time `getPositions()` runs.
- `src/lib/risk/engine.ts:14-34` and `:82-85` call `getPositions()` in hot risk paths.
- `src/app/actions.ts:193-197` and `/orders` also call it for routine reads.

## Proposed Solutions

### Option 1: Separate read and snapshot APIs
**Approach:** Keep `getPositions()` pure; create an explicit snapshot ingestion function for scheduled/manual syncs.
**Pros:** Clear boundaries, lower latency, predictable writes.
**Cons:** Requires updating call sites.
**Effort:** Small
**Risk:** Low

### Option 2: Gate snapshots behind an opt-in flag
**Approach:** Add a parameter to disable snapshot persistence by default.
**Pros:** Minimal refactor.
**Cons:** Still leaves mixed concerns in one helper.
**Effort:** Small
**Risk:** Medium

## Recommended Action

## Acceptance Criteria

- [ ] Read-only position fetches do not write to the database
- [ ] Snapshot persistence only runs from explicit sync/ingestion paths
- [ ] Risk checks no longer incur DB write amplification

## Work Log

### 2026-03-17 - Initial Discovery

**By:** Codex

**Actions:**
- Traced all `getPositions()` call sites
- Confirmed it mutates local state on routine reads

**Learnings:**
- The helper currently mixes transport, persistence, and risk responsibilities

