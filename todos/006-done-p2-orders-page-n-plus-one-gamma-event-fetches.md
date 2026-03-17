---
status: done
priority: p2
issue_id: "006"
tags: [code-review, performance, rate-limits, orders]
dependencies: []
---

# Reduce `/orders` event-fetch fanout for active positions filtering

## Problem Statement

The Orders page fetches one Gamma event per distinct `eventId` on every render, even when local cache rows already exist.

## Findings

- `src/app/orders/page.tsx:51-64` calls `getEventById()` for each unique `eventId`.
- `src/lib/polymarket/gamma.ts:119-126` refetches Gamma and then writes `eventCache`.
- This creates an N+1 remote-call pattern tied to portfolio size and can trigger Gamma rate limits.

## Proposed Solutions

### Option 1: Cache-first resolution
**Approach:** Use `eventCache` first; only fetch live events for missing/stale rows.
**Pros:** Lowest remote load for common page views.
**Cons:** Needs staleness policy.
**Effort:** Small
**Risk:** Low

### Option 2: Batch/event discovery API redesign
**Approach:** Fetch event context in one batched request path or pre-join from cached market/event tables.
**Pros:** Better long-term scaling.
**Cons:** Larger refactor.
**Effort:** Medium
**Risk:** Medium

## Recommended Action

## Acceptance Criteria

- [ ] `/orders` does not make one live Gamma request per position/event on each render
- [ ] Existing cache rows are reused
- [ ] Rate-limit pressure and page latency are reduced measurably

## Work Log

### 2026-03-17 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed the position filtering context build-up in `/orders`
- Confirmed live event fetch is unconditional once `eventId` exists

**Learnings:**
- The new filtering layer is structurally good, but the data-fetch strategy is too expensive

