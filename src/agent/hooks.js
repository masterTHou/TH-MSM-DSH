/**
 * TH-MSM Agent Hooks — per-turn accounting and policy guards.
 *
 * PRESERVED from v0.1.0 architecture. These hooks maintain a
 * process-local per-turn accounting view that policy guards consult.
 * TH-MSM does not replace DSH's core Agent Loop.
 */

export function installAgentHooks(ctx, toolNames, { maxCallsPerTurn }) {
  const state = new WeakMap()

  ctx.on('agent/pre-step', async ({ agent, turn }, next) => {
    const current = state.get(agent)
    if (current?.turn !== turn) state.set(agent, { turn, calls: 0 })
    return next()
  })

  ctx.on('tools/result', (exec) => {
    if (!exec.agent || !toolNames.has(exec.name)) return
    const current = state.get(exec.agent)
    if (current) current.calls += 1
  })

  // Fail closed for repeated TH-MSM calls in one turn.
  ctx.tools.guard((exec) => {
    if (!exec.agent || !toolNames.has(exec.name)) return undefined
    const current = state.get(exec.agent)
    if (current && current.calls >= maxCallsPerTurn) {
      return `TH-MSM per-turn call limit reached (${maxCallsPerTurn}).`
    }
    return undefined
  })

  ctx.on('agent/turn-stopping', ({ agent }) => {
    state.delete(agent)
  })
}