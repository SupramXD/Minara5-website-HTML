<!-- agent-config -->
# Directives

- Always commit and push changes to git (`git add .`, `git commit -m "..."`, `git push`) automatically upon task completion.

## Project Memory
- FIRST, read `MEMORY.md` at the root of this codebase on every new session. Reuse it instead of re-reading the whole repo — it is the token-efficient map of the project.
- After making any structural or logic change, update `MEMORY.md` (and run `node tools/update-memory.js` to refresh the auto-generated file-inventory block).
- Keep `MEMORY.md` concise; do not let it balloon.
