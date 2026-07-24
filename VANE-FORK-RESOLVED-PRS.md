# VANE Fork – Resolved PRs

> Merge conflict resolutions for PRs targeting the `integration` branch.

## ✅ Resolved PRs

| PR # | Source Branch | Target Branch | Resolution Date | Status | Notes |
|------|---------------|---------------|-----------------|--------|-------|
| 3 | pr/octo-20260713-add-minimax-provider-recvoLarLluey1-clean-1166 | integration | 2026-07-24 | ✅ Resolved | Included both MiniMax and DeepSeek providers in providers/index.ts |
| 13 | pr/fix-issue-1119-searxng-number-of-results-1120 | integration | 2026-07-24 | ✅ Resolved | Merged batch embedding optimization with fallback logic for empty similarity filter results |
| 9 | pr/fix-openrouter-stream-empty-args-1151 | integration | 2026-07-24 | ✅ Resolved | Combined parseToolArguments helper with integration's extractJsonObject and error handling |
| 18 | pr/main-1107 | integration | 2026-07-24 | ✅ Resolved | Merged README.md (Vane-MU features + original docs), accepted integration's minor code fixes |
| 4 | pr/feat-youcom-search-provider-1164 | integration | 2026-07-24 | ✅ Resolved | Unified search provider support for SearXNG, fastCRW, and You.com across config and dispatcher |

---

## Resolution Summaries

### PR #3: MiniMax Provider Support
**Conflict:** Single file (`src/lib/models/providers/index.ts`) with parallel addition conflict
**Resolution:** Included both MiniMaxProvider and DeepSeekProvider imports and registrations
**Complexity:** 2/10 - Trivial parallel additions

### PR #13: SearXNG Similarity Fallback
**Conflict:** Single file (`src/lib/agents/search/.../baseSearch.ts`) with overlapping embedding logic
**Resolution:** Kept integration's batch embedding optimization, added PR's fallback logic for empty filter results
**Complexity:** 4/10 - Semantic merge, both improvements compatible

### PR #9: OpenRouter Streaming Fix
**Conflict:** Single file (`src/lib/models/providers/openai/openaiLLM.ts`) with tool-call parsing differences
**Resolution:** Merged PR's parseToolArguments helper with integration's array pattern and extractJsonObject utility
**Complexity:** 6/10 - Localized to 2 methods, required understanding streaming logic

### PR #18: Multi-User Authentication & RBAC
**Conflicts:** 4 files (README.md major, search/index.ts, openaiLLM.ts, yarn.lock)
**Resolution:** 
- README: Manual merge preserving Vane-MU features, badges, sponsors, troubleshooting
- search/index.ts: Accepted integration's clearer error messages
- openaiLLM.ts: Accepted integration's .trim() safeguard
- yarn.lock: Accepted integration version
**Complexity:** 6/10 - README required careful manual merge, code conflicts trivial

### PR #4: You.com Search Provider
**Conflicts:** 3 files (baseSearch.ts, config/index.ts, serverRegistry.ts)
**Resolution:** 
- serverRegistry.ts: Unified config key naming, added all three provider helpers
- config/index.ts: Added You.com to provider options, included youcomApiKey field
- baseSearch.ts: Updated searchWeb dispatcher to support SearXNG, fastCRW, and You.com
**Complexity:** 7/10 - Architectural merge to support multi-provider search

---

## Post-Resolution Checklist

- [x] All 5 PR branches pushed to GitHub
- [ ] Verify PR mergeability on GitHub (gh pr view <NUMBER>)
- [ ] Remove entries from VANE-FORK-SCORES.md for resolved PRs
- [ ] Clean up worktrees (completed)
- [ ] Final merging to be done on GitHub

---

*Last updated: 2026-07-24*
