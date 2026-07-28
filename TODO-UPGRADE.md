# TODO — Upgrade

## Remaining Tasks

- [x] Run `yarn lint` and fix lint errors introduced by dependency updates. (Completed: migrated to flat config, 0 errors, 125 warnings remaining)
- [x] Run `yarn test` and fix test regressions. (Tests pass: 39/39)
- [x] Verify `drizzle-kit` compatibility — updated to `^0.31.10`, aligned with `drizzle-orm@^0.45.2` (Phase 3d)
- [x] Review `g` package in dependencies — removed (Phase 1)
- [x] Review `yarn` package in dependencies — removed (Phase 1)
- [ ] Address remaining lint warnings (125 warnings, mostly unused vars and prefer-const)
- [ ] Consider enabling stricter TypeScript ESLint rules after addressing warnings
- [ ] Investigate `@modelcontextprotocol/sdk` and `express` for `integrations/mcp-server` — currently excluded from root build; should have its own build pipeline.
- [ ] Review `baseSearch.ts` `as any` cast for `ResearchBlockSubStep` — may indicate missing type variant.
- [ ] Review `scrapeURLAction` removal — verify no runtime dependency exists.

## Completed Phases

- [x] Phase 1: Safe updates (minor version bumps, remove accidental packages)
- [x] Phase 2: Security fixes (transitive dependency resolutions)
- [x] Phase 3a: React 18 → 19 migration
- [x] Phase 3b: TypeScript 5 → 6 + @types/node 24 → 26
- [x] Phase 3c: Tailwind CSS 3 → 4 migration
- [x] Phase 3d: drizzle-kit 0.18 → 0.31
- [x] Phase 4a: AI/ML providers (@google/genai v2, @huggingface/transformers v4, @icons-pack/react-simple-icons v13)
- [x] Phase 4b: UI libraries (lucide-react v1, sonner v2, markdown-to-jsx v9, react-text-to-speech v5)
- [x] Phase 4c: Data/utility libraries (better-sqlite3 v13, yahoo-finance2 v4, uuid v14, officeparser v7)
- [x] Phase 5: PR Recreations (all PRs already implemented, closed resolved PRs and issues, added missing tests)

## Known Limitations

- `integrations/mcp-server` is excluded from root TypeScript compilation. It is a separate project with its own `package.json`, `tsconfig.json`, and build script. It should be built independently.
- The `JWT_SECRET` check in `src/lib/auth.ts` is bypassed during `next build` to allow production builds without environment variables. Runtime enforcement remains active.
