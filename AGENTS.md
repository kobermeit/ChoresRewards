# Project Guidelines for ChoresRewards

## Plan of Action First
- **Provide a Plan of Action First**: When the user sends a message with feedback or changes without an explicit "go and fix this now" instruction, respond quickly with a clear plan of action detailing how the message was interpreted and the intended implementation steps, so the user can review and confirm before work begins.

## Local Server & Process Lifecycle
- **Keep server running while actively collaborating**: Do NOT kill the local server while pair programming / actively working with the user unless the user explicitly indicates they are stepping away or concluding the session.
- **Sleep & Power Management**: When the user states they are finishing, leaving, or stepping away, clean up and terminate background server processes so the host PC can sleep.

## Versioning Protocol
- **Only increment version on deploy/push**: Do NOT bump versions multiple times during local development. Only increment when preparing to deploy/push to git, and use a single bump (e.g., `1.2.0` -> `1.2.1` or `1.3.0` depending on release scope).

## Quality Standards & Live Browser Verification
- **Full UI Regression Test Before Deploy**: Before doing a version push or deploy, run a comprehensive regression test in the local UI across every screen. Verify:
  - Adding, editing, and redeeming rewards
  - Adding, completing, and undoing chores
  - Adding, checking off, and removing shopping list items and meals
  - Notes kanban and sticky notes
  - Profile switcher modal and active user transitions
  - Visual polish: NO broken images, broken avatars, layout shifts, or horizontal scrollbars
  - Never modify user-configured external configs (like Calendar iCal/Embed URLs or Notion tokens).
- Maintain a high bar of visual polish, alignment, and responsiveness.


