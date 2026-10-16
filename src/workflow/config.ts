import { randomUUID } from 'node:crypto'

export interface WorkflowParameters {
  lagTime: number
  nClusters: number
  holdoutFraction: number
  targetState?: number
  seed: string
}
export interface WorkflowConfig {
  schema_version: 1
  mode: 'example' | 'msm'
  trajectoryPath?: string
  outputDir: string
  parameters: WorkflowParameters
}
export interface WorkflowArgs extends Partial<WorkflowParameters> {
  mode?: 'example' | 'msm'
  trajectoryPath?: string
  outputDir?: string
  scriptDir?: string
}
function keys(value: unknown, allowed: string[], label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`unknown ${label} field: ${key}`)
}
export function validateWorkflow(config: unknown): WorkflowConfig {
  keys(config, ['schema_version', 'mode', 'trajectoryPath', 'outputDir', 'parameters'], 'workflow')
  if (config.schema_version !== 1 || (config.mode !== 'example' && config.mode !== 'msm')) throw new Error('workflow requires schema_version=1 and mode=example|msm')
  if (typeof config.outputDir !== 'string' || !config.outputDir.trim()) throw new Error('outputDir required')
  if (config.mode === 'msm' && (typeof config.trajectoryPath !== 'string' || !config.trajectoryPath.trim())) throw new Error('trajectoryPath required for mode=msm')
  if (config.mode === 'example' && config.trajectoryPath !== undefined) throw new Error('example mode must not specify trajectoryPath')
  const p = config.parameters
  keys(p, ['lagTime', 'nClusters', 'holdoutFraction', 'targetState', 'seed'], 'parameters')
  if (typeof p.lagTime !== 'number' || !Number.isSafeInteger(p.lagTime) || p.lagTime < 1) throw new Error('lagTime must be a positive frame count')
  if (typeof p.nClusters !== 'number' || !Number.isInteger(p.nClusters) || p.nClusters < 2 || p.nClusters > 128) throw new Error('nClusters must be 2–128')
  if (typeof p.holdoutFraction !== 'number' || !Number.isFinite(p.holdoutFraction) || p.holdoutFraction < 0 || p.holdoutFraction >= 0.5) throw new Error('holdoutFraction must lie in [0,0.5)')
  if (p.targetState !== undefined && (typeof p.targetState !== 'number' || !Number.isSafeInteger(p.targetState) || p.targetState < 0)) throw new Error('targetState must be a nonnegative state label')
  if (typeof p.seed !== 'string' || !p.seed || p.seed.length > 256) throw new Error('seed must be a nonblank string of at most 256 characters')
  return config as unknown as WorkflowConfig
}
export function workflowFromArgs(args: WorkflowArgs = {}): WorkflowConfig {
  keys(args, ['mode', 'trajectoryPath', 'outputDir', 'scriptDir', 'lagTime', 'nClusters', 'holdoutFraction', 'targetState', 'seed'], 'workflow arguments')
  const mode = args.mode ?? (args.trajectoryPath !== undefined ? 'msm' : 'example')
  const targetState = args.targetState ?? (mode === 'example' ? 1 : undefined)
  return validateWorkflow({ schema_version: 1, mode,
    ...(args.trajectoryPath !== undefined ? { trajectoryPath: args.trajectoryPath } : {}), outputDir: args.outputDir ?? `output/runs/${randomUUID()}`,
    parameters: { lagTime: args.lagTime ?? 1, nClusters: args.nClusters ?? 8, holdoutFraction: args.holdoutFraction ?? 0.25,
      ...(targetState !== undefined ? { targetState } : {}), seed: args.seed ?? 'msm-example' } })
}
