# Architecture Decision Record: TH-MSM DSH Plugin

## 2026-10-15: v1.4.0 restores the three product entry points

Classical MSM modeling/analysis, MSM education, and nonadiabatic C1/WE are separate workflows within one conversational assistant. The classical estimator is an explicit nonreversible row MLE with held-out CK and multi-lag ITS; it is not the deferred nonadiabatic C2 engine. Beginner guidance collects only missing information and experts can provide complete inputs directly.

Adopt strict TypeScript gradually for contracts and new modules, compile to lib for runtime portability, and keep validated JS physics compatible. Jev's typed-decision interface inspires local routing/state handling, without an online dependency or physical probability substitution. See docs/CLASSICAL-MSM.md and docs/TYPESCRIPT-AND-DECISIONS.md.

## 2026-10-15: v1.3.0 scientific core supersedes scaffold assumptions

Accepted after user confirmation. Node.js ESM scientific modules are independent of DSH tool wrappers. C1 finite-time first-hit/event-flux analysis is the default; equilibrium π and reversible MSM are not photochemical branch estimators. Standard single-CI LVC and explicitly nonlinear dual-CI models have different purposes. Full-state WE resampling changes weights/random streams, not nuclear momenta. Absorbed mass remains in the conservation ledger.

The prior Python generator and success templates were not validated implementations. They are replaced by explicit unsupported status or actual analytical run processing. C2, external ES propagation, strict budget scheduling, full WE-run restart and streaming trajectory IO remain future work. See docs/SCIENCE.md and CHANGELOG.md for current capability boundaries. Historical design text below is retained as history, not a description of completed features.

> Date: 2026-10-13
> Status: Accepted
> Author: TH-MSM Agent

---

## Context

We inherit two identical scaffold snapshots (`th-msm-dsh-architecture` and `th-msm-dsh-plugin-0.1.0`)
that provide a **secure MSM proxy tool** (`th_msm`) — a generic shell-execution bridge with JSON-stdin protocol,
sandbox enforcement, and registry validation. This is a solid foundation but it is NOT a Markov State Model
plugin: it knows nothing about MSM concepts, learning levels, trajectory analysis, or model validation.

We need to design the **real TH-MSM plugin** — one that:
1. Preserves the existing security architecture (registry, sandbox, JSON-stdin)
2. Adds MSM-domain tools (knowledge query, trajectory analysis, MSM construction, validation, reporting)
3. Adds an MSM-aware Agent Loop with teaching/planning/modeling modes
4. Integrates with the knowledge base at `D:\TH-MSM\knowledge`

---

## Inherited Architecture (Strengths to Preserve)

### 1. Security model (KEEP)
- **Registry as executable whitelist**: `.th-msm/registry.json` maps named MSMs to shell commands.
  The registry is the only source of shell program strings; model args stay in JSON stdin — never concatenated.
- **Sandbox enforcement by default**: `requireSandbox: true`, `allowDangerFullAccess: false`.
  Execution goes through `ctx.shell` with per-session sandbox policy.
- **Symlink escape protection**: `loadRegistry` resolves real paths and checks `isInside` for both
  the lexical path AND the resolved real path.
- **Per-turn call limit**: `maxCallsPerTurn` guard prevents runaway tool calls.

### 2. Code quality patterns (KEEP)
- **Frozen immutable state**: `Object.freeze` on registry entries.
- **Exhaustive error classification**: `classify()` covers timeout/abort/sandbox denial/nonzero exit.
- **Smart truncation**: `truncateText` preserves head + tail with 60/40 split.
- **Schemastery validation**: `Config` uses `z.object()` with constraints.
- **Test coverage**: Core tests cover registry validation, path escaping, stdin injection prevention,
  sandbox policy enforcement, boundary values.

### 3. Plugin architecture patterns (KEEP)
- **Cordis service injection**: `inject: ['tools', 'shell']`, `apply(ctx, config)`.
- **Tool registration via `defineTool`**: schema, render, execute pattern.
- **Agent hooks as non-invasive observers**: hooks maintain per-turn accounting without replacing the loop.
- **Bundle patch for host integration**: `cordis.patch.yml` inserts the plugin by name.

---

## Weaknesses & Gaps (What We Add)

### 1. No MSM-domain tools
The current plugin exposes exactly one tool: `th_msm` — a generic proxy that runs any registered command.
This is a **security boundary**, not an MSM tool. A user who asks "build an MSM" gets nothing.

**Fix**: Add a suite of MSM-domain tools:
- `th_msm_knowledge` — query the knowledge base (papers, concepts)
- `th_msm_teach` — explain MSM concepts at user's level
- `th_msm_plan` — design MSM protocol from trajectory metadata
- `th_msm_build` — orchestrate MSM construction pipeline
- `th_msm_validate` — run validation tests on a built MSM
- `th_msm_report` — generate Markdown scientific report
- `th_msm` (keep) — generic execution proxy for registered commands

### 2. No Agent Loop for MSM reasoning
The current hooks only count tool calls per turn. There is no MSM-aware reasoning loop.

**Fix**: Add a lightweight Agent Loop that:
- Detects MSM-related user intent from messages
- Routes to the correct mode (teaching/planning/modeling/validation/reporting)
- Maintains conversation state (current MSM project, trajectory metadata)
- Injects knowledge base context into the model's system prompt

### 3. No knowledge base integration
The current architecture has no concept of papers, reviews, or benchmarks.

**Fix**: Add `src/knowledge/` module:
- `loader.js` — scan `knowledge/` directory, parse CATALOG.md files
- `searcher.js` — keyword search across indexed papers
- `context.js` — format knowledge results for injection into prompts

### 4. No Python/MSM runtime management
The current executor runs arbitrary shell commands but has no Python environment management.

**Fix**: Add `src/python/` module:
- `env.js` — detect Python environment, find PyEMMA/deeptime
- `runner.js` — execute Python MSM scripts with structured I/O
- Pre-register standard MSM commands in the registry

---

## Architecture v1.0 Design

### File structure

```
th-msm-dsh-plugin/
├── README.md
├── plugin.json
├── package.json
├── cordis.patch.yml
├── src/
│   ├── index.js              ← Plugin entry: register tools + install hooks
│   ├── agent/
│   │   ├── hooks.js           ← Per-turn accounting (PRESERVED)
│   │   └── loop.js            ← MSM Agent Loop (NEW)
│   ├── tools/
│   │   ├── msm.js             ← Generic proxy tool (PRESERVED, renamed to th_msm_exec)
│   │   ├── knowledge.js       ← Knowledge base query tool (NEW)
│   │   ├── teach.js           ← MSM teaching tool (NEW)
│   │   ├── plan.js            ← MSM planning tool (NEW)
│   │   ├── build.js           ← MSM build orchestration (NEW)
│   │   ├── validate.js        ← MSM validation tool (NEW)
│   │   └── report.js          ← Report generation tool (NEW)
│   ├── registry/
│   │   └── loader.js          ← Registry loader (PRESERVED, extended)
│   ├── runtime/
│   │   ├── executor.js        ← Shell executor (PRESERVED)
│   │   └── python.js          ← Python/MSM runner (NEW)
│   ├── knowledge/
│   │   ├── loader.js          ← Knowledge base scanner (NEW)
│   │   ├── searcher.js        ← Paper search (NEW)
│   │   ├── context.js         ← Prompt injection (NEW)
│   │   └── catalog.js         ← CATALOG.md parser (NEW)
│   └── util/
│       └── text.js            ← Text utilities (PRESERVED)
├── test/
│   ├── core.test.mjs          ← Security tests (PRESERVED)
│   ├── knowledge.test.mjs     ← Knowledge base tests (NEW)
│   ├── tools.test.mjs         ← MSM tool tests (NEW)
│   └── loop.test.mjs          ← Agent Loop tests (NEW)
└── examples/
    ├── workspace/
    │   ├── .th-msm/
    │   │   └── registry.json  ← Extended with MSM commands
    │   └── tools/
    │       └── echo.mjs
    └── knowledge/
        └── sample-catalog.md
```

### Tool inventory

| Tool | Type | Description | Level |
|------|------|-------------|-------|
| `th_msm` | Generic | Shell execution proxy (KEPT) | System |
| `th_msm_knowledge` | Domain | Query knowledge base | User |
| `th_msm_teach` | Domain | MSM concept explanation | User |
| `th_msm_plan` | Domain | MSM protocol design | User |
| `th_msm_build` | Domain | MSM construction | User |
| `th_msm_validate` | Domain | MSM validation | User |
| `th_msm_report` | Domain | Report generation | User |

### Agent Loop modes

```
User message → Intent Detection
    ├── "what is MSM"     → Teaching mode → th_msm_knowledge + th_msm_teach
    ├── "build MSM from"  → Planning mode → th_msm_plan → (user confirms) → th_msm_build
    ├── "validate MSM"    → Validation mode → th_msm_validate
    └── "generate report" → Reporting mode → th_msm_report
```

### Data flow

```
User Query
  ↓
Agent Loop (loop.js)
  ├── Intent classification
  ├── Knowledge base enrichment (context.js)
  ├── Tool dispatch
  │     ├── th_msm_knowledge → knowledge/loader.js → CATALOG.md → papers
  │     ├── th_msm_plan → domain reasoning → MSM protocol
  │     ├── th_msm_build → registry lookup → python.js → PyEMMA/deeptime
  │     └── th_msm_exec → registry → executor.js → ctx.shell
  └── Response synthesis
```

---

## Tradeoffs Made

1. **Keep generic proxy, add domain tools**: The generic `th_msm` tool remains as the secure
   execution boundary. Domain tools (`th_msm_build`, etc.) are higher-level abstractions
   that eventually delegate to it. This preserves the security model.

2. **Agent Loop is advisory, not mandatory**: The loop enriches the system prompt and routes
   to tools, but never blocks direct tool use. Expert users can call `th_msm_exec` directly.

3. **Knowledge base is file-system-based**: No database. CATALOG.md files are parsed at load
   time and cached in memory. This keeps the plugin self-contained and portable.

4. **Python runtime is optional**: The plugin works without Python — `th_msm_build` will
   report missing dependencies rather than fail silently.

5. **Two-phase planning**: `th_msm_plan` produces a protocol; `th_msm_build` executes it.
   The human confirms the plan before execution, aligning with the "never blindly generate" principle.

---

## Migration from v0.1.0

- `plugin.json`: Add new capabilities, extend `msm` section with knowledge base config
- `package.json`: Add `@th-msm/dsh-plugin` as the canonical name, extend scripts
- `src/index.js`: Register all 7 tools instead of 1, install loop hooks
- `src/registry/loader.js`: Unchanged (fully compatible)
- `src/runtime/executor.js`: Unchanged (fully compatible)
- `src/agent/hooks.js`: Unchanged (fully compatible)
- `src/util/text.js`: Unchanged (fully compatible)

All existing tests continue to pass.
