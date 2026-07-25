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
| 112 | pr-25-resolved | integration | 2026-07-24 | ✅ Merged | Consolidated error handling from PRs #22, #23, #25, #32 - prevents stuck message states |
| 113 | pr-29-35-resolved | integration | 2026-07-24 | ✅ Merged | Consolidated Tavily provider + maxResultsPerQuery from PRs #29, #35 |
| 114 | pr-31-resolved | integration | 2026-07-24 | ✅ Merged | Image search via Ollama vision (replaces PR #31) |
| 115 | pr-33-resolved | integration | 2026-07-24 | ✅ Merged | MiniMax-M2.7-highspeed model (replaces PR #33) |

---

## Resolution Summaries

### PR #3: MiniMax Provider Support
**Conflict:** Single file (`src/lib/models/providers/index.ts`) with parallel addition conflict
**Resolution:** Included both MiniMaxProvider and DeepSeekProvider imports and registrations
**Complexity:** 2/10 - Trivial parallel additions

### PR #13: SearXNG Similarity Fallback
**Conflict:** Single file (`src/lib/agents/search/.../baseSearch.ts`) with You.com provider integration and mode transition structure
**Resolution:** 
- Accepted integration's You.com provider dispatcher (searchYoucom integration)
- Preserved PR's detailed comment about external SearXNG instances and number_of_results edge case
- Updated mode transition from `else if` to separate blocks for future extensibility
- Maintained batch embedding optimization and fallback logic for similarity filter
**Complexity:** 4/10 - Structural merge, preserved both PR's fix and integration's provider support

### PR #9: OpenRouter Streaming Fix
**Conflict:** Single file (`src/lib/models/providers/openai/openaiLLM.ts`) with tool-call parsing differences
**Resolution:** Merged PR's parseToolArguments helper with integration's array pattern and extractJsonObject utility
**Complexity:** 6/10 - Localized to 2 methods, required understanding streaming logic

### PR #18: Multi-User Authentication & RBAC
**Conflicts:** 1 file (`src/lib/agents/search/researcher/actions/search/baseSearch.ts`)
**Resolution:** 
- Preserved PR's complete quality mode implementation with AI-powered search result picker and information extractor
- Integrated similarity-based fallback from integration branch for external SearXNG instances (critical for production deployments)
- Kept PR's embedding stripping optimization to prevent OOM errors when processing 60-70+ search results
- Resolved structural conflict in executeSearch: merged PR's `else if` chain with integration's mode separation
- Both speed/balanced and quality modes now have similarity fallback for robustness
**Complexity:** 7/10 - Multiple conflict regions in critical search agent code, required preserving both PR's AI features and integration's optimizations

### PR #4: You.com Search Provider
**Conflicts:** 3 files (baseSearch.ts, config/index.ts, serverRegistry.ts)
**Resolution:** 
- serverRegistry.ts: Unified config key naming, added all three provider helpers
- config/index.ts: Added You.com to provider options, included youcomApiKey field
- baseSearch.ts: Updated searchWeb dispatcher to support SearXNG, fastCRW, and You.com
**Complexity:** 7/10 - Architectural merge to support multi-provider search

### PR #112: Consolidated Error Handling (PRs #22, #23, #25, #32)
**Conflicts:** 3 files (`src/lib/agents/search/index.ts`, `src/lib/agents/search/api.ts`, prompts)
**Resolution:** 
- Unified error handling structure with two-method pattern (searchAsync + _searchAsync)
- Database status updates to 'error' on failure (critical from PR #25)
- Error event emission to sessions for client-side error display
- Integrated spelling fixes from PR #32
**Complexity:** 6/10 - Consolidated 4 PRs into single implementation
**Files Changed:** 3

### PR #113: Tavily Provider + Result Limiting (PRs #29, #35)
**Conflicts:** 11 files (config, dispatcher, types, API routes)
**Resolution:**
- Added Tavily as 4th search provider alongside SearXNG, fastCRW, You.com
- Integrated maxResultsPerQuery and maxTotalResults limits for token efficiency
- Updated config UI with searchProvider selection and tavilyAPIKey field
**Complexity:** 7/10 - Multi-feature consolidation across search stack
**Files Changed:** 11

### PR #114: Image Search via Vision (PR #31)
**Conflicts:** 3 files (vision API route, Attach component, README)
**Resolution:**
- Added POST /api/vision endpoint using OpenAI SDK with Ollama backend
- Image detection in Attach component with automatic query generation
- File input updated to accept image/* files
**Complexity:** 4/10 - Clean feature addition, minimal conflicts
**Files Changed:** 3

### PR #115: MiniMax-M2.7-highspeed (PR #33)
**Conflicts:** 1 file (`src/lib/models/providers/minimax/index.ts`)
**Resolution:** Added M2.7-highspeed model variant to defaultChatModels array
**Complexity:** 2/10 - Simple model addition
**Files Changed:** 1

---

## Post-Resolution Checklist

- [x] All 5 PR branches pushed to GitHub
- [x] Verify PR mergeability on GitHub (gh pr view <NUMBER>)
- [x] Remove entries from VANE-FORK-SCORES.md for resolved/closed/merged PRs
- [x] Clean up worktrees (completed)
- [ ] Final merging to be done on GitHub

---

*Last updated: 2026-07-24*

## Batch 2 Summary: Closed/Replaced PRs

| Original PRs | Consolidated Into | Status | Description |
|--------------|-------------------|--------|-------------|
| #22, #23, #25, #32 | PR #112 | ✅ Merged | Error handling consolidation - prevents stuck message states |
| #29, #35 | PR #113 | ✅ Merged | Tavily provider + maxResultsPerQuery feature |
| #31 | PR #114 | ✅ Merged | Image search via Ollama vision model |
| #33 | PR #115 | ✅ Merged | MiniMax-M2.7-highspeed model variant |
| #27 | - | ❌ Closed | Raw LLM response in errors - not consolidated |
| #30 | - | ❌ Closed | HTML cleanup - superseded by integration's Scraper class |

**Total:** 10 original PRs → 4 consolidated PRs (#112, #113, #114, #115), 2 closed without replacement (#27, #30)


