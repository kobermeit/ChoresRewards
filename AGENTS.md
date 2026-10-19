# Project Guidelines for ChoresRewards

## Plan of Action First
- **Provide a Plan of Action First**: When the user sends a message with feedback or changes without an explicit "go and fix this now" instruction, respond quickly with a clear plan of action detailing how the message was interpreted and the intended implementation steps, so the user can review and confirm before work begins.

## Local Server & Process Lifecycle
- **Keep server running while actively collaborating**: Do NOT kill the local server while pair programming / actively working with the user unless the user explicitly indicates they are stepping away or concluding the session.
- **Sleep & Power Management**: When the user states they are finishing, leaving, or stepping away, clean up and terminate background server processes so the host PC can sleep.
- **Sleep Sequence Order**: When asked to put the PC to sleep, ALWAYS send your final complete summary / status message to the user FIRST so they can read what was done. Only after the final response has been delivered should the OS sleep command be executed (e.g. giving a slight delay or executing as the final action after messaging), never cutting off or suspending mid-turn before the user sees the summary.

## Versioning Protocol
- **Only increment version on deploy/push**: Do NOT bump versions multiple times during local development. Only increment when preparing to deploy/push to git, and use a single bump (e.g., `1.2.0` -> `1.2.1` or `1.3.0` depending on release scope).
- **Update All 4 Version Files in Lockstep**: When bumping versions, you MUST update all 4 of these files together:
  1. `choresrewards/config.yaml` (`version: "X.Y.Z"`) — **CRITICAL**: Home Assistant Supervisor reads this exact file to detect updates in HAOS. If omitted, Home Assistant will report "No updates available".
  2. `package.json` (Root workspace `version`)
  3. `client/package.json` (Frontend client `version`)
  4. `server/package.json` (Backend server `version`)
- **Always build production bundles before push**: Run `npm run build` (`npm run build:client` + `npm run build:server`) before committing.

## Quality Standards & Live Browser Verification
- **Mandatory Ingress & Environment Portability Audit**:
  - Run `npm run verify` (`node scripts/verify_ingress.js`) before every deploy or commit.
  - Zero tolerance for hardcoded absolute paths (`/static/...` or `/api/...`). All paths must be relative (`./static/...`) or passed through `resolveAssetUrl(url)`.
  - Ensure the client runs seamlessly in standalone mode (direct port `8099`), sub-path proxies, and Home Assistant Ingress dynamic token prefixes (`/api/hassio_ingress/<token>/`).
- **Full UI Regression Test Before Deploy**: Before doing a version push or deploy, run a comprehensive regression test in the local UI across every screen. Verify:
  - Adding, editing, and redeeming rewards
  - Adding, completing, and undoing chores
  - Adding, checking off, and removing shopping list items and meals
  - Notes full-length feed, inline expand/collapse, and full view modal
  - Extra bonus chores pool in settings with add, edit, and delete flow
  - Profile switcher modal and active user transitions
  - Visual polish: NO broken images, broken avatars, layout shifts, or horizontal scrollbars
  - Never modify user-configured external configs (like Calendar iCal/Embed URLs or Notion tokens).
- Maintain a high bar of visual polish, alignment, and responsiveness.

## Design System & Component Library Standards
- **Strict Compliance with [DESIGN_SYSTEM.md](file:///d:/projects/choresrewards/DESIGN_SYSTEM.md)**: All frontend development MUST adhere to the design tokens and UI primitives documented in `DESIGN_SYSTEM.md`.
- **UI Primitives Requirement**: Use `<Button>`, `<Input>`, `<Select>`, `<Card>`, and `<Badge>` from `@/components/ui`. Never add raw unstyled `<button>` or `<input>` tags for UI actions.
- **Forbid Arbitrary Inline Styles**: Inline styles for design attributes (colors, corner radius, borders, shadows) are forbidden unless required for dynamic data-driven values (e.g. person accent colors). Use CSS variables (`var(--btn-radius)`, `var(--card-radius)`, `var(--modal-radius)`) instead.
- **Single-Line Reskinning Guarantee**: The design system must maintain single-variable theme overrides in `tokens.css` so buttons, modals, and card styles can be reskinned in 1 line.

## Production Resource & Ingress Path Safety (CRITICAL)
- **Home Assistant Ingress Path Routing**: In production, Home Assistant serves the application behind a dynamic path prefix (e.g. `/api/hassio_ingress/<token>/`).
- **NEVER use Absolute Root Paths in the Client**: Absolute paths like `/static/...` or `/api/...` break in production because the browser requests `http://<ha-ip>:8123/static/...` bypassing the Ingress session token completely (yielding 404/401).
- **Mandatory Relative Resolution (`resolveAssetUrl` & `resolveAvatarUrl`)**:
  - Always wrap any static image, uploaded photo, avatar, audio, or resource URL through `resolveAssetUrl(url)` or `resolveAvatarUrl(avatar)`.
  - When declaring stock asset catalogs or audio clip arrays in frontend code, always specify them as `./static/...` (never `/static/...`).
  - Audio playback must pass `resolveAssetUrl(url)` to `new Audio(...)`.
- **Backend Dual-Path Mounting**: The Express server must continue to serve both `/static` and `/api/static`, as well as `/` and `/api`, guaranteeing both direct port 8099 and Ingress reverse-proxy traffic find all files.
- **Automated Verification**: Run `npm run verify` to automatically scan all source files for path violations before building production bundles.



