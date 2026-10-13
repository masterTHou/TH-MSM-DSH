/**
 * TH-MSM Agent Loop
 *
 * This is an advisory loop that enriches the agent's system prompt with
 * MSM-specific context and routes user intent to the correct tools.
 *
 * It does NOT replace DSH's core Agent Loop. It runs as middleware:
 *   user message → loop.intent detection → prompt enrichment → DSH dispatches → tools execute
 *
 * Modes (from plugin.json agent.modes):
 *   teaching   — "explain MSM", "what is implied timescale"
 *   planning   — "design protocol", "plan MSM for protein"
 *   modeling   — "build MSM", "construct Markov model"
 *   validation — "validate MSM", "run CK test", "check model"
 *   reporting  — "generate report", "write summary"
 */

/**
 * Install the TH-MSM agent loop middleware.
 *
 * @param {object} ctx — Cordis context
 * @param {object} config — Resolved plugin config
 */
export function installAgentLoop(ctx, config) {
  // ── Intent detection ──────────────────────────────────────────
  // Listen to agent/pre-step and classify the user's intent.
  // This enriches the system prompt with mode-specific instructions
  // and tool recommendations.

  ctx.on('agent/pre-step', async ({ agent, turn, messages }, next) => {
    // Extract the last user message
    const userMessages = messages?.filter(m => m.role === 'user') ?? []
    const lastUserMessage = userMessages[userMessages.length - 1]

    if (lastUserMessage?.content) {
      const intent = detectIntent(lastUserMessage.content, config)

      if (intent.confidence >= config.intentConfidenceThreshold) {
        // Enrich the system prompt with mode-specific context
        const enrichment = buildModePrompt(intent.mode, intent.details, config)
        if (enrichment) {
          // In production, this would inject into the system message.
          // For DSH, we signal through the context so the core loop can use it.
          agent._thMsmMode = intent.mode
          agent._thMsmEnrichment = enrichment
          agent._thMsmTools = intent.recommendedTools
        }
      }
    }

    return next()
  })

  // ── Post-turn logging ─────────────────────────────────────────
  ctx.on('agent/turn-stopping', ({ agent }) => {
    // Clean up mode state
    delete agent._thMsmMode
    delete agent._thMsmEnrichment
    delete agent._thMsmTools
  })
}

// ── Intent Detection ─────────────────────────────────────────────

const INTENT_PATTERNS = [
  {
    mode: 'teaching',
    patterns: [
      /explain/i, /what\s+is/i, /concept/i, /learn/i, /teach/i,
      /understand/i, /definition/i, /introduce/i, /basics/i,
    ],
    details: (msg) => ({
      concept: extractConcept(msg),
      level: detectLevel(msg),
    }),
  },
  {
    mode: 'planning',
    patterns: [
      /plan/i, /design/i, /protocol/i, /strategy/i, /approach/i,
      /how\s+(would|should|to)\s+(build|construct|make|do)/i,
      /trajectory/i, /system/i, /which\s+(feature|method)/i,
    ],
    details: (msg) => ({
      systemType: extractSystemType(msg),
      goal: extractResearchGoal(msg),
    }),
  },
  {
    mode: 'modeling',
    patterns: [
      /build/i, /construct/i, /run/i, /execute/i, /compute/i,
      /create\s+(an?\s+)?msm/i, /train/i, /fit/i, /pipeline/i,
      /featurize/i, /cluster/i, /reduce/i,
    ],
    details: (msg) => ({
      dataPath: extractPath(msg),
    }),
  },
  {
    mode: 'validation',
    patterns: [
      /validate/i, /check/i, /verify/i, /test/i, /quality/i,
      /implied\s+timescale/i, /its/i, /chapman.?kolmogorov/i, /ck.?test/i,
      /convergence/i, /bootstrap/i, /stability/i,
    ],
    details: (msg) => ({
      modelPath: extractPath(msg),
    }),
  },
  {
    mode: 'reporting',
    patterns: [
      /report/i, /summary/i, /document/i, /write.?up/i, /manuscript/i,
      /generate/i, /output/i, /result/i,
    ],
    details: () => ({}),
  },
]

function detectIntent(message, config) {
  const msg = String(message ?? '')

  let bestMode = null
  let bestConfidence = 0
  let bestDetails = {}

  for (const { mode, patterns, details } of INTENT_PATTERNS) {
    let matches = 0
    for (const pattern of patterns) {
      if (pattern.test(msg)) matches++
    }
    if (matches > 0) {
      // Confidence: fraction of patterns matched × 0.7 + keyword heuristics × 0.3
      const patternConfidence = (matches / patterns.length) * 0.7
      const keywordBonus = hasMsmKeywords(msg) ? 0.3 : 0
      const confidence = Math.min(patternConfidence + keywordBonus, 1.0)

      if (confidence > bestConfidence) {
        bestConfidence = confidence
        bestMode = mode
        bestDetails = details(msg)
      }
    }
  }

  // Fallback: if message mentions MSM at all, default to teaching
  if (!bestMode && /msm|markov|kinetic/i.test(msg)) {
    bestMode = 'teaching'
    bestConfidence = 0.4
    bestDetails = { concept: 'overview', level: 'graduate' }
  }

  const modeConfig = config._agentModes?.[bestMode] ?? {}

  return {
    mode: bestMode,
    confidence: bestConfidence,
    details: bestDetails,
    recommendedTools: modeConfig.tools ?? [],
  }
}

function hasMsmKeywords(msg) {
  const keywords = /\b(msm|markov|transition\s+matrix|implied\s+timescale|tica|pcca|vamp|koopman|lag\s+time|microstate|macrostate)\b/i
  return keywords.test(msg)
}

function extractConcept(msg) {
  const concepts = [
    'markov state model', 'implied timescale', 'transfer operator',
    'tica', 'pcca', 'vamp', 'koopman operator', 'lag time',
    'transition matrix', 'stationary distribution', 'eigenvector',
    'metastable state', 'coarse graining', 'variational principle',
    'reversible MSM', 'maximum likelihood', 'bayesian MSM',
  ]
  const lower = msg.toLowerCase()
  return concepts.find(c => lower.includes(c)) ?? 'overview'
}

function detectLevel(msg) {
  const lower = msg.toLowerCase()
  if (/\b(beginner|basic|simple|intro|undergrad|novice|new to)\b/i.test(lower)) return 'undergraduate'
  if (/\b(expert|advanced|research|cutting.?edge|frontier)\b/i.test(lower)) return 'expert'
  return 'graduate'
}

function extractSystemType(msg) {
  const lower = msg.toLowerCase()
  if (/\bprotein\b/i.test(lower)) return 'protein'
  if (/\bpeptide\b/i.test(lower)) return 'peptide'
  if (/\bsmall.?molecule\b/i.test(lower)) return 'small-molecule'
  if (/\bmaterial\b/i.test(lower)) return 'material'
  if (/\bsolution\b/i.test(lower)) return 'solution'
  return undefined
}

function extractResearchGoal(msg) {
  const lower = msg.toLowerCase()
  if (/\bbind/i.test(lower)) return 'binding'
  if (/\breact/i.test(lower)) return 'reaction'
  if (/\bele(c|kt)ron/i.test(lower)) return 'electronic-properties'
  if (/\bconform/i.test(lower) || /\bfold/i.test(lower)) return 'conformational-change'
  if (/\bkinetic/i.test(lower) || /\brate\b/i.test(lower)) return 'kinetics'
  return undefined
}

function extractPath(msg) {
  // Simple heuristic: look for quoted or slash-containing paths
  const quotedMatch = msg.match(/["']([^"']+\.(?:xtc|dcd|nc|pdb|psf|prmtop|pkl|h5))["']/)
  if (quotedMatch) return quotedMatch[1]
  const pathMatch = msg.match(/(\S+\/(?:\S+\.(?:xtc|dcd|nc|pdb|psf|prmtop|pkl|h5)))/)
  return pathMatch?.[1] ?? undefined
}

// ── Mode Prompt Builder ───────────────────────────────────────────

function buildModePrompt(mode, details, config) {
  const base = '[TH-MSM Agent Loop active]'

  switch (mode) {
    case 'teaching':
      return `${base} Mode: TEACHING.
You are explaining MSM concepts to a ${details.level ?? 'graduate'}-level user.
The topic is: "${details.concept ?? 'MSM overview'}".
- Provide intuitive meaning before mathematics.
- Use the th_msm_knowledge tool to search for relevant papers.
- Use the th_msm_teach tool for structured explanations.
- Reference the knowledge base at knowledge/LEARNING_ROADMAP.md for learning paths.
Science principles: ${(config._principles ?? []).join('; ')}`

    case 'planning':
      return `${base} Mode: PLANNING.
The user wants to design an MSM protocol for a ${details.systemType ?? 'molecular'} system
(goal: ${details.goal ?? 'unspecified'}).
- Use th_msm_plan to generate a structured protocol.
- Justify every choice: feature, reduction method, lag time, clustering.
- Use th_msm_knowledge to find relevant benchmark papers.
- Ask for user confirmation before any execution.
Science principles: ${(config._principles ?? []).join('; ')}`

    case 'modeling':
      return `${base} Mode: MODELING.
The user wants to build an MSM from trajectory data${details.dataPath ? ` at ${details.dataPath}` : ''}.
- Use th_msm_build to orchestrate the pipeline.
- Ensure preprocessing → featurization → reduction → clustering → estimation.
- The generic th_msm tool dispatches to Python (PyEMMA/deeptime) via the registry.
- Report each pipeline step status.
Science principles: ${(config._principles ?? []).join('; ')}`

    case 'validation':
      return `${base} Mode: VALIDATION.
The user wants to validate an MSM model${details.modelPath ? ` at ${details.modelPath}` : ''}.
- Use th_msm_validate to run ITS, CK test, population analysis, stability analysis.
- A successful program run does NOT mean a valid model.
- Report uncertainties honestly. Distinguish numerical correctness from scientific credibility.
Science principles: ${(config._principles ?? []).join('; ')}`

    case 'reporting':
      return `${base} Mode: REPORTING.
The user wants to generate a scientific report.
- Use th_msm_report to produce a complete Markdown report.
- Include all 9 standard sections.
- Use th_msm_knowledge for literature context.
Science principles: ${(config._principles ?? []).join('; ')}`

    default:
      return null
  }
}