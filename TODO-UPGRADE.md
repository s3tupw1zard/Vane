# TODO — Upgrade

## Remaining Tasks

- [ ] Run `yarn lint` and fix lint errors introduced by dependency updates.
- [ ] Run `yarn test` and fix test regressions.
- [ ] Verify `drizzle-kit` compatibility — currently at `^0.18.1`, may need update for `drizzle-orm@^0.45.2`.
- [ ] Review `g` package in dependencies — appears to be an accidental install (`g@^2.0.1` is a meta-package).
- [ ] Review `yarn` package in dependencies — `yarn@^1.22.22` in `dependencies` is unusual and likely unnecessary.
- [ ] Consider updating `eslint@^10.2.0` and `eslint-config-next@^16.2.2` compatibility.
- [ ] Investigate `@modelcontextprotocol/sdk` and `express` for `integrations/mcp-server` — currently excluded from root build; should have its own build pipeline.
- [ ] Review `baseSearch.ts` `as any` cast for `ResearchBlockSubStep` — may indicate missing type variant.
- [ ] Review `scrapeURLAction` removal — verify no runtime dependency exists.

## Known Limitations

- `integrations/mcp-server` is excluded from root TypeScript compilation. It is a separate project with its own `package.json`, `tsconfig.json`, and build script. It should be built independently.
- The `JWT_SECRET` check in `src/lib/auth.ts` is bypassed during `next build` to allow production builds without environment variables. Runtime enforcement remains active.
