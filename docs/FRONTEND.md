# PickLab: Frontend and page spec (for UI design)

Use this to design every screen. Mobile first: most testers arrive from Discord, X and LinkedIn on a phone. Desktop is a centred column (max about 720 px), not a different product. Companion: `PRD.md`, `TRD.md`.

Priority: **M** = must for the test, **S** = should, **C** = can cut.

---

## 1. Page map

| ID | Route | Page | Who | Pri |
| --- | --- | --- | --- | --- |
| P-01 | `/` | Landing | everyone | M |
| P-02 | `/login` | Creator sign in (Google) | creators, team | M |
| P-05 | `/start` | About this test (consent) | new tester | M |
| P-06 | `/app` | Tester home (modules) | tester | M |
| P-07 | `/app/session/[id]` | Voting screen (grid, swipe, this-or-that, yes/no) | tester | M |
| P-17 | `/admin/live` | Live visitors (who opened the site, which view) | team | M |
| P-08 | `/app/session/[id]/done` | Session complete | tester | M |
| P-09 | `/app/paused` | Voting paused | tester | S |
| P-10 | `/creator` | My sets | creator | M |
| P-11 | `/creator/new` | New set (upload) | creator | M |
| P-12 | `/creator/sets/[id]` | Set results | creator | M |
| P-13 | `/admin` | Admin overview | team | S |
| P-14 | `/account` | Account and data deletion | signed in | S |
| P-15 | `/about-test`, `/privacy` | Static info | everyone | M |
| P-16 | `404`, `500` | Error pages | everyone | M |

Global shell: top bar with logo, role-aware nav (Tester: Home; Creator: My sets, New set; Admin: Admin), avatar menu (Account, Sign out). No bottom tab bar needed (two or three destinations).

---

## 2. Pages

### P-01 Landing `/`
Purpose: explain in 5 seconds and get a click.
Content: headline ("Which one wins? Let real people pick."), one-line sub, two buttons: **Start voting** (tester) and **Post options** (creator), a 3-step strip (Post -> Pick -> See), a small honest line "Part of a live Flagsmith A/B test", footer links.
**Start voting** goes to `/start` (no account). **Post options** goes to `/login`.
States: returning testers go straight to `/app`; signed-in creators to `/creator`.
Every extra tap before the first vote costs testers, and the experiment needs 100+ of them: keep this page to one screen.

### P-02 Creator sign in `/login`
Content: **Continue with Google**, short privacy line. Testers never see this page.
States: loading, Google cancelled/failed.

### P-05 About this test `/start`
The only step between the link and voting. Content (plain language, 3 short lines): "PickLab is running a real experiment. You will see one of several voting layouts. We record your picks, how long you take, and which layout you saw. No account needed, nothing is sold or shared." One button **Got it, start** (this is the consent). Link to full privacy page.
Shown once per device. Wave is assigned automatically and never shown.

### P-06 Tester home `/app`
Purpose: show only what is open for this tester.
Content: greeting, **progress card** (e.g. "Session: 2 of 5 done" or "Start a 5-pick session"), **module cards** (title + instructions from remote config, count of sets left, icon per module). Primary button **Start session** (or Continue).
Module states: available, "No sets left, come back soon", and a short banner "New: Captions just opened" when a module appears (this is the wave demo moment: make it visible and delightful, with a subtle entrance animation).
Empty state: no module open for this wave yet ("Your group opens soon").
Hidden modules never appear (not greyed out).

### P-07 Voting screen `/app/session/[id]`
The core screen. Shared frame for all layouts:
- Top: close (X) with "Leave session?" confirm, progress dots or bar "Set 2 of 5", module name.
- Prompt text from the set title ("Which thumbnail would you click?") from module instructions.
- Body: one of four views chosen by Flagsmith (below). All four are Must.
- Feedback: tiny confirmation (check animation, 150 ms) then the next set slides in. No spinner between sets (next set is preloaded).
- Skeleton while flags resolve (no layout flash). If voting is paused mid-session, go to P-09.
- Error toast "Couldn't save, retrying" only if retries fail.

Layout A: **Grid** (control)
```
+---------------------------+
| Set 2 of 5          [X]   |
| Which one would you click?|
| +---------+  +---------+  |
| |   A     |  |   B     |  |
| +---------+  +---------+  |
| +---------+  +---------+  |
| |   C     |  |   D     |  |
| +---------+  +---------+  |
|      [ Confirm pick ]     |
+---------------------------+
```
2-4 tiles, equal size, tap selects (highlight ring + check), Confirm button enabled after selection. Tap again to change.

Layout B: **Swipe**
```
+---------------------------+
| Set 2 of 5          [X]   |
|   +-------------------+   |
|   |                   |   |
|   |     card (A)      |   |   drag right = pick
|   |                   |   |   drag left  = drop
|   +-------------------+   |
|    (X drop)   (check pick)|   buttons for non-touch
|   card 1 of 4             |
+---------------------------+
```
One card per option, drag right = like, left = pass, spring physics, buttons as alternative. Set is done when every card is swiped. Card order is shuffled per visitor. Undo is out of scope.

Layout D: **Yes / No**
```
+---------------------------+
| Set 2 of 5          [X]   |
|  Option 1 of 4            |
| +-----------------------+ |
| |        option A       | |
| +-----------------------+ |
|  [   No   ]   [  Yes   ]  |
+---------------------------+
```
One option at a time, no gesture, two big buttons, auto-advance. Same order shuffle as swipe. Must feel clearly different from swipe: calm, button-driven, no card motion.

Layout C: **This or that** (left / right)
```
+---------------------------+
| Set 2 of 5          [X]   |
|  Round 1 of 2             |
| +-----------------------+ |
| |          A            | |   tap to pick
| +-----------------------+ |
|           vs              |
| +-----------------------+ |
| |          B            | |
| +-----------------------+ |
+---------------------------+
```
Two stacked (mobile) or side-by-side (desktop) options. 2 options = 1 round; 3-4 options = knockout bracket with a small "Round x of y" label. Winner of the final is the pick.

Content types: image options keep original aspect ratio (thumbnails 16:9, reels 9:16 handled with contain + neutral backdrop); text options are large readable cards (captions). Tap target at least 44 px. Tap/hold on an image opens a zoom view (S).
Design every layout with the **same visual weight and speed** so the test measures layout, not polish.

### P-08 Session complete
Content: success moment, "5 picks in. Thanks!", stat ("You helped {n} creators"), buttons **Another session** (if sets left) and **Back home**, soft prompt to share the link. Triggers `session_completed` (no UI impact).

### P-09 Voting paused
Friendly "Voting is paused for a moment, we'll be right back" with a Retry button. Shown when `voting_enabled` is off. Also used as the generic maintenance state.

### P-10 My sets `/creator`
Content: list/grid of sets with thumbnail strip, title, module, created date, total votes, status; **New set** button. Empty state: illustration + "Post your first set".
Actions: open results, delete (confirm).

### P-11 New set `/creator/new`
Three steps in one page:
1. **Module**: cards for the modules open to creators (Thumbnails, Captions, Reel captions, Visuals), only those whose flag is on.
2. **Options**: title ("What are you choosing between?"), then 2 to 4 option slots. Image modules: drag-and-drop/camera upload per slot with preview and remove; text modules: textarea per slot with character count. Add/remove/reorder.
3. **Review & publish**: preview as a tester would see it, Publish.
States: upload progress per slot, wrong type/too large (5 MB), minimum 2 options, publish success -> results page, API error with retry.

### P-12 Set results `/creator/sets/[id]`
Content: set title, voter count, **ranked bars** per option (picks and %, winner highlighted), the options themselves (image/text) beside their bar, small note when under 10 voters ("Early results, not reliable yet"), delete set. Optional (S): split by layout for admins only.
States: no votes yet (waiting), loading, deleted.

### P-13 Admin overview `/admin` (team only)
Content: testers by wave (3 counters), sessions started/completed per layout (3 columns), votes total, completion rate per layout, **sample-ratio check** (expected vs actual split), module status list with link to Flagsmith, **Open Flagsmith experiment** button, last refreshed time. Read-only; flags are changed in Flagsmith, not here.
Access: admin emails only; others see 404.

### P-17 Live visitors `/admin/live` (team only, used on camera)
Purpose: prove Flagsmith is deciding things right now.
Content: header strip with the current view split as set in Flagsmith vs actual split of the last hour (4 coloured bars), counters (on site now, sessions today, finished). Table/feed of visitors, newest first: short id, wave badge, **view badge** (grid / swipe / this-or-that / yes-no, one colour each, reuse these colours everywhere), module, progress 0-5, status (voting, finished, dropped), last seen ("12 s ago"). New rows slide in. Auto refresh every 5 s, paused toggle.
Design for a laptop screen recording: large type, high contrast.

### P-14 Account `/account`
Creators: name, email, Sign out. Everyone (guests too): **Delete my data** with confirm.

### P-15 About this test / Privacy
Static pages: what A/B test is running, what is recorded, contact, how to delete data.

### P-16 Errors
404 ("That page isn't here"), 500 ("Something broke, try again"), session-expired prompt (creators only).

---

## 3. Flows to design

1. New tester: P-01 -> P-05 -> P-06 -> P-07 x5 -> P-08. (Two taps to the first vote.)
2. Returning tester: P-06 -> Continue session -> P-07.
3. Creator: P-01 -> P-02 -> P-10 -> P-11 -> P-12.
4. Release wave moment: tester sits on P-06; a module card appears with "New" badge without reload (flag refresh on focus/60 s).
5. Kill switch: tester on P-07 -> next flag refresh says paused -> P-09 -> Retry returns when back.

## 4. Flag-driven UI (what changes by flag)

| Flag | UI effect |
| --- | --- |
| `module_*` on/off per wave | Module card appears/disappears (P-06, P-11 step 1) |
| Module remote config JSON | Card title, instructions, sets per session |
| `voting_layout` | Which of the four views P-07 renders (fixed per session) |
| `voting_enabled` off | P-09 replaces P-06/P-07 actions |

## 5. Shared components

App shell, top bar, avatar menu, button (primary/secondary/ghost, loading), card, module card, progress bar/dots, toast, modal/confirm, skeletons (home, voting, results), empty state, image uploader slot, text option card, option tile (selected state), swipe card, pair option, result bar, stat tile, badge ("New"), form field with error.

## 6. Design requirements

- Mobile first, 360 px minimum width; thumb-reachable primary actions at the bottom; safe-area insets for iOS.
- Light and dark theme supported if cheap; at least a strong light theme. Contrast AA.
- Motion: 150-250 ms transitions, spring on swipe; respect reduced-motion (swipe gets buttons, no slide).
- Accessibility: all voting actions keyboard operable (arrow keys + Enter for grid and this-or-that, left/right for swipe, Y/N keys for yes/no), focus rings, alt text on option images (creator-supplied title fallback), live region announces "Pick saved, set 3 of 5".
- Tone: friendly, short, honest; never promise payment or rewards.
- All layouts must match in image size, copy and timing so only the layout differs.

## 7. Deliverables expected from the UI design

Mobile frames for every page in the page map, all four views of P-07, the Live page P-17, with selected/loading/error states, desktop versions of P-06, P-07, P-11, P-12, component sheet, empty/loading/error states, and a tiny style guide (colours, type scale, radius, spacing, motion).

## 8. Content to prepare for seeding

At least 20 sets per live module before 28 Nov (4 options for some, 2-3 for others) so each tester can finish 5 sets; mix of real creator content (from friends) and clearly labelled sample sets.
