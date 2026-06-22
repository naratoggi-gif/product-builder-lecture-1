# StepQuest Closed Alpha Test Plan

Use this after the HTTPS staging URL passes `npm run smoke:staging`.

## Goal

Verify that a real user can:

```text
open URL -> create one goal -> complete one tiny action -> stop safely -> return later
```

The alpha is not testing richer game depth yet. It is testing whether StepQuest helps a person start.

## Participants

Start with 5-10 people across different patterns:

- Plans often, but does not start.
- Starts, but stops quickly.
- Has trouble waking up or beginning the day.
- Procrastinates on study or work.
- General user with no ADHD diagnosis.

Do not describe StepQuest as treatment, diagnosis, or medical support. Use "ADHD-friendly execution helper".

## Invite Copy

```text
I am testing a small app that turns a big goal into a tiny first action.

Open this link and enter one goal you actually want to do.
You do not need to finish the goal. Just follow the first small action the app gives you.

URL:
<staging-url>
```

Avoid giving a long explanation before the test. If the app needs the explanation, the UX needs work.

## What To Observe

Do not coach unless the tester is fully stuck.

- Do they understand the first screen?
- Do they enter a real goal or hesitate?
- Do they notice the tiny action?
- Do they complete before acting in real life?
- Do they find "smaller" when blocked?
- Do rewards motivate or distract?
- Do they stop safely instead of abandoning?
- Do they come back the next day?

## Follow-Up Questions

Ask these after the session or after day 7:

1. Where did you get stuck?
2. Did it help you start a real action?
3. Did "smaller" feel natural?
4. Were the game elements motivating or distracting?
5. Did you want to open it again the next day?

## Metrics To Pull

Run:

```bash
cd backend
DATABASE_URL=postgresql://... DATABASE_SSL=true npm run analytics:report
```

Primary metrics:

- Goal created -> first step completed.
- App opened -> first step completed.
- Smaller used -> completed.
- Return offered -> return started.
- Guest import completed.
- D1 and D7 revisit by anonymous user or account user. In the JSON report, check `retention.d1RetentionPct` and `retention.d7RetentionPct`.

Secondary metrics:

- Event counts by category.
- Sessions with `step_skipped` or `session_deferred`.
- Error-free session ratio from request logs.

## Stop Conditions

Pause the alpha if:

- `/health` is not `ok`.
- Production super login succeeds.
- QA costume IDs are reachable.
- Guest progress is lost on signup.
- Duplicate completion grants extra rewards.
- More than one tester reports data loss.

## After Day 7

Choose one direction:

```text
Execution rate is low
-> improve goal decomposition, "smaller", and return UX.

Execution rate is okay but revisit is low
-> improve character, village, costume growth feedback.
```

Do not add boss fights, gacha, guilds, ranking, or large pixel art production before this decision.
