import { defineTool } from '@deepseek-ai/dsh-tools'
import { readWorkspaceJSON, writeWorkspaceText } from '../io/workspace.js'
import { buildC1 } from '../analysis/build-c1.js'
import { validateRun } from '../validation/physics.js'
export function createReportTool(ctx, config) {
  return defineTool({
    name: 'th_msm_report', description: 'Read an actual run and save a C1 scientific Markdown report with results, cost and limitations.',
    parameters: { title: { type: 'string', required: true }, modelPath: { type: 'string', required: true }, outputPath: { type: 'string' } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, reportPath: { type: 'string', required: true }, report: { type: 'string', required: true }, figuresGenerated: { type: 'array', items: { type: 'string' } } } }, render: (_args, v) => [{ type: 'text', text: v.ok ? `Saved: ${v.reportPath}\n${v.report}` : v.report }] },
    timeoutMs: config.pythonTimeoutMs, isConcurrencySafe: () => false,
    async execute(args, exec) {
      try {
        const workspace = exec.agent?.session?.header?.cwd
        if (!workspace) throw new Error('WORKSPACE_REQUIRED')
        const run = await readWorkspaceJSON(workspace, args.modelPath), a = buildC1(run), v = validateRun(run)
        const report = `# ${String(args.title).replace(/[\r\n]/g, ' ')}\n\nRun: ${run.run_id}\n\nObservation horizon: ${run.horizon_fs} fs.\n\n| Channel | Weighted first-hit probability |\n|---|---:|\n${a.curves.map(c => `| ${c.channel} | ${c.points.at(-1).probability} |`).join('\n')}\n\nSurviving mass: ${a.surviving_weight}.\n\nES calls: ${a.cost.total_es_calls}; analytical evaluations: ${a.cost.model_evaluations}. No ES speedup is defined for a zero-ES model.\n\nValidation: ${v.verdict}.\n\n${v.tests.map(t => `- ${t.name}: ${t.status}: ${t.details}`).join('\n')}\n\nConfidence intervals: ${a.confidence_intervals.status}. Supply independent complete runs to build for bootstrap.\n\nC_reachable: ${a.C_reachable.join(', ') || 'none'}. C_reactive: ${JSON.stringify(a.C_reactive)}.\n\n${v.uncertainties.map(x => `- ${x}`).join('\n')}\n\nSinks in analytical models are declared absorbing first-passage boundaries; they do not establish real molecular dissociation. C2, external ES propagation and validated acceleration are not implemented.\n`
        const reportPath = await writeWorkspaceText(workspace, args.outputPath ?? 'output/reports/c1_report.md', report)
        return { ok: true, reportPath, report, figuresGenerated: [] }
      } catch (e) { return { ok: false, reportPath: '', report: e.message, figuresGenerated: [] } }
    },
  })
}
