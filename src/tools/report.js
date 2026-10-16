import { defineTool } from '@deepseek-ai/dsh-tools'
import { readWorkspaceJSON, writeWorkspaceText } from '../io/workspace.js'
import { buildC1 } from '../analysis/build-c1.js'
import { validateRun } from '../validation/physics.js'
import { validateMSM, mfptToState } from '../msm/index.js'
export function createReportTool(ctx, config) {
  return defineTool({
    name: 'th_msm_report', description: '读取真实经典 MSM 或非绝热 run，保存可阅读的报告：关键结论、数值、验证与限制。',
    parameters: { title: { type: 'string', required: true }, modelPath: { type: 'string', required: true }, outputPath: { type: 'string' }, targetState: { type: 'integer' } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, reportPath: { type: 'string', required: true }, report: { type: 'string', required: true }, figuresGenerated: { type: 'array', items: { type: 'string' } } } }, render: (_args, v) => [{ type: 'text', text: v.ok ? `Saved: ${v.reportPath}\n${v.report}` : v.report }] },
    timeoutMs: config.pythonTimeoutMs, isConcurrencySafe: () => false,
    async execute(args, exec) {
      try {
        const workspace = exec.agent?.session?.header?.cwd
        if (!workspace) throw new Error('WORKSPACE_REQUIRED')
        const run = await readWorkspaceJSON(workspace, args.modelPath)
        if (run.kind === 'classical-msm') {
          const validation = validateMSM(run)
          if (validation.verdict === 'INVALID_MODEL') throw new Error(validation.uncertainties.join('; '))
          const report = `# ${String(args.title).replace(/[\r\n]/g, ' ')}\n\n经典 MSM：${run.labels.length} 个状态，lag=${run.lag_time} ${run.time_unit}。验证结论：**${validation.verdict}**。\n\n## 状态布居\n\n这是模型的长期状态占比，不能解释成光解产物分支比。\n\n| 状态 | 稳态布居 |\n|---|---:|\n${run.labels.map((s, i) => `| ${s} | ${run.stationary_distribution[i]} |`).join('\n')}\n\n## 慢时间尺度\n\n${run.spectrum.map((s, i) => `- 模式 ${i + 1}：${s.decay_time ?? '无有限衰减时间'} ${run.time_unit}；振荡=${s.oscillatory}`).join('\n')}\n\n## 验证依据\n\n${validation.tests.map(t => `- ${t.name}：${t.status}。${t.details}`).join('\n')}\n\n${args.targetState !== undefined ? '## 目标态 MFPT\n\n```json\n' + JSON.stringify(mfptToState(run, args.targetState), null, 2) + '\n```\n\n' : ''}## 解释边界\n\n${validation.uncertainties.map(x => `- ${x}`).join('\n')}\n- 本报告未估计布居与 MFPT 置信区间，不能将点估计精度当作统计精度。\n\n## 接下来可以问\n\n- 为什么 ITS 和 CK 都需要检查？\n- 哪个目标态的 MFPT 最值得分析？\n- 如果验证不通过，应该调整特征、状态还是 lag？\n`
          const reportPath = await writeWorkspaceText(workspace, args.outputPath ?? 'output/reports/msm_report.md', report)
          return { ok: true, reportPath, report, figuresGenerated: [] }
        }
        const a = buildC1(run), v = validateRun(run)
        const report = `# ${String(args.title).replace(/[\r\n]/g, ' ')}\n\nRun: ${run.run_id}\n\nObservation horizon: ${run.horizon_fs} fs.\n\n| Channel | Weighted first-hit probability |\n|---|---:|\n${a.curves.map(c => `| ${c.channel} | ${c.points.at(-1).probability} |`).join('\n')}\n\nSurviving mass: ${a.surviving_weight}.\n\nES calls: ${a.cost.total_es_calls}; analytical evaluations: ${a.cost.model_evaluations}. No ES speedup is defined for a zero-ES model.\n\nValidation: ${v.verdict}.\n\n${v.tests.map(t => `- ${t.name}: ${t.status}: ${t.details}`).join('\n')}\n\nConfidence intervals: ${a.confidence_intervals.status}. Supply independent complete runs to build for bootstrap.\n\nC_reachable: ${a.C_reachable.join(', ') || 'none'}. C_reactive: ${JSON.stringify(a.C_reactive)}.\n\n${v.uncertainties.map(x => `- ${x}`).join('\n')}\n\nSinks in analytical models are declared absorbing first-passage boundaries; they do not establish real molecular dissociation. C2, external ES propagation and validated acceleration are not implemented.\n`
        const reportPath = await writeWorkspaceText(workspace, args.outputPath ?? 'output/reports/c1_report.md', report)
        return { ok: true, reportPath, report, figuresGenerated: [] }
      } catch (e) { return { ok: false, reportPath: '', report: e.message, figuresGenerated: [] } }
    },
  })
}
