import { defineTool } from '@deepseek-ai/dsh-tools'
import { simulateAsync } from '../dynamics/async-run.js'
import { writeWorkspaceText } from '../io/workspace.js'
export function createSampleTool(ctx, config) {
  return defineTool({
    name: 'th_msm_sample', description: 'Analytical FC FSSH+EDC: direct, ordinary WE or CI-guided WE. No quantum chemistry calls. Sinks are first-passage boundaries, not verified molecular dissociation.',
    parameters: { mode: { type: 'string', enum: ['direct', 'we', 'ci-we'] }, model: { type: 'string', enum: ['lvc', 'dual-ci'] }, seed: { type: 'string' }, nTrajectories: { type: 'integer' }, steps: { type: 'integer' }, dt: { type: 'number', description: 'Atomic time units.' }, outputPath: { type: 'string' } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, summary: { type: 'string', required: true }, details: { type: 'object', additionalProperties: true } } }, render: (_args, v) => [{ type: 'text', text: `${v.summary}\n${JSON.stringify(v.details, null, 2)}` }] },
    timeoutMs: config.pythonTimeoutMs, isConcurrencySafe: () => false,
    async execute(args, exec) {
      try {
        const workspace = exec.agent?.session?.header?.cwd
        if (!workspace) throw new Error('WORKSPACE_REQUIRED')
        if ((args.nTrajectories ?? 64) > 1000 || (args.steps ?? 800) > 10000) throw new Error('interactive run limit exceeded; use benchmark CLI')
        const { outputPath: requestedOutput, ...options } = args
        const run = await simulateAsync(options, exec.signal)
        if (exec.signal?.aborted) throw new Error('ABORTED')
        const outputPath = await writeWorkspaceText(workspace, requestedOutput ?? 'output/run.json', JSON.stringify(run) + '\n')
        return { ok: true, summary: 'Analytical simulation completed', details: { outputPath, cost: run.cost, diagnostics: run.diagnostics, surviving_weight: run.surviving_weight } }
      } catch (e) { return { ok: false, summary: e.message, details: {} } }
    },
  })
}
