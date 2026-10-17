# Replay tour in the footer

Moves the replay action from the dashboard content into the global site footer. Approved chapter members get a small ghost Button that opens `/dashboard?tour=1`, using the existing tour flow. Visitors and pending members do not see the action. Removes the unused dashboard callback and updates its test setup.

Validation: footer navigation and visibility tests; dashboard and app regression tests; TypeScript and production build; mobile browser verification of the real footer with sample membership data, including no horizontal overflow and the replay action. No database migration or Edge Function deployment is needed.

Commit and push before deployment. Deploy the verified pushed revision through the existing GitHub/Vercel integration and record Ready status, production alias and shipped-source verification in the deployment receipt. Unrelated legacy cleanup and screenshots remain outside this release.
