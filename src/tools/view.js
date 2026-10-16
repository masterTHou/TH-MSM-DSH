import { defineTool } from '@deepseek-ai/dsh-tools'
import { readWorkspaceJSON, writeWorkspaceText } from '../io/workspace.js'
import { createDashboard } from '../web/export.js'
export function createViewTool(ctx, config) {
  return defineTool({
    name: 'th_msm_view', description: '生成可双击打开的离线 MSM 交互网页：教学示例、状态图、矩阵、布居、MFPT、ITS/CK。可选导入已有经典 model.json。',
    parameters: { modelPath: { type: 'string' }, outputPath: { type: 'string', description: 'Default output/msm-dashboard.html' } },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, v) => [{ type: 'text', text: JSON.stringify(v) }] },
    timeoutMs: config.pythonTimeoutMs, isConcurrencySafe: () => false,
    async execute(args, exec) {
      try {
        const root = exec.agent?.session?.header?.cwd
        if (!root) throw new Error('WORKSPACE_REQUIRED')
        const model = args.modelPath ? await readWorkspaceJSON(root, args.modelPath) : null
        const dashboardPath = await writeWorkspaceText(root, args.outputPath ?? 'output/msm-dashboard.html', createDashboard(model))
        return { ok: true, dashboardPath, instructions: '用浏览器打开此 HTML；点击教学示例或选择自己的 model.json。数据仅在本地浏览器处理。' }
      } catch (error) { return { ok: false, error: error.message } }
    },
  })
}
