Start by reading:
Linear project `markdowneditor`

Your job is to pick the best next issue yourself.


Rules:
- Use Linear as the task source of truth.
- Prefer unblocked issues in `Todo` first, then `Backlog`.
- Respect blockers and do not pull in downstream scope.
- Use the active split subtasks, not umbrella issues or issues marked `Duplicate`.
- Keep changes tightly scoped to the issue you pick.
- Do not read the whole repo unless the chosen issue truly requires it.
  - use the augment codebase retrieval skill.
- Update docs if your implementation changes shared assumptions.
- Do not commit secrets. If server access is needed and credentials are missing, stop and report exactly what access detail is needed.

Workflow:
1. Inspect Linear and choose the best next unblocked issue.
2. Move that issue to `In Progress`.
3. Summarize:
   - which issue you chose
   - why it is the best next issue
   - which files/docs you decided to read
4. Implement the issue with the smallest reasonable context window.
5. Run relevant validation/tests/checks. Smoketest using the UI if feasible for the task.
   1. Use your verification skill before calling the task complete.
   2. use the systematic-debugging skill if the tests fail
   3. If your change adds new user-facing functionality, add smoke tests for it (API-level in `server/src/smoke.test.ts`, or unit tests in the relevant package). Existing smoke tests must continue to pass.
6. Commit the change.
7. Leave a short Linear comment summarizing:
   - what changed
   - what you verified
   - any blockers or follow-up issues
8. Move the issue to `Done` as appropriate.

If there is no good unblocked implementation issue, do not guess. Report the blocker clearly and suggest the smallest next action.
