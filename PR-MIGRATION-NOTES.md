# PR Migration Notes

This file tracks the re-implementation of upstream Pull Requests on top of the current canary branch.

---

## PR #37 — Stop search failures from hanging on "Brainstorming"

**Original PR:** https://github.com/s3tupw1zard/Vane/pull/37  
**Upstream:** ItzCrazyKns/Vane#1054 (fixes upstream issue #965)  
**New Branch:** `reup/pr-37-search-error-persistence`  
**New PR:** https://github.com/s3tupw1zard/Vane/pull/183  
**Issue:** https://github.com/s3tupw1zard/Vane/issues/123

### Migration Summary

The original PR wrapped both search agents (`SearchAgent`, `APISearchAgent`) in try/catch, emitted a session `error` event on failure, persisted failed searches as `status: 'error'` with their partial `responseBlocks`, and made widget execution fail-soft.

### Current Codebase State

Most of the original PR already landed on canary via the consolidated error-handling work (PRs #22/#23/#25/#32, merged as #112) and follow-ups (`ad7aa6e`, `2d08a3b`, `a2f2ac5`):

- Both agents already use a `searchAsync` wrapper with try/catch around `_searchAsync`
- Both already emit `session.emit('error', ...)` on failure
- `SearchAgent` already persists `status: 'error'`; widgets already fail soft in `api.ts`

### Changes Made

Ported only the remaining delta to `src/lib/agents/search/index.ts`:

- Error-state update now also saves `responseBlocks: session.getAllBlocks()`, preserving content streamed before the failure
- Error-state DB update wrapped in its own try/catch so a DB failure during error handling cannot cause an unhandled rejection
- Persistence now runs **before** `session.emit('error', ...)`, fixing an upstream review finding (cubic, P1) where a synchronously throwing `emit` would skip persistence entirely

### Intentional Differences

- `api.ts` untouched — canary's `APISearchAgent` already covers the original behavior
- Error message wording kept as-is from canary; the upstream review's P2 note (raw exception messages sent to the client) is pre-existing behavior and left as possible follow-up

### Remaining Limitations

None beyond the pre-existing P2 note above.

---

## PR #111 — Fix overlapping turns and stale history in chat rewrite flow

**Original PR:** https://github.com/s3tupw1zard/Vane/pull/111  
**Upstream:** ItzCrazyKns/Vane#606  
**New Branch:** `reup/pr-111-fix-overlapping-turns`  
**New PR:** https://github.com/s3tupw1zard/Vane/pull/177  
**Issue:** https://github.com/s3tupw1zard/Vane/issues/176

### Migration Summary

The original PR fixed two issues in the old monolithic `ui/components/ChatWindow.tsx`:

1. **User turn duplication**: Frontend sent `history: [...chatHistory, ['human', message]]`, duplicating the user message that the backend also added.
2. **Stale chat history in rewrite**: Rewrite called `sendMessage` synchronously after async state updates, causing stale history.

### Current Codebase State

The codebase has been significantly refactored:

- `ui/components/ChatWindow.tsx` → split into `src/lib/hooks/useChat.tsx` (ChatProvider context) + smaller components
- `chatHistory` changed from `useState` to `useRef` (synchronous mutations)
- Frontend no longer appends user message to history; backend appends `followUp` separately

### Changes Made

- Removed redundant conditional slice in `sendMessage` rewrite branch (double-slice bug)
- Removed unused `messageIndex` variable
- No backend changes needed (architecture already correct)
- No `pendingRewrite`/`useEffect` pattern needed (chatHistory is now a ref)

### Remaining Limitations

None. The fix is minimal and preserves the intended behavior from the original PR.

---
