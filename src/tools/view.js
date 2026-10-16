import { defineTool } from '@deepseek-ai/dsh-tools'
import { readWorkspaceJSON, writeWorkspaceText } from '../io/workspace.js'
import { createDashboard } from '../web/export.js'
export function createViewTool(ctx, config) {
  return defineTool({
    name: 'th_msm_view', description: '生成离线交互网页：正丁烷分子七步课程、状态图、矩阵、布居、MFPT、ITS/CK。modelPath 导入经典模型，lessonPath 导入自己生成的完整分子运行记录。',
    parameters: { modelPath: { type: 'string' }, lessonPath: { type: 'string', description: 'Optional generated butane lesson.json with embedded PNGs and recorded MD preview.' }, outputPath: { type: 'string', description: 'Default output/msm-dashboard.html' } },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, v) => [{ type: 'text', text: JSON.stringify(v) }] },
    timeoutMs: config.pythonTimeoutMs, isConcurrencySafe: () => false,
    async execute(args, exec) {
      try {
        const root = exec.agent?.session?.header?.cwd
        if (!root) throw new Error('WORKSPACE_REQUIRED')
        const lesson = args.lessonPath ? await readWorkspaceJSON(root, args.lessonPath) : null
        const model = args.modelPath ? await readWorkspaceJSON(root, args.modelPath) : lesson?.model ?? null
        const dashboardPath = await writeWorkspaceText(root, args.outputPath ?? 'output/msm-dashboard.html', createDashboard(model, { lesson }))
        return { ok: true, dashboardPath, instructions: '用浏览器打开此 HTML；点击教学示例或选择自己的 model.json。数据仅在本地浏览器处理。' }
      } catch (error) { return { ok: false, error: error.message } }
    },
  })
}
