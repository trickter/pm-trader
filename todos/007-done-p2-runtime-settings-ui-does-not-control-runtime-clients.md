---
status: done
priority: p2
issue_id: "007"
tags: [code-review, operations, configuration, quality]
dependencies: []
---

# Make runtime settings actually drive Polymarket clients or remove them

## Problem Statement

The Settings UI persists `apiHost` and `chainId`, but the actual Gamma/CLOB clients still initialize from environment variables. Operators can save settings that have no runtime effect.

## Findings

- `src/app/actions.ts:103-112` persists runtime settings into `SystemSetting`.
- `src/app/settings/page.tsx:29-46` presents these settings as editable runtime controls.
- `src/lib/polymarket/clob-public.ts:11-24`, `src/lib/polymarket/clob-trading.ts:39-58`, and `src/lib/polymarket/gamma.ts:20-26` still read from `env`, not DB-backed runtime settings.

## Proposed Solutions

### Option 1: Wire clients to runtime settings
**Approach:** Resolve hosts/chain from `getRuntimeSettings()` in the server-only client factories.
**Pros:** Makes UI truthful.
**Cons:** Requires rethinking singleton client caching.
**Effort:** Medium
**Risk:** Medium

### Option 2: Remove or mark nonfunctional controls
**Approach:** Hide/edit-lock `apiHost` and `chainId` until they are truly supported.
**Pros:** Fastest way to avoid operator confusion.
**Cons:** Loses intended configurability.
**Effort:** Small
**Risk:** Low

## Recommended Action

## Acceptance Criteria

- [ ] Runtime settings shown in UI either affect the actual clients or are removed/disabled
- [ ] Operators cannot save misleading no-op configuration
- [ ] Client initialization behavior is documented clearly

## Work Log

### 2026-03-17 - Initial Discovery

**By:** Codex

**Actions:**
- Traced runtime-setting persistence and client initialization paths
- Confirmed `apiHost` / `chainId` are not consumed by trading/market clients

**Learnings:**
- The current UI suggests control the system does not actually provide

