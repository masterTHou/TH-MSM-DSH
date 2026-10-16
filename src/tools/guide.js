import { defineTool } from '@deepseek-ai/dsh-tools'
import { guide } from '../decision/wizard.js'
import { readWorkspaceJSON } from '../io/workspace.js'
import { GuideSessionStore } from '../decision/session-store.js'
export function createGuideTool(ctx, config) {
  const sessions = new GuideSessionStore()
  return defineTool({
    name: 'th_msm_guide', description: '对话向导：了解目标、记住本会话已提供的信息，每轮给 1–3 个问题、示例回答和可执行的下一步。不要重复确认已授权的任务。',
    parameters: { goal: { type: 'string', enum: ['learn', 'classical-msm', 'nonadiabatic-c1', 'unsure'] }, dataPath: { type: 'string' }, modelPath: { type: 'string' }, dataFormat: { type: 'string', enum: ['discrete', 'features', 'xtc-dcd', 'run-json', 'none'] }, level: { type: 'string', enum: ['undergraduate', 'graduate', 'expert'] }, topic: { type: 'string' }, experience: { type: 'string', enum: ['guided', 'expert'] }, reset: { type: 'boolean' } },
    output: { schema: { type: 'object', additionalProperties: true, properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } } }, render: (_args, v) => [{ type: 'text', text: `${v.message}\n\n${v.questions?.map(q => `${q.title}\n${q.choices.map(c => `- ${c.label}`).join('\n')}${q.example_reply ? '\n例如：' + q.example_reply : ''}`).join('\n\n') ?? ''}\n\n${v.suggested_replies?.map(x => `你可以说：“${x}”`).join('\n') ?? ''}` }] },
    timeoutMs: config.defaultTimeoutMs, isConcurrencySafe: () => false,
    async execute(args, exec) {
      const key = exec.agent?.session ?? exec.agent
      const { reset, ...answers } = args
      const state = { ...(!reset && key ? sessions.get(key) : {}), ...answers }
      if (answers.goal && key && answers.goal !== sessions.get(key)?.goal) {
        for (const field of ['dataPath', 'dataFormat', 'modelPath', 'topic']) if (answers[field] === undefined) delete state[field]
      }
      if (state.modelPath && !state.goal) state.goal = 'classical-msm'
      if (state.dataPath && exec.agent?.session?.header?.cwd && (answers.dataPath !== undefined || !state.dataFormat)) {
        try {
          const data = await readWorkspaceJSON(exec.agent.session.header.cwd, state.dataPath)
          if (data.kind === 'classical-msm') { state.modelPath = state.dataPath; if (!answers.goal) state.goal = 'classical-msm' }
          else if (data.kind === 'classical-trajectories' || data.kind === 'classical-features') { if (!answers.goal) state.goal = 'classical-msm'; state.dataFormat = data.kind === 'classical-features' ? 'features' : 'discrete' }
          else if (data.schema_version === 1 && Array.isArray(data.events)) { if (!answers.goal) state.goal = 'nonadiabatic-c1'; state.dataFormat = 'run-json' }
        } catch (e) { return { ok: false, message: `暂时读不到这个文件：${e.message}。请检查工作区内的路径，也可以先运行演示。`, questions: [], suggested_replies: ['我的文件路径是……', '先跑一个演示'] } }
      }
      if (key) sessions.set(key, state)
      return { ok: true, ...guide(state) }
    },
  })
}
