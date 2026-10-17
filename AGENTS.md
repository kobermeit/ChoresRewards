# Project Guidelines for ChoresRewards

## Background Task Management & Host Sleep
- **Always terminate background tasks**: Whenever starting background support processes or servers (`IsDaemon: true` or async tasks), you MUST call `manage_task` with action `kill` on all active tasks before pushing to Git or completing your response.
- Do not leave background tasks running indefinitely so the host computer can enter sleep mode normally.

## Quality Standards & Live Browser Verification
- **Verify in real browser before concluding or committing**: Once a batch of changes is made and ready to commit, thoroughly verify all runtime behavior (no missing React imports, no syntax/runtime exceptions like `useEffect is not defined`).
- Maintain a high bar of visual polish, alignment, and responsiveness.

