/**
 * th_msm_teach — Explain MSM concepts at the user's level.
 *
 * Routes to the knowledge base for concept lookup, then provides
 * level-appropriate explanation with intuitive meaning, mathematical
 * definition, and practical application.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'

const LEVEL_DESCRIPTIONS = {
  undergraduate: 'Intuitive explanation with minimal math. Focus on what MSM does, not how.',
  graduate: 'Mathematical foundation with practical examples. Include key equations.',
  expert: 'Rigorous treatment with variational principles, error analysis, and frontiers.',
}

const resultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    concept: { type: 'string', required: true },
    level: { type: 'string', required: true },
    explanation: {
      type: 'object', required: true,
      properties: {
        intuition: { type: 'string', required: true },
        mathematics: { type: 'string', required: true },
        application: { type: 'string', required: true },
        references: {
          type: 'array', items: { type: 'string' },
        },
      },
    },
    followUpQuestions: {
      type: 'array', items: { type: 'string' },
    },
  },
}

export function createTeachTool(ctx, config) {
  return defineTool({
    name: 'th_msm_teach',
    description:
      'Explain a Markov State Model concept at the appropriate level (undergraduate, graduate, or expert). ' +
      'Each explanation includes intuitive meaning, mathematical definition, and practical application.',
    parameters: {
      concept: {
        type: 'string', required: true,
        description: 'The MSM concept to explain (e.g., "implied timescale", "transfer operator", "PCCA+").',
      },
      level: {
        type: 'string', required: true,
        enum: ['undergraduate', 'graduate', 'expert'],
        description: 'The user\'s expertise level.',
      },
    },
    output: {
      schema: resultSchema,
      render: (_args, value) => {
        if (!value.ok) return [{ type: 'text', text: 'Teaching failed.' }]
        const e = value.explanation
        const lines = [
          `# ${value.concept} — ${value.level} level`,
          '',
          '## 🧠 Intuitive Meaning',
          e.intuition,
          '',
          '## 📐 Mathematical Definition',
          e.mathematics,
          '',
          '## 🔬 Practical Application',
          e.application,
          '',
        ]
        if (e.references.length) {
          lines.push('## 📚 References')
          for (const ref of e.references) lines.push(`- ${ref}`)
          lines.push('')
        }
        if (value.followUpQuestions.length) {
          lines.push('## 💡 Follow-up Questions')
          for (const q of value.followUpQuestions) lines.push(`- ${q}`)
        }
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    timeoutMs: config.defaultTimeoutMs,
    isConcurrencySafe: () => true,

    async execute(args, exec) {
      const concept = String(args.concept ?? '')
      const level = String(args.level ?? 'graduate')

      if (!concept) {
        return {
          ok: false, concept: '', level,
          explanation: { intuition: '', mathematics: '', application: '', references: [] },
          followUpQuestions: [],
        }
      }

      // In a full implementation, this would search the knowledge base for the concept
      // and generate a level-appropriate explanation using the indexed papers.
      // For now, it returns a structured template that the Agent Loop enriches.

      const levelDesc = LEVEL_DESCRIPTIONS[level] ?? LEVEL_DESCRIPTIONS.graduate

      return {
        ok: true,
        concept,
        level,
        explanation: {
          intuition: `[Knowledge-base-sourced intuitive explanation for "${concept}" at ${level} level.] ${levelDesc}`,
          mathematics: `[Formal mathematical treatment of "${concept}" from indexed papers in the knowledge base.]`,
          application: `[Practical use case of "${concept}" from benchmark systems and application papers.]`,
          references: [
            'Search the knowledge base with th_msm_knowledge for specific papers on this concept.',
            `See LEARNING_ROADMAP.md for ${level}-level learning path.`,
          ],
        },
        followUpQuestions: [
          `How does ${concept} relate to other MSM concepts?`,
          `What are the limitations of ${concept}?`,
          `Can you show a concrete example with ${concept}?`,
        ],
      }
    },
  })
}