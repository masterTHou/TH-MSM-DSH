import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildC1 } from '../analysis/build-c1.js'
import { writeWorkspaceText } from '../io/workspace.js'
import { buildIndex, checkIndex } from '../knowledge/vector/indexer.js'
import { readTrajectoryRun } from '../io/trajectory.js'
import { readWorkspaceJSON } from '../io/workspace.js'
import { buildClassicalModel } from '../msm/index.js'
export function createBuildTool(ctx, config) {
  return defineTool({
    name: 'th_msm_build',
    description: '建立经典 MSM（mode=msm，离散轨迹/预提取特征）或非绝热 C1（mode=c1）。不确定数据与参数时先使用 th_msm_guide。',
    parameters: {
      mode: { type: 'string', enum: ['auto', 'c1', 'c2', 'msm', 'index'], description: 'Default auto: infer domain from the file. Explicit msm/c1 available; C2 unsupported.' },
      trajectoryPath: { type: 'string', description: 'Versioned run JSON within workspace.' },
      outputPath: { type: 'string', description: 'Default output/c1.json.' },
      bootstrapPaths: { type: 'array', items: { type: 'string' }, description: 'Independent complete runs of the same protocol.' },
      nBootstraps: { type: 'integer', description: 'Default 200.' },
      lagTime: { type: 'integer', description: 'Classical MSM lag in frames; default 1.' },
      nClusters: { type: 'integer', description: 'KMeans clusters for pre-extracted feature trajectories; default 8.' },
      holdoutFraction: { type: 'number', description: 'Hold out whole trajectories, default .25 when at least four exist.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, mode: { type: 'string', required: true }, summary: { type: 'string', required: true }, details: { type: 'object', additionalProperties: true }, nextSteps: { type: 'array', items: { type: 'string' } } } },
      render: (_args, v) => [{ type: 'text', text: `${v.summary}\n${JSON.stringify(v.details, null, 2)}` }],
    },
    timeoutMs: config.pythonTimeoutMs, isConcurrencySafe: () => false,
    async execute(args, exec) {
      let mode = args.mode ?? 'auto'
      const workspace = exec.agent?.session?.header?.cwd
      const result = (ok, summary, details = {}) => ({ ok, mode, summary, details, nextSteps: [] })
      if (!workspace) return result(false, 'WORKSPACE_REQUIRED')
      try {
        let input
        if (mode === 'auto') {
          if (!args.trajectoryPath) return { ...result(false, '请提供工作区内的数据路径；没有数据可以运行 th_msm_example。'), nextSteps: ['用 th_msm_guide 选择目标与数据', '直接运行两状态 MSM 演示'] }
          if (args.trajectoryPath.endsWith('.jsonl')) mode = 'c1'
          else {
            input = await readWorkspaceJSON(workspace, args.trajectoryPath)
            if (input.kind === 'classical-msm') return { ...result(false, '这是已建立的模型，请用 th_msm_analyze 解读结果。'), nextSteps: [`th_msm_analyze: ${args.trajectoryPath}`] }
            mode = ['classical-trajectories', 'classical-features'].includes(input.kind) ? 'msm' : 'c1'
          }
        }
        if (mode === 'index') {
          const status = await checkIndex(workspace)
          if (status.exists) return result(true, 'Index exists', status)
          const index = await buildIndex(workspace, config.knowledgeBasePath, config.knowledgeCatalogs)
          return result(index.indexed > 0 && index.errors === 0, index.message, index)
        }
        if (mode === 'msm') {
          if (!args.trajectoryPath) return result(false, '请提供数据 JSON 路径；没有数据可以运行 th_msm_example。')
          if (args.bootstrapPaths?.length) return result(false, '经典 MSM 尚未实现置信区间 Bootstrap；bootstrapPaths 当前用于 C1 独立 runs。')
          const model = buildClassicalModel(input ?? await readWorkspaceJSON(workspace, args.trajectoryPath), { lagFrames: args.lagTime ?? 1, nClusters: args.nClusters ?? 8, holdoutFraction: args.holdoutFraction ?? 0.25 })
          const outputPath = await writeWorkspaceText(workspace, args.outputPath ?? 'output/msm/model.json', JSON.stringify(model, null, 2) + '\n')
          return { ...result(true, '经典 MSM 已建立并保存；科学适用性请查看验证结论。', { outputPath, model }), nextSteps: ['用 th_msm_analyze 解读布居、时间尺度和 MFPT', '如果 CK/ITS 不支持模型，调整特征与 lag 后重新验证', '请解释这个模型最慢的过程'] }
        }
        if (mode !== 'c1') return result(false, 'NOT_IMPLEMENTED: nonadiabatic absorbing C2 is not implemented; classical MSM is a separate mode')
        if (!args.trajectoryPath) return result(false, 'trajectoryPath is required')
        const run = input ?? await readTrajectoryRun(workspace, args.trajectoryPath)
        const bootstrapRuns = await Promise.all((args.bootstrapPaths ?? []).map(p => readTrajectoryRun(workspace, p)))
        const analysis = buildC1(run, { bootstrapRuns, nBootstraps: args.nBootstraps ?? 200 })
        const outputPath = await writeWorkspaceText(workspace, args.outputPath ?? 'output/c1.json', JSON.stringify(analysis, null, 2) + '\n')
        return result(true, 'C1 analysis completed and saved', { outputPath, ...analysis })
      } catch (e) { return { ...result(false, `暂时无法完成构建：${e.message}`), nextSteps: /outgoing|disconnected/.test(e.message) ? ['检查稀有状态是否有足够转移采样', '比较更小 lag 或有物理依据的状态合并'] : ['用 th_msm_guide 检查数据路径、格式与时间单位', '先运行演示，对照标准输入格式'] } }
    },
  })
}
