/**
 * th_msm — Generic MSM execution proxy.
 *
 * This is the security boundary. Only registry-owned command strings
 * reach ctx.shell. Model-supplied args are serialized to JSON stdin
 * and are never concatenated into the shell command.
 *
 * Preserved from v0.1.0 architecture. Fully backward-compatible.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { loadRegistry, findEntry, suggestEntries } from '../registry/loader.js'
import { executeMsm } from '../runtime/executor.js'

const resultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    code: { type: 'string', required: true },
    name: { type: 'string', required: true },
    exitCode: { type: 'integer', required: true },
    timedOut: { type: 'boolean', required: true },
    aborted: { type: 'boolean', required: true },
    output: { type: 'string', required: true },
    stderr: { type: 'string', required: true },
    truncated: { type: 'boolean', required: true },
  },
}

function domainResult(name, code, text) {
  return {
    ok: false,
    code,
    name,
    exitCode: -1,
    timedOut: false,
    aborted: false,
    output: '',
    stderr: text,
    truncated: false,
  }
}

function renderResult(value) {
  const parts = [`MSM ${value.name}: ${value.code}`]
  if (value.output) parts.push(value.output)
  if (value.stderr) parts.push(`stderr:\n${value.stderr}`)
  if (value.truncated) parts.push('[output truncated]')
  return [{ type: 'text', text: parts.join('\n') }]
}

function inspectText(entry) {
  const lines = [entry.name]
  if (entry.description) lines.push(entry.description)
  if (entry.usage) lines.push(`usage: ${entry.usage}`)
  if (entry.timeoutMs !== undefined) lines.push(`timeoutMs: ${entry.timeoutMs}`)
  return lines.join('\n')
}

export function createMsmTool(ctx, config, toolName) {
  return defineTool({
    name: toolName,
    description:
      'Invoke a workspace-registered MSM command by name. ' +
      'Arguments are delivered as JSON on stdin; they are never concatenated into the shell command. ' +
      'Use inspect=true to inspect metadata without executing.',
    parameters: {
      name: {
        type: 'string', required: true,
        description: 'Registered MSM name.',
      },
      args: {
        type: 'array', items: { type: 'string' },
        description: 'Opaque string arguments passed in the JSON stdin request.',
      },
      inspect: {
        type: 'boolean',
        description: 'Return registration metadata without execution.',
      },
    },
    output: {
      schema: resultSchema,
      render: (_args, value) => renderResult(value),
    },
    timeoutMs: config.maxTimeoutMs,
    isConcurrencySafe: () => false,

    async execute(args, exec) {
      const msmName = String(args.name ?? '')
      const msmArgs = args.args ?? []

      if (msmArgs.length > config.maxArgs) {
        return domainResult(
          msmName, 'TOO_MANY_ARGS',
          `received ${msmArgs.length} args; limit is ${config.maxArgs}`
        )
      }

      const workspace = exec.agent?.session?.header?.cwd
      if (!workspace) {
        return domainResult(msmName, 'WORKSPACE_REQUIRED', 'No agent workspace is available.')
      }

      let registry
      try {
        registry = await loadRegistry(workspace, config.registryFile, {
          maxEntries: config.maxRegistryEntries,
        })
      } catch (error) {
        return domainResult(
          msmName, 'REGISTRY_ERROR',
          error instanceof Error ? error.message : String(error)
        )
      }

      const entry = findEntry(registry, msmName)
      if (!entry) {
        const suggestions = suggestEntries(registry, msmName)
        const suffix = suggestions.length
          ? ` Candidates: ${suggestions.join(', ')}`
          : ''
        return domainResult(msmName, 'UNKNOWN_MSM', `Unknown MSM: ${msmName}.${suffix}`)
      }

      if (args.inspect === true) {
        return {
          ok: true, code: 'INSPECT', name: entry.name,
          exitCode: 0, timedOut: false, aborted: false,
          output: inspectText(entry), stderr: '', truncated: false,
        }
      }

      return executeMsm(ctx, entry, msmArgs, exec, config)
    },
  })
}