---
status: done
priority: p2
issue_id: "009"
tags: [code-review, performance, runtime, networking]
dependencies: []
---

# Replace the shared `curl` fallback in the HTTP helper

## Problem Statement

The shared HTTP helper falls back to spawning `curl` via Node-only imports. This broadens runtime assumptions, triggers build warnings, and can multiply latency under retries.

## Findings

- `src/lib/http/fetch-json.ts:14-38` dynamically imports `node:child_process` and `node:util`.
- `src/lib/http/fetch-json.ts:61-99` wraps retries around both `fetch` and subprocess fallback.
- The helper is imported from pages, routes, and instrumentation, so the Node-only path leaks into broad parts of the runtime graph.

## Proposed Solutions

### Option 1: Move fallback to a server-only transport module
**Approach:** Split the Node-specific fallback into a `server-only` wrapper and keep shared fetch helpers pure.
**Pros:** Restores runtime contracts and reduces warnings.
**Cons:** Requires transport refactor.
**Effort:** Medium
**Risk:** Low

### Option 2: Remove shell fallback entirely
**Approach:** Fail fast on `fetch` errors and solve the network issue at deployment/network level.
**Pros:** Simplest code, lowest complexity.
**Cons:** Loses resilience on the current host.
**Effort:** Small
**Risk:** Medium

## Recommended Action

## Acceptance Criteria

- [ ] Shared fetch utilities do not depend on Node-only subprocess modules
- [ ] Build/runtime warnings about unsupported runtime contracts are removed
- [ ] Retry behavior remains bounded and observable

## Work Log

### 2026-03-17 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed the fallback transport logic and build output
- Confirmed runtime warnings and multi-step retry/subprocess behavior

**Learnings:**
- The workaround solved one host-specific networking problem but spread that complexity across the app surface

