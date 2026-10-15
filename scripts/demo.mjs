import { mkdir, writeFile } from 'node:fs/promises'
import { runSimulation, buildC1, validateRun } from '../src/engine.js'
await mkdir('output/demo', { recursive: true })
const run = runSimulation({ mode: 'ci-we', nTrajectories: 32, steps: 1100, seed: 'demo-v1.3' })
const analysis = buildC1(run), validation = validateRun(run)
for (const [file, data] of Object.entries({ run, analysis, validation })) await writeFile(`output/demo/${file}.json`, JSON.stringify(data, null, 2))
console.log(JSON.stringify({ validation: validation.verdict, curves: analysis.curves.map(c => ({ channel: c.channel, final: c.points.at(-1).probability })), cost: run.cost }, null, 2))
if (!validation.ok) process.exitCode = 1
