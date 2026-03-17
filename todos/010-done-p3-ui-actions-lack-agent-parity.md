---
status: done
priority: p3
issue_id: "010"
tags: [code-review, architecture, agent-native, quality]
dependencies: ["001"]
---

# Add agent-accessible equivalents for operator UI actions

## Problem Statement

The app exposes meaningful operator workflows in the UI, but most of them only exist as form-bound server actions. There is no clear agent-facing primitive layer for strategy creation, risk changes, manual ordering, or cancel-all.

## Findings

- UI actions exist for strategy creation, risk updates, runtime settings, manual orders, syncing, and cancel-all.
- Agent/API parity is limited to quote reads and the engine-run route.
- There is no runtime capability/context layer that tells an agent what operator actions are possible.

## Proposed Solutions

### Option 1: Add authenticated JSON/API primitives
**Approach:** Introduce authenticated server routes or tool endpoints for each operator primitive.
**Pros:** Clear parity layer for future agent-native work.
**Cons:** Must be paired with authz.
**Effort:** Medium
**Risk:** Medium

### Option 2: Document current limitations and defer
**Approach:** Keep current UI-first architecture but explicitly mark missing agent parity in docs.
**Pros:** Lowest short-term effort.
**Cons:** Does not satisfy agent-native goals.
**Effort:** Small
**Risk:** Medium

## Recommended Action

## Acceptance Criteria

- [ ] High-value operator actions have authenticated agent/tool equivalents, or
- [ ] The system explicitly documents that operator actions are UI-only for now
- [ ] Agent capability/context documentation reflects the true action surface

## Work Log

### 2026-03-17 - Initial Discovery

**By:** Codex

**Actions:**
- Compared UI action surface against available routes/actions usable by an external agent
- Confirmed parity gaps across operator workflows

**Learnings:**
- This is architectural debt, not a merge blocker, but it matters if the product intends agent-native parity

