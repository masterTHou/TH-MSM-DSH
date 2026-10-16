import { defineTool } from '@deepseek-ai/dsh-tools'
import { workflowFromArgs } from '../workflow/config.js'
import { exportWorkflow } from '../workflow/artifacts.js'
import { inspectEnvironment } from '../workflow/doctor.js'
import { executeWorkflow } from '../workflow/runner.js'
export const workflowParameters = {
  mode: { type: 'string', enum: ['example', 'msm'], description: 'Default example without an input, otherwise msm. Native classical workflow only.' },
  trajectoryPath: { type: 'string', description: 'Classical state/feature JSON inside workspace.' },
  outputDir: { type: 'string', description: 'Fresh results directory, never overwritten; default unique output/runs directory.' },
  scriptDir: { type: 'string', description: 'Fresh directory for run.mjs, editable workflow.json and bundled runtime.' },
  lagTime: { type: 'integer', description: 'Lag in saved frames, default 1.' },
  nClusters: { type: 'integer', description: 'Feature KMeans clusters, default 8; range 2–128.' },
  holdoutFraction: { type: 'number', description: 'Whole-trajectory holdout fraction in [0,0.5), default .25.' },
  targetState: { type: 'integer', description: 'Actual target state label for MFPT; default 1 only for synthetic example.' },
  seed: { type: 'string', description: 'Synthetic data seed, default msm-example; does not reseed user input trajectories.' },
}
const output = { schema: { type: 'object', additionalProperties: true, properties: { ok: { type: 'boolean', required: true }, summary: { type: 'string', required: true } } }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
export function createScriptTool(ctx, config) {
  return defineTool({ name: 'th_msm_script', description: '生成可审阅、可复现的独立 MSM 脚本与配置，自带运行核心，无需 npm。只生成不执行；给出环境诊断。支持合成例子或经典状态/特征 JSON，不执行 Python/raw XTC/tICA/TPT。',
    parameters: workflowParameters, output, timeoutMs: config.pythonTimeoutMs, isConcurrencySafe: () => false,
    async execute(args, exec) {
      try {
        const workspace = exec.agent?.session?.header?.cwd
        if (!workspace) throw new Error('WORKSPACE_REQUIRED')
        const job = workflowFromArgs(args)
        const environment = await inspectEnvironment({ workspace, trajectoryPath: job.trajectoryPath, outputDir: job.outputDir, signal: exec.signal })
        const script = await exportWorkflow(workspace, job, args.scriptDir)
        return { ok: true, summary: '独立脚本与配置已生成，尚未执行；能否直接运行请看 environment.readiness.workflow。', details: { ...script, environment }, suggested_replies: ['解释这份脚本每一步在做什么', '按这份 workflow.json 运行完整流程', '如果环境未就绪，先解释失败的检查'] }
      } catch (error) { return { ok: false, summary: error.message, details: {} } }
    } })
}
export function createRunTool(ctx, config) {
  return defineTool({ name: 'th_msm_run', description: '端到端原生经典 MSM：自检→生成脚本→建模→分析→ITS/CK→报告与阶段日志。可以运行已有 workflow.json；仅执行插件固定运行核心，不执行用户/模型提供的任意代码。',
    parameters: { ...workflowParameters, workflowPath: { type: 'string', description: 'Use an existing workspace workflow.json; do not combine with inline settings.' } },
    output, timeoutMs: config.pythonTimeoutMs, isConcurrencySafe: () => false,
    async execute(args, exec) {
      try {
        const workspace = exec.agent?.session?.header?.cwd
        if (!workspace) throw new Error('WORKSPACE_REQUIRED')
        return await executeWorkflow(workspace, args, { signal: exec.signal, timeoutMs: config.pythonTimeoutMs })
      } catch (error) { return { ok: false, status: 'failed', summary: error.message, details: {} } }
    } })
}
