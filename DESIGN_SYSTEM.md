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
2. **Forbid Design-Property Inline Styles (STRICT)**:
   - ❌ Do NOT use inline styles for colors, radii, borders, padding, or shadows (e.g., `style={{ borderRadius: 16, background: '#3b82f6', padding: '12px 16px' }}`).
   - ✅ Use semantic tokens (`style={{ borderRadius: 'var(--card-radius)' }}`), design system primitives (`Button`, `Card`, `Badge`, `Input`, `Select`), or CSS classes from `components.css`.
   - *Exception*: Dynamic, data-driven values (e.g. member accent colors `borderLeft: 4px solid ${member.color}`, or dynamic coordinates/percents) are permitted inline.
3. **Single Component Per File (< 200 LOC)**:
   - Components should represent a single logical element (e.g., `ChoreCard`, `RewardCard`, `MealDayColumn`).
   - Extract subcomponents, modals, and lane views into dedicated subcomponent files under `features/<feature>/components/`.
   - Keep components focused on JSX. Business calculations and network calls belong in custom hooks or RTK slices.
4. **DRY Modal Standards**:
   - Modals should never declare custom container wrappers with ad-hoc `borderRadius: '24px'`. They must use `var(--modal-radius)`.
4. **Preserve Legacy Token Compatibility**:
   - Legacy CSS classes like `.btn-primary`, `.btn-secondary`, `.btn-cancel`, and `.modern-input` are mapped to design tokens in `tokens.css` so that legacy templates or unrefactored utility views remain visually harmonious.

---

## 4. Responsive Layout & Form Standards

To prevent visual clutter, ragged form inputs, and horizontal overflow on mobile devices and tablets, the following responsive layout system is strictly enforced:

### Breakpoint Tokens
- **Mobile** (`< 640px`): Single-column feeds, full-width form inputs, stacked action bars.
- **Tablet / Kiosk** (`640px - 1024px`): 2-to-3 column grids, compact horizontal headers, touch targets >= 44px.
- **Desktop** (`> 1024px`): Full multi-column grids, sidebar navigation, maximum content container width (1400px).

### Layout Primitives (`client/src/components/ui/Layout.tsx`)
```tsx
import { Container, ResponsiveGrid, FormGrid, FormField, Stack, Cluster } from './ui';
```

1. **`<Container maxWidth={1200}>`**:
   - Always wrap feature views and standalone settings pages in `<Container>`.
   - Automatically applies `--gutter-mobile` (16px) on phones and `--gutter-desktop` (24px) on tablet/desktop.

2. **`<ResponsiveGrid minColWidth="260px" gap="var(--space-4)">`**:
   - Replaces custom CSS grid templates like `repeat(auto-fill, minmax(260px, 1fr))`.
   - Enforces `repeat(auto-fill, minmax(min(100%, 260px), 1fr))` ensuring cards gracefully shrink to 100% width on narrow mobile screens without ever clipping or triggering horizontal scrollbars.

3. **`<FormGrid>` & `<FormField colSpan={...}>`**:
   - **Forbid Fixed Pixel Input Widths**: Never write `style={{ width: 140 }}` or `style={{ width: 180 }}` inside flex rows.
   - Use the 12-column `<FormGrid>`:
     ```tsx
     <FormGrid onSubmit={handleSubmit}>
       <FormField colSpan={12}>
         <Input label="Title" value={title} onChange={...} />
       </FormField>
       <FormField colSpan={6}>
         <Input label="Points" type="number" value={points} onChange={...} />
       </FormField>
       <FormField colSpan={6}>
         <Select label="Assign To" value={assignee} onChange={...}>...</Select>
       </FormField>
     </FormGrid>
     ```
   - On screens `< 640px`, all `<FormField>` columns automatically expand to 12 cols (full width) to prevent cramped inputs. On screens `>= 640px`, they snap to their declared `colSpan`.

4. **`<Stack>` & `<Cluster>`**:
   - Use `<Stack gap="var(--space-4)">` for clean vertical layouts without arbitrary bottom margins.
   - Use `<Cluster gap="var(--space-3)" justify="space-between">` for wrapping horizontal toolbars, filter pill groups, and card action footers.

