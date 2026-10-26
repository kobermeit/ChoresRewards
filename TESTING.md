# Testing & Verification Guide

ChoresRewards has **no committed unit-test framework** (no Vitest/Jest/Playwright suite). Testing is
deliberate, proportional, and scripted only when the risk justifies it. This document defines that ladder
so agents and humans spend the right amount of effort on the right change.

---

## 1. The Verification Ladder

Run these in order. Each tier assumes the previous tier passed.

| Tier | Check | Command | When |
| :--- | :--- | :--- | :--- |
| 0 | Ingress / path-portability audit | `npm run verify` | Before **every** commit or deploy (mandatory) |
| 1 | Type-check + production bundle | `npm run build` | Before every commit (client `tsc` + Vite, server `tsc`) |
| 2 | Manual UI pass | `npm run dev:server` (serves `dist` on `:8099`) | Tier 2 / Tier 3 changes |
| 3 | Scripted browser smoke | temporary `puppeteer-core` script (see §4) | Tier 3 changes only |

### Which tier is my change?

| Tier | Examples | Required testing |
| :--- | :--- | :--- |
| **1 – Low risk** | Copy text, icon swap, CSS/token tweak, docs, single-component layout | `npm run build:client`. Read the diff. Done. |
| **2 – Medium risk** | Logic inside one view/section, new modal, new form validation, responsive tweak | `npm run build` + manual click-through of that view (add → edit → delete → undo). |
| **3 – High risk** | `store/uiSlice.ts`, `store/api.ts`, redux-persist config, migrations, `AppContext`, routing/`activeView`, `ErrorBoundary`, shared primitives in `components/ui/`, auth/roles, database schema | `npm run verify` + `npm run build` + scripted smoke of the touched flow **and** one neighbour view + a fresh-profile boot (empty persisted state). |

---

## 2. Manual UI Regression Checklist (Tier 3 / pre-deploy)

Boot on `http://localhost:8099` and walk every screen in `SideNav`:

- **Chores** — add, start timer, complete, undo, edit, delete; parent completes "for" a child (points go to the child).
- **Rewards** — add, edit, redeem (points deducted), view redeemed pool.
- **Meals** — add meal for 1 / 2 week planner, edit, remove.
- **Shopping** — add item, check off (optimistic), uncheck, remove; offline queue drains when back online.
- **Notes** — full feed, inline expand/collapse, full view modal.
- **Calendar** — month grid + upcoming list (do **not** alter user-configured iCal/embed URLs).
- **Settings** — every tab, especially Family (profile add/edit), Chores (extra bonus pool add/edit/delete), Seasonal, Sounds.
- **Profile switcher** — child ↔ parent ↔ family transitions, PIN gate.
- **Visual polish** — no broken images/avatars, no layout shift, no horizontal scrollbar, works at tablet width.


---

## 3. Resilience Regression (after touching state, persistence, or error handling)

These are the failure modes that once took the whole app down. Re-verify them whenever `uiSlice`,
redux-persist config, `ErrorBoundary`, or `App.tsx` view mounting changes:

1. **Legacy persisted payload** — a stored `ui` slice missing newer keys (e.g. `shoppingCheckedOverrides`,
   `offlineQueue`) must rehydrate via defaults, not `Object.keys(undefined)`.
2. **Corrupt / null persisted fields** — an explicit `null` in any persisted record/array must be repaired.
3. **Unknown persisted `activeView`** — must fall back to a real view, never a blank screen.
4. **View crash containment** — a throw inside one section renders that section's inline fallback only;
   the header, nav, and every other view keep working.
5. **Shell crash recovery** — a throw in the shell shows the full-screen fallback with
   **Try Again**, **Reload Page**, and **Clear device cache & reload**. The reset must remove only
   app keys (`persist:choresrewards`, `cr:`, `cr-` + `cr-` service-worker caches) and must **never**
   call `localStorage.clear()` — Home Assistant Ingress shares the origin with `hassTokens`/Lovelace.
6. **Recovery logging** — `cr:lastError` is written on crash and surfaced in the fallback "Technical details".

Always test twice: once in a private window (empty persisted state) and once with existing device state.


---

## 4. Scripted Browser Smoke (Tier 3, temporary only)

There is no committed harness. When a Tier 3 change needs one, write a throwaway script at
`scripts/_tmp_<topic>.js`, run it, then **delete it before committing**.

```js
// scripts/_tmp_smoke.js   (temporary - delete before commit)
const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP = 'http://localhost:8099/';

const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    userDataDir: `${require('os').tmpdir()}\\cr-smoke-${Date.now()}`, // always a fresh profile
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${APP}#/chores`, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 3500)); // let RTK Query + persist rehydrate
    const text = await page.evaluate(() => document.body.innerText);
    check('Chores view renders', /Chores/i.test(text));
  } finally {
    await browser.close();
  }
  process.exit(results.every(Boolean) ? 0 : 1);
})();
```

Rules:

- `puppeteer-core` is **not** a declared dependency. It may already exist in `node_modules`; otherwise
  `npm i --no-save puppeteer-core`. Drive the **system Edge/Chrome** via `executablePath` (no bundled
  Chromium download).
- Always use a **fresh `userDataDir`** per run so persisted state and service workers start clean; seed
  corrupt state via `page.evaluateOnNewDocument`.
- Build the client first (`npm run build:client`) - scripts test the served `dist`, not source.
- **Never commit** smoke scripts, temporary `_*.txt` logs, or temporary `throw` / `SMOKE` hooks in product
  code. Assert on real DOM classes/copy (e.g. `.cr-root-error-fallback`), not internals.

---

## 5. Known Non-Issues

- `npm run build:client` prints `Some chunks are larger than 500 kB` - expected (single-bundle app).
- `npm.cmd :` / `NativeCommandError` lines in PowerShell are just stderr from Vite, not a failure.
  Judge success by `built in Xs` and exit code `0`.
