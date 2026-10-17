# Member-only chapter joining

- Production deployment dpl_G3KQxzUP6ZJY95XBegoGVY2d6CK5 is Ready and aliased to https://sorora.vercel.app.
- Applied 0035_join_as_member_only.sql to production Supabase project qkizypdwgqhkxwuhzmbr through the SQL editor. Read-back confirms the only INSERT policy requires caller-owned pending Big/Little memberships, is_admin=false, and requested_role=null.
- Live test chapter join-code screen verified to show only Big and Little. No membership request submitted during verification.
- Validation: 10 join/context tests passed, isolated PostgreSQL policy tests passed, production build passed.
- Existing chapter creation and internal administrator promotion flows retained.
