# StepQuest Blueprint

## Product Overview

StepQuest is a personal, ADHD-friendly execution helper presented as a lightweight idle RPG. It turns a large Goal into one physical action, rewards the start of real-world work, expects the app to be closed during that work, and preserves the exact point needed to resume later.

The authoritative product direction is planning document v0.2 dated 2026-07-10. The current repository is `v0.1.1-alpha` and is being migrated incrementally rather than rebuilt from scratch.

## Product Principles

- Core game resources enter through real-world action only.
- There is no failure penalty, streak reset, or inactivity loss.
- The primary screen shows one current step.
- Start and resume are more important than completion.
- Rewards are immediate but animation is asynchronous and skippable.
- Closing the app after starting an expedition is the expected flow.
- Data is local-first and exportable.

## Current Architecture

- Framework-less PWA frontend in `backend/public` using HTML, CSS, and JavaScript.
- NestJS backend in `backend/src` with PostgreSQL-backed account features.
- Guest execution state currently stored in `localStorage`.
- Existing domain and persistence checks under `backend/scripts`.
- Playwright coverage under `backend/e2e`.
- Render staging configuration and deployment diagnostics.

## Existing v0.1.1-alpha Capabilities

- Goal templates and micro-step chains.
- One current action, shrink, defer, resume, skip, complete, and undo.
- Guest and account modes with guest import.
- Reward idempotency for completion.
- Return sessions, reminders, costumes, facilities, and progress summaries.
- PWA manifest, service worker, reduced-motion setting, and staging checks.

Some existing behavior conflicts with v0.2: the start button is a UI timer rather than a domain event, local state is not in IndexedDB, return sessions do not capture a Resume Anchor, and streak/multi-facility systems are too prominent for the new MVP.

## v0.2 Target Architecture

- Pure browser domain transitions for start, outcome reporting, Resume Anchor, and resume.
- IndexedDB as the browser source of truth for all users.
- Immutable events and reward ledger with idempotency keys.
- JSON export, rolling snapshots, optional user-authorized external automatic backup, and persistent-storage status in the MVP.
- Existing server and account data retained for later synchronization, not used as the first-slice source of truth.
- Conflicting productized systems hidden from the primary flow without destructive deletion.

## Current Change: v0.2 Start and Return Core

Design source: `docs/superpowers/specs/2026-07-10-stepquest-v02-core-loop-design.md`

- [x] Read and compare v0.2 planning against the current repository.
- [x] Choose incremental migration over guest-only layering or a separate rewrite.
- [x] Approve architecture, state flow, storage, reward, and verification design.
- [ ] Write and review the implementation plan.
- [ ] Implement the v0.2 domain transitions test-first.
- [ ] Implement IndexedDB persistence, migration, persistent-storage request, JSON export, and backup rotation.
- [ ] Replace the primary UI with start, expedition, four-outcome return, and Resume Anchor flow.
- [ ] Verify reload recovery and regressions in the built PWA.

## Deferred Roadmap

- Action size adaptation and 5/10/25-minute focus modes.
- Full obstacle router and long-return handling.
- Goal types, recurrence, and seven-day carry-over review.
- One central camp and one general costume aligned with MVP limits.
- Additional progression systems, AI decomposition, Tauri, push, and cloud synchronization only after the core loop is validated.
