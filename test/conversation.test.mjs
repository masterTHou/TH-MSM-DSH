import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { validateJsonSchemaValue } from '@deepseek-ai/dsh-tools'
import { createGuideTool } from '../lib/tools/guide.js'
import { createExampleTool } from '../lib/tools/example.js'
import { createBuildTool } from '../lib/tools/build.js'
import { createAnalyzeTool } from '../lib/tools/analyze.js'
import { createValidateTool } from '../lib/tools/validate.js'
import { createReportTool } from '../lib/tools/report.js'
import { createTeachTool } from '../lib/tools/teach.js'
import { createKnowledgeTool } from '../lib/tools/knowledge.js'
import { installAgentLoop } from '../lib/agent/loop.js'
const config = { defaultTimeoutMs: 30000, pythonTimeoutMs: 300000, maxKnowledgeResults: 10 }

test('DSH beginner journey remembers answers and produces real MSM results and report', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'th-msm-conversation-')), exec = { agent: { session: { header: { cwd: workspace } } } }
  try {
    const wizard = createGuideTool({}, config)
    const start = await wizard.execute({}, exec)
    assert.equal(start.stage, 'choose-goal')
    const choice = await wizard.execute({ goal: 'classical-msm', dataFormat: 'none' }, exec)
    assert.equal(choice.next_action.tool, 'th_msm_example')
    const exampleTool = createExampleTool({}, config), example = await exampleTool.execute(choice.next_action.args, exec)
    assert.equal(example.ok, true, example.summary)
    assert.deepEqual(validateJsonSchemaValue(exampleTool.output.schema, example), [])
    const ready = await wizard.execute({ dataPath: example.details.dataPath }, exec)
    assert.equal(ready.questions.length, 0); assert.equal(ready.next_action.tool, 'th_msm_build')
    const build = createBuildTool({}, config), built = await build.execute({ trajectoryPath: example.details.dataPath }, exec)
    assert.equal(built.mode, 'msm'); assert.equal(built.ok, true, built.summary)
    const analyze = createAnalyzeTool({}, config), analysis = await analyze.execute({ modelPath: built.details.outputPath, targetState: 1 }, exec)
    assert.equal(analysis.ok, true); assert.ok(Math.abs(analysis.details.mfpt.by_state[0].mean_time - 10) < 1)
    assert.deepEqual(validateJsonSchemaValue(analyze.output.schema, analysis), [])
    const validated = await createValidateTool({}, config).execute({ modelPath: built.details.outputPath }, exec)
    assert.equal(validated.verdict, 'SUPPORTED_AT_TESTED_LAGS')
    const report = await createReportTool({}, config).execute({ title: '客户的第一个 MSM', modelPath: built.details.outputPath, targetState: 1 }, exec)
    assert.equal(report.ok, true); assert.equal(await readFile(report.reportPath, 'utf8'), report.report)
    const learning = await wizard.execute({ goal: 'learn' }, exec)
    assert.equal(learning.stage, 'choose-lesson'); assert.equal(learning.remembered.dataPath, undefined)
    const selected = await wizard.execute({ topic: 'ck', level: 'graduate' }, exec)
    const teach = createTeachTool({}, config), lesson = await teach.execute(selected.next_action.args, exec)
    assert.equal(lesson.ok, true); assert.equal(lesson.id, 'ck')
    assert.deepEqual(validateJsonSchemaValue(teach.output.schema, lesson), [])
    const separate = await wizard.execute({}, { agent: { session: { header: { cwd: workspace } } } })
    assert.equal(separate.stage, 'choose-goal')
    const reset = await wizard.execute({ reset: true }, exec)
    assert.equal(reset.stage, 'choose-goal')
    const keyword = await createKnowledgeTool({}, config).execute({ query: 'markov', maxResults: 3 }, exec)
    assert.ok(keyword.results.length > 0, 'compiled bundled literature must load')
  } finally { assert.equal(path.dirname(workspace), os.tmpdir()); await rm(workspace, { recursive: true, force: true }) }
})
test('guide infers existing file kind and does not silently build over an existing model', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'th-msm-infer-')), exec = { agent: { session: { header: { cwd: workspace } } } }
  try {
    const example = await createExampleTool({}, config).execute({}, exec)
    const guide = createGuideTool({}, config), result = await guide.execute({ dataPath: example.details.modelPath }, exec)
    assert.equal(result.next_action.tool, 'th_msm_analyze')
    const build = await createBuildTool({}, config).execute({ trajectoryPath: example.details.modelPath }, exec)
    assert.equal(build.ok, false); assert.match(build.summary, /已建立/)
    await writeFile(path.join(workspace, 'invalid.json'), '{')
    const invalid = await guide.execute({ dataPath: 'invalid.json' }, exec)
    assert.equal(invalid.ok, false); assert.ok(invalid.suggested_replies.length > 0)
  } finally { assert.equal(path.dirname(workspace), os.tmpdir()); await rm(workspace, { recursive: true, force: true }) }
})
test('conversation guidance reaches documented DSH section and scoped context APIs', async () => {
  const handlers = new Map(), sections = [], contexts = []
  const ctx = { systemPrompt: { section: section => sections.push(section) }, on: (name, handler) => handlers.set(name, handler) }
  installAgentLoop(ctx, config)
  assert.match(sections[0].text, /1–3/)
  const agent = { ctx: { systemPrompt: { context: entry => contexts.push(entry) } } }
  await handlers.get('agent/pre-step')({ agent, messages: [{ role: 'user', content: '建立 MSM 模型' }] }, async () => ({ kind: 'enter' }))
  assert.equal(contexts.length, 1); assert.match(contexts[0].text(), /classical-msm/)
  await handlers.get('agent/pre-step')({ agent, messages: [{ role: 'user', content: [{ type: 'text', text: '什么是 CK？' }] }] }, async () => ({ kind: 'enter' }))
  assert.equal(contexts.length, 1); assert.match(contexts[0].text(), /learn/)
  handlers.get('agent/turn-stopping')({ agent }); assert.equal(contexts[0].text(), '')
})
