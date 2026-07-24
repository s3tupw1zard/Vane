# VANE Fork – PR Branch Scoring

> Scoring of all imported PR branches compared to `integration`.

> Score scale: 0.1 (minimal) to 10.0 (critical/urgent).

> Only open PRs are included. Closed or merged PRs are removed from this file.

> Merge conflict status: ✅ = Keine Konflikte | ⚠️ = Leichte Konflikte | ❌ = Schwere Konflikte

---

## Batch 2: PRs #27, #30, #37, #38, #39, #41, #45, #46, #49, #51

### 🔴 Critical Bug Fixes & Error Handling

| Branch | PR # | Score | Description | Merge Conflicts | Resolution Status |
|---|---|---|---|---|---|
| pr/pr-factory-issue-965-search-hang-1054 | 37 | 9.0 | Prevents "Brainstorming" hangs by catching search pipeline errors in both APISearchAgent and SearchAgent, emitting session error events and persisting failed searches with status: error | ❌ **SCHWER** - 2 files: `src/lib/agents/search/api.ts`, `src/lib/agents/search/index.ts` | Needs manual review - conflicts with integration's error handling structure |
| pr/fix-robustness-improvements-1039 | 51 | 8.5 | **COMPREHENSIVE** - Fixes 6 issues: Ollama context window, vLLM null-safety, YouTube embeds, SearXNG error handling, error logging across 9 files | ❌ **SCHWER** - 6 files: `academicSearch.ts` (DELETED), `socialSearch.ts` (DELETED), `webSearch.ts`, `ollamaLLM.ts`, `openaiLLM.ts`, `searxng.ts` | Needs manual review - integration deleted files PR modified |
| pr/pr-factory-issue-1011-limit-search-context-1053 | 38 | 7.5 | Caps search-result context at 20k tokens total, 2.5k per result to prevent model context overflow with token-based truncation | ⚠️ **MITTEL** - 1 file: `src/lib/agents/search/index.ts` | Can resolve - conflicts with error handling changes from #37 |
| pr/fix-openrouter-compatibility-1046 | 45 | 8.0 | Switches OpenAI provider to standard chat completions API for OpenRouter/LiteLLM compatibility, adds JSON fence stripping, null-safety for tool calls | ❌ **SCHWER** - 4 files: `openaiLLM.ts`, `ollamaLLM.ts`, `searxng.ts`, `webSearch.ts` | Needs manual review - overlaps with #49 (markdown fences) and #51 (null-safety) |
| pr/pr-factory-issue-980-groq-tool-schema-1050 | 41 | 6.5 | Restores Groq structured-output using `json_object` + json-repair, removes redundant `type` from web_search schema | ✅ **KEINE** - Clean merge | Ready to merge |
| pr/fix-strip-markdown-json-fences-1042 | 49 | 6.0 | Strips markdown code fences from LLM JSON responses in streamObject paths for OpenAI and Ollama | ❌ **MITTEL** - 2 files: `openaiLLM.ts`, `ollamaLLM.ts` | Can resolve - SUBSET of #45 which has more comprehensive JSON handling |
| pr/fix-issue-997-include-raw-response-in-parse-errors-1090 | 27 | 5.5 | Includes raw LLM response in JSON parse error messages for debugging | ❌ **LEICHT** - 2 files: `openaiLLM.ts`, `ollamaLLM.ts` | Can resolve - simple additive change to error messages |

### 🔒 Security & SSRF Prevention

| Branch | PR # | Score | Description | Merge Conflicts | Resolution Status |
|---|---|---|---|---|---|
| pr/pr-factory-issue-949-block-local-urls-1052 | 39 | 9.5 | **CRITICAL SECURITY** - Blocks localhost/private IP scraping, validates DNS results, rejects non-HTTP(S), limits redirects to 5 hops | ❌ **MITTEL** - 1 file: `src/lib/agents/search/researcher/actions/scrapeURL.ts` | Needs manual review - conflicts with #30's scraper changes (JSDOM vs Scraper class) |

### 🟡 Features & Infrastructure

| Branch | PR # | Score | Description | Merge Conflicts | Resolution Status |
|---|---|---|---|---|---|
| pr/master-1045 | 46 | 9.0 | **COMPREHENSIVE** - Standalone server startup script, server path resolution, multi-user auth scaffolding, Next.js standalone mode, 25 files changed | ❌ **SEHR SCHWER** - 15+ files: `next.config.mjs`, `package.json`, `package-lock.json`, `yarn.lock`, API routes, DB, searxng, etc. | Needs manual review - massive changeset, conflicts with many other PRs |
| pr/feature-cleanup-html-page-to-reduce-token-usage-1073 | 30 | 5.0 | Cleans HTML with JSDOM before markdown conversion, removes scripts/styles/templates to reduce token usage | ❌ **MITTEL** - 3 files: `package.json`, `yarn.lock`, `scrapeURL.ts` | **LIKELY OBSOLETE** - integration has superior Scraper class with Readability |

---

## Detailed Conflict Analysis

### PR #27 - Raw LLM Response in Errors (Score: 5.5)
**Files:** `src/lib/models/providers/ollama/ollamaLLM.ts`, `src/lib/models/providers/openai/openaiLLM.ts`

**Conflicts:**
- `ollamaLLM.ts`: Integration added `extractJsonObject` utility, PR adds raw response to error messages
- `openaiLLM.ts`: Integration has different error handling structure

**Resolution:** Simple - preserve PR's raw response logging, adapt to integration's error structure

---

### PR #30 - HTML Cleanup (Score: 5.0)
**Files:** `package.json`, `yarn.lock`, `src/lib/agents/search/researcher/actions/scrapeURL.ts`

**Conflicts:**
- `scrapeURL.ts`: PR uses JSDOM + TurnDown, integration uses `Scraper` class with different approach
- Package files: jsdom dependency vs integration's dependencies

**Resolution:** ⚠️ **LIKELY REDUNDANT** - Integration's `Scraper` class already has HTML cleanup. Need to compare implementations.

---

### PR #37 - Search Pipeline Error Handling (Score: 9.0)
**Files:** `src/lib/agents/search/api.ts`, `src/lib/agents/search/index.ts`

**Conflicts:**
- Both files: Integration has different error handling structure
- PR wraps entire search flow in try/catch, integration has more granular error handling

**Resolution:** Merge PR's error emission logic with integration's structure. Preserve session.emit('error') pattern.

---

### PR #38 - Search Context Capping (Score: 7.5)
**Files:** `src/lib/agents/search/api.ts`, `src/lib/agents/search/index.ts`, `src/lib/agents/search/context.ts`, `src/lib/utils/splitText.ts`

**Conflicts:**
- `index.ts`: Conflicts with #37's error handling changes
- Other files: Clean additions

**Resolution:** Apply after #37 is resolved. Context capping is independent feature.

---

### PR #39 - SSRF URL Blocking (Score: 9.5)
**Files:** `src/lib/agents/search/researcher/actions/scrapeURL.ts`

**Conflicts:**
- `scrapeURL.ts`: PR adds IP validation, DNS checks, redirect limiting. Integration uses different `Scraper` class structure

**Resolution:** **CRITICAL** - Security fix must be preserved. Adapt validation logic to integration's Scraper class architecture.

---

### PR #41 - Groq Tool Schema (Score: 6.5)
**Files:** `src/lib/agents/search/researcher/actions/webSearch.ts`, `src/lib/models/providers/groq/groqLLM.ts`

**Conflicts:** None detected

**Resolution:** ✅ Ready to merge

---

### PR #45 - OpenRouter Compatibility (Score: 8.0)
**Files:** 6 files including `openaiLLM.ts`, `ollamaLLM.ts`, `searxng.ts`, `parseJson.ts`, `webSearch.ts`

**Conflicts:**
- `openaiLLM.ts`: Major rewrite to use chat.completions.create instead of parse/stream
- `ollamaLLM.ts`: JSON fence stripping overlaps with #49
- `searxng.ts`: Error handling overlaps with #51
- `webSearch.ts`: Query validation overlaps with #51

**Resolution:** This is comprehensive. #49 (markdown fences) is SUBSET of this PR. #51's null-safety should be merged into this.

---

### PR #46 - Standalone Server (Score: 9.0)
**Files:** 25+ files including config, API routes, DB, searxng, etc.

**Conflicts:**
- Massive overlap with integration branch
- `next.config.mjs`, `package.json`: Structural changes
- API routes: Error handling changes
- `searxng.ts`: Overlaps with #45, #51
- DB migration: Path resolution changes

**Resolution:** **MAJOR EFFORT** - This is infrastructure-critical. Need systematic file-by-file resolution. Priority: server paths > startup script > error handling.

---

### PR #49 - Markdown Fence Stripping (Score: 6.0)
**Files:** `src/lib/models/providers/ollama/ollamaLLM.ts`, `src/lib/models/providers/openai/openaiLLM.ts`, `src/lib/utils/parseJson.ts`

**Conflicts:**
- Completely SUBSET of #45 which has more comprehensive JSON handling

**Resolution:** ⚠️ **REDUNDANT with #45** - Close as redundant or cherry-pick only if #45 is rejected.

---

### PR #51 - Robustness Improvements (Score: 8.5)
**Files:** 9 files across providers and search actions

**Conflicts:**
- `academicSearch.ts`, `socialSearch.ts`: **DELETED in integration** - actions moved to `search/` subdirectory
- `webSearch.ts`: Structure changed in integration
- `ollamaLLM.ts`, `openaiLLM.ts`: Overlaps with #45
- `searxng.ts`: Overlaps with #45

**Resolution:** **COMPLEX** - Deleted files need special handling. Null-safety and error logging should be merged into #45's changes.

---

## Redundancy Analysis

### Detected Redundant PRs:
1. **PR #49 (Markdown fences) is REDUNDANT with PR #45** - #45 includes comprehensive JSON parsing with fence stripping
2. **PR #30 (HTML cleanup) is LIKELY REDUNDANT** - Integration has superior Scraper class with Readability
3. **PR #51 overlaps heavily with PR #45** - Both fix null-safety, error handling, searxng errors

### Recommended Primary PRs:
- **PR #45** as primary for JSON/LLM provider fixes (includes #49)
- **PR #51** for broader robustness (error logging, YouTube, context window)
- **PR #46** for infrastructure (standalone mode)

---

## Resolution Priority Order

1. **PR #41** - No conflicts, ready first ✅
2. **PR #39** - Critical security, resolve conflicts with integration's Scraper
3. **PR #37** - Error handling foundation
4. **PR #38** - Depends on #37
5. **PR #45** - Comprehensive JSON/LLM fixes (absorbs #49)
6. **PR #51** - Merge remaining robustness into #45
7. **PR #27** - Simple error message enhancement
8. **PR #46** - Major infrastructure, resolve last
9. **PR #30** - Evaluate if still needed after integration review
10. **PR #49** - Close as redundant with #45

---

*Analysis Date: 2026-07-24*
*10 PRs analyzed: 1 ready (#41), 9 need conflict resolution*
*3 likely redundant: #30, #49, and partial #51*
