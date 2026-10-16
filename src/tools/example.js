import { defineTool } from '@deepseek-ai/dsh-tools'
import { runClassicalExample } from '../msm/demo.js'
export function createExampleTool(ctx, config) {
  return defineTool({
    name: 'th_msm_example', description: '无需自备数据：生成可复现两状态经典轨迹，建立 MSM，保存数据/模型/入门报告并解释验证结论。',
    parameters: { outputDir: { type: 'string' }, seed: { type: 'string' } },
    output: { schema: { type: 'object', additionalProperties: true, properties: { ok: { type: 'boolean', required: true }, summary: { type: 'string', required: true } } }, render: (_args, v) => [{ type: 'text', text: `${v.summary}\n\n${JSON.stringify(v.details, null, 2)}\n\n${v.suggested_replies?.join('\n') ?? ''}` }] },
    timeoutMs: config.defaultTimeoutMs, isConcurrencySafe: () => false,
    async execute(args, exec) {
      try {
        const workspace = exec.agent?.session?.header?.cwd
        if (!workspace) throw new Error('WORKSPACE_REQUIRED')
        return await runClassicalExample(workspace, args)
      } catch (e) { return { ok: false, summary: e.message, details: {} } }
    },
  })
}
