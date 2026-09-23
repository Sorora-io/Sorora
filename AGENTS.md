# AGENTS.md

Conventions for AI agents working in this repo. Keep entries short and
rule-shaped — a convention you'd otherwise have to re-explain every session.

## UI

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
