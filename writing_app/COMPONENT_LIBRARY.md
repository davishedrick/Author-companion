# Scriptor Component Library

This inventory documents reusable components already present in Scriptor. Reuse
these before creating new UI.

Each component entry includes purpose, usage, variants, and known
implementations.

## Buttons

### Primary Button

- Purpose: commit the main action in a flow.
- Use for: start session, create project, confirm save, publish, clear after
  confirmation.
- Do not use for: secondary navigation or multiple equal choices.
- Variants: `.primary-btn`, `.header-primary-btn`, `.writing-launch-cta`.
- Implementations: `layout.css`, `dashboard.js`, `edit.js`, `templates/index.html`.

### Ghost Button

- Purpose: secondary action with visible affordance.
- Use for: close, cancel, open history, alternative action.
- Do not use for destructive final confirmation.
- Variants: `.ghost-btn`.
- Implementations: `layout.css`, session modals, issue forms.

### Inline Button

- Purpose: compact list action.
- Use for: resolve issue, smaller row actions, project admin actions.
- Do not use as a page-level CTA.
- Variants: `.inline-btn`.
- Implementations: `layout.css`, `edit.js`, `app.js`.

### Route Chip

- Purpose: compact mode or route selection.
- Use for: workspace route affordances and icon/text chips.
- Variants: `.route-chip`, `.route-chip-icon`, `.route-chip-icon-only`.
- Implementations: `layout.css`, global navigation surfaces.

## Navigation

### Global Header

- Purpose: app-wide identity, project selection, primary workspace navigation,
  start-session action, and account menu.
- Use for: persistent app controls.
- Known classes: `.global-header`, `.brand-home-btn`, `.project-selector-btn`,
  `.global-nav`, `.avatar-menu-btn`.
- Implementations: `templates/index.html`, `app.js`, `layout.css`.

### Sidebar Navigation

- Purpose: legacy/secondary workspace route list.
- Use for: existing app shell route controls.
- Known classes: `.sidebar`, `.nav`, `.nav-icon`, `.nav-label`.
- Implementations: `templates/index.html`, `app.js`, `layout.css`.

### Project Selector Menu

- Purpose: switch active project and create or manage projects.
- Use for: current project context.
- Known classes: `.project-selector-shell`, `.project-selector-menu`.

## Cards and Panels

### Standard Card

- Purpose: framed content group.
- Use for: dashboards, forms, charts, summaries.
- Do not use for full page sections if an unframed board is established.
- Class: `.card`.

### Metric Card

- Purpose: label/value/hint summary.
- Use for: dashboard metrics.
- Classes: `.metric`, `.label`, `.value`, `.hint`.

### Signal Card

- Purpose: icon plus status copy.
- Use for: qualitative project signals and momentum.
- Classes: `.signal-card`, `.signal-icon`, `.signal-copy`.

### Project Card

- Purpose: project overview in Projects board.
- Use for: one project tile.
- Classes: `.project-card`, `.project-card-actions`,
  `.project-card-admin-actions`.

### Board Panels

- Purpose: dense workspace-specific surfaces.
- Use for: Write tracker, Activity, Goals, Projects.
- Classes: `.tracker-progress-panel`, `.activity-board`, `.goals-board`,
  `.projects-board`.

## Status

### Pill

- Purpose: compact state, metadata, or category.
- Use for: issue status, section label, current manuscript, goal state.
- Classes: `.pill`, `.pill.status-open`, `.pill.status-resolved`,
  `.pill.status-deferred`, `.pill.issue-priority`.

### Badge

- Purpose: more prominent state than a pill.
- Use for: active state, baseline set, completion.
- Class: `.badge`.

### Toast

- Purpose: temporary non-blocking status.
- Use for: saved, exported, remote sync warning.
- Class and behavior: `.toast`, `showToast()`.

## Forms

### Form Grid

- Purpose: responsive form layout.
- Use for: project creation/edit, modal forms.
- Classes: `.form-grid`, `.form-grid.triple`, `.full`.

### Inputs

- Purpose: text, number, date, select, and textarea fields.
- Use with visible labels.
- Do not replace labels with placeholder-only UI.
- Classes: global `input`, `select`, `textarea`, `label`.

### Theme Option

- Purpose: segmented radio selection.
- Classes: `.theme-toggle`, `.theme-option`.

## Progress

### Progress Rail

- Purpose: linear completion display.
- Classes: `.progress-block`, `.progress-label-row`, `.progress-rail`,
  `.progress-fill`.

### Manuscript Progress Meter

- Purpose: Write tracker target progress with checkpoints.
- Classes: `.manuscript-progress-meter`, `.manuscript-progress-track`,
  `.manuscript-progress-fill`, `.manuscript-progress-marker`.

### Goal Heatmap

- Purpose: month view of daily goal completion.
- Classes: `.heatmap-shell`, `.heatmap-cell`, `.heatmap-swatch`,
  `.heatmap-detail`.

### Priority Ring

- Purpose: Edit 2.0 summary of issue priority.
- Classes: `.edit2-priority-ring`, `.edit2-priority-ring.is-empty`.

## Modals

### Modal Backdrop and Card

- Purpose: blocking decisions and forms.
- Use when the user must choose before continuing.
- Classes: `.modal-backdrop`, `.modal-card`, `.hidden`.

### Session Modal

- Purpose: choose writing/editing, duration, and start counts.
- Classes: `.start-session-card`, `.start-session-flow`,
  `.session-type-grid`, `.session-type-card`, `.session-dial`.

### Confirmation Modal

- Purpose: irreversible or important transitions.
- Use for: end session, manuscript complete, publish, clear binding.
- Copy must be specific and calm.

## Session Components

### Session Dial

- Purpose: choose session duration with a radial interaction.
- Classes: `.session-dial`, `.session-dial-rail`, `.session-dial-progress`,
  `.session-dial-handle`.

### Focus Screen

- Purpose: full-screen writing or editing timer.
- Classes: `.writing-session-screen`, `.editing-session-screen`.

### Floating Timer

- Purpose: persistent minimized active session control.
- Classes: `.floating-focus-timer`, `.floating-focus-copyline`,
  `.floating-focus-actions`.

## Activity Components

### Activity Timeline

- Purpose: recent writing/editing activity.
- Classes: `.activity-timeline-card`, `.activity-timeline-list`,
  `.activity-timeline-item`, `.activity-timeline-dot`,
  `.activity-timeline-baseline`.

### Activity KPI and Chart Cards

- Purpose: time-window summary and trend chart.
- Classes: `.activity-kpi-card`, `.activity-chart-card`,
  `.activity-range-tabs`, `.activity-narrative-strip`.

## Story Components

### Plot Section Tabs

- Purpose: switch story categories.
- Classes: `.plot-section-tabs`, `.plot-section-tab`,
  `.plot-section-tab-count`.

### Plot Entry Card

- Purpose: display one structured story element.
- Classes: `.plot-entry-card`, `.item-top`, `.small-copy`, `.goal-actions`.

### Plot Entry Modal

- Purpose: create/edit story elements.
- Functions: `openPlotEntryModal()`, `closePlotEntryModal()`.

## Editing Components

### Issue Card

- Purpose: track editing work.
- Classes: `.item`, `.item-top`, `.issue-title`, `.issue-snippet`,
  `.issue-note`, `.pill.issue-priority`.

### Issue Filters

- Purpose: filter unresolved/deferred/resolved issues.
- Classes: `.issue-filter-form`, `.issue-status-tabs`.

### Editing Metric Card

- Purpose: revision progress and stats.
- Classes: `.editing-metric-card`, `.editing-metric-card.dark`.

### Edit 2.0 Chapter Card

- Purpose: structure-level review and issue grouping.
- Classes: `.edit2-chapter-card`, `.edit2-chapter-page`,
  `.edit2-summary-display`.

## Goal Components

### Goal Board Row

- Purpose: display active goal progress.
- Classes: `.goal-board-row`, `.goals-progress-ring`.

### Goal Cards

- Purpose: active and archived goal summaries.
- Classes: `.goal-card`, `.archived-goal-card`.

## Publishing Components

### Manuscript Complete Action

- Purpose: transition a finished manuscript into completion state.
- Classes: `.manuscript-complete-btn`, `.disabled-action-tooltip`.

### Published Dashboard

- Purpose: final stats mode after publishing.
- Classes: `.published-hero`, `.published-celebration-screen`,
  `.published-stat-card`.

## Empty States

### Workspace Empty State

- Purpose: explain why a workspace is empty and provide the next action.
- Classes: `.empty-state`, `.empty-panel`.

### List Empty State

- Purpose: compact no-data state inside lists.
- Class: `.empty`.

## Rules for New Components

Every new reusable component must include:

- Purpose.
- When to use.
- When not to use.
- Variants.
- Accessibility considerations.
- Production example in `/design-system`.

