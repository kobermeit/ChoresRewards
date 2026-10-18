# ChoresRewards Design System & Component Library

This document outlines the design tokens, reusable component primitives, and architecture rules for ChoresRewards. All frontend code must adhere to these guidelines to ensure consistency, eliminate code duplication, and allow single-line theme and styling customizations.

---

## 1. Design Tokens (`client/src/styles/tokens.css`)

All fundamental design attributes (radii, colors, shadows, borders) are defined in CSS custom properties in `tokens.css`.

### Radius Tokens
| Token | Default | Semantic Alias | Purpose |
| :--- | :--- | :--- | :--- |
| `--radius-xs` | `4px` | | Tiny chips, tight badges |
| `--radius-sm` | `6px` | | Micro controls |
| `--radius-md` | `10px` | `--btn-radius`, `--input-radius` | Standard buttons, form inputs, selects |
| `--radius-lg` | `14px` | `--card-radius` | Cards, list items, small containers |
| `--radius-xl` | `20px` | `--modal-radius` | Dialog modals, flyouts, main panels |
| `--radius-2xl` | `28px` | | Prominent hero sections |
| `--radius-pill` | `9999px` | `--badge-radius` | Avatars, status pills, filter chips |

### Color Tokens
- **Primary Accent**: `--color-primary` (`#3b82f6`), `--color-primary-hover` (`#2563eb`), `--color-primary-border` (`rgba(59, 130, 246, 0.5)`)
- **Backgrounds**: `--color-bg-base` (`#0f172a`), `--color-bg-surface` (`#1e293b`), `--color-bg-card` (`rgba(30, 41, 59, 0.7)`), `--color-bg-modal` (`#1e293b`)
- **Status Colors**: `--color-danger` (`#ef4444`), `--color-success` (`#10b981`), `--color-warning` (`#f59e0b`), `--color-info` (`#38bdf8`)
- **Text & Borders**: `--color-text-primary` (`#f8fafc`), `--color-text-secondary` (`#94a3b8`), `--color-border-subtle` (`rgba(255, 255, 255, 0.08)`)

### Single-Line Customization
Want to restyle the entire application? You can adjust tokens in `tokens.css` with a single line change:
- **Change all button borders**: edit `--color-primary-border`
- **Change all button corner roundness**: edit `--btn-radius` (e.g. `4px` for square, `9999px` for pill)
- **Change all modal dialog corners**: edit `--modal-radius`
- **Change all card surfaces**: edit `--card-radius` or `--color-bg-card`

---

## 2. Component Primitives (`client/src/components/ui/`)

Always import and use the primitives exported from `@/components/ui`:

```tsx
import { Button, Input, Select, Card, Badge } from './ui';
```

### `<Button>`
- **Variants**: `primary`, `secondary`, `danger`, `success`, `ghost`
- **Sizes**: `sm`, `md`, `lg`
- **Props**: `icon` (FontAwesome class string), `isLoading` (shows spinner and disables), `fullWidth`
- **Example**:
  ```tsx
  <Button variant="primary" icon="fas fa-save" isLoading={isSaving} onClick={handleSave}>
    Save Changes
  </Button>
  ```

### `<Input>` & `<Select>`
- Standardized heights, tokenized border-radius (`var(--input-radius)`), focus rings, and dark glass background.
- Built-in `label`, `error`, and `helperText` props.
- **Example**:
  ```tsx
  <Input
    label="Chore Title"
    placeholder="e.g. Empty dishwasher"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
    error={errors.title}
    helperText="Keep titles short and action-oriented."
    required
  />

  <Select
    label="Assigned Family Member"
    value={assignedTo}
    onChange={(e) => setAssignedTo(e.target.value)}
  >
    <option value="">Select a person...</option>
    {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
  </Select>
  ```

### `<Card>`
- Standard container with tokenized background (`var(--color-bg-card)`), radius (`var(--card-radius)`), and optional glass blur.
- **Props**: `padding` (`none`, `sm`, `md`, `lg`), `interactive` (hover effect), `blur` (glass effect).

### `<Badge>`
- Semantic chip primitive for roles (`parent`, `child`, `family`), points, or custom status tags.
- **Variants**: `neutral`, `primary`, `success`, `warning`, `danger`.

### Modals (`.cr-modal-dialog`)
- Every modal container must use `.cr-modal-overlay` and `.cr-modal-dialog`.
- Border-radius is bound to `var(--modal-radius)`.
- Footers must align action buttons (`<Button variant="ghost">Cancel</Button>` and `<Button variant="primary">Confirm</Button>`).

---

## 3. Architecture Rules for Pair Programming & Agents

1. **No Raw HTML Buttons/Inputs for Actions**:
   - ❌ Do NOT write `<button className="btn-primary" style={{ padding: 10, borderRadius: 8 }}>...</button>`.
   - ✅ Always write `<Button variant="primary">...</Button>`.
2. **Forbid Design-Property Inline Styles**:
   - ❌ Do NOT use inline styles for colors, radii, borders, or shadows (e.g., `style={{ borderRadius: 16, background: '#3b82f6' }}`).
   - ✅ Use semantic tokens (`style={{ borderRadius: 'var(--card-radius)' }}`) or UI primitives.
   - *Exception*: Dynamic, data-driven values (e.g. member accent colors `borderLeft: 4px solid ${member.color}`, or drag-and-drop grid coordinates) are permitted inline.
3. **DRY Modal Standards**:
   - Modals should never declare custom container wrappers with ad-hoc `borderRadius: '24px'`. They must use `var(--modal-radius)`.
4. **Preserve Legacy Token Compatibility**:
   - Legacy CSS classes like `.btn-primary`, `.btn-secondary`, `.btn-cancel`, and `.modern-input` are mapped to design tokens in `tokens.css` so that legacy templates or unrefactored utility views remain visually harmonious.
