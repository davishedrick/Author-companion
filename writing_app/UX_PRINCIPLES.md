# Scriptor UX Principles

## Core Principle

Scriptor should protect writing trust. UI decisions must preserve accurate
session history, clear manuscript state, and predictable workflow transitions.

## Navigation Principles

- Keep navigation stable.
- Do not hide primary workspaces behind novelty interactions.
- Keep Write, Story, Edit, Goals, Activity, and project settings conceptually
  separate.
- Do not add developer pages to production navigation.
- Project context must be visible before project-specific actions.

## Dashboard Principles

- Separate project progress from words written inside Scriptor.
- Make the current manuscript count visible when relevant.
- Show starting word count when it is nonzero.
- Prefer metric labels that describe the source and meaning of a number.
- Do not inflate writing history with pre-existing manuscript words.

## Writing Principles

- Starting a session is an intentional action.
- Ending a session must reconcile start and end counts clearly.
- Negative writing sessions are valid if they happen in the same manuscript.
- Catch-up is a reconciliation event, not live monitoring.
- Active writing should not be interrupted by prompts unless safety requires it.

## Editing Principles

- Editing UI should orient around issues, passes, priorities, and structure.
- Issue cards should expose status, priority, type, and relevant context.
- Editing metrics should distinguish time, issue movement, and manuscript word
  deltas.

## Story Planning Principles

- Story planning is structured reference, not a drafting canvas.
- Plot entries should be grouped by meaningful category.
- Empty story tabs should provide a concrete add action.
- Hidden story tabs should not imply deleted content.

## Goal Tracking Principles

- Goals should be measurable and explain their live value.
- Heatmaps should summarize behavior without moralizing.
- Archived goals remain part of history but should not dominate current work.
- Goal progress language should be specific: complete, partial, missed, future.

## Publishing Principles

- Publishing and manuscript completion are state transitions.
- Confirm irreversible or high-impact transitions.
- Published/final stats mode should preserve history and explain how to reopen.
- Completion should not erase editing or writing data.

## Modal Principles

- Use modals only for blocking choices, structured creation/edit forms, or
  important confirmations.
- Modal titles should name the decision.
- Modal body should state the consequence.
- Primary action should be visually dominant only when it is the recommended
  committed path.
- Avoid hidden bypass paths in recovery or data integrity workflows.

## Empty State Principles

- Explain what is missing.
- Offer one concrete next action.
- Keep copy calm and short.
- Do not use empty states as marketing space.

## Data Density Principles

- Dense surfaces are acceptable for repeated operational work.
- Keep cards compact when users compare items.
- Use labels and alignment to reduce cognitive load.
- Avoid decorative panels around every section.

## Mobile Principles

- Use single-column fallbacks.
- Avoid horizontal-only workflows.
- Keep primary actions tappable.
- Preserve labels; do not rely only on icons.
- Maintain text wrapping inside buttons and cards.

## Accessibility Principles

- All interactive controls require visible labels or `aria-label`.
- Preserve focus-visible styling.
- Do not remove semantic form labels.
- Color cannot be the only state indicator.
- Modals should keep decisions clear and buttons reachable.
- Toasts should not carry critical unrecoverable information.

## Extension Integration Principles

- Extension state and web app state can refresh at different times.
- The web app should refetch server state when the user returns to it.
- The extension should never silently classify pre-existing manuscript words as
  newly written.
- Tab identity and manuscript surface identity must be explicit in extension
  workflows.

