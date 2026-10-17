# Organization invites and admin participation — October 5, 2026

- Production deployment dpl_9Q8RU1vAcyHWGxgpkhzeRsFJmQTt is Ready and aliased to https://sorora.vercel.app.
- Added a prominent Invite members card to Organization with join code, join link and shared copy buttons with success/error feedback.
- Added the existing checked admin-to-Big role action on Dashboard and Organization for admin-only members. Copy explains that Littles can rank them before they submit their own rankings, and admin access remains. Updated its label to Become a Big.
- Blind-ranking explanation describes an organization policy choice, including the use case of admins who also participate as Bigs; no privacy settings or memberships were changed.
- Strict production build, 23 focused tests and whitespace check passed.
- Signed-in production browser verified the Invite members card, copy success UI and updated Blind rankings explanation. Logged-in verifier is already Big + Admin, so the admin-only prompt was verified through component tests rather than changing the live membership.
