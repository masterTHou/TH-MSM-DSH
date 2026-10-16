# Changelog

## 1.5.2 — 2026-10-16

- Add a complete Chinese software user manual for first-time users and MSM practitioners: installation checks, full tutorials, copyable prompts, data formats, units, tool parameters, output files, validation interpretation, troubleshooting and advanced workflows.
- Verify tutorial values with real tools; distinguish executed functionality from method guidance, classical MSM from C1, and computation success from scientific validation.
- Link the manual prominently in README and Codex skill; bundle it and all linked local companion documents in the Codex plugin. DSH packages include the repository docs directory.

## 1.5.1 — 2026-10-16

- Adopt the consistent English name **Trajectory Hub for Markov State Modeling (TH-MSM)**: TH = Trajectory Hub, MSM = Markov State Modeling.
- Update GitHub repository branding/links, README titles and banner, DSH/Codex display names, marketplace metadata, MCP server title and skill introduction.
- Publish refreshed DSH/Codex packages and installation references with the same scientific algorithms and stable th-msm tool/plugin identifiers.

## 1.5.0 — 2026-10-16

- Add a Codex local plugin beside the existing DSH plugin: portable/compatibility manifests, guided scientific skill, repository marketplace and self-contained stdio MCP runtime.
- Reuse 11 scientific/education tools and the same numerical core and JSON formats; retain DSH's 12-tool interface and host-owned command proxy.
- Require explicit user-project roots for file operations; isolate guide state by conversation/workspace, serialize project calls, propagate cancellation and report structured errors.
- Bundle MCP SDK, numerical/schema dependencies, analytical worker and offline literature with third-party notices; Codex installation needs Node ≥22 and no DSH or npm build.
- Add live MCP discovery/end-to-end tests, DSH/Codex numerical parity checks and isolated Codex tarball verification on Linux/Windows CI.
- Document host selection, installation, scientific boundaries and unverified current-GUI behavior. GitHub distribution does not imply public-directory listing.

## 1.4.1 — 2026-10-16

- Add fallback export conditions for plugin and public module entries, fixing `ERR_PACKAGE_PATH_NOT_EXPORTED` in resolver-first hosts while preserving ESM and TypeScript declarations.
- Add package-name resolution/import/tool-registration regression coverage and an isolated release-tarball smoke test in Linux/Windows CI.
- Document installation recovery and the limits of the generic DSH `failed to import` warning.

## 1.4.0 — 2026-10-16

- Restore classical MSM as a real, separate workflow: discrete/pre-extracted feature trajectories, training-only KMeans, within-trajectory counts, row MLE, stationary populations, spectral decay times and MFPT.
- Compute multi-lag ITS and held-out CK diagnostics, with explicit insufficient-data and negative results; keep nonadiabatic C1 semantics separate.
- Add conversation guide, no-data MSM example and result analysis tools. Remember session answers, infer file types, offer 1–3 relevant questions and useful next messages.
- Replace generic teaching templates with 12 topics, beginner/graduate/expert levels, numerical examples, exercises and caveats.
- Introduce strict TypeScript for scientific contracts, trajectory validation and new MSM/education/decision modules; compile JS/TS to lib with public declarations. Existing JS migration remains gradual.
- Apply Jev-inspired typed workflow decisions locally with explicit abstention. No Jev API call or fabricated calibrated probability; scientific probabilities remain numerical observables.
- Wire documented DSH prompt section/scoped context APIs; fix compiled knowledge asset lookup.
- Tighten runtime frame/mass invariants: reject contradictory non-hop state fields and nonfinite/negative absorbed mass.
- Redesign README with original SVG graphics, dialogue examples, actual demo output and honest feature boundaries. Bundle numerical runtime dependency for installation convenience.

## 1.3.0 — 2026-10-15

- Implement a host-independent Node.js C1 engine: validated dynamical frames, state/gap/progress bins, weighted first hits, directed hop maps, candidate/reachable/reactive evidence and complete-run bootstrap.
- Add experimental FC FSSH+EDC dynamics, standard single-CI LVC and explicitly nonlinear dual-CI models, direct/WE/CI-WE runners, reproducible PRNG state, exact-state cloning and weighted survivor merging.
- Count ES attempts, including failures, separately from analytical evaluations. No unverified ES speedup claim.
- Replace build/validate/report/environment success placeholders with actual run analysis, persisted outputs and explicit unsupported/unknown status.
- Remove the broken, unvalidated equilibrium Python generator. C2/ITS/CK and external ES propagation remain unsupported.
- Add 10,000-trajectory reference benchmark, independent repeated comparisons, negative efficiency diagnostics, real DSH tool contract tests, Windows/Linux CI and reproducible packaging.
- Fix knowledge filters, per-workspace vector caching, catalog base paths and vector dimension errors; keep keyword search honest about its capabilities.
- Add a streaming direct-FC JSONL frame adapter with explicit exploration costs and rejection of incomplete histories.
- Explicit limitations: toy sinks are first-passage boundaries, not physical dissociation; strict equal-budget runner and full WE restart/WE JSONL streaming remain future work.

## 1.2.0

Previous DSH research-assistant scaffold and bundled literature keyword search. Historical feature claims are superseded by 1.3.0's tested capability descriptions.
