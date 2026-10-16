# 正丁烷分子全流程：从结构到 MSM 结果

适用版本：v1.8.0。读者：零基础、本科生，以及希望检查真实数据流的研究者。

## 先判断可行性

在内存有限的笔记本上，直接做大蛋白、溶剂盒或量化动力学会增加环境和采样成本。水没有适合本课的慢构象转换，乙烷三个交错构象等价。正丁烷的中央键能产生 trans、gauche+、gauche− 三个清晰的构象区域，适合讲解特征、状态、时间尺度和首达时间。

本课采用**四站点联合原子、孤立分子、显式力积分**。每个 CH₃ / CH₂ 基团作为一个站点，氢质量并入；不是四个裸碳，也不是全原子正丁烷。它展示真实的模型 MD 到 MSM 数据流，目标是教学，不给出实验正丁烷速率。

Python 负责 OpenMM 动力学、角特征与科学绘图；Node 调用项目已有 MSM 科学核心，保持网页、插件和教程只有一套估计器。没有另写一套看似一致的 Python MSM。

## 1. 最简单的体验方法：只打开网页

1. 下载 [最新 Release](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM/releases/latest) 的 `th-msm-web.html`。
2. 双击，用 Chrome / Edge / Firefox 打开。
3. 点击 **打开正丁烷分子全流程**。
4. 按顶部七个步骤依次看；拖动轨迹帧和视角，看中央键转动。
5. 点击“跳到可点击的三态模型”，检查概率、布居、MFPT 与验证。

这条路线不安装 Python，也不在后台跑 MD。网页内附本次发布的真实记录、图像、公式和运行清单。播放是保存帧回放；播放速度不代表物理速度。

## 2. 自己重跑：一次准备，六条命令

先下载仓库源码并解压，或 git clone。进入**仓库根目录**，能看到 package.json、tutorials 和 src。推荐打开 Anaconda Prompt 或已初始化 conda 的 PowerShell。

```sh
conda env create -f tutorials/butane/environment.yml
conda activate th-msm-tutorial
npm ci --ignore-scripts
npm run build
python tutorials/butane/run.py --output output/my-butane
node tutorials/butane/export-view.mjs output/my-butane
```

需要 Node ≥22。Conda 环境已经存在时跳过创建命令。安装失败时可使用等价的两步方式：

```sh
conda create -n th-msm-tutorial python=3.11 pip -c conda-forge --no-default-packages
conda run -n th-msm-tutorial python -m pip install -r tutorials/butane/requirements.txt
```

环境仅直接依赖 **OpenMM、NumPy、Matplotlib**，不需要 CUDA、深度学习、RDKit、MDAnalysis 或 Jupyter。创建独立环境，避免改坏其他科研项目的依赖。环境磁盘空间与安装下载不是程序峰值内存。

Python 脚本末尾已自动导出网页；上方最后一条 node 命令用于单独重新导出，可以省略。完成后双击 `output/my-butane/dashboard.html`。本次模型、六张图和保存帧一起嵌入网页；不会把你的新模型与旧发布记录混用。默认网页与 `th_msm_view` 的普通导出则附带发布参考记录。

输出目录必须全新。需要重跑时换 `output/my-butane-02`，程序不会删除旧结果。任一步失败都不能当作全流程成功；若 MSM 无法估计，保留原始数据、运行清单和 FAILURE.json。

## 3. 默认资源预算

| 项目 | 默认值 / 约束 |
|---|---|
| 动力学引擎 | OpenMM CPU，1 线程；无 CPU 平台时用 Reference |
| 站点 | 4，三个固定键长 |
| 温度 / 摩擦 | 300 K / 5 ps⁻¹ |
| 每条平衡 / 生产 | 20 ps 丢弃 / 200 ps 保留 |
| 独立轨迹 | 12；独立、非零随机种子 |
| 积分步长 / 保存间隔 | 2 fs / 0.1 ps |
| 总生产时间 | 2.4 ns |
| 训练 / 留出 | 9 / 3 条完整轨迹 |
| 默认 MSM lag | 2 ps，20 个保存间隔 |
| 硬预算 | ≤16 条、每条≤500 ps、总保存≤100000 帧、积分≤500 万步 |
| 时间止损 | MD 默认 180 秒；超时不返回成功的部分分析 |

时间与内存记录见 [发布运行清单](../examples/butane/manifest.json)。本机此次**单次正式运行**采样、建模及绘图约 51.33 s，Python 峰值工作集约 130.48 MiB；不含 Node 子进程、Conda 安装及系统缓存，也不是整个开发过程的总成本。换电脑、版本或平台，耗时和轨迹都可能不同。电子结构调用为 0，不能据此宣称量化计算加速比。

先查看已有记录，再决定是否增加采样。更长采样示例（仍单线程，可能耗时数分钟）：

```sh
python tutorials/butane/run.py --output output/butane-longer --duration-ps 500 --max-wall-seconds 300
```

不要为了获得“通过”结论更改默认阈值，也不要只挑最好看的一条轨迹。

## 4. 七步科学流程

### ① 建结构：一条四站点链

构建 CH₃–CH₂–CH₂–CH₃。站点质量分别为 15.035 / 14.027 / 14.027 / 15.035 Da。键长固定 0.153 nm；两个键角围绕 112.4° 波动。使用解析几何生成初始结构、能量最小化、Maxwell 速度，然后平衡并丢弃。

初始扭转角按目标扭转势的 Boltzmann 权重抽取，但随后最小化会改变分布，因此仍需平衡；“抽过一次平衡角”不等于整条轨迹已平衡。每条独立初始化，未从静态结构生成非绝热轨迹。

文件 `initial-conformers.xyz` 的帧 0/1/2 分别是理想 trans / gauche+ / gauche−；单位 Å，氢隐含在站点中。`system.xml` 保存真实 OpenMM 体系。

### ② 定势能：山谷与能垒

采用局部 OPLS-style 势能：

$$U_\theta=\tfrac12k_\theta(\theta-\theta_0)^2$$

$$U_\phi=\tfrac12[V_1(1+\cos\phi)+V_2(1-\cos2\phi)+V_3(1+\cos3\phi)]$$

键角力常数 126.0 kcal mol⁻¹ rad⁻²；V₁/V₂/V₃ 为 1.411 / −0.271 / 3.145 kcal/mol。代码统一转成 kJ/mol，角度以弧度进入公式。这些局部项来自公开 [PCCP 补充材料的表 2、3 与公式 1、2](https://www.rsc.org/suppdata/cp/b6/b601373b/b601373b.pdf)。本例没有超过所用约定排除范围的分子内非键对，也没有分子间相互作用；没有另加 1–4 Lennard-Jones 项去重复改变扭转地形。

这是明确列出的局部参数教学体系，不声称是经过完整验证的商业力场、液相正丁烷或该文献体系的复现。

![扭转势能](../examples/butane/figures/01-potential.png)

### ③ 采样：积分运动，而非抽取状态标签

$$\mathbf F=-\nabla U,\qquad m\,d\mathbf v=\mathbf Fdt-\gamma m\mathbf vdt+\sqrt{2\gamma mk_BT}\,d\mathbf W$$

势能力让分子沿地形运动，阻尼模拟热浴摩擦，随机项维持温度。使用 [OpenMM LangevinMiddleIntegrator](https://docs.openmm.org/latest/userguide/theory/04_integrators.html)；[CPU Threads 属性](https://docs.openmm.org/latest/userguide/library/04_platform_specifics.html) 固定为 1，避免占满笔记本。

恒温轨迹会与热浴交换能量，所以总能量不需逐帧恒定。额外两个 2 ps 的 NVE 短段分别使用 2 fs 与 1 fs，最大能量变化约 0.0219 与 0.0190 kJ/mol；原始值存入清单。这不是长时收敛证明，也不据此声称严格二阶误差收敛。

![实际 MD 轨迹](../examples/butane/figures/02-trajectory.png)

### ④ 特征与分箱：从坐标到状态序列

提取 C1–C2–C3–C4 的带符号周期二面角 φ：

| 状态 | 名称 | 规则 |
|---|---|---|
| 0 | trans | \|φ\|≥120° |
| 1 | gauche+ | 0°≤φ<120° |
| 2 | gauche− | −120°<φ<0° |

−180° 和 +180° 相邻，不应按普通直线距离处理。若改用聚类，可考虑 `(sinφ,cosφ)` 特征；本课直接使用物理分箱，未实现新的 tICA/PCCA 流程。

保存 `trajectory-data.npz`（全部坐标、角、能量与状态），`discrete-trajectories.json`（完整轨迹边界、ps 单位），以及第一条轨迹每 1 ps 的 `trajectory-00.xyz`。网页展示前 100 ps 的稀疏记录并进行刚体对齐，没有插值生成新轨迹。

### ⑤ MSM：从计数到条件概率

$$C_{ij}(\tau)=\sum_t\mathbf1[s_t=i,s_{t+\tau}=j],\qquad P_{ij}=C_{ij}/\sum_jC_{ij}$$

同一条轨迹内用滑动 lag 计数，绝不跨轨迹边界连接。前 9 条训练，末 3 条留出。这里的 2 ps lag 是问“2 ps 后在哪”，不是 2 fs 的积分步长。

使用项目现有非可逆行 MLE；没有人为加入伪计数、隐藏删除状态或把轨迹打乱成独立帧。产物 `model.json` 与普通 TH-MSM 工具完全相同。

![矩阵与布居](../examples/butane/figures/04-msm.png)

### ⑥ 验证：ITS 与 CK

$$t_i=-\tau/\ln|\lambda_i|,\qquad P(k\tau)\approx[P(\tau)]^k$$

预先指定 lag=2 ps；另输出 0.2/0.5/1/2/5 ps 的扫描，透明展示结果，不按是否通过选最漂亮的 lag。默认模型的 ITS 检查使用 τ/2τ/3τ；CK 在留出整条轨迹上比较 k=2、3。

![ITS 与 CK](../examples/butane/figures/05-validation.png)

科学结论为 `SUPPORTED_AT_TESTED_LAGS`，意味着在当前启发式 ITS 与 CK 设置下得到支持；不是马尔可夫性证明，也不是误差已足够小。

### ⑦ 分析：布居、衰减与 MFPT

$$\pi P=\pi,\quad\sum_i\pi_i=1;\qquad m_i=\tau+\sum_{j\ne B}P_{ij}m_j,\;m_B=0$$

π 回答长期偏好哪种构象；衰减时间描述初态记忆消失；MFPT 回答平均第一次到目标需多久。它们不能互相替代。

![MFPT](../examples/butane/figures/06-mfpt.png)

本次训练 MSM 布居约 75.39% / 13.53% / 11.08%；全部 MD 帧占比约 71.07% / 17.10% / 11.83%；同一扭转势的 Boltzmann 积分约 66.27% / 16.86% / 16.86%。最大布居偏差约 9.11 个百分点，两个 gauche 区的采样也不对称。**即使 ITS/CK 通过，短数据仍未证明平衡布居已充分收敛。**

![角分布与本模型平衡参考](../examples/butane/figures/03-distribution.png)

Boltzmann 曲线是本模型的平衡参考，不是有限温度真实正丁烷的实验真值；全体帧、训练模型及解析积分来源不同。保存帧高度相关，目前没有布居/MFPT 置信区间，不能把 24012 帧当作 24012 个独立样本。经典 π 不是光解分支比。

## 5. 结果文件与检查方法

| 文件 | 用途 |
|---|---|
| simulation.json、system.xml、integrator.xml | 参数、体系及积分器 |
| trajectory-data.npz | 全部 MD 坐标、能量、角与状态 |
| discrete-trajectories.json | 接入 TH-MSM 的真实离散轨迹 |
| model.json、analysis.json、lag-scan.json | 模型、验证/MFPT、lag 扫描 |
| manifest.json | 版本、种子、时间/内存、NVE、数据 SHA256、限制 |
| lesson.json、figures/ | 完整网页教学数据、六张独立图片及 SHA256 摘要 |
| dashboard.html | 导出后可分享的离线完整网页 |
| RESULTS.md、requirements-frozen.txt | 可阅读报告与实际依赖版本 |

发布参考数据在 `examples/butane/`；原始坐标 NPZ 随 Release 的参考数据 ZIP 分发，避免把较大的二进制重复塞进插件。固定种子便于追溯，但不保证不同 OpenMM 版本/平台逐位一致。

测试：

```sh
conda run -n th-msm-tutorial python -m unittest discover -s tutorials/butane -p test_model.py
npm test
```

测试覆盖解析势与 OpenMM 能量、有限差分力、周期角、几何约束、发布预览与坐标一致性，以及发布数据重建模型与自定义网页导出。

## 6. 在插件中怎么说

> 我是本科生，请打开正丁烷分子全流程网页，按建结构、势能、动力学、特征、MSM、验证、分析七步教学，每次讲一步，再问我一道小问题。

> 我已经生成 output/my-butane/lesson.json。请用 th_msm_view 的 lessonPath 参数生成对应的交互网页，核对它的模型与图像确实来自这次运行。

`th_msm_view` 增加可选 `lessonPath`；Codex 仍需用户选定的绝对 `workspaceRoot`。如果同时给 modelPath，必须与 lesson 内模型一致。普通网页导出不触发 Python 或安装依赖。重新运行 MD 需要在有源码的工作区明确执行上述 Python 脚本；当前未新增任意 Python 代码执行接口。
