// Shared constants and types for the client.

## Sync note (two-repo setup)

The server repo contains its own copy of `shared/constants.ts` and
`shared/obstacles.ts`. These must stay in sync: any change to speed clamps, ramps,
lives, durations, obstacle spacing, or track length must be made in BOTH copies and
verified against each other. The obstacle generator must be deterministic and
identical on both sides so every client renders the same track as the server.

## Files

- constants.ts — gameplay tuning constants (mirrors server copy).
- obstacles.ts — deterministic seeded obstacle generator (mirrors server copy).
- types.ts — room/snapshot/player shapes (mirrors server copy).
