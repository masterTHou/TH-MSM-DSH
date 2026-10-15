import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildC1 } from '../analysis/build-c1.js'
import { writeWorkspaceText } from '../io/workspace.js'
import { buildIndex, checkIndex } from '../knowledge/vector/indexer.js'
import { readTrajectoryRun } from '../io/trajectory.js'
export function createBuildTool(ctx, config) {
  return defineTool({
    name: 'th_msm_build',
    description: 'Build C1 first-hit probabilities and directed hopping flux from run JSON. C2/legacy MSM execution is not implemented.',
    parameters: {
      mode: { type: 'string', enum: ['c1', 'c2', 'msm', 'index'], description: 'Default c1; c2/msm report unsupported.' },
      trajectoryPath: { type: 'string', description: 'Versioned run JSON within workspace.' },
      outputPath: { type: 'string', description: 'Default output/c1.json.' },
      bootstrapPaths: { type: 'array', items: { type: 'string' }, description: 'Independent complete runs of the same protocol.' },
      nBootstraps: { type: 'integer', description: 'Default 200.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, mode: { type: 'string', required: true }, summary: { type: 'string', required: true }, details: { type: 'object', additionalProperties: true }, nextSteps: { type: 'array', items: { type: 'string' } } } },
      render: (_args, v) => [{ type: 'text', text: `${v.summary}\n${JSON.stringify(v.details, null, 2)}` }],
    },
    timeoutMs: config.pythonTimeoutMs, isConcurrencySafe: () => false,
    async execute(args, exec) {
      const mode = args.mode ?? 'c1', workspace = exec.agent?.session?.header?.cwd
      const result = (ok, summary, details = {}) => ({ ok, mode, summary, details, nextSteps: [] })
      if (!workspace) return result(false, 'WORKSPACE_REQUIRED')
      try {
        if (mode === 'index') {
          const status = await checkIndex(workspace)
          if (status.exists) return result(true, 'Index exists', status)
          const index = await buildIndex(workspace, config.knowledgeBasePath, config.knowledgeCatalogs)
          return result(index.indexed > 0 && index.errors === 0, index.message, index)
        }
        if (mode !== 'c1') return result(false, 'NOT_IMPLEMENTED: only C1 analysis is scientifically supported')
        if (!args.trajectoryPath) return result(false, 'trajectoryPath is required')
        const run = await readTrajectoryRun(workspace, args.trajectoryPath)
        const bootstrapRuns = await Promise.all((args.bootstrapPaths ?? []).map(p => readTrajectoryRun(workspace, p)))
        const analysis = buildC1(run, { bootstrapRuns, nBootstraps: args.nBootstraps ?? 200 })
        const outputPath = await writeWorkspaceText(workspace, args.outputPath ?? 'output/c1.json', JSON.stringify(analysis, null, 2) + '\n')
        return result(true, 'C1 analysis completed and saved', { outputPath, ...analysis })
      } catch (e) { return result(false, e.message) }
    },
  })
}
