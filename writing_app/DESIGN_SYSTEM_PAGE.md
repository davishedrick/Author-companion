# Design System Page

Route: `/design-system`

Template: `templates/design_system.html`

Visibility: authenticated but hidden. It must not appear in production
navigation.

## Purpose

The page is a living showroom for Scriptor's current production UI language.
It exists so engineers and AI coding agents can inspect real classes before
implementing new screens.

## Implementation Rules

- Use the production CSS bundle: `static/css/app.css`.
- Examples must use production class names where possible.
- Do not create mock component systems separate from the app.
- Developer-only wrapper classes may exist only to arrange the showroom.
- Do not add this route to global navigation, sidebar navigation, or project
  menus.

## Current Sections

- Typography.
- Color palette.
- Buttons.
- Cards and metrics.
- Status indicators.
- Forms.
- Progress indicators.
- Navigation.
- Modals.
- Workspace components.
- Empty states.

## Future Additions

When a reusable component is added:

1. Add a component entry to `COMPONENT_LIBRARY.md`.
2. Add a visual example to `/design-system`.
3. Add accessibility notes.
4. Add or update tests.

## Known Limitations

- The app is not yet componentized. Examples are representative markup using
  real classes, not imported JavaScript components.
- Some production render functions generate markup dynamically, so exact
  examples may need to be copied from the render function.
- The page is intentionally hidden and not a polished end-user workspace.

