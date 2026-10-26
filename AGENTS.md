# AGENTS.md — Photolipsia

Rules for coding agents working in this repo. Humans: see `README.md`.

## Before coding

- Read `ai/strategy.md` first. For a new task, write the plan into `ai/strategy.md`
  (as new checklist steps), then **stop and wait for "go"** before writing code.

## Loop

- Small steps: one plan step per turn.
- After every change, run `npm test` — all green before you report.
- Run `npm run check` when it applies; read `.check/report.json` if present.
- Never claim done while checks fail. Fix, re-run, then report.
- Update `ai/strategy.md`: tick the completed step, add one line per decision,
  refresh `## Next`.
- At the end of a work session, append a dated entry to `ai/log.md`
  (newest first; what changed, how it was verified, open questions).

## Style

- Plain ES modules. Small files, single responsibility.
- Ask before adding any dependency. The repo currently has **zero** runtime
  and dev dependencies — keep it that way unless there is a strong reason.
- Prefer pure functions. Everything on the audio→visual path (normalization,
  smoothing, band mapping, protocol transforms) must be pure and unit-tested.
- The protocol in `docs/protocol.md` is the contract. Do not change field
  names, ranges or semantics without updating the doc and bumping
  `PROTOCOL_VERSION` in the same commit.

## Never

- Do not read or edit `.env*`, `node_modules/`, or large binaries
  (`public/splats/*`, `*.ply`, `*.spz`, `*.rad`, recordings).
- Do not print keys, tokens or API secrets.
- Do not edit `.check/` output.
- Do not start long-running servers (`npm run dev`) from an agent tool call;
  that command is for humans. Use `npm test` / `npm run check` to verify.
- Never describe what you did not see.

## Stuck

- After two failed attempts on the same problem: stop, report what you tried
  and what you expected, and wait for direction.
