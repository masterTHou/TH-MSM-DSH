import { decideWorkflow } from '../decision/router.js'

export const CONVERSATION_GUIDANCE = `Trajectory Hub for Markov State Modeling (TH-MSM) 是面向客户和科研使用者的轨迹工作台，有三个入口：MSM 学习、经典 MSM 建模分析、非绝热 C1/WE。
先用一句话说明你理解的目标。信息不足时用 th_msm_guide，每轮问 1–3 个相关问题，提供容易选择的回答和具体示例；不要一次倾倒所有参数。
已提供或能从文件读取的信息不要再问。新手可以直接运行 th_msm_example 演示；专家可以提供参数跳过向导。用户已授权执行且输入完整时继续执行，不增加重复确认。
经典数据用 th_msm_build mode=msm；非绝热 run 用 mode=c1。已有模型用 th_msm_analyze。验证和报告必须读取真实结果。
用户只要脚本时用 th_msm_script，不执行；用户授权经典 MSM 全流程且输入完整时用 th_msm_run，先自检并保存脚本、配置、模型、验证、报告和阶段日志。新手解释每个阶段，专家使用明确参数直接执行。Python 导入成功不代表外部工作流已实现；原始轨迹提取与 tICA/TPT 不得声称已接通。
解释结果时先说科学问题的答案，再给关键数值、单位、区间和验证限制。失败时指出具体原因并给 1–2 个可操作的下一步。
每次教学或分析后给 2–3 条自然语言后续提问建议。尊重用户选择，避免反复推荐与目标无关的功能。
Jev 启发的路由仅决定软件工作流；规则得分不是校准概率。严禁将决策模型的置信度用于跃迁概率、WE 权重或科学通量。`

export function installAgentLoop(ctx, config) {
  const register = promptCtx => { promptCtx.systemPrompt.section({ name: 'th-msm:conversation', order: 2500, interpolate: false, text: CONVERSATION_GUIDANCE }) }
  // Register when the optional service becomes available, without blocking tools.
  if (typeof ctx.inject === 'function') ctx.inject(['systemPrompt'], register)
  else if (typeof ctx.systemPrompt?.section === 'function') register(ctx)
  const installed = new WeakSet()
  ctx.on('agent/pre-step', async ({ agent, messages }, next) => {
    const latest = messages?.filter(m => m.role === 'user' || m.role === undefined).at(-1)
    const text = typeof latest?.content === 'string' ? latest.content : Array.isArray(latest?.content) ? latest.content.filter(x => x.type === 'text').map(x => x.text).join('\n') : ''
    if (text) agent._thMsmDecision = decideWorkflow({ message: text })
    if (!installed.has(agent) && typeof agent.ctx?.systemPrompt?.context === 'function') {
      agent.ctx.systemPrompt.context({ name: 'th-msm:workflow', order: 2500, text: () => agent._thMsmDecision ? JSON.stringify({ type: 'workflow_advice', ...agent._thMsmDecision }) : '' })
      installed.add(agent)
    }
    return next()
  })
  ctx.on('agent/turn-stopping', ({ agent }) => { delete agent._thMsmDecision })
}
