# Scriptor Design System

This document is the master source of truth for Scriptor interface work. It
extracts the product language that already exists in the Flask app and Chrome
extension integration. It is not a redesign brief.

## Design Philosophy

Scriptor is a focused writing workspace for tracking manuscripts, sessions,
story planning, revision, goals, and publishing state.

Scriptor is:

- Structured: information is organized by manuscript workflow.
- Focused: screens should reduce ambiguity and support a next action.
- Purposeful: every metric, prompt, and control should explain why it exists.
- Quietly ambitious: the product can feel serious and capable without hype.
- Professional: UI should support repeat use, review, and decision making.

Scriptor is not:

- A gamified productivity toy.
- A marketing landing page inside the app.
- A visual experiment for its own sake.
- A place for decorative surfaces that do not clarify work.
- A system that treats historical manuscript words as newly written work.

## Visual Principles

### Hierarchy

Use the manuscript or task as the largest signal. Supporting metrics and actions
should sit below it in predictable groups. Prefer clear labels like "Current
words", "Starting word count", "Since tracking began", and "Open issue".

### Density

Scriptor should be scan-friendly. Dashboards can be information-dense, but each
cluster needs a purpose: project status, writing progress, activity, goals,
story entries, or edit issues.

### Whitespace

Whitespace is functional. Use it to separate workflows and decisions, not to
create decorative hero pages. Common gaps are 8, 10, 12, 14, 16, 18, 20, 22,
24, 28, 34, and 44px.

### Readability

Use high-contrast labels and clear numeric formatting. Labels are frequently
small, uppercase, or muted; values carry weight. Avoid long instructional
paragraphs in active work surfaces.

### Focus

The app should guide one current decision at a time: start a session, bind a
document, resolve an issue, add a story element, or review progress.

## Layout Rules

- App shell: `.app-shell` uses a 240px sidebar and fluid content column.
- Header: `.global-header` is sticky, compact, and always spans the app.
- Content: `.content-shell` contains mutually exclusive `.view` panels.
- Page max width: use `--max` (`1240px`) for centered standalone pages.
- Cards: `.card` is the default framed content unit.
- Workspace boards: Write, Activity, Goals, and Projects use board-level
  containers like `.tracker-progress-panel`, `.activity-board`, `.goals-board`,
  and `.projects-board`.
- Grid defaults: prefer `minmax(0, 1fr)`, `auto-fit`, and responsive collapse.
- Do not nest card-looking containers inside other decorative cards unless the
  nested unit is a real repeated item or modal.

## Color System

All new UI should use tokens from `static/css/base.css` first.

| Token | Value | Use |
| --- | --- | --- |
| `--brand-primary` | `#c66f4d` | Primary accent and active warmth |
| `--brand-secondary` | `#44312b` | Dark brand ink and strong actions |
| `--brand-tertiary` | `#8a7a6e` | Neutral supporting accent |
| `--neutral-0` | `#ffffff` | White panels and fields |
| `--neutral-50` | `#fff9f3` | App background start |
| `--neutral-100` | `#f7efe7` | App background end |
| `--neutral-200` | `#e9ded3` | Light borders |
| `--neutral-300` | `#d8c8ba` | Form borders |
| `--neutral-500` | `#8a7a6e` | Muted text |
| `--neutral-900` | `#211711` | Primary ink |
| `--success` | `#2f7d4a` | Completion and positive status |
| `--warning` | `#b86b00` | Caution and incomplete state |
| `--danger` | `#b34435` | Destructive or blocked state |
| `--info` | `#4b6f8f` | Informational state |

Workspace-specific colors currently exist in `dashboard.css`, `edit.css`, and
`edit2.css`, especially blue for writing activity, green for editing/activity
success, and orange for interaction emphasis. Reuse them only when matching the
existing workspace pattern.

## Typography System

- Font stack: use `--sans` for application UI.
- Serif: `--serif` exists for legacy hero titles and expressive headings.
- Hero titles: `.hero-title`, large manuscript or empty-state headline.
- Section titles: `h2` and `h3` inside `.section-head`.
- Body copy: normal paragraph text in cards or panels.
- Labels: muted, compact, often uppercase in stat strips and metric cards.
- Metadata: `.small-copy`, `.muted`, `time`, and pill/badge text.
- Button text: short command verbs, usually sentence case.

Do not scale type by viewport width except existing `clamp()` heading patterns.
Do not use negative letter spacing in new compact UI.

## Elevation System

- Primary surface: `--panel`, `--panel-strong`, `--shadow`.
- Standard card: `.card` with blur, border, radius, and shadow.
- Board surfaces: some newer workspace boards intentionally use flatter white
  panels with 8px or 0px radius.
- Menus: popover surfaces use stronger shadows and compact padding.
- Modal: `.modal-backdrop` plus `.modal-card` blocks the current workflow.

Prefer border plus light shadow over heavy elevation.

## Radius System

- Default app radius: `--radius` (`24px`).
- Small radius: `--radius-sm` (`16px`).
- Newer operational cards: often 8px.
- Pills and progress rails: 999px.
- Auth card and compact dashboard cards: 8px.

Do not introduce a new radius scale without documenting the reason.

## Motion System

Motion is minimal and state-driven.

- Common transition duration: 140-220ms.
- Progress fill transition: 320ms.
- Hover: small translateY or background/box-shadow shift.
- Menus: no complex animation.
- Focus: visible focus rings through `--focus-ring` and
  `--focus-ring-soft`.

Avoid animation that distracts from writing, editing, or review.

## Component Taxonomy

Current component families:

- App shell and global navigation.
- Project selector and menus.
- Buttons and route chips.
- Cards, panels, and board shells.
- Metrics, stat strips, and signal cards.
- Pills, badges, status labels.
- Forms and field grids.
- Progress rails, manuscript meter, heatmap, and rings.
- Modals and confirmation flows.
- Session timer, session dials, and floating timer.
- Activity timeline and charts.
- Project cards and lifecycle controls.
- Story/plot entry cards and tabs.
- Editing issue cards, filters, priority/status pills.
- Goal cards, goal heatmap, and goal rows.
- Publication/completion surfaces.
- Empty states and toasts.

See `COMPONENT_LIBRARY.md` for component-level rules.

## Inconsistencies Discovered During Audit

- `dashboard.css` contains several historical/cohesion passes. Later selectors
  often override earlier ones.
- Radius usage ranges from 0px project boards, to 8px operational cards, to
  24px standard cards.
- Some workspace colors are hard-coded instead of tokenized.
- There are two navigation generations: legacy sidebar `.nav` and current
  `.global-nav` header navigation.
- Some components are function-rendered in JS instead of reusable templates,
  which makes component reuse dependent on class naming.
- The app has both local and remote state refresh paths; UI that depends on
  extension updates must expect remote refresh timing.

## Recommended Standardizations

- Treat `base.css` tokens as canonical for new colors.
- Prefer 8px radius for dense operational cards and 24px for larger app cards.
- Preserve `.primary-btn`, `.ghost-btn`, and `.inline-btn` as the button core.
- Prefer `.item` for repeated list rows and cards in activity/editing flows.
- Keep one current stat-strip pattern for dashboards.
- Add any new reusable component to `COMPONENT_LIBRARY.md` and `/design-system`.

## Recommended Component Consolidations

- Consolidate duplicate card treatments into documented variants: standard card,
  dense operational card, board panel, and repeated item.
- Consolidate the two navigation generations by keeping `.global-nav` as the
  current primary pattern and treating `.nav` as legacy/sidebar support.
- Convert repeated metric/stat markup into a documented metric-card helper if
  the app becomes componentized.
- Tokenize hard-coded workspace colors that appear repeatedly in Activity,
  Goals, Edit, and heatmap styles.
- Normalize modal copy and button order across writing, editing, publishing,
  binding, and recovery flows.
- Keep `/design-system` updated as the visual registry before adding new
  component variants.
