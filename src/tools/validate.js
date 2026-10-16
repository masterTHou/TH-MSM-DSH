import { defineTool } from '@deepseek-ai/dsh-tools'
import { readWorkspaceJSON } from '../io/workspace.js'
import { validateRun } from '../validation/physics.js'
import { validateMSM } from '../msm/index.js'
export function createValidateTool(ctx, config) {
  return defineTool({
    name: 'th_msm_validate',
    description: '自动识别经典 MSM 或非绝热 run。经典模型检查计数、稳态、ITS 与留出 CK；非绝热 run 检查质量、能漂、范数和 EDC。',
    parameters: { modelPath: { type: 'string', required: true, description: 'Run JSON within workspace, not pickle.' }, energyTolerance: { type: 'number', description: 'Maximum energy drift in Hartree; default 1e-4.' } },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, modelPath: { type: 'string', required: true }, verdict: { type: 'string', required: true }, tests: { type: 'array', items: { type: 'object', additionalProperties: true }, required: true }, uncertainties: { type: 'array', items: { type: 'string' }, required: true } } },
      render: (_args, v) => [{ type: 'text', text: `${v.verdict}\n${v.tests.map(t => `${t.name}: ${t.status} — ${t.details}`).join('\n')}\n${v.uncertainties.join('\n')}` }],
    },
    timeoutMs: config.pythonTimeoutMs, isConcurrencySafe: () => true,
    async execute(args, exec) {
      const modelPath = args.modelPath ?? '', workspace = exec.agent?.session?.header?.cwd
      try {
        if (!workspace || !modelPath) throw new Error('workspace and modelPath required')
        const input = await readWorkspaceJSON(workspace, modelPath)
        const { ok, verdict, tests, uncertainties } = input.kind === 'classical-msm' ? validateMSM(input) : validateRun(input, { energyTolerance: args.energyTolerance ?? 1e-4 })
        return { ok, modelPath, verdict, tests, uncertainties }
      } catch (e) { return { ok: false, modelPath, verdict: 'INVALID_INPUT', tests: [], uncertainties: [e.message] } }
    },
  })
}
