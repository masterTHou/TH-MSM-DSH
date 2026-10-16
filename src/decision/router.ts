export type Workflow = 'learn' | 'classical-msm' | 'nonadiabatic-c1' | 'analyze' | 'validate' | 'report' | 'clarify'
export interface DecisionState { message: string; explicit?: Exclude<Workflow, 'clarify'> }
export interface WorkflowDecision {
  workflow: Workflow
  certainty: 'explicit' | 'rule-match' | 'ambiguous'
  calibrated: false
  probabilities: null
  evidence: string[]
  alternatives: { workflow: Workflow; score: number }[]
  next_tool: string
}
export function decideWorkflow(state: DecisionState): WorkflowDecision {
  const tools: Record<Workflow, string> = { learn: 'th_msm_teach', 'classical-msm': 'th_msm_build', 'nonadiabatic-c1': 'th_msm_sample', analyze: 'th_msm_analyze', validate: 'th_msm_validate', report: 'th_msm_report', clarify: 'th_msm_guide' }
  if (state.explicit) return { workflow: state.explicit, certainty: 'explicit', calibrated: false, probabilities: null, evidence: ['User selected workflow explicitly'], alternatives: [], next_tool: tools[state.explicit] }
  const message = state.message.toLowerCase(), candidates: { workflow: Workflow; patterns: [RegExp, number][] }[] = [
    { workflow: 'learn', patterns: [[/解释|什么是|教学|科普|入门|学习|explain|what\s+is|teach|learn/, 5]] },
    { workflow: 'classical-msm', patterns: [[/构建|建立|拟合|建模|\bbuild\b|\bfit\b|\btrain\b/, 3], [/\bmsm\b|马尔可夫|构象|蛋白|离散轨迹/, 1]] },
    { workflow: 'nonadiabatic-c1', patterns: [[/非绝热|光解|光化学|\bfssh\b|\bc1\b|首达概率|\bci-we\b/, 3], [/采样|模拟|\bsample\b|\bsimulate\b/, 2]] },
    { workflow: 'validate', patterns: [[/验证|检验|检查|\bvalidate\b|\bverify\b|\bcheck\b/, 5]] },
    { workflow: 'report', patterns: [[/报告|总结|\breport\b|\bsummary\b/, 5]] },
    { workflow: 'analyze', patterns: [[/分析|解读结果|\banalyze\b|\banalyse\b/, 4]] },
  ]
  const ranked = candidates.map(c => ({ workflow: c.workflow, matches: c.patterns.filter(([p]) => p.test(message)), score: c.patterns.reduce((s, [p, w]) => s + (p.test(message) ? w : 0), 0) })).sort((a, b) => b.score - a.score)
  // A physics-domain keyword must not silently convert an explanation into a simulation.
  const top = ranked[0], ambiguous = top.score < 3 || top.score === ranked[1].score
  const workflow = ambiguous ? 'clarify' : top.workflow
  return { workflow, certainty: ambiguous ? 'ambiguous' : 'rule-match', calibrated: false, probabilities: null, evidence: top.matches.map(([p]) => p.source), alternatives: ranked.map(({ workflow, score }) => ({ workflow, score })), next_tool: tools[workflow] }
}
