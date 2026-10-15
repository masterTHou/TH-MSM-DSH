import { defineTool } from '@deepseek-ai/dsh-tools'
import { platform, arch, freemem } from 'node:os'
export function createEnvTool(ctx, config) {
  return defineTool({
    name: 'th_msm_env', description: 'Report measured Node/OS environment for the analytical engine. Python/quantum chemistry provider availability is not checked.',
    parameters: {},
    output: { schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, node: { type: 'string' }, system: { type: 'object', additionalProperties: true }, analyticalEngine: { type: 'boolean' }, pythonStatus: { type: 'string' }, esProviderStatus: { type: 'string' } } }, render: (_args, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }] },
    timeoutMs: config.defaultTimeoutMs, isConcurrencySafe: () => true,
    async execute() { return { ok: true, node: process.version, system: { platform: platform(), arch: arch(), free_memory_bytes: freemem() }, analyticalEngine: true, pythonStatus: 'not_checked', esProviderStatus: 'not_connected' } },
  })
}
