# PR Migration Notes

This file tracks the re-implementation of upstream Pull Requests on top of the current canary branch.

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
