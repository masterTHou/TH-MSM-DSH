/**
 * Runtime Executor — Execute registered MSM commands via ctx.shell.
 *
 * PRESERVED from v0.1.0 architecture. Security-critical:
 *  - args are JSON-serialized to stdin, never concatenated into command
 *  - Sandbox policy enforced
 *  - danger-full-access blocked by default
 *  - Timeout capped to maxTimeoutMs
 */

import { truncateText } from '../util/text.js'

function classify(result) {
  if (result.timedOut) return { ok: false, code: 'TIMEOUT' }
  if (result.aborted) return { ok: false, code: 'ABORTED' }
  if (result.sandbox?.runnerFailed) return { ok: false, code: 'SANDBOX_UNAVAILABLE' }
  if (result.sandbox?.denied) return { ok: false, code: 'SANDBOX_DENIED' }
  if (result.exitCode !== 0) return { ok: false, code: 'NONZERO_EXIT' }
  return { ok: true, code: 'OK' }
}

export function resolveTimeout(entryTimeoutMs, config) {
  const requested = entryTimeoutMs ?? config.defaultTimeoutMs
  if (!Number.isInteger(requested) || requested <= 0) {
    throw new TypeError('timeout must be a positive integer')
  }
  return Math.min(requested, config.maxTimeoutMs)
}

export async function executeMsm(ctx, entry, args, exec, config) {
  const session = exec.agent?.session
  const workspace = session?.header?.cwd
  if (!workspace) {
    return {
      ok: false,
      code: 'WORKSPACE_REQUIRED',
      name: entry.name,
      exitCode: -1,
      timedOut: false,
      aborted: false,
      output: '',
      stderr: 'TH-MSM requires an agent session with session.header.cwd.',
      truncated: false,
    }
  }

  const sandboxPolicyService = ctx.get?.('sandboxPolicy')
  if (ctx.shell.sandboxMode !== undefined && sandboxPolicyService === undefined) {
    throw new Error('sandboxed ctx.shell requires ctx.sandboxPolicy; refusing unscoped execution')
  }
  const sandboxPolicy = sandboxPolicyService?.resolve({ session })
  if (!config.allowDangerFullAccess && sandboxPolicy?.mode === 'danger-full-access') {
    return {
      ok: false,
      code: 'DANGER_FULL_ACCESS_BLOCKED',
      name: entry.name,
      exitCode: -1,
      timedOut: false,
      aborted: false,
      output: '',
      stderr: 'TH-MSM refuses danger-full-access by default.',
      truncated: false,
    }
  }

  const timeoutMs = resolveTimeout(entry.timeoutMs, config)
  const stdin = JSON.stringify({
    protocol: 'json-stdin-v1',
    msm: entry.name,
    args,
  }) + '\n'

  const spec = ctx.shell.resolve({
    command: entry.command,
    workdir: sandboxPolicy?.workspaceRoot ?? workspace,
    timeoutMs,
    stdoutMaxBytes: Math.max(config.maxOutputChars * 4, 4096),
    signal: exec.signal,
    stdin,
    sandboxPolicy,
  })

  const result = await ctx.shell.run(spec)
  const status = classify(result)
  const out = truncateText(result.stdout?.text ?? '', config.maxOutputChars)
  const err = truncateText(result.stderr?.text ?? '', config.maxOutputChars)

  return {
    ok: status.ok,
    code: status.code,
    name: entry.name,
    exitCode: result.exitCode ?? -1,
    timedOut: Boolean(result.timedOut),
    aborted: Boolean(result.aborted),
    output: out.text,
    stderr: err.text,
    truncated: out.truncated || err.truncated || Boolean(result.stdout?.truncated) || Boolean(result.stderr?.truncated),
  }
}