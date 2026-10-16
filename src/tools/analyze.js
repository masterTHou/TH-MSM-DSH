import { defineTool } from '@deepseek-ai/dsh-tools'
import { readWorkspaceJSON } from '../io/workspace.js'
import { validateMSM, mfptToState } from '../msm/index.js'
import { buildC1 } from '../analysis/build-c1.js'
export function createAnalyzeTool(ctx, config) {
  return defineTool({
    name: 'th_msm_analyze', description: '解读真实模型：经典 MSM 的布居、时间尺度、可选目标态 MFPT；非绝热 run 的首达曲线与跃迁通量。保留验证限制，给出后续提问建议。',
    parameters: { modelPath: { type: 'string', required: true }, targetState: { type: 'integer', description: 'Classical model target label for MFPT.' } },
    output: { schema: { type: 'object', additionalProperties: true, properties: { ok: { type: 'boolean', required: true }, summary: { type: 'string', required: true } } }, render: (_args, v) => [{ type: 'text', text: `${v.summary}\n\n${JSON.stringify(v.details, null, 2)}\n\n${v.suggested_replies?.join('\n') ?? ''}` }] },
    timeoutMs: config.defaultTimeoutMs, isConcurrencySafe: () => true,
    async execute(args, exec) {
      try {
        const workspace = exec.agent?.session?.header?.cwd
        if (!workspace) throw new Error('WORKSPACE_REQUIRED')
        const model = await readWorkspaceJSON(workspace, args.modelPath)
        if (model.kind === 'classical-msm') {
          const validation = validateMSM(model)
          if (validation.verdict === 'INVALID_MODEL') throw new Error(validation.uncertainties.join('; '))
          const populations = model.labels.map((label, i) => ({ label, population: model.stationary_distribution[i] })).sort((a, b) => b.population - a.population)
          return { ok: true, summary: `模型中布居最高的是状态 ${populations[0].label}（${(populations[0].population * 100).toFixed(2)}%）。验证结论：${validation.verdict}。这些数值需结合验证限制解释。`, details: { domain: 'classical-msm', populations, spectrum: model.spectrum, time_unit: model.time_unit, validation, ...(args.targetState !== undefined ? { mfpt: mfptToState(model, args.targetState) } : {}), confidence_intervals: 'not_estimated' }, suggested_replies: ['这个慢时间尺度对应什么运动？', '计算到状态 1 的 MFPT', '为什么 CK 检验可能失败？'] }
        }
        const analysis = buildC1(model)
        return { ok: true, summary: `观察窗 ${analysis.horizon_fs} fs 内已吸收质量为 ${analysis.absorbed_weight}，未反应质量为 ${analysis.surviving_weight}。`, details: analysis, suggested_replies: ['解释各通道首达曲线', '哪些 CI 真正通向产物？', '怎样获得可靠置信区间？'] }
      } catch (e) { return { ok: false, summary: `暂时无法完成分析：${e.message}`, details: {}, suggested_replies: ['检查模型 JSON 路径', '先运行经典 MSM 演示'] } }
    },
  })
}
