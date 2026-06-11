# Scriptor UI Contribution Rules

These rules are for human engineers and AI coding agents.

## Before Creating a Component

1. Search `COMPONENT_LIBRARY.md`.
2. Search existing CSS classes with `rg`.
3. Search existing render functions in `static/js`.
4. Reuse the existing component if possible.
5. Extend an existing component if the new case is a true variant.
6. Create a new component only when no existing pattern fits.
7. Add the new component to `COMPONENT_LIBRARY.md`.
8. Add a production-class example to `/design-system`.

## Before Creating CSS

1. Check `static/css/base.css` tokens.
2. Reuse existing classes and utilities.
3. Reuse the established spacing rhythm.
4. Prefer existing radii: 8px, 16px, 24px, and 999px.
5. Prefer existing transition durations: 140-220ms.
6. Avoid hard-coded colors unless matching an established workspace pattern.
7. If a new hard-coded color is necessary, document it in `DESIGN_SYSTEM.md`.

Do not invent:

- New color palettes.
- New type scales.
- New navigation systems.
- New button families.
- New card treatments.
- New spacing scales.

without updating the design system documents.

## Before Creating a Page

1. Review `DESIGN_SYSTEM.md`.
2. Review `UX_PRINCIPLES.md`.
3. Identify the closest existing workspace pattern.
4. Use production app shell patterns unless the route is developer-only.
5. Keep developer routes hidden from production navigation.
6. Add route/template contract tests when a new route is introduced.

## Before Creating a Modal

1. Confirm the action needs to block the user.
2. Use `.modal-backdrop` and `.modal-card`.
3. Make the title a decision or object.
4. Make the body state the consequence.
5. Use one primary action and one secondary action when possible.
6. Do not use a toast for critical recovery, binding, or data integrity choices.

## Before Creating a Metric

1. Identify the source of truth.
2. Name the metric precisely.
3. Confirm whether the value is current manuscript size, tracked writing,
   session delta, goal progress, or editing progress.
4. Do not use "words written" for pre-existing manuscript words.
5. Add tests when data source or display meaning can regress.

## Before Changing Extension-Related UI

1. Identify the manuscript surface.
2. Identify whether the state comes from the extension, web app server, or local
   browser storage.
3. Preserve tab-specific behavior.
4. Preserve catch-up boundaries.
5. Do not advance baselines unless the product rule explicitly allows it.

## Required Updates for New UI Work

For every reusable component or pattern change:

- Update `COMPONENT_LIBRARY.md`.
- Update `DESIGN_SYSTEM.md` if tokens, layout, type, motion, or color change.
- Update `BRAND_GUIDE.md` if voice or copy patterns change.
- Update `UX_PRINCIPLES.md` if workflow behavior changes.
- Add or update `/design-system` examples.
- Add tests for route, static contract, or data contract as appropriate.

## Testing Expectations

Run at least:

- `node --check` for changed JavaScript files.
- `./.venv/bin/pytest -q` for app changes.

If CSS or static templates change, ensure the Pages mirror remains synced where
the repository requires it.

