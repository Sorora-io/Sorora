# UI conventions

### Use real buttons, not hyperlinked text

Anything that performs an action or sends the user somewhere to do something
gets a `<Button>` (`sorority-matcher/src/components/Button.tsx`). Do not
substitute underlined text to save space or reduce visual weight.

Underlined text is only correct in two places:

- **Inline prose** — a link inside a running sentence
  ("Still have questions? [Contact us].")
- **Footer / site-map navigation** — the global footer's About / FAQ / Contact row

Everything else is a button: card actions, tab actions, anything sitting on
its own line as a call to action.

Pick the variant rather than dropping to text:

| Need | Use |
|---|---|
| Primary call to action | `variant="primary"` |
| Secondary, still prominent | `variant="outline"` |
| Tertiary / in-card action | `variant="quiet"` |
| Minimal, low emphasis | `variant="ghost"` |

There is a `variant="link"` (underlined, no pill). It exists for a couple of
legacy shortcuts and is **not** the escape hatch from this rule — reach for
`ghost` or `quiet` at `size="sm"` instead.

**Why:** underlined text reads as ambient prose and gets skipped, and it's a
much smaller tap target on mobile. If a row of buttons feels too heavy in a
narrow column, use `size="sm"` with `variant="quiet"` — don't downgrade them
to links.


### Rectangle corner radii

Use the shared tokens in `sorority-matcher/src/index.css` and their Tailwind utilities:

| Element | Utility | Radius |
|---|---|---|
| Buttons, inputs, selects, menu items, selection controls | `rounded-control` | 6px |
| Cards, outer panels, menus, dialogs, tour panels | `rounded-panel` | 8px |
| Small status badges, counts, rank markers | `rounded-badge` | 4px |

The shared `Button` defaults to the control radius. Avoid per-page pixel overrides and pill-shaped rectangular actions. Existing standard Tailwind radius utilities map to this scale for compatibility; prefer the semantic names for new UI. Unframed sections and underline navigation stay square. Avatars, dots, radio indicators, decorative circles, and switch tracks/thumbs retain their circular shapes. Preserve badge color semantics, especially the deadline badge's pale green background and dark green text.


### Workspace hierarchy and colour

- Tasks before decoration: show status and the next action first.
- Warm identity, practical workspace: use neutral backgrounds and neutral body text. Do not turn the workspace background green.
- Structure through alignment: distinguish task, chapter-progress, and personal-ranking sections with consistent headings, spacing, neutral rules, and clear grouping. Avoid decorative shadows or coloured framing.
- Colour with a purpose: dark green marks primary actions. Softer greens support selections and status; preserve the deadline badge's approved colours. Secondary actions at the same priority use the same outlined style.
- Specific copy: describe the actual task or count instead of generic welcome or motivational copy.
