---
status: done
priority: p2
issue_id: "008"
tags: [code-review, security, audit, compliance]
dependencies: ["001"]
---

# Add actor and request attribution to audit logs

## Problem Statement

Audit records currently capture action/entity/payload only. They do not record who initiated the change or which request/session it came from.

## Findings

- `src/lib/risk/engine.ts:113-121` writes `AuditLog` entries with no actor metadata.
- `src/app/actions.ts:82`, `:99`, `:111`, `:180`, `:188`, `:200` rely on this helper for destructive actions.
- Without actor/request attribution, audit logs cannot distinguish intended operator actions from forged or automated requests.

## Proposed Solutions

### Option 1: Extend AuditLog schema with actor metadata
**Approach:** Store actor id, session id, IP, and correlation/request id.
**Pros:** Makes logs forensically useful.
**Cons:** Requires auth context propagation and schema change.
**Effort:** Medium
**Risk:** Low

### Option 2: Enrich payload with structured request context
**Approach:** Add operator/request context inside `payload` until the schema is expanded.
**Pros:** Faster interim step.
**Cons:** Weaker queryability and less enforcement.
**Effort:** Small
**Risk:** Medium

## Recommended Action

## Acceptance Criteria

- [ ] Mutating actions record actor identity and request context
- [ ] Audit trails can distinguish manual operator actions from automated engine actions
- [ ] Destructive events are queryable for incident response

## Work Log

### 2026-03-17 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed audit helper and all mutating call sites
- Confirmed logs lack actor/session attribution

**Learnings:**
- This is particularly important once authz is added, because the app otherwise has no trustworthy forensic trail

