import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, cp, access, truncate, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createScriptTool, createRunTool } from '../lib/tools/workflow.js'
import { createEnvTool } from '../lib/tools/env.js'
import { generateClassicalExample, buildClassicalModel } from '../lib/msm/index.js'
const execute = promisify(execFile)
const settings = { pythonTimeoutMs: 300000, defaultTimeoutMs: 30000 }
const context = root => ({ agent: { session: { header: { cwd: root } } } })
async function temporary(action) {
  const root = await mkdtemp(path.join(tmpdir(), 'th-msm workflow-'))
  try { await action(root) } finally { assert.equal(path.dirname(root), tmpdir()); await rm(root, { recursive: true, force: true }) }
}

test('exported script runs after relocation without host dependencies; numeric parity and overwrite refusal', async () => temporary(async root => {
  const exported = await createScriptTool({}, settings).execute({ mode: 'example', scriptDir: 'scripts/job', outputDir: 'results/job' }, context(root))
  assert.equal(exported.ok, true, exported.summary)
  assert.equal(exported.details.environment.readiness.workflow, 'ready')
  await assert.rejects(access(path.join(root, 'results/job')))
  await temporary(async relocated => {
    await cp(path.join(root, 'scripts'), path.join(relocated, 'scripts'), { recursive: true })
    const entry = path.join(relocated, 'scripts/job/run.mjs')
    const { stdout } = await execute(process.execPath, [entry], { cwd: tmpdir() })
    const result = JSON.parse(stdout)
    assert.equal(result.status, 'completed')
    const model = JSON.parse(await readFile(path.join(relocated, 'results/job/model.json'), 'utf8'))
    const expected = buildClassicalModel(generateClassicalExample('msm-example'))
    assert.deepEqual(model.transition_matrix, expected.transition_matrix)
    assert.deepEqual(model.stationary_distribution, expected.stationary_distribution)
    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'))
    assert.equal(manifest.stages.length, 6)
    assert.ok(manifest.stages.every(stage => stage.status === 'completed'))
    assert.ok(manifest.input.canonical_json_sha256)
    assert.ok((await readFile(result.artifacts.dashboard, 'utf8')).includes('window.TH_MSM_INITIAL_MODEL={'))
    assert.ok((await readFile(result.artifacts.report, 'utf8')).includes('SUPPORTED_AT_TESTED_LAGS'))
    await assert.rejects(execute(process.execPath, [entry]), /OUTPUT_EXISTS/)
    assert.deepEqual(JSON.parse(await readFile(result.manifestPath, 'utf8')), manifest)
    await writeFile(path.join(relocated, 'scripts/job/runtime.mjs'), '// altered runtime\n', { flag: 'a' })
    await assert.rejects(execute(process.execPath, [entry]), /checksum mismatch/i)
  })
}))

test('managed workflow preserves negative science verdict and generates real logs/report', async () => temporary(async root => {
  const input = JSON.parse(await readFile(new URL('../examples/msm/discrete.json', import.meta.url), 'utf8'))
  input.origin = 'synthetic-markov'
  await writeFile(path.join(root, 'short.json'), JSON.stringify(input))
  const result = await createRunTool({}, settings).execute({ mode: 'msm', trajectoryPath: 'short.json', outputDir: 'negative', scriptDir: 'script' }, context(root))
  assert.equal(result.ok, true, result.summary)
  assert.equal(result.status, 'completed_with_limitations')
  assert.notEqual(result.details.science_verdict, 'SUPPORTED_AT_TESTED_LAGS')
  assert.ok((await readFile(result.details.artifacts.report, 'utf8')).includes(result.details.science_verdict))
  assert.equal((await readFile(result.details.logPath, 'utf8')).trim().split('\n').length, 12)
  const repeat = await createRunTool({}, settings).execute({ workflowPath: result.details.script.workflowPath }, context(root))
  assert.equal(repeat.status, 'blocked')
}))

test('doctor distinguishes embedded readiness, missing native Node, data errors and input size limit', async () => temporary(async root => {
  const env = await createEnvTool({}, settings).execute({ trajectoryPath: 'missing.json', outputDir: 'future' }, context(root))
  assert.equal(env.analyticalEngine, true)
  assert.equal(env.readiness.workflow, 'blocked')
  assert.equal(env.checks.input.status, 'fail')
  assert.equal(env.python.status, 'not_checked')
  const module = new URL('../lib/workflow/doctor.js', import.meta.url).href
  const { stdout } = await execute(process.execPath, ['--input-type=module', '-e', `import {inspectEnvironment} from ${JSON.stringify(module)};console.log(JSON.stringify(await inspectEnvironment()))`], { env: { ...process.env, PATH: '', Path: '' } })
  const absent = JSON.parse(stdout)
  assert.equal(absent.readiness.in_process_native, 'ready')
  assert.equal(absent.readiness.standalone_node, 'blocked')
  await writeFile(path.join(root, 'large.json'), '')
  await truncate(path.join(root, 'large.json'), 64 * 1024 * 1024 + 1)
  const large = await createEnvTool({}, settings).execute({ trajectoryPath: 'large.json' }, context(root))
  assert.match(large.checks.input.reason, /64 MiB/)
}))

test('workflow refuses unsupported commands, escaping/overlapping paths and cancellation', async () => temporary(async root => {
  const script = createScriptTool({}, settings), run = createRunTool({}, settings)
  for (const args of [{ scriptDir: '../escape' }, { outputDir: '../escape' }, { scriptDir: 'job', outputDir: 'job/results' }, { language: 'python' }]) {
    assert.equal((await script.execute(args, context(root))).ok, false)
  }
  await writeFile(path.join(root, 'workflow.json'), JSON.stringify({ schema_version: 1, mode: 'example', outputDir: 'bad', parameters: { lagTime: 1, nClusters: 8, holdoutFraction: .25, seed: 'a' }, command: 'do-not-execute' }))
  const blocked = await run.execute({ workflowPath: 'workflow.json' }, context(root))
  assert.equal(blocked.ok, false); assert.match(blocked.summary, /unknown workflow field/)
  const controller = new AbortController(); controller.abort()
  assert.equal((await run.execute({ mode: 'example' }, { ...context(root), signal: controller.signal })).status, 'cancelled')
  await assert.rejects(access(path.join(root, 'bad')))
}))

test('managed process timeout is explicit and never returns successful partial results', async () => temporary(async root => {
  const result = await createRunTool({}, { ...settings, pythonTimeoutMs: 1 }).execute({ mode: 'example', outputDir: 'timed-out', scriptDir: 'script' }, context(root))
  assert.equal(result.ok, false)
  assert.equal(result.status, 'failed')
  assert.equal(result.summary, 'TIMEOUT')
  const manifest = await readFile(path.join(root, 'timed-out/run-manifest.json'), 'utf8').then(JSON.parse).catch(() => null)
  if (manifest) assert.equal(manifest.execution_ok, false)
}))

test('workflow file boundary rejects directory symlinks into another project', async () => temporary(async root => temporary(async other => {
  await symlink(other, path.join(root, 'outside'), process.platform === 'win32' ? 'junction' : 'dir')
  const result = await createScriptTool({}, settings).execute({ scriptDir: 'outside/script', outputDir: 'result' }, context(root))
  assert.equal(result.ok, false); assert.match(result.summary, /escapes workspace/)
  await assert.rejects(access(path.join(other, 'script')))
})))
