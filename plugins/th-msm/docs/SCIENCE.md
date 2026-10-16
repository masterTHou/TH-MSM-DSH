# 非绝热 C1 引擎：物理约定与适用范围

## 当前实现

v1.3.0 是可运行的 C1 与解析模型基础版。Node.js ESM 核心可脱离 DSH 主机使用：`import { runSimulation, buildC1, validateRun } from '@th-msm/dsh-plugin/engine'`。

默认计算 FC 初始分布下的有限时域加权首达概率。没有平衡 π、没有从静态 CI 发射轨迹、没有在克隆时扰动动量。外部电子结构传播与 C2 吸收 MSM 尚未实现。WE 调度器和双 CI 模型是实验功能，不能据此宣布真实分子的效率提升。

## 单位、FC 分布与传播

内部 R、P、能量、质量、时间分别为 bohr、原子单位动量、Hartree、电子质量、原子时间；`time_fs = time_au * 0.024188843265857`。电子态编号为 0/1，复振幅为 `{re, im}`。

FC 使用声明的参考谐振子基态 Gaussian Wigner 分布：sigma_R=sqrt[1/(2m omega_FC)]，sigma_P=sqrt[m omega_FC/2]。垂直激发到上绝热态，核动量来自 Wigner 分布，非人为的 CI 发射速度。参考谐振子中心和频率属于初态分布定义，不要求等于激发态模型的平衡位置和频率。

核传播使用 velocity Verlet；电子振幅在固定 diabatic 基中用中点哈密顿量的解析 2×2 unitary 分子步传播，然后投影回绝热基。共同势 U 的全局电子相位省略，所有相对相位保留。NAC 使用同一解析基的导数，FSSH 的源态流出概率依赖 Re(c_i* c_j) v·d_ij / |c_i|²。概率超过 1 时在该步修改状态前拒绝，并将核步长减半重试，最小 dt/65536；不是截断概率。重试的模型调用也计入成本。

成功跳跃仅沿 NAC 方向重标定核动量，满足动能变化加绝热能隙为零。方向动能不足时拒绝跳跃，采用不反转速度的受挫跳跃约定。精确 CI 奇点直接报错，不静默正则化。概率自适应只解决概率上界，不能代替完整时间步收敛检验。

EDC 对非活性态使用 exp[-dt |DeltaE|/(1+C/K)] 阻尼，默认 C=0.1 Hartree，再保持活性振幅相位恢复归一化。K=0 时采用无限退相干时间的极限。不额外增加随机 collapse。FSSH 的随机决定驱动克隆分化；FSSH+EDC 仍为近似动力学。

## 两个不同的模型

标准 `createLVC()`：

```text
H = U I + [[a, b], [b, -a]]
U = m omega² (x²+y²)/2
a = kappa x; b = lambda y
```

只有一个孤立 CI，位于 (0,0)。

扩展 `createDualCI()`：

```text
U = m omega² x²/2 + m omega² (y+d)²/8 + tilt*y
a = kappa x; b = lambda (y²-d²)
```

两个 CI 位于 (0,±d)，+y 交叉漏斗的共同势更高。此模型具有非线性耦合，不称为标准 LVC。参数冻结后，稀有通道比例由真实传播产生，不设置固定随机分支。

解析测试中的 sink 是 `active_state=0` 且 `x > sinkX` 的首次通过边界，按照此时 y≤0/y>0 标记 main/rare。它们是明确声明的不可逆统计边界，谐振子模型本身没有真实解离渐近线。这些结果不能解释为真实分子的解离证据。真实分子适配器必须提供经过验证的产物定义与持久性准则。

## WE 与历史

固定物理时间间隔重采样。bin 按 active_state、最小能隙与几何进度分层；支持坐标分量、原子间距离、角度、预对齐 RMSD。CI-guided 另外细分 candidate 邻域，并提高该箱目标数；不改变势、速度或跃迁概率。

每次 split 深复制完整 walker：R/P/c/活性态、表面缓存、初始能量、反应历史；权重均分，使用 SHA-256 派生独立随机流。PRNG 保存 seed 和 counter，可确定性恢复。检查点可用于 `propagate` 恢复；完整 WE runner 的中断续跑接口尚未实现。

merge 配对后以权重比例选中一个完整历史，合并权重记录两个父节点与被选父节点。之后的产物历史统计对这个被重采样的路径赋合并权重；它是路径分布的随机重采样，不是将一条路径当作两个父路径都发生过。过去已发生的跃迁账本保持不变。

每轮断言存活权重 + 已吸收权重 = 1，误差 <1e-12；不会重归一化存活者，也不会 source recycling。

## C1 结果与置信区间

输入是带版本号的 run JSON：manifest/protocol、初态记录、事件账本、重采样谱系、存活 checkpoints、诊断与成本。默认只保存访问/跃迁/首达事件和末态，`recordFrames:true` 可额外保存所有传播帧。另支持 direct FC 轨迹的 JSONL 流式适配，首行为 `type:manifest`，包含 schema_version/mode=direct/initialization=FC/run_id/seed/protocol.fc/horizon_fs/observation_times_fs/exploration_es_calls，随后每行一个统一帧。它要求逐轨迹时间有序、固定权重和完整未吸收观察窗，拒绝把未完成轨迹计为存活到 T。WE 输入仍必须携带显式事件及重采样账本，不能从最终叶节点拼接重建。

`r_k(t)` 累加在 t 前首次进入 sink k 的事件权重。不能把最终叶节点的祖先事件重复累加。hop map 累加带方向的跃迁事件权重，另提供除以完整观测窗的加权事件频率；不是连续时间局域条件速率。

`C_candidate` 为候选输入，`C_reachable` 需访问证据，`C_reactive` 需该候选处真实 hop 及后续 sink 的完整路径证据。反应路径权重对每个 candidate/sink/吸收路径只加一次。

Bootstrap 单位是独立完整 runs，需要相同物理及采样 protocol、不同 run_id 和 seed。clone 不是独立样本。单个 run 的区间明确标记 insufficient_independent_runs；区间围绕多 run 平均值。只有少量独立 runs 时区间也可能不稳定。10,000 条直接参考使用二项 Wilson 区间，不称为精确真值。

## 成本与负向诊断

`CostLedger.electronicStructure(stage, provider, request)` 在调用前计数，失败/重试亦计；探索、初始化和传播都必须经过这个入口。当前没有外部 provider，所有实验真实 `total_es_calls=0`。解析模型另外记录 model_evaluations，不能以 0/0 宣称 ES 加速。

公开 benchmark 保存每次完整实验的实际解析成本，比较样本方差、相对方差、对有限参考的 RMSE 及 cost×variance。没有观测到效率改善就输出 NO_EFFICIENCY_ADVANTAGE。初期开发探针的解析调用未全量留档，故不提供包含开发调参的端到端解析加速倍数。

`evaluateEqualBudget` 可验证外部提供的、预先声明且具有相同正 ES 成本和时间窗的完整独立 trials；无法比较时返回 NOT_COMPARABLE，不丢弃预算超限或未完成 runs。当前 runner 没有实现严格预算下的停止/资源分配，公开 toy benchmark 不声称是相同 ES 预算实验。普通误差阈值也不提供可随意重复查看的统计停止保证。

## 验证边界与后续任务

现有测试包括解析力/NAC 的有限差分、动量重标定能量守恒、受挫跃迁、电子范数与 EDC、WE 权重和 merge 概率、谱系首达去重、检查点恢复、平滑短路径时间步能漂收敛、实际 DSH schema 和工具闭环。

仍需：跨 CI 的产率时间步收敛、独立实现对照、真实 ES 适配器、产物渐近判据、完整 checkpoint runner 恢复、大规模 WE 流式 IO、带吸收态 C2 与 transient ITS/CK、严格预算调度。C1 不需要马尔可夫假设，但不能修复底层近似传播器的物理偏差。

方法依据：Tully (1990), DOI 10.1063/1.459170；Granucci & Persico (2007), DOI 10.1063/1.2715585；Zhang, Jasnow & Zuckerman (2010), DOI 10.1063/1.3306345；Plasser et al. (2019), DOI 10.1039/C8CP05662E。实现公式与本文约定均公开，需进一步独立验证。
