# VANE Fork – PR Branch Scoring

> Scoring of all imported PR branches compared to `integration`.

> Score scale: 0.1 (minimal) to 10.0 (critical/urgent).

> Only open PRs are included. Closed or merged PRs are removed from this file.

> Merge conflict status: ✅ = Keine Konflikte | ⚠️ = Leichte Konflikte | ❌ = Schwere Konflikte

## 🔴 Fixes & Bug Fixes

| Branch | Score | Description | Merge Conflicts | Resolution Status |
|---|---|---|---|---|
| pr/fix-openrouter-stream-empty-args-1151 (#9) | 6.5 | Fix OpenRouter streaming tool-call argument parsing with improved error handling and parseToolArguments helper | ✅ Resolved | Merged parseToolArguments helper with integration's extractJsonObject and array pattern |
| pr/fix-issue-1119-searxng-number-of-results-1120 (#13) | 7.0 | Fall back to top results when similarity filter removes all SearXNG results - critical fix for external SearXNG instances | ✅ Resolved | Combined batch embedding optimization with fallback logic |

## 🔒 Security & Performance

| Branch | Score | Description | Merge Conflicts | Resolution Status |
|---|---|---|---|---|
| pr/main-1107 (#18) | 8.5 | Add multi-user authentication and role-based access control - comprehensive auth system with RBAC, admin panel, session management | ✅ Resolved | Merged README manually, accepted integration's minor code fixes |

## 🟡 Features & Enhancements

| Branch | Score | Description | Merge Conflicts | Resolution Status |
|---|---|---|---|---|
| pr/feat-youcom-search-provider-1164 (#4) | 7.5 | Add You.com as alternative search provider with config-driven dispatcher and result mapping | ✅ Resolved | Unified support for SearXNG, fastCRW, and You.com |

## 🔵 Providers & Integrations

| Branch | Score | Description | Merge Conflicts | Resolution Status |
|---|---|---|---|---|
| pr/octo-20260713-add-minimax-provider-recvoLarLluey1-clean-1166 (#3) | 5.0 | Add MiniMax provider support with OpenAI-compatible and Anthropic-compatible endpoints | ✅ Resolved | Included both MiniMax and DeepSeek providers |

## 🟢 Docs, CI/CD & Chore

| Branch | Score | Description | Merge Conflicts | Resolution Status |
|---|---|---|---|---|

---

## Resolution Summary

All 5 PRs have been successfully resolved and pushed to GitHub:

1. **PR #3** (MiniMax) - ✅ Resolved 2026-07-24 - 1 file, 2/10 complexity
2. **PR #13** (SearXNG fallback) - ✅ Resolved 2026-07-24 - 1 file, 4/10 complexity
3. **PR #9** (OpenRouter fix) - ✅ Resolved 2026-07-24 - 1 file, 6/10 complexity
4. **PR #18** (Multi-user auth) - ✅ Resolved 2026-07-24 - 4 files, 6/10 complexity
5. **PR #4** (You.com) - ✅ Resolved 2026-07-24 - 3 files, 7/10 complexity

See `VANE-FORK-RESOLVED-PRS.md` for detailed resolution notes.

---

*Last updated: 2026-07-24*
*All conflicts resolved - ready for GitHub merge*
