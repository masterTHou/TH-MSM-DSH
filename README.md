# TH-MSM DSH Plugin v1.0

> **Thermodynamic and Kinetic Markov State Model Intelligence Agent**
> DeepSeek Harness Plugin

---

## Overview

TH-MSM is an intelligent Markov State Model (MSM) research assistant plugin for DeepSeek Harness.
It helps researchers extract long-timescale kinetics from molecular dynamics trajectories through
a structured pipeline: teaching → planning → modeling → validation → reporting.

### Architecture

```
User Query → Agent Loop (intent detection)
    ├── teaching    → th_msm_knowledge + th_msm_teach
    ├── planning    → th_msm_plan → (confirm) → th_msm_build
    ├── modeling    → th_msm_build → th_msm (generic proxy)
    ├── validation  → th_msm_validate
    └── reporting   → th_msm_report
```

## File Structure

```
th-msm-dsh-plugin/
├── README.md                    ← This file
├── plugin.json                  ← Plugin metadata (DSH manifest)
├── package.json                 ← npm package definition
├── cordis.patch.yml             ← DSH bundle patch for host integration
├── ADR.md                       ← Architecture Decision Record
├── .gitignore
├── .npmignore
├── src/
│   ├── index.js                 ← Plugin entry: register 7 tools + hooks + loop
│   ├── agent/
│   │   ├── hooks.js             ← Per-turn accounting & policy guards
│   │   └── loop.js              ← MSM-aware Agent Loop (intent detection + routing)
│   ├── tools/
│   │   ├── msm.js               ← th_msm: Generic execution proxy (security boundary)
│   │   ├── knowledge.js         ← th_msm_knowledge: Query knowledge base
│   │   ├── teach.js             ← th_msm_teach: Explain MSM concepts
│   │   ├── plan.js              ← th_msm_plan: Design MSM protocol
│   │   ├── build.js             ← th_msm_build: Orchestrate MSM construction
│   │   ├── validate.js          ← th_msm_validate: Run validation tests
│   │   └── report.js            ← th_msm_report: Generate scientific report
│   ├── registry/
│   │   └── loader.js            ← Registry loader & validator (symlink-safe)
│   ├── runtime/
│   │   ├── executor.js          ← Shell executor with sandbox enforcement
│   │   └── python.js            ← Python/MSM runtime manager
│   ├── knowledge/
│   │   ├── loader.js            ← Knowledge base scanner
│   │   ├── catalog.js           ← CATALOG.md parser
│   │   ├── searcher.js          ← Full-text search with relevance scoring
│   │   └── context.js           ← Prompt injection formatter
│   └── util/
│       └── text.js              ← Smart text truncation (60/40 split)
├── test/
│   └── core.test.mjs            ← Security + knowledge base tests
└── examples/
    └── workspace/
        ├── .th-msm/
        │   └── registry.json    ← Example MSM registry
        └── tools/
            └── echo.mjs         ← Echo tool for testing
```

## Tools

| Tool | Description |
|------|-------------|
| `th_msm` | Generic MSM execution proxy — security boundary for shell commands |
| `th_msm_knowledge` | Query the knowledge base (papers, reviews, benchmarks) |
| `th_msm_teach` | Explain MSM concepts at user's level (undergraduate/graduate/expert) |
| `th_msm_plan` | Design MSM protocol with justified methodological choices |
| `th_msm_build` | Orchestrate MSM construction pipeline (preprocess → featurize → reduce → cluster → estimate) |
| `th_msm_validate` | Run validation: ITS, CK test, population analysis, stability |
| `th_msm_report` | Generate Markdown scientific report (9 standard sections) |

## Security Model

- **Registry as executable whitelist**: Only `command` strings in `.th-msm/registry.json` reach the shell.
- **JSON-stdin protocol**: Model-supplied arguments are serialized to JSON and written to stdin — NEVER concatenated into shell commands.
- **Sandbox by default**: Requires sandboxed `ctx.shell`; refuses `danger-full-access`.
- **Symlink escape protection**: `loadRegistry` resolves real paths and double-checks workspace boundaries.
- **Per-turn call limit**: `maxCallsPerTurn` guard prevents runaway tool usage.

## Quick Start

### 1. Install as DSH plugin

Add to your DSH configuration:

```yaml
# cordis.patch.yml
- insert:
    - id: th-msm
      name: '@th-msm/dsh-plugin'
      config:
        requireSandbox: true
        agentLoopEnabled: true
```

### 2. Create a workspace registry

Create `.th-msm/registry.json` in your workspace:

```json
{
  "version": 1,
  "msms": [
    {
      "name": "msm_featurize",
      "command": "python ./tools/msm_featurize.py",
      "description": "Extract features from MD trajectory",
      "timeoutMs": 60000
    }
  ]
}
```

### 3. Populate the knowledge base

Add papers to `knowledge/reviews/`, `knowledge/papers/`, `knowledge/benchmarks/` and update their `CATALOG.md` files with YAML entries.

### 4. Start using

```
User: "Build an MSM for alanine dipeptide folding"
TH-MSM: [Detects modeling intent → th_msm_plan → confirms → th_msm_build]
```

## Scientific Principles

1. Never blindly generate MSM models — every step requires justification
2. Warn when MSM is unsuitable for the research goal
3. Never hide model uncertainty — distinguish numerical correctness from scientific credibility
4. All analyses must be reproducible

## Dependencies

- **Node.js** >= 22
- **DSH Host**: `@deepseek-ai/cordis` >= 4, `@deepseek-ai/dsh-tools` >= 0.2.0-rc.2, `@deepseek-ai/schemastery` >= 3.18
- **Python** (optional): `pyemma`, `deeptime`, `msmbuilder`

## Testing

```bash
npm test
```

Runs security tests (registry validation, path escaping, stdin injection prevention, sandbox enforcement) and knowledge base tests (catalog parsing, search, filtering).

## License

MIT

---

*TH-MSM · Powered by Markov State Model Intelligence*