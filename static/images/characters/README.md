# Seasonal character art (hot-swap)

The character layer (`client/src/features/seasonal/SeasonalCharacters.tsx`) renders a few
animated characters in the screen gutters. Each one tries to load a custom file first:

```
static/images/characters/<theme>/<name>.svg
```

If that file is missing (404) the built-in inline SVG is used instead, so you can replace
any character just by dropping a file in — no code change, no rebuild of the app code
(the image is served from `/static`, which lives on the data volume in Docker).

Custom art is opt-in: add the character's name to the folder's `manifest.json`, e.g.

```json
{ "characters": ["jack", "zero"] }
```

Only those names load an image; everything else keeps the built-in SVG. This keeps the
console clean (no 404 attempts for art that does not exist yet).

Currently wired for the **halloween** theme with these names:

| Name | Role |
| :--- | :--- |
| `jack` | tall skeleton, left edge |
| `sally` | ragdoll, right edge |
| `zero` | ghost dog, floating above the right gutter |
| `oogie` | burlap sack, left gutter |
| `lock`, `shock`, `barrel` | small masks peeking over the bottom edge |

## Rules for the artwork

- **SVG preferred** (crisp at any size, tiny). PNG/WebP also work if you rename the
  reference — the loader uses `.svg`.
- **Viewport height ≈ 150–200 CSS px**, bottom-anchored; transparent background.
- **No baked-in animation** — the layer applies the idle motion (sway / float / wobble)
  and randomises phase so characters never move in lockstep.
- Give each file a `viewBox` and no fixed `width`/`height` so it scales to the slot.

## Where they appear

Only when **Settings → Seasonal Themes → Enable Seasonal Themes** is on *and* the theme
is active (e.g. the Halloween window) *and* the per-device
**Settings → Seasonal Themes → Show Seasonal Characters** toggle is enabled.
The layer is `pointer-events:none`, `aria-hidden`, hidden below 1100px wide, and honours
`prefers-reduced-motion`.

To place a character elsewhere, edit `SETS` (name → `left` / `right` / `bottom` / `width`)
in `SeasonalCharacters.tsx`.
