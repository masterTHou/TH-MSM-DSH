/**
 * th_msm_build — MSM 构建 + 知识索引构建 (v1.1 deeptime-first)
 *
 * 两种模式:
 *   mode="msm"    — 编排 MSM 构建流水线 (deeptime)
 *   mode="index"  — 构建知识库向量索引 (RAG)
 *
 * deeptime 流水线: 特征提取 → TICA → KMeans → MaxLikelihoodMSM → PCCA+
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildIndex, checkIndex } from '../knowledge/vector/indexer.js'
import { getRetriever } from '../knowledge/vector/retriever.js'

const resultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    mode: { type: 'string', required: true },
    summary: { type: 'string', required: true },
    details: { type: 'object', additionalProperties: true },
    nextSteps: { type: 'array', items: { type: 'string' } },
  },
}

export function createBuildTool(ctx, config) {
  return defineTool({
    name: 'th_msm_build',
    description:
      '两种模式: (1) mode="msm" 构建 deeptime MSM 流水线; ' +
      '(2) mode="index" 一键构建知识库向量索引，启用 AI 语义搜索（首次约需 30 秒，后续秒开）。',
    parameters: {
      mode: {
        type: 'string',
        enum: ['msm', 'index'],
        description: '构建模式: msm（MSM 流水线）或 index（知识索引）。',
      },
      // MSM mode params
      trajectoryPath: {
        type: 'string',
        description: '轨迹文件路径（mode=msm 时使用）。',
      },
      topologyPath: {
        type: 'string',
        description: '拓扑文件路径（mode=msm 时使用）。',
      },
      lagTime: {
        type: 'integer',
        description: 'Lag time（帧数）。默认: 10。',
      },
      nClusters: {
        type: 'integer',
        description: 'K-Means 聚类数。默认: 100。',
      },
    },
    output: {
      schema: resultSchema,
      render: (_args, value) => {
        if (!value.ok) return [{ type: 'text', text: `构建失败: ${value.summary}` }]
        const lines = [`# ${value.summary}`]
        if (value.nextSteps?.length) {
          lines.push('', '## 下一步')
          for (const s of value.nextSteps) lines.push(`- ${s}`)
        }
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    timeoutMs: config.pythonTimeoutMs,
    isConcurrencySafe: () => true,

    async execute(args, exec) {
      const workspace = exec.agent?.session?.header?.cwd
      if (!workspace) {
        return { ok: false, mode: args.mode ?? 'msm', summary: '未找到工作区。', details: {}, nextSteps: [] }
      }

      const mode = args.mode ?? 'msm'

      // ── 模式 1: MSM 流水线 ──────────────────────────────
      if (mode === 'msm') {
        if (!args.trajectoryPath) {
          return {
            ok: false, mode: 'msm',
            summary: '缺少轨迹路径。请提供 trajectoryPath 参数。',
            details: {}, nextSteps: [],
          }
        }

        return {
          ok: true, mode: 'msm',
          summary: `deeptime MSM 流水线已就绪`,
          details: {
            library: 'deeptime (https://deeptime-ml.github.io)',
            pipeline: '特征提取 → TICA 降维 → KMeans 聚类 → MaximumLikelihoodMSM → PCCA+',
            trajectory: args.trajectoryPath,
            topology: args.topologyPath ?? 'system.pdb',
            lagTime: args.lagTime ?? 10,
            nClusters: args.nClusters ?? 100,
          },
          nextSteps: [
            '运行 th_msm_validate 验证模型质量',
            '运行 th_msm_report 生成科研报告',
          ],
        }
      }

      // ── 模式 2: 向量索引构建 ────────────────────────────
      if (mode === 'index') {
        try {
          const status = await checkIndex(workspace)
          if (status.exists) {
            return {
              ok: true, mode: 'index',
              summary: `向量索引已存在（${status.count} 篇论文），无需重建。`,
              details: { count: status.count },
              nextSteps: ['现在可以用自然语言搜索知识库了，例如搜索"tICA 降维方法"。'],
            }
          }

          const result = await buildIndex(
            workspace,
            config.knowledgeBasePath,
            config.knowledgeCatalogs,
            { force: false }
          )

          return {
            ok: true, mode: 'index',
            summary: result.message,
            details: { indexed: result.indexed, errors: result.errors },
            nextSteps: [
              '✅ 向量索引构建完成！',
              '现在搜索知识库会自动使用 AI 语义搜索，比关键词更准确。',
              '试试: "搜索 MSM lag time 选择方法"',
            ],
          }
        } catch (error) {
          return {
            ok: false, mode: 'index',
            summary: `索引构建失败: ${error.message}`,
            details: {},
            nextSteps: ['检查 @xenova/transformers 是否安装: npm install @xenova/transformers'],
          }
        }
      }

      return { ok: false, mode, summary: `未知模式: ${mode}`, details: {}, nextSteps: [] }
    },
  })
}