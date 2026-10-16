import type { LearningLevel } from '../education/lessons.js'
export interface GuideState {
  goal?: 'learn' | 'classical-msm' | 'nonadiabatic-c1' | 'unsure'
  dataPath?: string
  dataFormat?: 'discrete' | 'features' | 'xtc-dcd' | 'run-json' | 'none'
  level?: LearningLevel
  topic?: string
  modelPath?: string
  experience?: 'guided' | 'expert'
}
interface Question { id: string; title: string; choices: { label: string; value: string }[]; example_reply?: string }
export interface GuideResponse {
  stage: 'choose-goal' | 'choose-lesson' | 'prepare-data' | 'ready'
  message: string
  questions: Question[]
  next_action: { tool: string; args: Record<string, string | number> } | null
  suggested_replies: string[]
  remembered: GuideState
}
export function guide(state: GuideState): GuideResponse {
  const result = (stage: GuideResponse['stage'], message: string, questions: Question[], action: GuideResponse['next_action'] = null, replies: string[] = []): GuideResponse => ({ stage, message, questions, next_action: action, suggested_replies: replies, remembered: state })
  if (!state.goal || state.goal === 'unsure') return result('choose-goal', '我们先选一个目标。没有自己的数据也可以直接体验完整演示。', [{ id: 'goal', title: '你现在最想完成什么？', choices: [{ label: '先学懂 MSM，从直观例子开始', value: 'learn' }, { label: '建立或分析经典 MSM', value: 'classical-msm' }, { label: '研究非绝热光化学路径', value: 'nonadiabatic-c1' }] }], null, ['我是新手，先解释 MSM', '我有离散轨迹，想建立模型', '先跑一个不用量化软件的演示'])
  if (state.goal === 'learn') {
    if (!state.topic) return result('choose-lesson', '可以从“MSM 是什么”开始，也可以直接挑你遇到的问题。', [
      { id: 'topic', title: '想先聊哪个主题？', choices: [{ label: 'MSM 是什么（推荐从这里开始）', value: 'msm' }, { label: '怎样选状态和特征', value: 'features' }, { label: '怎么看 ITS / CK', value: 'its' }, { label: '布居、MFPT 与通量有什么区别', value: 'mfpt' }] },
      ...(!state.level ? [{ id: 'level', title: '希望讲解到什么程度？不选默认从直观例子讲起。', choices: [{ label: '零基础，多用例子', value: 'undergraduate' }, { label: '研究生，需要公式与实操', value: 'graduate' }, { label: '熟悉方法，讨论假设与误差', value: 'expert' }] }] : []),
    ], null, ['用零基础方式解释 MSM', '我想理解 CK 检验失败意味着什么'])
    return result('ready', '我们按你选择的主题来讲：先给直观例子，再解释公式与常见误区。', [], { tool: 'th_msm_teach', args: { concept: state.topic, level: state.level ?? 'undergraduate' } }, ['举个两状态的数值例子', '给我一道小练习', '带我跑第一个模型'])
  }
  if (state.modelPath) return result('ready', '先读取已有模型并检查结果，再用图表和数值解释状态布居、慢时间尺度或目标态首达时间。', [], { tool: 'th_msm_analyze', args: { modelPath: state.modelPath } }, ['解释哪个状态更常见', '解释最慢的时间尺度', '计算到目标态的 MFPT'])
  if (state.goal === 'nonadiabatic-c1' && state.dataPath) return result('ready', '已有非绝热轨迹时直接分析首达曲线与跃迁通量。', [], { tool: 'th_msm_build', args: { mode: 'c1', trajectoryPath: state.dataPath } }, ['解释各产物首达概率', '哪些交叉区实际发生了反应？'])
  if (state.goal === 'nonadiabatic-c1') return result('ready', '可以先运行标准 LVC 演示，再看首达曲线和跃迁通量。演示无需量化软件；外部 ES 轨迹适配仍需专门接入。', [], { tool: 'th_msm_sample', args: { model: 'lvc', mode: 'direct', seed: 'guided-demo', nTrajectories: 32, steps: 1100 } }, ['先运行演示并解释输出', '我已经有 run JSON，请分析它', '解释 C1 与经典 MSM 的区别'])
  if (!state.dataFormat || state.dataFormat === 'none') return result('prepare-data', '先确认手头的数据。没有数据时，演示会生成可查看的经典轨迹、模型和报告。', [{ id: 'dataFormat', title: '你现在有哪种数据？', choices: [{ label: '没有数据，先跑演示', value: 'none' }, { label: '离散状态序列（JSON）', value: 'discrete' }, { label: '预提取的数值特征（JSON）', value: 'features' }, { label: 'XTC / DCD 等原始分子轨迹', value: 'xtc-dcd' }] }], state.dataFormat === 'none' ? { tool: 'th_msm_example', args: { outputDir: 'output/msm-demo' } } : null, ['我没有数据，直接带我跑演示', '我的数据是离散轨迹', '我只有 XTC 和拓扑文件'])
  if (state.dataFormat === 'xtc-dcd') return result('prepare-data', '这类轨迹需要先提取特征。本版直接接受特征 JSON；我可以先解释如何选择键长、距离或周期二面角，并按你的环境准备后续步骤。', [{ id: 'dataPath', title: '轨迹与拓扑分别在哪里？也请说明体系与最关心的运动。', choices: [], example_reply: '轨迹 data/traj.xtc，拓扑 data/system.pdb，关注两个构象间转换' }], null, ['先帮我选择特征', '先用演示熟悉后续分析'])
  if (!state.dataPath) return result('prepare-data', '请提供工作区内的数据路径。文件中的帧间隔、时间单位和轨迹边界会直接读取；缺失时会明确提示补充。', [{ id: 'dataPath', title: '数据 JSON 在哪个路径？', choices: [], example_reply: 'data/classical.json' }])
  return result('ready', '数据路径已记下。接下来建立模型并展示验证结果；如发现连通性或采样不足，会解释具体原因和修改建议。', [], { tool: 'th_msm_build', args: { mode: 'msm', trajectoryPath: state.dataPath, outputPath: 'output/msm/model.json' } }, ['用推荐设置建立模型', '我想自己指定 lag time', '先解释数据格式'])
}
