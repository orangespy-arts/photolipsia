# Course relationship

This repo is **not** the photolipsia-agentic-kit course fork — that is a
separate deliverable (see `ai/strategy.md` decisions). What we borrowed:

- `AGENTS.md` / `CLAUDE.md` rulebook pattern (plan-first, check-driven)
- `ai/strategy.md` as agent memory + `ai/log/` session logs
- `scripts/check.mjs` producing `.check/report.json` (ours runs unit tests
  now; browser screenshot checks come with the render stage)

Course kit reference: https://github.com/xohm/photolipsia-agentic-kit
(ZHdK MA Interaction Design, "Agentic Coding", example 02-splat-viewer:
Vite + three.js + Spark, prompts 1–9, Quest 3 VR, .rad streaming).

Useful course docs to revisit when we pick the Stage 1 splat engine:
- `ai/spark-facts.md` in the kit — current-version Spark usage
- `docs/big-scans.md` — .rad conversion / streaming for large scans
- `docs/blender-and-splats.md` — Blender-side splat processing
