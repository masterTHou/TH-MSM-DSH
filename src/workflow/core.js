import { randomUUID, createHash } from 'node:crypto'
import path from 'node:path'
import { writeWorkspaceText } from '../io/workspace.js'
import { generateClassicalExample } from '../msm/example.js'
import { createBuildTool } from '../tools/build.js'
import { createAnalyzeTool } from '../tools/analyze.js'
import { createValidateTool } from '../tools/validate.js'
import { createReportTool } from '../tools/report.js'
import { validateWorkflow } from './config.js'
import { freshDirectory } from './paths.js'
import { readClassicalInput } from './input.js'
export const runnerVersion = typeof __TH_MSM_VERSION__ === 'string' ? __TH_MSM_VERSION__ : 'development'

export async function runWorkflow(workspace, config, options = {}) {
  validateWorkflow(config)
  const folder = await freshDirectory(workspace, config.outputDir)
  const relative = file => path.join(config.outputDir, file)
  const manifest = { schema_version: 1, kind: 'th-msm-workflow-run', run_id: options.runId ?? randomUUID(), runner_version: runnerVersion,
    status: 'running', execution_ok: false, started_at: new Date().toISOString(), configuration: structuredClone(config), node: process.version,
    stages: [], artifacts: {}, limitations: ['Classical native MSM only: no raw XTC/DCD extraction, tICA/VAMP, reversible MLE, PCCA or TPT execution.', 'Computation completion does not establish Markov validity or confidence intervals.'] }
  const events = []
  const save = async () => {
    await writeWorkspaceText(workspace, relative('run-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
    await writeWorkspaceText(workspace, relative('workflow.log.jsonl'), events.map(event => JSON.stringify(event)).join('\n') + '\n')
  }
  const stage = async (name, action) => {
    if (options.signal?.aborted) throw new Error('ABORTED')
    const record = { name, status: 'running', started_at: new Date().toISOString() }
    manifest.stages.push(record); events.push({ stage: name, event: 'started', time: record.started_at }); await save()
    try {
      const value = await action()
      if (options.signal?.aborted) throw new Error('ABORTED')
      record.status = 'completed'; record.finished_at = new Date().toISOString()
      events.push({ stage: name, event: 'completed', time: record.finished_at }); await save()
      return value
    } catch (error) {
      record.status = error.message === 'ABORTED' ? 'cancelled' : 'failed'; record.error = error.message; record.finished_at = new Date().toISOString()
      events.push({ stage: name, event: record.status, error: error.message, time: record.finished_at }); throw error
    }
  }
  const context = { agent: { session: { header: { cwd: workspace } } }, signal: options.signal }
  const settings = { defaultTimeoutMs: 30000, pythonTimeoutMs: 300000 }
  let inputPath = config.trajectoryPath
  const requireSuccess = result => { if (!result.ok) throw new Error(result.summary ?? result.report ?? result.verdict ?? 'tool failed'); return result }
  try {
    await save()
    await stage('prepare_input', async () => {
      if (config.mode === 'example') {
        inputPath = relative('trajectories.json')
        await writeWorkspaceText(workspace, inputPath, JSON.stringify(generateClassicalExample(config.parameters.seed)) + '\n')
      }
      const input = await readClassicalInput(workspace, inputPath)
      manifest.input = { path: inputPath, kind: input.kind, canonical_json_sha256: createHash('sha256').update(JSON.stringify(input)).digest('hex') }
      manifest.artifacts.input = inputPath
    })
    await stage('build', async () => {
      const { lagTime, nClusters, holdoutFraction } = config.parameters
      const result = requireSuccess(await createBuildTool({}, settings).execute({ mode: 'msm', trajectoryPath: inputPath, outputPath: relative('model.json'), lagTime, nClusters, holdoutFraction }, context))
      manifest.artifacts.model = result.details.outputPath
    })
    await stage('analyze', async () => {
      const result = requireSuccess(await createAnalyzeTool({}, settings).execute({ modelPath: relative('model.json'), ...(config.parameters.targetState !== undefined ? { targetState: config.parameters.targetState } : {}) }, context))
      manifest.artifacts.analysis = await writeWorkspaceText(workspace, relative('analysis.json'), JSON.stringify(result, null, 2) + '\n')
    })
    await stage('validate', async () => {
      const result = await createValidateTool({}, settings).execute({ modelPath: relative('model.json') }, context)
      if (['INVALID_INPUT', 'INVALID_MODEL'].includes(result.verdict)) throw new Error(`invalid model: ${result.verdict}`)
      // A negative science verdict is a valid result, and must reach the report.
      manifest.science_verdict = result.verdict
      manifest.artifacts.validation = await writeWorkspaceText(workspace, relative('validation.json'), JSON.stringify(result, null, 2) + '\n')
    })
    await stage('report', async () => {
      const result = requireSuccess(await createReportTool({}, settings).execute({ title: 'TH-MSM reproducible workflow', modelPath: relative('model.json'), outputPath: relative('report.md'), ...(config.parameters.targetState !== undefined ? { targetState: config.parameters.targetState } : {}) }, context))
      manifest.artifacts.report = result.reportPath
      manifest.artifacts.readme = await writeWorkspaceText(workspace, relative('START-HERE.md'), `# 这次 MSM 工作流\n\n1. 输入：${inputPath}。\n2. model.json 保存真实计数、矩阵和谱。\n3. analysis.json 解读布居与可选 MFPT。\n4. validation.json 保存 ITS/CK 诊断。\n5. report.md 是可交付报告。\n\n科学结论：**${manifest.science_verdict}**。程序完成不等于科学验证通过。合成示例不是分子模拟；稳态布居不是光解分支比。\n\n参数和运行阶段见 run-manifest.json，日志见 workflow.log.jsonl。\n\n你可以继续问：为什么布居不是各占一半？这个 lag 是否受支持？如何替换成自己的数据？\n`)
    })
    manifest.execution_ok = true
    manifest.status = manifest.science_verdict === 'SUPPORTED_AT_TESTED_LAGS' ? 'completed' : 'completed_with_limitations'
  } catch (error) {
    manifest.status = error.message === 'ABORTED' ? 'cancelled' : 'failed'; manifest.error = error.message
  }
  manifest.finished_at = new Date().toISOString(); await save()
  return { ok: manifest.execution_ok, status: manifest.status, science_verdict: manifest.science_verdict ?? 'not_available', outputDir: folder,
    manifestPath: path.join(folder, 'run-manifest.json'), logPath: path.join(folder, 'workflow.log.jsonl'), artifacts: manifest.artifacts,
    ...(manifest.error ? { error: manifest.error } : {}), limitations: manifest.limitations }
}
