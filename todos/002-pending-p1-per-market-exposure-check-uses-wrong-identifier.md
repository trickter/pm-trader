---
status: done
priority: p1
issue_id: "002"
tags: [code-review, risk, trading, correctness]
dependencies: []
---

# Fix per-market exposure checks to use matching identifiers

## Problem Statement

The per-market exposure guard compares `input.marketId` against Data API positions that are keyed by `conditionId`, so the single-market exposure limit can silently fail.

## Findings

- `src/lib/risk/engine.ts:68-70` and `:104-106` compare `position.conditionId ?? position.market` to `input.marketId`.
- `src/lib/strategy/engine.ts:100` and `src/app/actions.ts:133` pass Gamma `marketId`, not `conditionId`.
- The result is mismatched identifier domains and missed existing exposure on the same market.

## Proposed Solutions

### Option 1: Normalize around `conditionId`
**Approach:** Pass `conditionId` into risk checks and compare only normalized condition identifiers.
**Pros:** Matches Data API shape; simplest mental model.
**Cons:** Requires widening call sites to carry both market and condition identifiers.
**Effort:** Small
**Risk:** Low

### Option 2: Resolve marketId -> conditionId inside risk layer
**Approach:** Look up the market cache before exposure comparison.
**Pros:** Fewer calling-code changes.
**Cons:** Adds extra IO and hidden coupling inside risk checks.
**Effort:** Medium
**Risk:** Medium

## Recommended Action

## Technical Details

- Affected files:
  - `src/lib/risk/engine.ts`
  - `src/lib/strategy/engine.ts`
  - `src/app/actions.ts`

## Acceptance Criteria

- [x] Per-market exposure logic compares like-for-like identifiers
- [x] Existing exposure in the same market is counted correctly
- [x] Manual orders and strategy orders use the same normalized identifier path
- [ ] Add regression coverage for a position keyed by `conditionId`

## Work Log

### 2026-03-17 - Initial Discovery

**By:** Codex

**Actions:**
- Cross-checked order call sites against Data API position fields
- Confirmed `marketId` and `conditionId` are mixed in the same comparison

**Learnings:**
- This is a business-critical risk-control bug, not a UI issue

