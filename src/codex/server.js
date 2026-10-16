import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { createEnvTool } from '../tools/env.js'
import { createGuideTool } from '../tools/guide.js'
import { createExampleTool } from '../tools/example.js'
import { createBuildTool } from '../tools/build.js'
import { createAnalyzeTool } from '../tools/analyze.js'
import { createValidateTool } from '../tools/validate.js'
import { createReportTool } from '../tools/report.js'
import { createSampleTool } from '../tools/sample.js'
import { createKnowledgeTool } from '../tools/knowledge.js'
import { createTeachTool } from '../tools/teach.js'
import { createPlanTool } from '../tools/plan.js'

const config = { defaultTimeoutMs: 30000, pythonTimeoutMs: 300000, maxKnowledgeResults: 10,
  knowledgeBasePath: 'knowledge', knowledgeCatalogs: ['reviews/CATALOG.md', 'papers/CATALOG.md', 'benchmarks/CATALOG.md'] }
const tools = [createEnvTool, createGuideTool, createExampleTool, createBuildTool, createAnalyzeTool,
  createValidateTool, createReportTool, createSampleTool, createKnowledgeTool, createTeachTool, createPlanTool].map(factory => factory({}, config))
const fileTools = new Set(['th_msm_example', 'th_msm_build', 'th_msm_analyze', 'th_msm_validate', 'th_msm_report', 'th_msm_sample'])
const readOnlyTools = new Set(['th_msm_env', 'th_msm_analyze', 'th_msm_validate', 'th_msm_knowledge', 'th_msm_teach', 'th_msm_plan'])
const queues = new Map()
const server = new Server({ name: 'th-msm', version: __TH_MSM_VERSION__ }, { capabilities: { tools: {} },
  instructions: 'TH-MSM: classical MSM, teaching and experimental FC/C1/WE. Use the user-selected absolute workspaceRoot for file tools. Never infer a project from the plugin installation directory. Ask 1–3 questions when inputs are missing. Use a distinct conversationId per conversation for guide memory; omit it for stateless guidance. Scientific limitations must remain visible.' })

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: tools.map(tool => ({
  name: tool.name, description: tool.description,
  inputSchema: { ...tool.parameters, properties: { ...tool.parameters.properties,
    workspaceRoot: { type: 'string', description: 'Absolute path of the user-selected project directory. Required for file operations.' },
    ...(tool.name === 'th_msm_guide' ? { conversationId: { type: 'string', description: 'Distinct per-conversation ID to remember answers. Omit for stateless guidance.' } } : {}) },
    required: [...(tool.parameters.required ?? []), ...(fileTools.has(tool.name) ? ['workspaceRoot'] : [])] },
  annotations: { readOnlyHint: readOnlyTools.has(tool.name), destructiveHint: fileTools.has(tool.name) && !readOnlyTools.has(tool.name), idempotentHint: readOnlyTools.has(tool.name), openWorldHint: false },
})) }))

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const tool = tools.find(item => item.name === request.params.name)
  if (!tool) throw new Error(`Unknown tool: ${request.params.name}`)
  const { workspaceRoot, conversationId, ...args } = request.params.arguments ?? {}
  const controller = new AbortController()
  const abort = () => controller.abort()
  extra.signal.addEventListener('abort', abort, { once: true })
  if (extra.signal.aborted) abort()
  const timer = setTimeout(abort, tool.timeoutMs ?? 30000)
  let unlock, queueKey
  try {
    if (fileTools.has(tool.name) && !workspaceRoot) throw new Error('WORKSPACE_REQUIRED: provide the user-selected absolute workspaceRoot')
    if (workspaceRoot !== undefined && (typeof workspaceRoot !== 'string' || !path.isAbsolute(workspaceRoot))) throw new Error('workspaceRoot must be an absolute directory path')
    if (conversationId !== undefined && (typeof conversationId !== 'string' || !conversationId.trim())) throw new Error('conversationId must be nonblank')
    const root = workspaceRoot ? await realpath(workspaceRoot) : undefined
    if (root && !(await stat(root)).isDirectory()) throw new Error('workspaceRoot must be a directory')
    if (root && process.env.TH_MSM_WORKSPACE && root !== await realpath(process.env.TH_MSM_WORKSPACE)) throw new Error('workspaceRoot differs from configured TH_MSM_WORKSPACE')
    if (root) {
      queueKey = process.platform === 'win32' ? root.toLowerCase() : root
      const previous = queues.get(queueKey) ?? Promise.resolve()
      const pending = new Promise(resolve => { unlock = resolve })
      queues.set(queueKey, pending)
      await previous
      // Only the tail removes the queue entry.
      const release = unlock
      unlock = () => { release(); if (queues.get(queueKey) === pending) queues.delete(queueKey) }
    }
    if (controller.signal.aborted) throw new Error('ABORTED')
    const session = { header: { cwd: root, ...(conversationId ? { id: conversationId } : {}) } }
    const value = await tool.execute(args, { agent: { session }, signal: controller.signal })
    if (controller.signal.aborted) throw new Error('ABORTED')
    return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value, isError: value.ok === false }
  } catch (error) {
    return { content: [{ type: 'text', text: error.message }], isError: true }
  } finally { clearTimeout(timer); extra.signal.removeEventListener('abort', abort); unlock?.() }
})

await server.connect(new StdioServerTransport())
