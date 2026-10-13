/**
 * th_msm_validate — Run MSM validation tests.
 *
 * Scientific principle: MSM results are not trustworthy just because
 * the program ran successfully. Every MSM must pass:
 *
 *   1. Implied Timescale Analysis (ITS) — verify τ-convergence
 *   2. Chapman-Kolmogorov Test — verify Markovianity
 *   3. Population Analysis — compare to MD sampling
 *   4. Model Stability Analysis — bootstrap robustness
 *
 * This tool runs all four tests and returns a pass/fail/uncertain verdict.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'

const VALIDATION_TESTS = [
  'implied_timescale',
  'chapman_kolmogorov',
  'population',
  'stability',
]

const resultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    modelPath: { type: 'string', required: true },
    verdict: { type: 'string', required: true },
    overallScore: { type: 'number', required: true },
    tests: {
      type: 'array', required: true,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', required: true },
          status: { type: 'string', required: true },
          score: { type: 'number' },
          details: { type: 'string', required: true },
          recommendation: { type: 'string' },
        },
      },
    },
    uncertainties: { type: 'array', items: { type: 'string' }, required: true },
  },
}

export function createValidateTool(ctx, config) {
  return defineTool({
    name: 'th_msm_validate',
    description:
      'Validate a built Markov State Model using the four standard tests: ' +
      'Implied Timescale Analysis (ITS), Chapman-Kolmogorov Test, ' +
      'Population Analysis, and Model Stability Analysis. ' +
      'Returns a pass/fail/uncertain verdict with detailed diagnostic.',
    parameters: {
      modelPath: {
        type: 'string', required: true,
        description: 'Path to the trained MSM model file.',
      },
      tests: {
        type: 'array',
        items: { type: 'string', enum: VALIDATION_TESTS },
        description: 'Specific tests to run. Default: all four.',
      },
      nBootstraps: {
        type: 'integer',
        description: 'Number of bootstrap samples for stability analysis (default: 50).',
      },
      confidenceLevel: {
        type: 'number',
        description: 'Confidence level for error estimates (default: 0.95).',
      },
    },
    output: {
      schema: resultSchema,
      render: (_args, value) => {
        if (!value.ok) return [{ type: 'text', text: `Validation failed: ${value.verdict}` }]

        const statusIcon = (s) => {
          if (s === 'pass') return '✅'
          if (s === 'fail') return '❌'
          return '⚠️'
        }

        const lines = [
          `# MSM Validation: ${value.verdict}`,
          `**Overall score**: ${(value.overallScore * 100).toFixed(0)}%`,
          '',
        ]

        for (const t of value.tests) {
          lines.push(`## ${statusIcon(t.status)} ${t.name}`)
          lines.push(t.details)
          if (t.recommendation) lines.push(`> ${t.recommendation}`)
          lines.push('')
        }

        if (value.uncertainties.length) {
          lines.push('## ⚠️ Identified Uncertainties')
          for (const u of value.uncertainties) lines.push(`- ${u}`)
        }

        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    timeoutMs: config.pythonTimeoutMs,
    isConcurrencySafe: () => false,

    async execute(args, exec) {
      const modelPath = String(args.modelPath ?? '')
      const testsToRun = args.tests ?? VALIDATION_TESTS
      const nBootstraps = args.nBootstraps ?? 50
      const confidenceLevel = args.confidenceLevel ?? 0.95

      if (!modelPath) {
        return {
          ok: false, modelPath: '', verdict: 'NO_MODEL_PATH',
          overallScore: 0, tests: [], uncertainties: ['modelPath is required.'],
        }
      }

      // In production: load the MSM from disk, run validation tests via Python.
      // For design: return structured validation template.

      const tests = testsToRun.map((name) => ({
        name,
        status: 'pending',
        score: null,
        details: `[Run "${name}" test on ${modelPath} via Python MSM runtime]`,
        recommendation: null,
      }))

      return {
        ok: true,
        modelPath,
        verdict: 'VALIDATION_PENDING',
        overallScore: 0,
        tests,
        uncertainties: [
          `Validation requires Python MSM runtime with PyEMMA or deeptime installed.`,
          `CK test may be unreliable with fewer than ${nBootstraps} bootstrap samples.`,
          `ITS analysis requires testing multiple lag times to confirm convergence.`,
        ],
      }
    },
  })
}