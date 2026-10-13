/**
 * th_msm_plan — Design an MSM protocol from trajectory metadata.
 *
 * This is the "planning mode" entry point. Based on system type,
 * research goal, and trajectory characteristics, it produces a
 * structured MSM protocol with rationale for each methodological choice.
 *
 * Scientific principle: every choice (feature, reduction, lag time,
 * clustering) must be justified. This tool enforces that.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'

const SYSTEM_TYPES = ['protein', 'peptide', 'small-molecule', 'material', 'solution', 'other']
const RESEARCH_GOALS = ['kinetics', 'conformational-change', 'binding', 'reaction', 'electronic-properties']

const resultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    systemType: { type: 'string', required: true },
    researchGoal: { type: 'string', required: true },
    protocol: {
      type: 'object', required: true,
      additionalProperties: false,
      properties: {
        featurization: {
          type: 'object', required: true,
          additionalProperties: false,
          properties: {
            method: { type: 'string', required: true },
            rationale: { type: 'string', required: true },
            parameters: { type: 'object', additionalProperties: true },
          },
        },
        dimensionalityReduction: {
          type: 'object', required: true,
          additionalProperties: false,
          properties: {
            method: { type: 'string', required: true },
            rationale: { type: 'string', required: true },
            parameters: { type: 'object', additionalProperties: true },
          },
        },
        clustering: {
          type: 'object', required: true,
          additionalProperties: false,
          properties: {
            method: { type: 'string', required: true },
            rationale: { type: 'string', required: true },
            nStates: { type: 'integer' },
          },
        },
        lagTime: {
          type: 'object', required: true,
          additionalProperties: false,
          properties: {
            value: { type: 'string', required: true },
            rationale: { type: 'string', required: true },
          },
        },
        validation: {
          type: 'array', required: true,
          items: { type: 'string' },
        },
      },
    },
    estimatedComplexity: { type: 'string', required: true },
    warnings: { type: 'array', items: { type: 'string' }, required: true },
  },
}

export function createPlanTool(ctx, config) {
  return defineTool({
    name: 'th_msm_plan',
    description:
      'Design a Markov State Model protocol based on system type, research goal, ' +
      'and trajectory characteristics. Every methodological choice is justified. ' +
      'Supports system types: protein, peptide, small-molecule, material, solution, other. ' +
      'Supports research goals: kinetics, conformational-change, binding, reaction, electronic-properties.',
    parameters: {
      systemType: {
        type: 'string', required: true,
        enum: SYSTEM_TYPES,
        description: 'Type of molecular system.',
      },
      researchGoal: {
        type: 'string', required: true,
        enum: RESEARCH_GOALS,
        description: 'Primary research objective.',
      },
      nAtoms: {
        type: 'integer',
        description: 'Number of atoms in the system (for complexity estimation).',
      },
      trajectoryLength: {
        type: 'string',
        description: 'Total trajectory length (e.g., "10 μs", "1 ms").',
      },
      nTrajectories: {
        type: 'integer',
        description: 'Number of independent trajectories.',
      },
      temperature: {
        type: 'number',
        description: 'Simulation temperature in Kelvin.',
      },
    },
    output: {
      schema: resultSchema,
      render: (_args, value) => {
        if (!value.ok) return [{ type: 'text', text: 'Planning failed.' }]
        const p = value.protocol
        const lines = [
          `# MSM Protocol: ${value.systemType} → ${value.researchGoal}`,
          '',
          '## Featurization',
          `- **Method**: ${p.featurization.method}`,
          `- **Why**: ${p.featurization.rationale}`,
          '',
          '## Dimensionality Reduction',
          `- **Method**: ${p.dimensionalityReduction.method}`,
          `- **Why**: ${p.dimensionalityReduction.rationale}`,
          '',
          '## Clustering',
          `- **Method**: ${p.clustering.method}`,
          `- **Target states**: ${p.clustering.nStates ?? 'auto'}`,
          `- **Why**: ${p.clustering.rationale}`,
          '',
          '## Lag Time',
          `- **τ**: ${p.lagTime.value}`,
          `- **Why**: ${p.lagTime.rationale}`,
          '',
          '## Validation Steps',
          ...p.validation.map(s => `- ${s}`),
          '',
          `**Estimated complexity**: ${value.estimatedComplexity}`,
        ]
        if (value.warnings.length) {
          lines.push('', '## ⚠️ Warnings')
          for (const w of value.warnings) lines.push(`- ${w}`)
        }
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    timeoutMs: config.defaultTimeoutMs,
    isConcurrencySafe: () => true,

    async execute(args, exec) {
      const { systemType, researchGoal, nAtoms, trajectoryLength, nTrajectories, temperature } = args

      if (!systemType || !researchGoal) {
        return {
          ok: false, systemType: systemType ?? 'unknown', researchGoal: researchGoal ?? 'unknown',
          protocol: null, estimatedComplexity: 'unknown', warnings: ['systemType and researchGoal are required.'],
        }
      }

      // ── Protocol logic ────────────────────────────────────────

      const protocol = recommendProtocol(systemType, researchGoal, {
        nAtoms: nAtoms ?? 100,
        trajectoryLength: trajectoryLength ?? 'unknown',
        nTrajectories: nTrajectories ?? 1,
        temperature: temperature ?? 300,
      })

      return {
        ok: true,
        systemType,
        researchGoal,
        protocol,
        estimatedComplexity: estimateComplexity(nAtoms ?? 100, nTrajectories ?? 1),
        warnings: generateWarnings(systemType, researchGoal, { nAtoms, trajectoryLength, nTrajectories }),
      }
    },
  })
}

// ── Protocol recommendation engine ──────────────────────────────

function recommendProtocol(systemType, researchGoal, meta) {
  const { nAtoms } = meta

  // Featurization
  let featurization
  if (systemType === 'protein') {
    featurization = {
      method: 'Backbone dihedral angles (φ, ψ) + Cα distances',
      rationale:
        'Protein dynamics are dominated by backbone torsions. Cα distances capture tertiary contacts. ' +
        'These features are rotationally and translationally invariant.',
      parameters: { dihedralAngles: ['phi', 'psi'], caDistances: { threshold: 0.8 }, periodic: true },
    }
  } else if (systemType === 'peptide' || systemType === 'small-molecule') {
    featurization = {
      method: 'Heavy-atom distances + dihedral angles',
      rationale:
        'Small systems benefit from all-atom features. Distance-based features avoid the degeneracy of dihedral-only representations.',
      parameters: { heavyAtomPairs: 'all', dihedralAngles: ['phi', 'psi', 'chi1'] },
    }
  } else if (systemType === 'material') {
    featurization = {
      method: 'Coordination numbers + Steinhardt order parameters',
      rationale:
        'Material dynamics are governed by local structural order. Coordination numbers and bond-orientational order parameters capture crystalline/amorphous transitions.',
      parameters: { coordinationCutoff: 3.5, steinhardtL: [4, 6] },
    }
  } else {
    featurization = {
      method: 'Pairwise distances (all heavy atoms)',
      rationale: 'General-purpose features for unknown systems. Consider custom features for specific dynamics.',
      parameters: { heavyAtomPairs: 'all' },
    }
  }

  // Dimensionality reduction
  let dimReduction
  if (nAtoms > 500) {
    dimReduction = {
      method: 'tICA (time-lagged Independent Component Analysis)',
      rationale:
        'tICA finds the slowest collective variables by maximizing the autocorrelation at the lag time. ' +
        'For systems with >500 atoms, PCA mixes fast and slow motions, obscuring the dominant processes.',
      parameters: { lagTime: 'auto (from ITS analysis)', nComponents: 'auto (keep 95% kinetic variance)' },
    }
  } else {
    dimReduction = {
      method: 'tICA (or PCA for very small systems)',
      rationale:
        'tICA is preferred for kinetics. For <500 atoms with limited sampling, PCA may be sufficient if tICA overfits.',
      parameters: { lagTime: 'auto', nComponents: 'auto (keep 95% kinetic variance)' },
    }
  }

  // Clustering
  const nStates = Math.min(Math.max(Math.floor(nAtoms / 10), 50), 1000)
  let clustering
  if (nAtoms < 200) {
    clustering = {
      method: `K-Means (${nStates} clusters)`,
      rationale:
        'K-Means provides uniform state decomposition for well-sampled small systems. ' +
        'Number of clusters scales with system size to balance resolution and statistics.',
      nStates,
    }
  } else {
    clustering = {
      method: `K-Means (${nStates} clusters) with mini-batch for efficiency`,
      rationale:
        'K-Means with mini-batch scales well to large datasets. Consider GMM or HDBSCAN if density variations are expected.',
      nStates,
    }
  }

  // Lag time
  const lagTime = {
    value: 'Determined by ITS convergence analysis (typically 1-100 ns for proteins)',
    rationale:
      'Lag time must be long enough for Markovian behavior (ITS plateaus) but short enough to retain temporal resolution. ' +
      'Run implied timescale analysis at multiple lag times and select the smallest τ where ITS curves converge.',
  }

  // Validation
  const validation = [
    'Implied Timescale Analysis (ITS) — verify τ-convergence',
    'Chapman-Kolmogorov Test — verify Markovianity at the chosen lag time',
    'Population Analysis — compare MSM stationary distribution to MD sampling',
    'Model Stability — bootstrap the MSM and check robustness',
    'Cross-Validation — use generalized matrix Rayleigh quotient (VAMP-2 score)',
  ]

  return { featurization, dimensionalityReduction: dimReduction, clustering, lagTime, validation }
}

function estimateComplexity(nAtoms, nTrajectories) {
  if (nAtoms < 100) return 'Low — feasible on a laptop'
  if (nAtoms < 1000) return 'Medium — requires workstation or small cluster'
  return 'High — requires HPC resources'
}

function generateWarnings(systemType, researchGoal, meta) {
  const warnings = []

  if (meta.nTrajectories === 1) {
    warnings.push(
      'Single trajectory detected. MSM from a single long trajectory may miss rare events. ' +
      'Consider multiple independent trajectories or enhanced sampling.'
    )
  }

  if (meta.trajectoryLength === 'unknown') {
    warnings.push(
      'Trajectory length unknown. If the trajectory is shorter than the slowest process, ' +
      'the MSM will not capture the full kinetics.'
    )
  }

  if (researchGoal === 'binding' && systemType === 'protein') {
    warnings.push(
      'Binding processes often require enhanced sampling (MetaD, REHT) or very long trajectories. ' +
      'Standard MSM may not capture rare binding/unbinding events.'
    )
  }

  if (researchGoal === 'electronic-properties') {
    warnings.push(
      'MSM is designed for conformational dynamics, not electronic transitions. ' +
      'Consider QM/MM or surface-hopping methods instead. TH-MSM → AutoREST integration may help.'
    )
  }

  return warnings
}