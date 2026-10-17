# Focused pairing editor

Production deployment dpl_FpNYVVcBaYAG45ifQFL7RfAaBXGm is Ready and aliased to https://sorora.vercel.app.
Applied migration 0036_batch_pairing_changes.sql to production project qkizypdwgqhkxwuhzmbr using SQL editor; success result returned.

Editor starts with a searchable pool rather than all Big cards. Selecting Littles includes their current Bigs, with all occupants visible for capacity and swaps. Destinations can be searched and added; Show everyone remains available. Admins can stage moves and swaps, review the final before/after list, and save the sequence atomically. Existing change_pairing checks validate every operation, preserve reasons/audit entries, and reject stale versions or locked cycles.

Validation: 11 component tests; PostgreSQL integration tests including atomic rollback and multiple-operation success; production build; actual PairingBoard rendered and exercised with sample names locally. No production pairings edited during verification.
