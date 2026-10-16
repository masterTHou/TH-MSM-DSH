import { generateClassicalExample } from './example.js'
import { buildClassicalModel, mfptToState } from './index.js'
import { writeWorkspaceText } from '../io/workspace.js'
export async function runClassicalExample(workspace: string, options: { outputDir?: string; seed?: string } = {}) {
  const folder = options.outputDir ?? 'output/msm-demo', dataset = generateClassicalExample(options.seed), model = buildClassicalModel(dataset), passage = mfptToState(model, 1)
  const dataPath = await writeWorkspaceText(workspace, `${folder}/trajectories.json`, JSON.stringify(dataset))
  const modelPath = await writeWorkspaceText(workspace, `${folder}/model.json`, JSON.stringify(model, null, 2))
  const reportPath = await writeWorkspaceText(workspace, `${folder}/START-HERE.md`, `# 你的第一个 MSM\n\n本例是已知转移矩阵 [[0.9,0.1],[0.2,0.8]] 的合成 Markov 链，不是分子模拟。\n\n解析参考：π=(2/3,1/3)，慢时间尺度≈2.804 步，MFPT 0→1=10 步。有限样本估计会有波动。\n\n模型：${modelPath}\n\n估计 π=${JSON.stringify(model.stationary_distribution)}。验证：${model.validation.verdict}。\n\n从这里继续：解释 ITS；计算到状态 1 的 MFPT；比较训练与留出 CK。\n`)
  return { ok: true, summary: '演示已完成：数据、模型和入门说明都已保存。这个例子可以和手算结果直接比较。', details: { dataPath, modelPath, reportPath, estimated_pi: model.stationary_distribution, validation: model.validation.verdict, mfpt: passage, exact_reference: { pi: [2 / 3, 1 / 3], slow_time_steps: -1 / Math.log(0.7), mfpt_0_to_1_steps: 10 } }, suggested_replies: ['解释为什么 π 不是 50% / 50%', '帮我解读 ITS 和 CK', '把演示换成我自己的数据'] }
}
