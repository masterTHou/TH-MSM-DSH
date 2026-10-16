import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createExampleTool } from '../lib/tools/example.js'

test('configured project root confines IO while allowing workspace-free teaching', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'th-msm-fixed-root-'))
  const entry = process.env.TH_MSM_TEST_SERVER ?? fileURLToPath(new URL('../plugins/th-msm/server/index.mjs', import.meta.url))
  const client = new Client({ name: 'th-msm-fixed-root', version: '1.0.0' })
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: { TH_MSM_WORKSPACE: workspace }, stderr: 'pipe' })
  try {
    await client.connect(transport)
    assert.ok(!(await client.callTool({ name: 'th_msm_teach', arguments: { concept: 'msm' } })).isError)
    const forbidden = await client.callTool({ name: 'th_msm_example', arguments: { workspaceRoot: tmpdir() } })
    assert.equal(forbidden.isError, true)
    assert.match(JSON.stringify(forbidden), /configured TH_MSM_WORKSPACE/)
    assert.ok(!(await client.callTool({ name: 'th_msm_example', arguments: { workspaceRoot: workspace } })).isError)
  } finally { await client.close(); assert.equal(path.dirname(workspace), tmpdir()); await rm(workspace, { recursive: true, force: true }) }
})

test('Codex stdio plugin: discovery, teaching, MSM parity, C1 worker and workspace isolation', { timeout: 60000 }, async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'th-msm-codex-'))
  const entry = process.env.TH_MSM_TEST_SERVER ?? fileURLToPath(new URL('../plugins/th-msm/server/index.mjs', import.meta.url))
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], cwd: workspace, stderr: 'pipe' })
  let stderr = ''
  transport.stderr?.on('data', data => { stderr += data })
  const client = new Client({ name: 'th-msm-regression', version: '1.0.0' })
  try {
    await client.connect(transport)
    const list = await client.listTools()
    assert.equal(list.tools.length, 11)
    assert.ok(!list.tools.some(tool => tool.name === 'th_msm'))
    const call = async (name, args = {}) => {
      const reply = await client.callTool({ name, arguments: args })
      assert.ok(!reply.isError, JSON.stringify(reply))
      return reply.structuredContent
    }
    assert.equal((await call('th_msm_env')).analyticalEngine, true)
    assert.equal((await call('th_msm_teach', { concept: 'msm', level: 'undergraduate' })).ok, true)
    assert.equal((await client.callTool({ name: 'th_msm_teach', arguments: { level: 'invented' } })).isError, true)
    assert.equal((await client.callTool({ name: 'th_msm_example', arguments: {} })).isError, true)
    assert.equal((await client.callTool({ name: 'th_msm_example', arguments: { workspaceRoot: 'relative' } })).isError, true)
    const start = await call('th_msm_guide', { workspaceRoot: workspace, conversationId: 'a', goal: 'classical-msm', dataFormat: 'none' })
    assert.equal(start.next_action.tool, 'th_msm_example')
    const example = await call('th_msm_example', { workspaceRoot: workspace })
    const ready = await call('th_msm_guide', { workspaceRoot: workspace, conversationId: 'a', dataPath: example.details.dataPath })
    assert.equal(ready.next_action.tool, 'th_msm_build')
    assert.equal((await call('th_msm_guide', { workspaceRoot: workspace, conversationId: 'b' })).stage, 'choose-goal')
    assert.equal((await call('th_msm_guide', { workspaceRoot: workspace })).stage, 'choose-goal')
    const built = await call('th_msm_build', { workspaceRoot: workspace, trajectoryPath: example.details.dataPath })
    assert.equal(built.mode, 'msm')
    const analyzed = await call('th_msm_analyze', { workspaceRoot: workspace, modelPath: built.details.outputPath, targetState: 1 })
    assert.equal(analyzed.details.domain, 'classical-msm')
    assert.ok(Math.abs(analyzed.details.mfpt.by_state[0].mean_time - 10) < 1)
    const baseline = await createExampleTool({}, { defaultTimeoutMs: 30000 }).execute({ outputDir: 'dsh-parity' }, { agent: { session: { header: { cwd: workspace } } } })
    const baselineModel = JSON.parse(await readFile(baseline.details.modelPath, 'utf8'))
    assert.ok(Array.isArray(built.details.model.transition_matrix))
    assert.deepEqual(built.details.model.transition_matrix, baselineModel.transition_matrix)
    assert.deepEqual(built.details.model.stationary_distribution, baselineModel.stationary_distribution)
    assert.equal((await call('th_msm_validate', { workspaceRoot: workspace, modelPath: built.details.outputPath })).verdict, 'SUPPORTED_AT_TESTED_LAGS')
    const report = await call('th_msm_report', { workspaceRoot: workspace, modelPath: built.details.outputPath, title: 'Codex 的第一个 MSM' })
    assert.equal(await readFile(report.reportPath, 'utf8'), report.report)
    const knowledge = await call('th_msm_knowledge', { query: 'markov', maxResults: 2 })
    assert.ok(knowledge.results.length > 0)
    const sampled = await call('th_msm_sample', { workspaceRoot: workspace, seed: 'codex-e2e', nTrajectories: 8, steps: 40 })
    const c1 = await call('th_msm_build', { workspaceRoot: workspace, trajectoryPath: sampled.details.outputPath, mode: 'c1' })
    assert.equal(c1.mode, 'c1')
    assert.equal((await call('th_msm_validate', { workspaceRoot: workspace, modelPath: sampled.details.outputPath })).ok, true)
    const escape = await client.callTool({ name: 'th_msm_build', arguments: { workspaceRoot: workspace, mode: 'msm', trajectoryPath: '../outside.json' } })
    assert.equal(escape.isError, true)
    assert.match(JSON.stringify(escape), /escapes workspace/)
    const index = await client.callTool({ name: 'th_msm_build', arguments: { workspaceRoot: workspace, mode: 'index' } })
    assert.equal(index.isError, true)
    assert.match(JSON.stringify(index), /not supported/)
    assert.equal(stderr, '')
  } finally { await client.close(); assert.equal(path.dirname(workspace), tmpdir()); await rm(workspace, { recursive: true, force: true }) }
})
