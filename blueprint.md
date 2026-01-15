# The Hunter System

## Overview
A gamified goal management application inspired by "Solo Leveling", where real-life achievements (Quests) translate into in-game character growth.

## Architecture
- **Framework-less**: Plain HTML, CSS, JavaScript (ES Modules).
- **State Management**: `StateManager` class using `localStorage`.
- **Navigation**: SPA Router (hash-based).
- **UI**: Component-based rendering functions.

## Features

### v5.0 Dual Economy
- **Gold**: Earned via Idle/Offline/Ads. Used for **Stat Refinement** (Idle Growth) and **General Shop** items.
- **Essence**: Earned via Real-life Quests (Proof of Effort) and Essence Condenser. Used for **Hunter Growth** (Costumes/Skills).

### Growth Systems
1.  **Idle Growth (Gold)**:
    -   Accessible via "스탯" (Stats) tab.
    -   Upgrade stats (STR, INT, WIL, FOCUS, LUK) using Gold.
    -   Gold generated automatically based on STR.
2.  **Hunter Growth (Essence)**:
    -   Accessible via "전직" (Job/Costume) tab.
    -   Purchase Costumes (Jobs) using Essence.
    -   Equip Costumes to change class, gain stat bonuses, and modify skills.
3.  **Essence Condenser**:
    -   Passive Essence generation while app is open.
    -   Multiplier increases with completed quests.
    -   Capped at 40% of daily quest earnings.

### Core Systems
-   **Quests**: Create and complete real-life tasks to earn Essence and EXP.
-   **Hunter Status**: "Real Hunter" (active today) vs "Simulation" (inactive).
-   **Gates**: Dungeons/Challenges (Weekday/Weekend/Sudden).
-   **Shop**: Split into General (Gold) and Hunter (Essence) tabs.

## Recent Changes (v5.0)
-   **Stat Growth Rule**: Stats are upgraded using Gold only.
-   **Refine Tab Split**: Created "Idle Growth (Gold)" and "Hunter Growth (Essence)" tabs.
-   **Essence Condenser**: Implemented passive essence generation with daily cap logic.
-   **Shop Refactor**:
    -   Split shop into "General Shop (Gold)" and "Hunter Shop (Essence)".
    -   Created `shopItems.js` config.
    -   Enforced hard rule: Costumes buyable only with Essence.

## Current Plan
-   [x] **v5.0 Stat Growth Rule**: Switch stat upgrades to Gold only.
-   [x] **Split Refine Tab**: Separate Stat and Costume growth screens.
-   [x] **Essence Condenser**: Implement passive essence mechanic.
-   [x] **Shop Refactor**: Split shop into General (Gold) and Hunter (Essence) tabs.
-   [ ] **Elite Skills**: Implement Elite Skills purchase in Hunter Growth (Future).