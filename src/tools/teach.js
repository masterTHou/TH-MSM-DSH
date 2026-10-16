import { defineTool } from '@deepseek-ai/dsh-tools'
import { getLesson, lessonCatalog } from '../education/lessons.js'
export function createTeachTool(ctx, config) {
  return defineTool({
    name: 'th_msm_teach', description: '分层讲解 MSM/C1/WE：直观解释、公式、例子、练习、误区与下一步。新手默认从直观例子开始。',
    parameters: { concept: { type: 'string', required: true }, level: { type: 'string', enum: ['undergraduate', 'graduate', 'expert'] } },
    output: { schema: { type: 'object', additionalProperties: true, properties: { ok: { type: 'boolean', required: true }, concept: { type: 'string', required: true }, level: { type: 'string', required: true } } }, render: (_args, v) => [{ type: 'text', text: v.ok ? `# ${v.title}\n\n${v.explanation.intuition}\n\n${v.explanation.mathematics}\n\n${v.explanation.application}\n\n注意：${v.caveat}\n\n小练习：${v.exercise.question}\n\n你还可以问：${v.followUpQuestions.join('；')}` : `暂未收录这个概念。可选：${v.available.map(x => x.title).join('、')}` }] },
    timeoutMs: config.defaultTimeoutMs, isConcurrencySafe: () => true,
    async execute(args) {
      const level = args.level ?? 'undergraduate', lesson = getLesson(args.concept, level)
      return lesson ? { ok: true, concept: args.concept, ...lesson, followUpQuestions: ['举个能手算的两状态例子', '带我跑第一个模型', '这个方法最容易误用在哪里？'] } : { ok: false, concept: args.concept, level, available: lessonCatalog() }
    },
  })
}
