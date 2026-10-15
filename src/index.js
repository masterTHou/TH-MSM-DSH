/**
 * TH-MSM DSH Plugin v1.3
 *
 * Thermodynamic and Kinetic Markov State Model Intelligence Agent.
 *
 * v1.3: FC analytical FSSH+EDC, WE and C1 event analysis.
 *
 * Registers:
 *  - 8 tools: th_msm (proxy), th_msm_env, th_msm_knowledge, th_msm_teach,
 *             th_msm_plan, th_msm_build, th_msm_validate, th_msm_report
 *  - Agent hooks: per-turn accounting + policy guards
 *  - Agent loop: MSM-aware intent routing and knowledge enrichment
 *
 * Security boundary:
 *  - Only registry-owned `command` strings reach ctx.shell.
 *  - Model-supplied `args` are serialized to JSON stdin; never concatenated.
 *  - Sandbox enforced by default; danger-full-access refused.
 */

import z from '@deepseek-ai/schemastery'

import { createMsmTool } from './tools/msm.js'
import { createEnvTool } from './tools/env.js'
import { createKnowledgeTool } from './tools/knowledge.js'
import { createTeachTool } from './tools/teach.js'
import { createPlanTool } from './tools/plan.js'
import { createBuildTool } from './tools/build.js'
import { createValidateTool } from './tools/validate.js'
import { createReportTool } from './tools/report.js'
import { createSampleTool } from './tools/sample.js'

import { installAgentHooks } from './agent/hooks.js'
import { installAgentLoop } from './agent/loop.js'

import { buildIndex, checkIndex } from './knowledge/vector/indexer.js'

export const name = 'th-msm'
export const inject = ['tools', 'shell']

// ── Configuration schema ──────────────────────────────────────────

export const Config = z.object({
  // Registry
  registryFile: z.string().default('.th-msm/registry.json'),
  toolName: z.string().default('th_msm'),
  exposeMsmAlias: z.boolean().default(false),

  // Sandbox
  requireSandbox: z.boolean().default(true),
  allowDangerFullAccess: z.boolean().default(false),

  // Limits
  defaultTimeoutMs: z.number().min(1).step(1).default(30000),
  maxTimeoutMs: z.number().min(1).step(1).default(120000),
  maxArgs: z.number().min(1).step(1).default(64),
  maxRegistryEntries: z.number().min(1).step(1).default(256),
  maxOutputChars: z.number().min(256).step(1).default(16000),
  maxCallsPerTurn: z.number().min(1).step(1).default(32),

  // Knowledge Base
  knowledgeBasePath: z.string().default('knowledge'),
  knowledgeCatalogs: z.array(z.string()).default([
    'reviews/CATALOG.md',
    'papers/CATALOG.md',
    'benchmarks/CATALOG.md',
  ]),
  learningRoadmapFile: z.string().default('knowledge/LEARNING_ROADMAP.md'),
  maxKnowledgeResults: z.number().min(1).step(1).default(10),

  // Agent Loop
  agentLoopEnabled: z.boolean().default(true),
  intentConfidenceThreshold: z.number().min(0).max(1).step(0.01).default(0.6),
  requirePlanConfirmation: z.boolean().default(true),

  // Python Runtime
  pythonEnabled: z.boolean().default(true),
  pythonPath: z.string().default('python'),
  msmPackages: z.array(z.string()).default(['pyemma', 'deeptime', 'msmbuilder']),
  pythonTimeoutMs: z.number().min(1000).step(1).default(300000),
})

// ── Normalization ─────────────────────────────────────────────────

const TOOL_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/

function normalizeConfig(raw) {
  const defaults = {
    registryFile: '.th-msm/registry.json',
    toolName: 'th_msm',
    exposeMsmAlias: false,
    requireSandbox: true,
    allowDangerFullAccess: false,
    defaultTimeoutMs: 30000,
    maxTimeoutMs: 120000,
    maxArgs: 64,
    maxRegistryEntries: 256,
    maxOutputChars: 16000,
    maxCallsPerTurn: 32,
    knowledgeBasePath: 'knowledge',
    knowledgeCatalogs: ['reviews/CATALOG.md', 'papers/CATALOG.md', 'benchmarks/CATALOG.md'],
    learningRoadmapFile: 'knowledge/LEARNING_ROADMAP.md',
    maxKnowledgeResults: 10,
    agentLoopEnabled: true,
    intentConfidenceThreshold: 0.6,
    requirePlanConfirmation: true,
    pythonEnabled: true,
    pythonPath: 'python',
    msmPackages: ['pyemma', 'deeptime', 'msmbuilder'],
    pythonTimeoutMs: 300000,
  }

  const resolved = { ...defaults, ...raw }

  if (!TOOL_NAME_RE.test(resolved.toolName)) {
    throw new TypeError('toolName must match [A-Za-z0-9_-]{1,64}')
  }
  if (resolved.defaultTimeoutMs > resolved.maxTimeoutMs) {
    throw new RangeError('defaultTimeoutMs must be <= maxTimeoutMs')
  }
  return resolved
}

// ── Apply (Cordis entry point) ────────────────────────────────────

export function apply(ctx, rawConfig = {}) {
  const config = normalizeConfig(rawConfig)
  const toolNames = new Set()

  // ── Sandbox precondition ──────────────────────────────────────
  if (config.requireSandbox && ctx.shell.sandboxMode === undefined) {
    throw new Error(
      'TH-MSM requires a sandboxing ctx.shell by default; ' +
      'set requireSandbox=false only when shell-equivalent execution is intentional'
    )
  }
  if (ctx.shell.sandboxMode !== undefined && ctx.get?.('sandboxPolicy') === undefined) {
    throw new Error(
      'TH-MSM found a sandboxing ctx.shell but no ctx.sandboxPolicy service'
    )
  }

  // ── Register all 8 tools ─────────────────────────────────────

  // 1. Generic MSM execution proxy (the security boundary)
  ctx.tools.register(createMsmTool(ctx, config, config.toolName))
  toolNames.add(config.toolName)

  if (config.exposeMsmAlias && config.toolName !== 'msm') {
    if (ctx.tools.get('msm') !== undefined) {
      throw new Error('cannot expose msm alias: tool name "msm" is already registered')
    }
    ctx.tools.register(createMsmTool(ctx, config, 'msm'))
    toolNames.add('msm')
  }

  // 2-8. Domain tools
  ctx.tools.register(createEnvTool(ctx, config))
  toolNames.add('th_msm_env')
  ctx.tools.register(createSampleTool(ctx, config))
  toolNames.add('th_msm_sample')

  ctx.tools.register(createKnowledgeTool(ctx, config))
  toolNames.add('th_msm_knowledge')

  ctx.tools.register(createTeachTool(ctx, config))
  toolNames.add('th_msm_teach')

  ctx.tools.register(createPlanTool(ctx, config))
  toolNames.add('th_msm_plan')

  ctx.tools.register(createBuildTool(ctx, config))
  toolNames.add('th_msm_build')

  ctx.tools.register(createValidateTool(ctx, config))
  toolNames.add('th_msm_validate')

  ctx.tools.register(createReportTool(ctx, config))
  toolNames.add('th_msm_report')

  // ── Install agent hooks (per-turn accounting) ────────────────
  installAgentHooks(ctx, toolNames, config)

  // ── Install agent loop (MSM reasoning) ───────────────────────
  if (config.agentLoopEnabled) {
    installAgentLoop(ctx, config)
  }
}
