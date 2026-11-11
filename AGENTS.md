- Don't implement any backwards compatibility unless explicitly told to do so
- Don't implement any fallback unless explicitly told to do so
- When asked a question, just answer it. Do NOT make any changes
- If you don't understand something or instructions aren't clear enough, make sure to ask follow up questions
- Make the smallest possible change that will satisfy the request
- Don't just add code, also look for opportunities to refactor, simplify, delete code to satisfy the request
- Don't commit to git. You are allowed to read past commits.
- Don't touch TODO.md
- When asked to change database schema, update it both in code and also in the database itself. Don't do migration though unless explicitly asked to do it. Just update the database in place. If rows could be deleted, make a backup of the database first.


## Collaboration And Continuity

- After every compaction, reread this file, relevant decisions and unfinished
  tasks before resuming. Do not rely only on the conversation summary. Then
  invoke the `pstack:poteto-mode` skill again and follow it: the matched
  playbook's checklist, the review of every diff before reporting a step done,
  and its rules for replies.
- All working directives live in this file. The agent's memory file
  (`~/.claude/projects/<this project>/memory/MEMORY.md`) is an exact copy of it:
  whenever one changes, update the other to match. Keep no directives in
  separate memory files.
- Do a single line of work yourself, where the user can see it; delegate only
  independent work that runs in parallel. The user cannot see what a subagent does.
- Use the agent's checklist for multi-step work; update it as work completes,
  revisit it after interruptions and reconcile it before the final response.
  Use `TASK.md` only when persistence is genuinely needed or requested.
- Treat recorded decisions as revisable. When new findings conflict with a
  decision, or a decision, threshold or margin pushes a design towards
  workarounds, challenge it first (why it was introduced, whether that still
  holds, what a faithful version would be) and raise it for discussion instead
  of silently following it or building around it.
- Push back on incorrect assumptions. Surface material findings, regressions
  and unexpectedly long investigations promptly: what happened, what it may mean
  and the proposed next action. Consult the user before another architecture
  round; test-progress updates alone are insufficient.
- For newly discovered issues, inspect history and report the likely origin:
  new regression, exposed older defect or inconclusive history.
- Answer from the code, history and documents, checked when answering, never
  from memory or a guess; when something cannot be checked, say so.
- Report evidence precisely. Passing tests support a conclusion; they do not
  prove architectural soundness. Do not call a mechanism fixed or working
  end-to-end when only a component or controlled case passes.
- When a reply asks for a decision, keep the explanation but end with a
  one-line summary and the single question being asked.
- The user makes all commits; do not run `git commit`. Suggest a commit message
  only at the end of finished work, never alongside a question.