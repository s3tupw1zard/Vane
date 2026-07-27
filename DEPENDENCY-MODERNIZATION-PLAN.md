# Dependency Modernization Plan

**Created**: 2026-07-27  
**Status**: Phase 1 in progress  
**Repository**: s3tupw1zard/Vane (modernization fork)

---

## Executive Summary

Comprehensive dependency audit identifying 74 direct dependencies, 137 security vulnerabilities, and 12 outdated PRs requiring recreation. Plan divided into 5 phases with clear risk assessments and verification criteria.

### Environment
- **Yarn**: 1.22.22 (classic)
- **Node**: v24.18.0
- **Lockfile**: Healthy (290K, 6884 lines)
- **Direct dependencies**: 74 packages

### Security Status
- **137 vulnerability instances** (3 critical, 58 high, 66 moderate, 10 low)
- **Critical CVEs**: protobufjs, tar, brace-expansion (transitive)
- **Direct dependency CVEs**: axios (false positives - 1.18.1 installed), dompurify via jspdf

### PR Analysis (up to #110)
- **38 PRs already resolved** on canary
- **3 PRs documented** in PR-MIGRATION-NOTES.md (#37, #54, #111)
- **12 PRs need recreation** (dependency updates, bug fixes, security)

---

## Phase 1: Safe Updates (No Code Changes) - LOW RISK

**Estimated effort**: 1-2 hours  
**PR category**: Chore/Infra  
**Status**: IN PROGRESS

### Packages to Update

| Package | Current → Target | Type | Risk |
|---------|-----------------|------|------|
| @anthropic-ai/sdk | 0.111.0 → 0.115.0 | minor | LOW |
| @tavily/core | 0.6.4 → 0.7.6 | minor | LOW |
| next-themes | 0.3.0 → 0.4.6 | minor | LOW |
| openai | 6.33.0 → 6.49.0 | minor | LOW |
| **Remove `g`** | 2.0.1 → removed | accidental | NONE |
| **Remove `yarn`** | 1.22.22 → removed | accidental | NONE |

### Verification Criteria
- [ ] `yarn install` succeeds
- [ ] `yarn build` succeeds
- [ ] `yarn typecheck` passes
- [ ] `yarn lint` passes
- [ ] `yarn test` passes
- [ ] No new TypeScript errors
- [ ] No new lint warnings

### Implementation Steps
1. Edit `package.json`:
   - Update version constraints for 4 packages
   - Remove `g` from dependencies
   - Remove `yarn` from dependencies
2. Run `yarn install` to update lockfile
3. Run verification commands
4. Commit changes with descriptive message

### GitHub Issue
**Title**: chore: Safe dependency updates - remove accidental packages, update minor versions  
**Labels**: chore, infra, dependencies  
**Priority**: P0 (immediate)

---

## Phase 2: Security Fixes (Transitive Dependencies) - MEDIUM RISK

**Estimated effort**: 2-3 hours  
**PR category**: Security/Infra  
**Status**: PENDING

### Vulnerable Transitive Dependencies

| Package | Fix Version | CVEs | Severity | Paths |
|---------|-------------|------|----------|-------|
| brace-expansion | >=2.1.2 | CVE-2026-13149, CVE-2026-14257 | HIGH | 11+ via eslint, drizzle-kit, minimatch |
| protobufjs | >=7.6.5 | CVE-2026-41242 (critical), +5 more | CRITICAL | 2-4 via @huggingface/transformers |
| tar | >=7.5.19 | CVE-2026-59873 (critical), +4 more | CRITICAL | via npm/node-gyp toolchain |
| ws | >=8.21.0 | CVE-2026-48779, CVE-2026-45736 | HIGH | via playwright/vitest |
| postcss | >=8.5.18 | CVE-2026-45623, CVE-2026-41305 | HIGH | 3 paths |
| @xmldom/xmldom | >=0.8.13 | CVE-2026-41673, +3 more | HIGH | via mammoth/jspdf |
| form-data | >=4.0.6 | CVE-2026-12143 | HIGH | via axios |

### Implementation Strategy
Use `resolutions` field in `package.json` to force-update vulnerable transitive dependencies:

```json
{
  "resolutions": {
    "brace-expansion": "^2.1.2",
    "protobufjs": "^7.6.5",
    "tar": "^7.5.19",
    "ws": "^8.21.0",
    "postcss": "^8.5.18",
    "@xmldom/xmldom": "^0.8.13",
    "form-data": "^4.0.6"
  }
}
```

### Verification Criteria
- [ ] `yarn install` succeeds with resolutions
- [ ] `yarn audit --level high` shows reduced vulnerabilities
- [ ] `yarn build` succeeds
- [ ] `yarn test` passes
- [ ] No runtime errors from forced version mismatches
- [ ] Manual testing of affected features (eslint, playwright, PDF export)

### Risk Mitigation
- Test each resolution individually before combining
- If a resolution breaks functionality, document and create separate issue
- Keep original versions in `package.json` for reference

### GitHub Issue
**Title**: security: Force-update transitive dependencies to resolve critical CVEs  
**Labels**: security, infra, dependencies  
**Priority**: P0 (critical)

---

## Phase 3: Major Framework Upgrades - HIGH RISK

### Phase 3a: React 18 → 19

**Estimated effort**: 8-16 hours  
**PR category**: Breaking Changes  
**Status**: PENDING

#### Packages to Update
- react: 18.3.1 → 19.2.8
- react-dom: 18.3.1 → 19.2.8
- @types/react: 18.3.28 → 19.2.17
- @types/react-dom: 18.3.7 → 19.2.3

#### Impact Assessment
- **55 files** use React hooks
- **Complex hooks**: useChat (861 lines), useAuth
- **No class components** (good - reduces migration effort)
- **Risk**: useEffect cleanup changes, new ref behavior, Server Components

#### Migration Steps
1. Review React 19 migration guide
2. Audit all 55 React imports for deprecated patterns
3. Update useEffect cleanup functions
4. Test streaming functionality (useChat)
5. Test auth flow (useAuth)
6. Verify all 27 API routes

#### Verification Criteria
- [ ] `yarn typecheck` passes with React 19 types
- [ ] `yarn build` succeeds
- [ ] `yarn test` passes
- [ ] Manual testing: chat flow, auth, streaming
- [ ] No console warnings about deprecated APIs

#### GitHub Issue
**Title**: feat: Migrate to React 19 - breaking changes in hooks and refs  
**Labels**: breaking-change, dependencies, react  
**Priority**: P1 (high)

---

### Phase 3b: TypeScript 5 → 7

**Estimated effort**: 8-16 hours  
**PR category**: Breaking Changes  
**Status**: PENDING

#### Packages to Update
- typescript: 5.9.3 → 7.0.2
- @types/node: 24.13.3 → 26.1.1

#### Impact Assessment
- **203 TypeScript files**
- **Strict mode enabled**
- **Complex generics** in model providers
- **Risk**: Stricter type checking, new errors

#### Migration Steps
1. Review TypeScript 7 release notes
2. Run `yarn typecheck` to identify new errors
3. Fix type errors (likely 10-50 errors)
4. Update @types/node for Node 26 types
5. Verify all API routes type-check correctly

#### Verification Criteria
- [ ] `yarn typecheck` passes with zero errors
- [ ] `yarn build` succeeds
- [ ] `yarn test` passes
- [ ] No `any` types introduced as workarounds

#### GitHub Issue
**Title**: feat: Upgrade to TypeScript 7 - stricter type checking  
**Labels**: breaking-change, dependencies, typescript  
**Priority**: P1 (high)

---

### Phase 3c: Tailwind CSS 3 → 4

**Estimated effort**: 8-16 hours  
**PR category**: Breaking Changes  
**Status**: PENDING

#### Packages to Update
- tailwindcss: 3.4.19 → 4.3.3
- tailwind-merge: 2.6.1 → 3.6.0
- @tailwindcss/typography: 0.5.20 → latest compatible
- @headlessui/tailwindcss: 0.2.2 → latest compatible

#### Impact Assessment
- **Custom theme config**: 71 lines in tailwind.config.ts
- **29 files** use UI libraries (Headless UI, Radix)
- **Custom plugins**: @tailwindcss/typography, @headlessui/tailwindcss
- **Risk**: Config format changes, plugin API changes

#### Migration Steps
1. Review Tailwind CSS 4 migration guide
2. Rewrite tailwind.config.ts (complete format change)
3. Update plugin configurations
4. Test all components with custom theme (dark/light/warm)
5. Verify Headless UI and Radix UI compatibility

#### Verification Criteria
- [ ] `yarn build` succeeds
- [ ] Visual testing: all components render correctly
- [ ] Theme switching (dark/light/warm) works
- [ ] No missing styles or layout breaks
- [ ] `yarn typecheck` passes

#### GitHub Issue
**Title**: feat: Migrate to Tailwind CSS 4 - complete config rewrite  
**Labels**: breaking-change, dependencies, styling  
**Priority**: P1 (high)

---

### Phase 3d: Drizzle ORM + drizzle-kit

**Estimated effort**: 8-16 hours  
**PR category**: Breaking Changes  
**Status**: PENDING

#### Packages to Update
- drizzle-kit: 0.18.1 → 0.31.10 (13 minor versions!)
- drizzle-orm: 0.45.2 (already latest, but drizzle-kit must align)

#### Impact Assessment
- **Schema definition**: src/lib/db/schema.ts (4 tables)
- **12 files** import from drizzle-orm
- **5 migration files** in drizzle/
- **Risk**: Breaking changes to schema definition, query builder

#### Migration Steps
1. Review drizzle-kit changelog (0.18 → 0.31)
2. Update drizzle.config.ts if needed
3. Run `yarn db:generate` to check for migration changes
4. Test all database operations
5. Verify existing migrations still work

#### Verification Criteria
- [ ] `yarn db:generate` succeeds
- [ ] `yarn db:migrate` succeeds
- [ ] `yarn typecheck` passes
- [ ] `yarn test` passes (db-migration.test.ts)
- [ ] Manual testing: chat history, user sessions

#### GitHub Issue
**Title**: feat: Upgrade drizzle-kit 0.18 → 0.31 - align with drizzle-orm 0.45  
**Labels**: breaking-change, dependencies, database  
**Priority**: P1 (high)

---

## Phase 4: Major Library Upgrades - MEDIUM RISK

### Phase 4a: AI/ML Providers

**Estimated effort**: 4-8 hours  
**PR category**: Breaking Changes  
**Status**: PENDING

#### Packages to Update
- @google/genai: 1.52.0 → 2.13.0
- @huggingface/transformers: 3.8.1 → 4.2.0
- @icons-pack/react-simple-icons: 12.9.0 → 13.13.0

#### Impact Assessment
- **10 AI provider integrations**
- **Deep usage**: openaiLLM.ts (309 lines), helpers/zod, resources
- **Risk**: API changes, type changes, method signature changes

#### Migration Steps
1. Review @google/genai v2 migration guide
2. Review @huggingface/transformers v4 migration guide
3. Update provider implementations
4. Test all 10 AI providers
5. Verify streaming and tool calling

#### Verification Criteria
- [ ] `yarn typecheck` passes
- [ ] `yarn build` succeeds
- [ ] Manual testing: all 10 AI providers respond correctly
- [ ] Streaming works for all providers
- [ ] Tool calling works for OpenAI/Anthropic

#### GitHub Issue
**Title**: feat: Upgrade AI/ML providers - @google/genai v2, @huggingface/transformers v4  
**Labels**: breaking-change, dependencies, ai-providers  
**Priority**: P2 (medium)

---

### Phase 4b: UI Libraries

**Estimated effort**: 4-8 hours  
**PR category**: Breaking Changes  
**Status**: PENDING

#### Packages to Update
- lucide-react: 0.556.0 → 1.27.0
- sonner: 1.7.4 → 2.0.7
- markdown-to-jsx: 7.7.17 → 9.9.0
- react-text-to-speech: 0.14.9 → 5.1.10
- @icons-pack/react-simple-icons: 12.9.0 → 13.13.0

#### Impact Assessment
- **Component APIs** may change
- **Icon names** may change (lucide-react, simple-icons)
- **Risk**: Breaking changes in component props, icon imports

#### Migration Steps
1. Review lucide-react v1 migration guide
2. Review sonner v2 migration guide
3. Update icon imports (check for renamed icons)
4. Test all UI components
5. Verify toast notifications, markdown rendering, TTS

#### Verification Criteria
- [ ] `yarn typecheck` passes
- [ ] `yarn build` succeeds
- [ ] Visual testing: all components render correctly
- [ ] Toast notifications work (sonner)
- [ ] Markdown rendering works (markdown-to-jsx)
- [ ] Text-to-speech works (react-text-to-speech)

#### GitHub Issue
**Title**: feat: Upgrade UI libraries - lucide-react v1, sonner v2, markdown-to-jsx v9  
**Labels**: breaking-change, dependencies, ui  
**Priority**: P2 (medium)

---

### Phase 4c: Data/Utility Libraries

**Estimated effort**: 4-8 hours  
**PR category**: Breaking Changes  
**Status**: PENDING

#### Packages to Update
- better-sqlite3: 11.10.0 → 13.0.1
- yahoo-finance2: 3.14.0 → 4.0.0
- uuid: 13.0.2 → 14.0.1
- officeparser: 6.0.7 → 7.5.0
- @types/bcryptjs: 2.4.6 → 3.0.0
- @types/uuid: 10.0.0 → 11.0.0
- @napi-rs/canvas: 0.1.100 → 1.0.2 (optional)

#### Impact Assessment
- **Native bindings** (better-sqlite3)
- **API changes** (yahoo-finance2, officeparser)
- **Risk**: Breaking changes in database operations, widget data

#### Migration Steps
1. Review better-sqlite3 v13 changelog
2. Review yahoo-finance2 v4 migration guide
3. Update database connection code
4. Update widget data fetching
5. Test all affected features

#### Verification Criteria
- [ ] `yarn typecheck` passes
- [ ] `yarn build` succeeds
- [ ] `yarn test` passes
- [ ] Database operations work (chat history, sessions)
- [ ] Yahoo Finance widget displays data correctly
- [ ] Office file parsing works

#### GitHub Issue
**Title**: feat: Upgrade data/utility libraries - better-sqlite3 v13, yahoo-finance2 v4  
**Labels**: breaking-change, dependencies, data  
**Priority**: P2 (medium)

---

## Phase 5: PR Recreations - MEDIUM RISK

**Estimated effort**: 2-4 hours per PR  
**PR category**: Bug Fixes/Features  
**Status**: PENDING

### Priority Matrix

| Priority | PR # | Title | Effort | Impact | Status |
|----------|------|-------|--------|--------|--------|
| **P0** | #82 | Next.js security update (React2Shell) | Small | Security | PENDING |
| **P1** | #45 | OpenRouter compatibility | Medium | Critical for providers | PENDING |
| **P1** | #110 + #108 | Upload fixes (non-ASCII + large files) | Small | Bug fix | PENDING |
| **P2** | #56 | Markdown code block stripping | Small | JSON parsing | PENDING |
| **P2** | #55 | Missing `<think>` tag handling | Small | DeepSeek support | PENDING |
| **P3** | #51 (partial) | Robustness fixes | Medium | Error handling | PENDING |
| **P3** | #84 (partial) | Weather, file validation | Medium | Bug fixes | PENDING |

### PR #82: Next.js Security Update (React2Shell)

**Original PR**: Updates Next.js to 15.5.9, sharp to 0.34.3  
**Security Impact**: Fixes React2Shell vulnerability  
**Effort**: Small (2 files: package.json, yarn.lock)  
**Files Changed**: 
- package.json (Next.js version)
- yarn.lock (lockfile update)

**Migration Notes**:
- Current Next.js: 16.2.12 (already newer than PR target)
- May already be resolved on canary
- Verify if React2Shell fix is present in 16.2.12

**Implementation**:
1. Check if Next.js 16.2.12 includes React2Shell fix
2. If not, update to latest Next.js 16.x
3. Run verification commands
4. Create PR with security advisory reference

**GitHub Issue**:
**Title**: security: Recreate PR #82 - Next.js security update for React2Shell  
**Labels**: security, bug-fix, pr-recreation  
**Priority**: P0 (critical)

---

### PR #45: OpenRouter Compatibility

**Original PR**: Replace OpenAI-exclusive APIs with standard endpoints  
**Impact**: Critical for OpenRouter/LiteLLM compatibility  
**Effort**: Medium (6 files)  
**Files Changed**:
- src/lib/models/providers/openai/openaiLLM.ts
- src/lib/models/providers/openai/openaiEmbedding.ts
- src/lib/models/providers/lmstudio/lmstudioLLM.ts
- src/lib/models/providers/groq/groqLLM.ts
- src/lib/models/providers/deepseek/deepseekLLM.ts
- src/lib/models/providers/minimax/minimaxLLM.ts

**Migration Notes**:
- Current codebase may have diverged significantly
- Need to adapt changes to current provider structure
- Test all 6 affected providers

**Implementation**:
1. Review original PR diff
2. Identify applicable changes for current codebase
3. Update provider implementations
4. Test OpenRouter, LiteLLM, Groq, DeepSeek, MiniMax, LM Studio
5. Create PR with compatibility notes

**GitHub Issue**:
**Title**: feat: Recreate PR #45 - OpenRouter/LiteLLM compatibility via standard APIs  
**Labels**: bug-fix, pr-recreation, providers  
**Priority**: P1 (high)

---

### PR #110 + #108: Upload Fixes

**Original PRs**: 
- #110: Fix garbled non-ASCII filenames
- #108: Fix large document upload 413 error

**Impact**: Bug fixes for file uploads  
**Effort**: Small (1 file each: src/routes/uploads.ts)  
**Files Changed**:
- src/routes/uploads.ts (may have moved in canary refactor)

**Migration Notes**:
- File path may have changed in canary
- Need to locate current upload handling code
- Combine both fixes into single PR

**Implementation**:
1. Find current upload handling code
2. Apply non-ASCII filename fix
3. Apply large file batch size fix
4. Test file uploads with various filenames and sizes
5. Create PR with both fixes

**GitHub Issue**:
**Title**: fix: Recreate PR #110 + #108 - Upload fixes for non-ASCII filenames and large files  
**Labels**: bug-fix, pr-recreation, uploads  
**Priority**: P1 (high)

---

### PR #56: Markdown Code Block Stripping

**Original PR**: Strip markdown code block wrappers before JSON parsing  
**Impact**: Fixes JSON parsing for Claude/LiteLLM/OpenRouter  
**Effort**: Small (2 files)  
**Files Changed**:
- src/lib/models/providers/ollama/ollamaLLM.ts
- src/lib/models/providers/openai/openaiLLM.ts

**Migration Notes**:
- Check if current JSON handling already includes this fix
- May be redundant with current codebase

**Implementation**:
1. Review current JSON parsing logic
2. Determine if fix is already present
3. If not, apply markdown code block stripping
4. Test with Claude, LiteLLM, OpenRouter responses
5. Create PR if fix is needed

**GitHub Issue**:
**Title**: fix: Recreate PR #56 - Strip markdown code blocks before JSON parsing  
**Labels**: bug-fix, pr-recreation, json-parsing  
**Priority**: P2 (medium)

---

### PR #55: Missing `<think>` Tag Handling

**Original PR**: Handle missing opening `<think>` tag for deepseek-r1-671b  
**Impact**: Fixes thinking display for DeepSeek models  
**Effort**: Small (1 file: src/lib/hooks/useChat.tsx)  
**Files Changed**:
- src/lib/hooks/useChat.tsx (significantly refactored since PR)

**Migration Notes**:
- useChat.tsx has been significantly refactored
- Need to adapt fix to current implementation
- Test with deepseek-r1-671b model

**Implementation**:
1. Review current useChat.tsx thinking handling
2. Adapt PR #55 fix to current code
3. Test with DeepSeek R1 model
4. Create PR with adaptation notes

**GitHub Issue**:
**Title**: fix: Recreate PR #55 - Handle missing `<think>` tag for DeepSeek R1  
**Labels**: bug-fix, pr-recreation, deepseek  
**Priority**: P2 (medium)

---

### PR #51 (Partial): Robustness Fixes

**Original PR**: Improve robustness across model providers and search pipeline  
**Impact**: Fixes 6 issues (#981, #836, #789, #799, #763, #997)  
**Effort**: Medium (9 files)  
**Files Changed**: Multiple provider files, search agent files

**Migration Notes**:
- Some files deleted in canary refactor
- Extract only applicable null-safety and error handling fixes
- Skip changes to deleted files

**Implementation**:
1. Review original PR diff
2. Identify which fixes are still applicable
3. Apply null-safety checks to current provider files
4. Apply error handling improvements to search pipeline
5. Test all affected providers and search flow
6. Create PR with list of applied fixes

**GitHub Issue**:
**Title**: fix: Recreate PR #51 (partial) - Robustness improvements for providers and search  
**Labels**: bug-fix, pr-recreation, robustness  
**Priority**: P3 (low)

---

### PR #84 (Partial): Bug Fixes

**Original PR**: Various bugfixes (Jest tests, weather switch, file validation, etc.)  
**Impact**: Multiple small fixes  
**Effort**: Medium (33 files)  
**Files Changed**: Multiple files across features

**Migration Notes**:
- Skip Jest test infrastructure (already have Vitest)
- Extract individual fixes: weather switch, file validation, SearXNG error handling
- Adapt to current codebase structure

**Implementation**:
1. Review original PR diff
2. Extract applicable fixes (skip test infrastructure)
3. Apply weather switch fix
4. Apply file validation improvements
5. Apply SearXNG error handling
6. Test affected features
7. Create PR with list of applied fixes

**GitHub Issue**:
**Title**: fix: Recreate PR #84 (partial) - Weather, file validation, SearXNG error handling  
**Labels**: bug-fix, pr-recreation, misc  
**Priority**: P3 (low)

---

## Execution Strategy

### Parallelization Opportunities

**Wave 1 (Immediate - can run in parallel)**:
- Phase 1: Safe updates
- Phase 2: Security fixes (resolutions)
- PR #82: Next.js security update

**Wave 2 (After Wave 1 - sequential)**:
- Phase 3a: React 19 migration
- Phase 3b: TypeScript 7 migration
- Phase 3c: Tailwind CSS 4 migration
- Phase 3d: Drizzle ORM upgrade

**Wave 3 (After Wave 2 - can run in parallel)**:
- Phase 4a: AI/ML providers
- Phase 4b: UI libraries
- Phase 4c: Data/utility libraries

**Wave 4 (After Wave 3 - sequential)**:
- PR #45: OpenRouter compatibility
- PR #110 + #108: Upload fixes
- PR #56: Markdown stripping
- PR #55: DeepSeek think tag
- PR #51 (partial): Robustness
- PR #84 (partial): Misc fixes

### Risk Mitigation

1. **Test after each phase**: Run full verification suite after each phase
2. **Commit frequently**: One commit per logical change
3. **Document everything**: Update UPGRADE-NOTES.md with breaking changes
4. **Rollback plan**: Keep git history for easy rollback
5. **Isolate changes**: Each PR should be independently mergeable

### Success Criteria

- [ ] All 5 phases completed
- [ ] All 7 PRs recreated
- [ ] `yarn install` succeeds
- [ ] `yarn build` succeeds
- [ ] `yarn typecheck` passes
- [ ] `yarn lint` passes
- [ ] `yarn test` passes
- [ ] `yarn audit --level high` shows minimal vulnerabilities
- [ ] Manual testing: all features work correctly
- [ ] Documentation updated (UPGRADE-NOTES.md, PR-MIGRATION-NOTES.md)

---

## GitHub Issues Summary

| # | Title | Labels | Priority | Phase |
|---|-------|--------|----------|-------|
| 1 | chore: Safe dependency updates - remove accidental packages, update minor versions | chore, infra, dependencies | P0 | Phase 1 |
| 2 | security: Force-update transitive dependencies to resolve critical CVEs | security, infra, dependencies | P0 | Phase 2 |
| 3 | feat: Migrate to React 19 - breaking changes in hooks and refs | breaking-change, dependencies, react | P1 | Phase 3a |
| 4 | feat: Upgrade to TypeScript 7 - stricter type checking | breaking-change, dependencies, typescript | P1 | Phase 3b |
| 5 | feat: Migrate to Tailwind CSS 4 - complete config rewrite | breaking-change, dependencies, styling | P1 | Phase 3c |
| 6 | feat: Upgrade drizzle-kit 0.18 → 0.31 - align with drizzle-orm 0.45 | breaking-change, dependencies, database | P1 | Phase 3d |
| 7 | feat: Upgrade AI/ML providers - @google/genai v2, @huggingface/transformers v4 | breaking-change, dependencies, ai-providers | P2 | Phase 4a |
| 8 | feat: Upgrade UI libraries - lucide-react v1, sonner v2, markdown-to-jsx v9 | breaking-change, dependencies, ui | P2 | Phase 4b |
| 9 | feat: Upgrade data/utility libraries - better-sqlite3 v13, yahoo-finance2 v4 | breaking-change, dependencies, data | P2 | Phase 4c |
| 10 | security: Recreate PR #82 - Next.js security update for React2Shell | security, bug-fix, pr-recreation | P0 | Phase 5 |
| 11 | feat: Recreate PR #45 - OpenRouter/LiteLLM compatibility via standard APIs | bug-fix, pr-recreation, providers | P1 | Phase 5 |
| 12 | fix: Recreate PR #110 + #108 - Upload fixes for non-ASCII filenames and large files | bug-fix, pr-recreation, uploads | P1 | Phase 5 |
| 13 | fix: Recreate PR #56 - Strip markdown code blocks before JSON parsing | bug-fix, pr-recreation, json-parsing | P2 | Phase 5 |
| 14 | fix: Recreate PR #55 - Handle missing `<think>` tag for DeepSeek R1 | bug-fix, pr-recreation, deepseek | P2 | Phase 5 |
| 15 | fix: Recreate PR #51 (partial) - Robustness improvements for providers and search | bug-fix, pr-recreation, robustness | P3 | Phase 5 |
| 16 | fix: Recreate PR #84 (partial) - Weather, file validation, SearXNG error handling | bug-fix, pr-recreation, misc | P3 | Phase 5 |

---

## Notes

### Already Resolved PRs (No Action Needed)
38 PRs already merged into canary:
- #16, #17, #19, #20, #21, #22, #23, #24, #25, #26, #27, #28, #30, #31, #32, #33, #34, #36, #37, #38, #39, #40, #41, #42, #43, #44, #48, #50, #52, #54, #57, #59, #60, #62, #64, #65, #67, #68, #77, #81, #100, #111

### Accidental Dependencies
- `g` package: Meta-package, likely accidental install
- `yarn` package: Package manager should not be in dependencies

### Sub-Project: integrations/mcp-server
Separate project with its own package.json:
- Uses zod@3 (root uses zod@4)
- Uses typescript@5.6 (root uses 5.9.3)
- Should be upgraded independently

---

## References

- **UPGRADE-NOTES.md**: Documents prior completed tasks
- **TODO-UPGRADE.md**: Tracks remaining upgrade tasks
- **PR-MIGRATION-NOTES.md**: Documents 3 already-migrated PRs (#37, #54, #111)
- **VANE-FORK-SCORES.md**: Scoring analysis for PRs #37-#51
- **Yarn Classic docs**: https://classic.yarnpkg.com/
- **Security audit**: `yarn audit --json`
- **CISA KEV**: https://www.cisa.gov/known-exploited-vulnerabilities-catalog
