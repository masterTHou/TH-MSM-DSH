export type LearningLevel = 'undergraduate' | 'graduate' | 'expert'
interface Topic {
  id: string; title: string; aliases: string[]; intuition: string; equation: string; application: string; advanced: string; caveat: string
}
const topics: Topic[] = [
  { id: 'msm', title: '马尔可夫态模型', aliases: ['markov state model', 'msm', '马尔可夫状态模型', '马尔科夫状态模型', '马尔可夫态模型'], intuition: '把连续分子运动划分成少数状态，再统计经过固定时间后从一个状态走到另一个状态的概率。像给构象变化画一张带概率的地图。', equation: 'P_ij(τ)=Pr[X(t+τ)=j | X(t)=i]；每行概率和为 1。', application: '输入多条离散轨迹，建立状态转移矩阵，分析构象布居与转换时间。先运行 npm run demo:msm。', advanced: '离散化通常使投影过程带记忆；拟合得到随机矩阵并不自动满足选定 τ 下的马尔可夫性。', caveat: '基础经典 MSM 与非绝热光解 C1 是两种分析问题，不共享产物分支比解释。' },
  { id: 'features', title: '特征与微态', aliases: ['features', 'microstate', '特征', '微态', '聚类'], intuition: '特征决定你看见什么运动，聚类决定把哪些相似构象归为一类。输入信息丢失后，后续矩阵无法自动补回来。', equation: '角度宜编码为 (sin φ, cos φ)；键长等具有不同尺度的特征需声明缩放方法。', application: '使用键长、距离、周期二面角的预提取特征。KMeans 只在训练轨迹拟合，再给验证轨迹分配微态。', advanced: '特征、聚类数和滞后时间必须共同验证；训练/验证切分要先于任何从数据拟合的变换。', caveat: '当前支持预提取特征与 KMeans；未直接读取 XTC/DCD 或实现 tICA。' },
  { id: 'counts', title: '滞后转移计数', aliases: ['counts', 'transition matrix', '转移矩阵', '计数矩阵'], intuition: '沿每条轨迹向后看固定的帧数，给对应的状态对加一次计数，再逐行归一化。不同轨迹的尾和头没有物理连接。', equation: 'C_ij(τ)=Σ_m Σ_t 1[x_m(t)=i,x_m(t+τ)=j]；P_ij=C_ij/Σ_j C_ij。', application: '本项目使用滑动窗口计数与非可逆行归一化最大似然估计。没有观测到的出边行会报错。', advanced: '滑动计数对点估计有用，重叠 lag 对彼此相关；不能把所有计数当作独立试验来计算后验误差。', caveat: '不得跨轨迹拼接，不得给无计数行偷偷添加吸收自环。' },
  { id: 'lag', title: '滞后时间', aliases: ['lag time', 'lagtime', '滞后时间', 'lag'], intuition: 'τ 是每次观察状态变化隔多久。太短可能仍记得更早的运动，太长则可用转移对减少。', equation: 'τ=lag_frames × frame_time；必须携带实际时间单位。', application: '对多个 τ 重建模型，对照 ITS 与留出轨迹 CK，而非按原子数指定固定 τ。', advanced: '选 lag 时应同时考察记忆误差、统计误差、状态可辨识性和目标过程的分辨率。', caveat: 'ITS 看起来平稳不能单独证明马尔可夫性。' },
  { id: 'its', title: '隐含时间尺度', aliases: ['implied timescale', 'implied timescales', 'its', '隐含时间尺度'], intuition: '一个扰动衰减得多慢，可以由转移矩阵的特征值估计。改变观察间隔后，可靠的慢时间尺度应大致稳定。', equation: 't_i(τ)=−τ/ln|λ_i(τ)|。例如 λ=0.7、τ=1 时，t≈2.804。', application: '观察多 τ 的慢衰减时间与谱，不能只看一张单 lag 的图。', advanced: '非可逆模型可有复特征值；模给出衰减包络，负实部/非零虚部提示振荡。|λ|=1 的非稳态模式没有有限衰减时间。', caveat: '不同 τ 的谱模可能交换；当前 ITS 稳定性标记只是一项启发式诊断。' },
  { id: 'ck', title: 'Chapman–Kolmogorov 检验', aliases: ['chapman kolmogorov', 'chapman-kolmogorov', 'ck', 'ck test', 'ck检验', 'ck 检验'], intuition: '用短时间模型连续预测几步，再看它是否能预测独立轨迹中的长时间转移。', equation: 'P(kτ)≈P(τ)^k；比较独立留出轨迹的经验转移概率与模型预测。', application: '本项目输出支持计数足够的状态行、加权 RMSE、显式阈值；缺数据时返回 insufficient_data。', advanced: '阈值和支持计数不是普适显著性检验；需考虑相关性、有限样本区间与观测量选择。', caveat: '训练数据自检可能乐观；一次通过不证明所有状态与时间尺度都满足马尔可夫性。' },
  { id: 'stationary', title: '稳态分布', aliases: ['stationary distribution', 'stationary', '稳态分布', '平衡分布'], intuition: '在一个连通且合适的经典模型里，长时间反复转换后，各状态的平均占比可能稳定下来。', equation: 'πP=π，Σ_i π_i=1；示例 P=[[0.9,0.1],[0.2,0.8]] 给出 π=(2/3,1/3)。', application: '解释经典构象模型的长期布居；若要解释分子平衡热力学，还需要相应物理前提。', advanced: '不可约有限链有唯一稳态分布，但周期链未必从任意初态收敛；不可逆估计不会自动满足详细平衡。', caveat: '光解吸收过程的分支比必须使用有限时域首达概率，不能用 π 替代。' },
  { id: 'mfpt', title: '平均首达时间', aliases: ['mfpt', 'mean first passage time', '平均首达时间'], intuition: '从一个状态出发，第一次到达目标通常要等多久？这里不把已经到达目标后的重复访问算进去。', equation: 'm_target=0；m_i=τ+Σ_{j≠target} P_ij m_j。示例 0→1 概率 0.1 时，MFPT=10 步。', application: '调用 mfptToState(model,targetLabel)，结果保留 lag 的实际单位。', advanced: '估计的是离散 MSM 在每个 τ 观测时的首达时间；真实连续轨迹可能在观测间隔内到达并返回。', caveat: 'MFPT 可靠性依赖状态、连通性和马尔可夫性，不是脱离验证的真实速率。' },
  { id: 'we', title: '加权系综采样', aliases: ['we', 'weighted ensemble', '加权系综'], intuition: '把更多计算分配给少见的路径区域，同时用权重记住每条路径代表多少概率。', equation: 'split: w_child=w_parent/M；merge: 以 w_i/Σw 选择完整父路径并保留合并权重。', application: '原样复制 R/P/c/活性态，只更换随机流；每轮检查存活质量加吸收质量等于 1。', advanced: 'WE 重采样可对带历史的随机动力学保持路径分布，但 clone 具有相关性，需要独立完整 runs 估计误差。', caveat: '更多稀有事件命中不自动意味着更高统计效率。' },
  { id: 'c1', title: '非平衡加权首达概率', aliases: ['c1', 'first hit', '首达概率', '光解分支比'], intuition: '在规定的观察时间内，统计有多少概率质量第一次进入某个产物通道，仍未反应的质量要保留。', equation: 'r_k(t)=Σ_{first-hit k by t} w_event。Σ_k r_k(T)+surviving_mass(T)=1。', application: '使用 buildC1(run) 分析 FC→FSSH+EDC 的事件账本与跃迁通量。', advanced: '分裂前的 hop 只能在 flux 账本计一次；对后续产物路径需要保留并正确重采样整个历史。', caveat: '不把最终叶节点的祖先事件重复相加；不对已反应产物重新归一化来隐藏未反应质量。' },
  { id: 'tica', title: 'tICA 与 VAMP', aliases: ['tica', 'vamp', '降维'], intuition: 'PCA 寻找变化幅度大的方向，tICA 寻找保持相关时间长的方向；VAMP 提供更一般的动力学表示评估框架。', equation: 'tICA: C_τ v=λ C_0 v；VAMP-2 使用白化的时滞协方差矩阵奇异值平方和。', application: '在数据足够且方法前提合适时用于特征选择，所有变换必须仅在训练集拟合。', advanced: 'tICA 的可逆/平稳约定与 VAMP 的非可逆扩展需要分开；不同 score 不能脱离验证协议横向比较。', caveat: '本版提供概念教学，未实现 tICA/VAMP 数值后端。' },
  { id: 'tpt', title: '过渡路径理论', aliases: ['tpt', 'transition path theory', '过渡路径理论', 'committor'], intuition: '在已验证的动力学模型上，询问从哪里更容易先到目标，以及反应路径主要经过哪些状态。', equation: 'q_i=Pr_i[T_B<T_A]，边界 q_A=0、q_B=1，内部满足 q_i=Σ_j P_ij q_j。', application: '用于满足相应定义的经典 MSM 路径分析；当前代码只教学，尚未提供经典 TPT 求解器。', advanced: '稳态 TPT 反应通量还需要反向 committor 和匹配的稳态过程；吸收光解不能直接套平衡 π。', caveat: '承诺概率、首达产率和跃迁次数是不同观测量。' },
]
export interface Lesson {
  id: string; title: string; level: LearningLevel
  explanation: { intuition: string; mathematics: string; application: string; references: string[] }
  caveat: string; exercise: { question: string; answer: string }; learning_path: string[]
}
export function learningPath(level: LearningLevel): string[] {
  return level === 'undergraduate' ? ['msm', 'features', 'counts', 'lag', 'stationary', 'mfpt', 'its', 'ck'] : ['msm', 'features', 'counts', 'lag', 'its', 'ck', 'stationary', 'mfpt', 'tica', 'tpt', 'we', 'c1']
}
export function getLesson(concept: string, level: LearningLevel = 'undergraduate'): Lesson | null {
  const key = concept.trim().toLowerCase().replace(/[？?。]/g, '')
  const topic = topics.find(t => t.id === key || t.title.toLowerCase() === key || t.aliases.includes(key))
    ?? topics.filter(t => t.aliases.some(a => a.length >= 3 && key.includes(a))).sort((a, b) => Math.max(...b.aliases.map(s => s.length)) - Math.max(...a.aliases.map(s => s.length)))[0]
  if (!topic || !['undergraduate', 'graduate', 'expert'].includes(level)) return null
  return { id: topic.id, title: topic.title, level, explanation: {
    intuition: topic.intuition + (level === 'expert' ? ` ${topic.advanced}` : ''),
    mathematics: level === 'undergraduate' ? (topic.id === 'msm' ? '例如“从 A 出发，隔一段时间有 90% 留在 A、10% 到 B”，就是转移矩阵的一行。' : topic.equation) : topic.equation + (level === 'expert' ? ` ${topic.advanced}` : ''),
    application: topic.application + (level === 'graduate' ? ` 验证要点：${topic.caveat}` : ''),
    references: [topic.id === 'we' || topic.id === 'c1' ? 'Zhang et al. (2010), DOI:10.1063/1.3306345' : 'Prinz et al. (2011), DOI:10.1063/1.3565032', 'https://deeptime-ml.github.io/latest/index_msm.html'],
  }, caveat: topic.caveat, exercise: { question: topic.id === 'mfpt' ? '如果每一步从 A 到 B 的概率为 0.2，MFPT 是多少步？' : `用自己的数据检查：“${topic.caveat}”会如何改变你的解释？`, answer: topic.id === 'mfpt' ? '5 步；依赖每步同样的马尔可夫转移概率假设。' : topic.advanced }, learning_path: learningPath(level) }
}
export function lessonCatalog(): { id: string; title: string }[] { return topics.map(({ id, title }) => ({ id, title })) }
