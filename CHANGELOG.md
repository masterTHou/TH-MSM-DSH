# Changelog

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
