# STEPQUEST Frontend Screen Spec

## MVP Screen

The current MVP uses one primary screen:

- `/goals.html`

Older public pages redirect to this screen until dedicated STEPQUEST screens are built.

## Today

Purpose: make the next physical action obvious.

Required elements:

- Goal input
- Category selector
- Burden selector
- Energy selector
- Optional target time
- Optional recurrence
- Optional location
- Optional available minutes
- Optional blocking reason
- Current micro step
- Estimated seconds
- Reward preview
- Last reward pulse with XP, material, combo, dungeon progress, and village growth
- Complete button
- Shrink button
- Not now button
- Stop for today button

Rules:

- Show one active action at a time.
- Do not show shame language.
- Do not call a shrink action a failure.
- Keep the whole chain collapsed by default.
- Stop for today must record a defer attempt, not only show a toast.
- Return, reminder, and stats panels must reflect stored state.
- Reminder actions must support complete, snooze, shrink, and skip.

## Expedition

Purpose: show that real actions move a dungeon forward.

Current MVP:

- Active quest title
- Progress bar
- Completed step count
- Last completed action
- Next action
- Korean theme labels instead of internal theme keys
- Pause, resume, and archive controls
- Full chain disclosure

## Character

Purpose: show execution strategy and growth without distracting from action.

Current MVP:

- Six PRD starter costumes
- Equipped costume state
- Unlock progress for each costume
- Passive and active ability copy
- Guest and account-mode active abilities create real strategy micro steps
- Level
- Materials

## Village

Purpose: show long-term growth from accumulated action.

Current MVP:

- Eight PRD category-matched facilities
- Level, XP, material, and progress display for each facility

## Guest Mode

Guest mode is required for MVP. Users can create goals and complete steps without signup. Data is stored in browser local storage.

## Mobile Web

The MVP includes a PWA shell:

- Web manifest
- App icon
- Standalone display mode
- Service worker cache for the app shell
- Offline fallback to `/goals.html`

## Return And Reminder

Current MVP:

- Stop for today records a defer attempt.
- Returning after a stop opens a 5-second recovery step.
- A local reminder can be scheduled from the current screen and saved through `/stepquest/reminder` in account mode.
- Saved reminders expose action buttons: complete, 5 minutes later, shrink, and skip.
- Basic counters show total steps, completed steps, shrink attempts, defer attempts, and return marks.

## Domain Coverage

The backend has tested STEPQUEST domain rules for:

- Template decomposition
- AI adapter shape, mock implementation, output validation, and template fallback
- First-step size caps
- Shrink as replacement, not failure
- Defer attempts for stop-for-today
- Basic attempt and reward counters
- Idempotent rewards
- Session combo rewards
- Costume active ability step insertion
- Village facility growth by category-matched facility
- 24-hour return eligibility
- Starter costume active ability

These rules are backed by persistent `/stepquest` API tables for goals, chains, micro steps, attempts, reward transactions, village facilities, user state, return sessions, and reminders. The web UI uses `/stepquest` in account/database mode and keeps guest mode as the no-signup fallback.

## Copy Rules

Allowed examples:

- "Open only the entrance today."
- "Progress already made is kept."
- "This step was too big. Make it smaller."
- "There is only one thing to do now."

Avoid:

- "You failed today."
- "Your streak is broken."
- "You lack willpower."
- "Try harder."
