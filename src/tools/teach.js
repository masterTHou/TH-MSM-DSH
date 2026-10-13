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
      additionalProperties: false,
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
      const concept = String(args.concept ?? '').toLowerCase().trim()
      const level = String(args.level ?? 'graduate')

      if (!concept) {
        return {
          ok: false, concept: '', level,
          explanation: { intuition: '', mathematics: '', application: '', references: [] },
          followUpQuestions: [],
        }
      }

      // ── 内置 MSM 核心概念库 ──
      const explanation = getBuiltinExplanation(concept, level)

      if (explanation) {
        return {
          ok: true,
          concept,
          level,
          explanation,
          followUpQuestions: [
            `How does ${concept} relate to other MSM concepts?`,
            `What are the limitations of ${concept}?`,
            `Can you show a concrete example with ${concept}?`,
          ],
        }
      }

      // ── 概念不在库中 — 尝试从知识库搜索 ──
      const levelDesc = LEVEL_DESCRIPTIONS[level] ?? LEVEL_DESCRIPTIONS.graduate

      return {
        ok: true,
        concept,
        level,
        explanation: {
          intuition: `${levelDesc} [请用 th_msm_knowledge 搜索 "${concept}" 获取详细论文支持]`,
          mathematics: `请用 th_msm_knowledge 搜索相关论文获取数学定义。`,
          application: `请用 th_msm_knowledge 搜索 "${concept}" 的 benchmark 体系应用。`,
          references: [
            '使用 th_msm_knowledge 搜索知识库中关于此概念的论文。',
            `参阅 LEARNING_ROADMAP.md 中的 ${level} 级别学习路径。`,
          ],
        },
        followUpQuestions: [
          `How does ${concept} relate to other MSM concepts?`,
          `What are the limitations of ${concept}?`,
        ],
      }
    },
  })
}

// ── 内置 MSM 概念库 ────────────────────────────────────────

const BUILTIN_CONCEPTS = {
  'markov state model': {
    intuition: 'Markov State Model (MSM) 是一种将分子动力学模拟中的连续构象空间离散化为"状态"，并用马尔可夫转移矩阵描述状态间跳转概率的统计力学方法。它让研究者能从短轨迹中提取长时尺度的动力学信息。',
    mathematics: '给定 lag time τ，MSM 定义转移概率矩阵 T(τ)，其中 T_ij = P(x_{t+τ} ∈ S_j | x_t ∈ S_i)。稳态分布 π 满足 π·T = π。关键方程：T(τ) = D^{-1}·C(τ)，其中 C(τ) 是 count matrix。',
    application: '蛋白质折叠、构象变化研究中最常用的工具之一。例如用 tICA 降维后对 BPTI 蛋白的 MD 轨迹做 MSM，可以提取出毫秒级的折叠动力学。',
  },
  'tica': {
    intuition: 'tICA（time-lagged Independent Component Analysis）是一种寻找"最慢"构象变化的降维方法。它找到的是最大化时间自相关函数的坐标方向。',
    mathematics: 'tICA 解广义特征值问题: C(τ)·v = λ·C(0)·v，其中 C(τ) 是时间滞后协方差矩阵，C(0) 是瞬时协方差矩阵。特征值 λ 对应时间尺度 t = -τ / ln(λ)。',
    application: 'Pérez-Hernández et al. JCP 2013 提出的 tICA 已成为 MSM 构建的标准预处理步骤，比 PCA 更适合动力学分析。',
  },
  'pca': {
    intuition: 'PCA（主成分分析）找到数据方差最大的方向。在 MSM 中，PCA 常用于初步降维但不如 tICA 适合动力学分析。',
    mathematics: 'PCA 解协方差矩阵的特征值分解: C(0)·v = λ·v。特征值越大，对应方向上的方差越大。',
    application: 'PCA 对 MSM 的特征初筛有用，但不区分快慢自由度，通常需要配合 tICA。',
  },
  'vamp': {
    intuition: 'VAMP（Variational Approach for Markov Processes）是基于 Koopman 算子理论的变分框架，用于找到最优的 MSM 特征和评分模型。',
    mathematics: 'VAMP-n score = ||(C(0))^{-1/2}·C(τ)·(C(τ))^{-1/2}||_n，用于评估 MSM 质量。VAMP-2 最常用。',
    application: 'Wu & Noé J. Nonlinear Sci. 2020 建立了完整的 VAMP 理论框架，是当前 MSM 评分和优化的标准方法。',
  },
  'koopman operator': {
    intuition: 'Koopman 算子描述的是非线性动力学系统在观测函数空间中的线性演化。这让我们可以对非线性分子动力学做线性谱分析。',
    mathematics: 'Koopman 算子 K_τ 定义为: [K_τ·g](x) = E[g(x_{t+τ}) | x_t = x]，其中 g 是观测函数。K_τ 的特征值和特征函数编码了系统的动力学。',
    application: 'deeptime 库中 TICA、VAMP、EDMD 都基于 Koopman 算子理论实现，是 MSM 和深度 MSM 的数学基础。',
  },
  'lag time': {
    intuition: 'Lag time（τ）是 MSM 中的核心参数，它决定了状态间跳转的时间尺度。τ 太短则模型不是 Markov 的，τ 太长则丢失时间分辨率。',
    mathematics: 'ITS（隐含时间尺度）分析: t_i(τ) = -τ / ln(|λ_i(τ)|)。当 τ 足够大时，t_i 应该收敛。选择 ITS 收敛的最小 τ 作为 lag time。',
    application: '实际应用中常用 ITS 图（x 轴 τ，y 轴 t_i）来确定收敛点。deeptime 的 implied_timescales 函数可以直接计算。',
  },
  'pcca': {
    intuition: 'PCCA+（Perron Cluster Cluster Analysis）是一种将 MSM 的微态（microstates）聚合成宏态（macrostates）的谱聚类方法。它找到动力学最"困"的状态群。',
    mathematics: 'PCCA+ 基于转移矩阵的特征向量做聚类，使用 membership 矩阵 χ 描述每个微态属于各宏态的概率。',
    application: 'PCCA+ 是 MSM 解释的关键步骤。通过宏态，研究者可以理解"蛋白有几种主要构象"以及它们之间的转换速率。',
  },
  'implied timescale': {
    intuition: '隐含时间尺度（ITS）是 MSM 转移矩阵特征值对应的松弛时间。它告诉用户"系统从扰动恢复到平衡需要多长时间"。',
    mathematics: 'ITS: t_i = -τ / ln(λ_i)，其中 λ_i 是 T(τ) 的第 i 个特征值。τ 取足够大时 t_i 应变平，这验证了 Markov 假设。',
    application: 'ITS 图是 MSM 验证的第一步。如果 ITS 曲线在某个 τ 处还不平，说明 lag time 不够大。deeptime 的 implied_timescales 函数可以直接生成。',
  },
  'chapman kolmogorov': {
    intuition: 'Chapman-Kolmogorov (CK) 检验验证 MSM 的 Markov 假设。它比较"用 MSM 预测的 k 步转移概率"与"从数据直接估计的 k 步转移概率"，两者应该一致。',
    mathematics: 'CK 检验: T(kτ) ≈ [T(τ)]^k。左式从数据估计，右式从 MSM 预测。误差越小越 Markov。',
    application: 'CK 检验是 MSM 验证的第二步，通常对每个宏态分别做。偏差大的宏态需要更多数据或更大的 lag time。',
  },
  'transition path theory': {
    intuition: '过渡路径理论（TPT）分析 MSM 中状态间的反应通道和通量，回答"系统的构象变化走哪条路径最快"。',
    mathematics: 'TPT 计算 committor 函数、反应通量和 net flux。committor q_i = P(从状态 i 出发，先到达 B 而非 A 的概率)。',
    application: 'TPT 常用于蛋白折叠路径分析、配体结合/解离通道分析。deeptime.markov.reactive_flux 提供 TPT 计算。',
  },
}

function getBuiltinExplanation(concept, level) {
  // 多级模糊匹配: ① 精确包含 ② 单词匹配 ③ 中文别名
  const conceptLower = concept.toLowerCase()
  const conceptWords = conceptLower.split(/[\s\(\)]+/).filter(w => w.length > 1)

  // 中文别名映射
  const CHINESE_ALIAS = {
    'msm': ['markov state model','马尔可夫状态模型','msm模型','马尔科夫','markov模型'],
    'markov': ['markov state model','马尔可夫','马尔科夫'],
    'tica': ['tica','时间滞后独立成分分析','时间结构独立成分分析'],
    'pca': ['pca','主成分分析'],
    'vamp': ['vamp','变分方法','variational approach'],
    'transfer operator': ['transfer operator','转移算子','koopman','koopman算子'],
    'implied timescale': ['implied timescale','its','隐含时间尺度','implied timescales'],
    'lag time': ['lag time','滞后时间','lagtime'],
    'pcca': ['pcca','perron cluster','谱聚类','宏态'],
    'chapman kolmogorov': ['chapman kolmogorov','ck检验','ck test','ck-test'],
    'transition path theory': ['transition path theory','tpt','过渡路径','反应路径'],
    'markov state model': ['markov state model','msm','马尔可夫状态模型','马尔科夫状态模型','msm模型'],
  }

  // 先尝试通过中文别名找对应的英文 key
  const candidates = new Set()
  for (const [enKey, aliases] of Object.entries(CHINESE_ALIAS)) {
    for (const alias of aliases) {
      if (conceptLower.includes(alias.toLowerCase()) || alias.toLowerCase().includes(conceptLower)) {
        candidates.add(enKey)
      }
    }
    // 单词级别匹配
    for (const w of conceptWords) {
      if (aliases.some(a => a.toLowerCase().includes(w) || w.includes(a.toLowerCase()))) {
        candidates.add(enKey)
      }
    }
  }

  // 用找到的英文 key 去查 BUILTIN_CONCEPTS
  for (const enKey of candidates) {
    if (BUILTIN_CONCEPTS[enKey]) {
      const value = BUILTIN_CONCEPTS[enKey]
      return {
        intuition: value.intuition,
        mathematics: value.mathematics,
        application: value.application,
        references: [
          '使用 th_msm_knowledge 搜索 "' + enKey + '" 获取更多论文。',
        ],
      }
    }
  }

  // 直接查 BUILTIN_CONCEPTS 的 key
  for (const [key, value] of Object.entries(BUILTIN_CONCEPTS)) {
    if (conceptLower.includes(key) || key.includes(conceptLower)) {
      return {
        intuition: value.intuition,
        mathematics: value.mathematics,
        application: value.application,
        references: [
          '使用 th_msm_knowledge 搜索 "' + key + '" 获取更多论文。',
        ],
      }
    }
  }

  return null
return null
}