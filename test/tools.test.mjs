import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createSampleTool } from '../src/tools/sample.js'
import { createBuildTool } from '../src/tools/build.js'
import { createValidateTool } from '../src/tools/validate.js'
import { createReportTool } from '../src/tools/report.js'
import { createEnvTool } from '../src/tools/env.js'
import { readWorkspaceJSON, writeWorkspaceText } from '../src/io/workspace.js'
import { openStore, closeStore } from '../src/knowledge/vector/store.js'
import { evaluateEqualBudget } from '../src/validation/stopping-rule.js'
import { validateJsonSchemaValue } from '@deepseek-ai/dsh-tools'
import { simulateAsync } from '../src/dynamics/async-run.js'

const config = { pythonTimeoutMs: 300000, defaultTimeoutMs: 30000 }
test('analytical worker honors cancellation without returning partial success', async () => {
  const control = new AbortController(), result = simulateAsync({ nTrajectories: 1000, steps: 10000 }, control.signal)
  control.abort()
  await assert.rejects(() => result, /ABORTED/)
})
test('real DSH tool definitions execute sampling -> build -> validate -> saved report', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'th-msm-tools-'))
  const exec = { agent: { session: { header: { cwd: workspace } } } }
  try {
    const sample = createSampleTool({}, config), build = createBuildTool({}, config), validate = createValidateTool({}, config), report = createReportTool({}, config)
    const s = await sample.execute({ mode: 'ci-we', seed: 'tools', nTrajectories: 12, steps: 1100 }, exec)
    assert.equal(s.ok, true, s.summary)
    assert.deepEqual(validateJsonSchemaValue(sample.output.schema, s), [])
    const b = await build.execute({ trajectoryPath: 'output/run.json' }, exec)
    assert.equal(b.ok, true, b.summary)
    assert.deepEqual(validateJsonSchemaValue(build.output.schema, b), [])
    assert.equal(JSON.parse(await readFile(b.details.outputPath)).mode, 'c1')
    const v = await validate.execute({ modelPath: 'output/run.json' }, exec)
    assert.equal(v.verdict, 'C1_CHECKS_PASS')
    assert.deepEqual(validateJsonSchemaValue(validate.output.schema, v), [])
    const r = await report.execute({ title: 'Actual C1 report', modelPath: 'output/run.json' }, exec)
    assert.equal(r.ok, true, r.report)
    assert.deepEqual(validateJsonSchemaValue(report.output.schema, r), [])
    assert.equal(await readFile(r.reportPath, 'utf8'), r.report)
    assert.deepEqual(r.figuresGenerated, [])
    assert.equal((await build.execute({ mode: 'c2', trajectoryPath: 'output/run.json' }, exec)).ok, false)
    assert.equal((await build.execute({ mode: 'msm', trajectoryPath: 'output/run.json' }, exec)).ok, false)
    assert.equal((await validate.execute({ modelPath: 'missing.json' }, exec)).ok, false)
    const env = await createEnvTool({}, config).execute({}, exec)
    assert.equal(env.node, process.version); assert.equal(env.esProviderStatus, 'not_connected')
  } finally {
    // Targets are direct mkdtemp results within the OS temp directory.
    assert.equal(path.dirname(workspace), os.tmpdir())
    await rm(workspace, { recursive: true, force: true })
  }
})
test('workspace IO rejects escape; vector stores are isolated and persist updates', async () => {
  const a = await mkdtemp(path.join(os.tmpdir(), 'th-msm-store-a-')), b = await mkdtemp(path.join(os.tmpdir(), 'th-msm-store-b-'))
  try {
    await assert.rejects(() => writeWorkspaceText(a, '../escape.json', '{}'), /escapes/)
    await assert.rejects(() => readWorkspaceJSON(a, '../escape.json'), /escapes/)
    for (const [dir, id] of [[a, 'a'], [b, 'b']]) {
      await mkdir(path.join(dir, '.th-msm/vector'), { recursive: true })
      await writeFile(path.join(dir, '.th-msm/vector/papers.json'), JSON.stringify({ dimension: 2, model: 'test', chunks: [{ id, text: id, vector: [1, 0] }] }))
    }
    await closeStore()
    const sa = await openStore(a), sb = await openStore(b)
    assert.notEqual(sa, sb)
    assert.equal((await sa.get('a')).id, 'a'); assert.equal(await sa.get('b'), null)
    await assert.rejects(() => sa.search([1, 0, 0]), /dimension/)
    await sa.clear(); await sa.upsert([{ id: 'new', text: 'new', vector: [0, 1], model: 'test', metadata: '{}' }])
    await closeStore()
    assert.equal(await (await openStore(a)).count(), 1)
    assert.equal((await (await openStore(b)).get('b')).id, 'b')
  } finally {
    await closeStore()
    for (const dir of [a, b]) { assert.equal(path.dirname(dir), os.tmpdir()); await rm(dir, { recursive: true, force: true }) }
  }
})
test('equal ES-budget evaluator rejects zero cost and reports negative findings', () => {
  assert.equal(evaluateEqualBudget([{ total_es_calls: 0 }], { reference: 0.02 }).verdict, 'NOT_COMPARABLE')
  const trials = ['direct', 'we', 'ci-we'].flatMap(mode => [0, 1, 2, 3, 4].map(i => ({ run_id: `${mode}-${i}`, seed: `${i}`, mode, horizon_fs: 10, total_es_calls: 10000, complete: true, probability: 0.02 + (i - 2) * (mode === 'direct' ? 0.0001 : 0.001) })))
  assert.equal(evaluateEqualBudget(trials, { reference: 0.02 }).verdict, 'NO_EFFICIENCY_ADVANTAGE')
  trials[0].complete = false
  assert.equal(evaluateEqualBudget(trials, { reference: 0.02 }).verdict, 'INSUFFICIENT_DATA')
})
