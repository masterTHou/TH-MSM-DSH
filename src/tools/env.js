import { defineTool } from '@deepseek-ai/dsh-tools'
import { inspectEnvironment } from '../workflow/doctor.js'
export function createEnvTool(ctx, config) {
  return defineTool({
    name: 'th_msm_env', description: '实际检查宿主数值核心、PATH 原生 Node、可选项目写入/输入/输出，以及可选 Python 依赖导入。区分内置可用、脚本可运行与未实现外部流程；不自动安装依赖。',
    parameters: { trajectoryPath: { type: 'string' }, outputDir: { type: 'string' }, checkPython: { type: 'boolean', description: 'Optional fixed Python package import probes; not a Python workflow execution backend.' } },
    output: { schema: { type: 'object', additionalProperties: true, properties: { ok: { type: 'boolean', required: true }, node: { type: 'string' }, system: { type: 'object', additionalProperties: true }, analyticalEngine: { type: 'boolean' }, pythonStatus: { type: 'string' }, esProviderStatus: { type: 'string' } } }, render: (_args, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }] },
    timeoutMs: config.pythonTimeoutMs ?? config.defaultTimeoutMs, isConcurrencySafe: () => false,
    async execute(args, exec) { return inspectEnvironment({ workspace: exec?.agent?.session?.header?.cwd, ...args, signal: exec?.signal }) },
  })
}
