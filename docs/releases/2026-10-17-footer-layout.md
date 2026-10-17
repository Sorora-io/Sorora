# Footer layout cleanup

Groups site navigation and Instagram in a primary row, with Replay the tour and Analytics preferences together in a second utility row. Mobile uses a compact grid and centered controls. Analytics preferences now renders inside the footer rather than as a detached section beneath it; its existing analytics behavior, choice persistence and focus management are preserved.

Validation: full frontend suite, TypeScript and strict CI production build. Real-component desktop/mobile sample preview confirmed aligned controls, no horizontal overflow at 390px, and preferences opening/closing inside the footer with focus returning to its button. No migration or Edge Function change required.

Release uses the pushed GitHub revision via the existing Vercel integration. Deployment receipt records Ready status, production alias, exact commit metadata and shipped-source comparison. Unrelated legacy cleanup and screenshots remain outside this release.
