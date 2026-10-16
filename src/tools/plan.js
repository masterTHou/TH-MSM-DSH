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
const RESEARCH_GOALS = ['kinetics', 'conformational-change', 'binding', 'reaction', 'electronic-properties', 'photochemistry']

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
      dynamicsType: { type: 'string', enum: ['classical', 'nonadiabatic'], description: 'Reaction goals need the physics domain clarified; photochemistry uses nonadiabatic C1.' },
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
      const { systemType, researchGoal, nAtoms, trajectoryLength, nTrajectories, temperature, dynamicsType } = args

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
        dynamicsType,
      })

      return {
        ok: true,
        systemType,
        researchGoal,
        protocol,
        estimatedComplexity: estimateComplexity(nAtoms ?? 100, nTrajectories ?? 1),
        warnings: generateWarnings(systemType, researchGoal, { nAtoms, trajectoryLength, nTrajectories, dynamicsType }),
      }
    },
  })
}

// ── Protocol recommendation engine ──────────────────────────────

function recommendProtocol(systemType, researchGoal, meta) {
  const { nAtoms } = meta
  if (researchGoal === 'photochemistry' || researchGoal === 'electronic-properties' || meta.dynamicsType === 'nonadiabatic') {
    return {
      featurization: { method: 'R/P/complex amplitudes/active electronic state + gap + reaction coordinates', rationale: 'Nonadiabatic paths require the complete dynamical state; FC roots or inherited checkpoints only.', parameters: { initialization: 'FC', candidateRole: 'binning only' } },
      dimensionalityReduction: { method: 'Explicit progress bins', rationale: 'C1 first-passage statistics do not require a Markov assumption.', parameters: {} },
      clustering: { method: 'Electronic state / energy gap / progress bins / absorbing sinks', rationale: 'Keep state and directional absorption information.', nStates: 0 },
      lagTime: { value: 'not applicable to C1', rationale: 'Use fixed WE resampling intervals and an explicit observation horizon.' },
      validation: ['Weight and absorption conservation', 'Energy drift, norm and EDC checks', 'Independent-run bootstrap', 'Same-budget Direct/WE/CI-WE comparison; report negative efficiency findings'],
    }
  }

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
      parameters: { heavyAtomPairs: 'system-specific', dihedralAngles: 'system-specific periodic sin/cos encoding' },
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
  const nStates = 8 // Starting candidate only; select using counts and held-out diagnostics.
  let clustering
  if (nAtoms < 200) {
    clustering = {
      method: `K-Means (${nStates} clusters)`,
      rationale:
        'K-Means provides uniform state decomposition for well-sampled small systems. ' +
        'Eight states is a starting candidate, not an atom-count rule. Compare alternatives using transition support and held-out validation.',
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
    value: 'Compare candidate lag frames using the declared frame time, ITS and held-out CK',
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
    'Optional external VAMP-2 cross-validation (numerical backend not implemented)',
  ]

  return { featurization, dimensionalityReduction: dimReduction, clustering, lagTime, validation }
}

function estimateComplexity(nAtoms, nTrajectories) {
  return 'Depends on frame count, feature dimension and states; native dense MSM supports 2–128 states. Atom count alone does not determine analysis cost.'
}

function generateWarnings(systemType, researchGoal, meta) {
  const warnings = []
  if (researchGoal === 'reaction' && !meta.dynamicsType) warnings.push('Reaction analysis may be classical or nonadiabatic. Clarify the physics domain before selecting MSM or C1.')
  warnings.push('tICA/VAMP suggestions are method guidance only; the current native builder accepts pre-extracted features and KMeans.')

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
      'Use FC-initiated FSSH+EDC with C1 first-hit analysis; a static CI structure is not a dynamical initial condition. ' +
      'External electronic-structure propagation and AutoREST adapters are not connected in this release.'
    )
  }

  return warnings
}
