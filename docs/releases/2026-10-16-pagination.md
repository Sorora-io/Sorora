# Superuser directory pagination

Follows the deployed-source reconciliation commit `33c9c1b13c9f7b03dc457bd4bdc76f35f47fe409`, already pushed to main before this UI change.

Accounts and organizations share numbered page Buttons, a visible current page, accurate result ranges from the existing RPC totals, descriptive previous/next controls, ellipses and a validated direct page jump for long directories. Search starts at page one. Pending queries retain the prior page with a loading announcement and disabled page controls. Deleted/disappearing last pages clamp to the nearest remaining page instead of showing an empty out-of-range page. Empty and single-page results omit redundant navigation.

No backend migration or authorization change is needed. Focused component/directory tests: 16 passed; TypeScript and frontend build passed. The actual pagination component was exercised with sample data at desktop and 390px mobile widths; no horizontal overflow and page selection updated the displayed range. No live account or organization was changed to test.

The coordinated release after the roster profile change will use a clean export of the pushed Git revision with that exact commit recorded in Vercel deployment metadata. Local sample screenshots are outside the source commit.
