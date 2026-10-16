# 经典 MSM：从数据到可解释结果

## 先跑一个可手算的例子

在 DSH 说：“我是新手，带我跑第一个 MSM。”工具 `th_msm_example` 生成 12 条独立两状态合成轨迹、保存数据、拟合模型并写出入门说明。源码用户运行 `npm run demo:msm`。

演示的真实转移矩阵为 [[0.9,0.1],[0.2,0.8]]，解析稳态为 (2/3,1/3)，慢时间尺度为 −1/ln(0.7)≈2.804 步，MFPT 0→1 为 10 步。它是合成 Markov 链，不是分子轨迹。

## 使用自己的数据

离散数据格式见 examples/msm/discrete.json；预提取特征格式见 examples/msm/features.json。这两个短文件是格式模板，不是充分采样的科研 benchmark。

每条轨迹单独保存，声明 `frame_time` 和 `time_unit`（steps/fs/ps/ns），以及来源 `origin`（unbiased-md 或 synthetic-markov）。禁止将 WE 权重数据或光解吸收历史伪装为经典无偏 MD；这类路径使用非绝热 C1。

特征 JSON 保存每帧数值向量。用户需要事先处理长度/角度尺度与周期性；二面角通常用 sin/cos 编码。当前不直接读取 XTC/DCD、不实现 tICA/VAMP。原始分子轨迹需用相应外部分析工具先提取特征。

```js
th_msm_build({trajectoryPath:'data/classical.json'}) // 自动识别数据类型
th_msm_analyze({modelPath:'output/msm/model.json', targetState:1})
th_msm_validate({modelPath:'output/msm/model.json'})
th_msm_report({title:'我的 MSM 分析', modelPath:'output/msm/model.json', targetState:1})
```

API：

```ts
import { buildClassicalModel, mfptToState, validateMSM } from '@th-msm/dsh-plugin/msm'
const model = buildClassicalModel(dataset, { lagFrames: 2, nClusters: 8 })
const passage = mfptToState(model, 1)
const checks = validateMSM(model)
```

## 数值与验证约定

采用滑动滞后计数 C_ij，逐行归一化得到无详细平衡约束的最大似然估计 P。不会跨轨迹计数、补造零行、静默删除不连通状态。当前 dense 实现限制 2–128 个状态，适用于基础建模与教学；大规模模型需要进一步扩展后端。

默认有至少 4 条轨迹时，将最后 floor(N/4) 条完整轨迹留出。KMeans++ 初始化与拟合只使用训练特征，验证数据不参与中心拟合。输入顺序可能含批次差异：用户应按实验设计预先组织代表性的训练/验证组，不应按验证结果反复挑选划分。较低层 `fitMSM` 允许显式提供独立 validationTrajectories。

ITS 对多个 lag 独立重建模型并计算非稳态谱；负/复特征值标记为振荡，单位模非稳态模式不伪造有限衰减时间。慢模时间尺度跨至少三个 lag 的相对极差 <30% 是当前启发式标记，不能代替完整误差分析与谱模跟踪。

CK 对照训练 P(τ)^k 与留出轨迹在 kτ 的经验条件概率。计算各源态支持计数加权、对目标态平均的 RMSE；默认每行至少 20 个计数且 RMSE≤0.1。阈值公开、不是统计显著性检验。缺失源态支持、没有独立留出集或部分 lag 不可估计时明确给出 INSUFFICIENT_DATA。

稳态分布通过线性方程求解并检查残差；唯一稳态不保证周期链从任意初态收敛。MFPT 解 (I−P_TT)m=1，并乘实际 lag 时间。它是模型在离散 lag 观测下的首达时间，不自动等于真实连续动力学的精确速率。

基础模型的 π 是模型长期布居；光解首达产率仍用 C1。没有可逆 MLE、贝叶斯后验、PCCA+、经典 TPT 或 π/MFPT Bootstrap 区间，不暗示这些功能已实现。点估计的小数位不代表统计精度。

## 学习与对话

内置 12 个主题：MSM、特征与微态、转移计数、lag、ITS、CK、稳态、MFPT、tICA/VAMP、TPT、WE 和 C1。入门/研究生/专家层分别强调例子、公式实操、假设与误差。每次教学提供练习、误区与下一步提问。

`th_msm_guide` 每轮给 1–3 个相关问题，记住当前 DSH session 已给的目标、文件与水平；换目标清理不相干数据，`reset:true` 清除记忆。这个记忆在进程内，应用重启后不保证保留。它不会重复确认已授权的可逆操作；信息齐全时交给具体工具执行。

## 方法来源

- [Prinz et al. (2011), Markov models of molecular kinetics: Generation and validation](https://doi.org/10.1063/1.3565032)
- [deeptime MSM 文档](https://deeptime-ml.github.io/latest/index_msm.html)
- [deeptime ITS 示例](https://deeptime-ml.github.io/latest/out/examples/plot_implied_timescales.html)

这些文献支持方法背景；本版是自己的基础实现，不宣称复现 deeptime 的全部估计器或验证体系。
