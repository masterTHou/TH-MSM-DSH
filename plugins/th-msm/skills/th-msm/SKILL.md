---
name: th-msm
description: "Use for classical Markov state model building, MSM result analysis and teaching, or experimental nonadiabatic FC/FSSH/EDC/C1/WE workflows using TH-MSM local tools."
---

# Trajectory Hub for Markov State Modeling (TH-MSM)

TH = Trajectory Hub；MSM = Markov State Modeling。中文名称：马尔可夫态建模轨迹工作台。

用用户的语言交流。先用一句话复述科学目标；缺少关键输入时调用 `th_msm_guide`，每轮只问 1–3 个相关问题，给出选项和具体回答示例。已提供的信息不要重复询问；已授权的工作继续执行。

## 工作区与会话

所有文件工具必须传 `workspaceRoot`：用户当前项目的绝对目录。用宿主工具读取当前工作目录，并在必要时确认项目路径。插件目录只保存程序，不能当作用户项目。相对数据和输出路径均相对此工作区。文件访问会检查路径与符号链接边界。

给向导分配本对话独有的 `conversationId`（可用宿主会话 ID 或新 UUID），本对话后续调用复用该值。不要在不同对话之间复用。没有可靠 ID 时省略，向导以无记忆方式工作，结合对话已知信息传参。工作区、目标变化时重新核对相关数据；不要跨客户复制回答或数据。

## 三个入口

- **学习**：`th_msm_teach`，参数 `concept` 与可选 `level=undergraduate|graduate|expert`。知识检索用 `th_msm_knowledge`。先解释直觉，再给公式、手算例子和误区。
- **经典 MSM**：无数据可直接 `th_msm_example`，会保存演示数据、模型与入门说明。自己的离散轨迹或预提取特征用 `th_msm_build mode=msm`，再用 `th_msm_analyze`、`th_msm_validate`、`th_msm_report`。查看 JSON 里的真实结果，不猜数值。XTC/DCD 原始轨迹目前需先在外部提取特征。
- **非绝热研究**：`th_msm_sample` 从 FC 分布运行解析 FSSH+EDC，支持 `direct|we|ci-we`、`lvc|dual-ci`；再 `th_msm_build mode=c1`、验证与报告。`dt` 为原子时间单位，结果时间为 fs。成本中解析计算与电子结构调用分开计数。

使用工具发现返回的实际名称（宿主可能加 MCP 命名空间前缀），不要执行插件缓存里的命令来绕过工具失败。工具未加载时说明安装或重启步骤，不编造成功。

## 科学约束

轨迹必须从 FC 或保留完整 R/P/c/active state 的真实父轨迹继承。WE 分裂原样复制动力学状态，仅分配独立随机流；权重守恒。光化学报告首达概率和跃迁通量，不能把经典 MSM 的稳态布居当光解分支比。严格区分 C_candidate、C_reachable、C_reactive。计入全部 ES 调用，不宣传未经等预算验证的加速比。

验证失败如实解释。经典 MSM 尚无可逆 MLE、PCCA、TPT 或置信区间 Bootstrap；非绝热吸收 C2、外部电子结构传播尚未实现。解析 sink 只是人为首达边界，不代表真实分子解离。双通道模型并非严格线性 LVC；10,000 条直接轨迹的结果是有限样本参考估计。

需要方法细节时读取随包附带的 [科学约定](../../docs/SCIENCE.md) 与 [经典 MSM 数据与分析说明](../../docs/CLASSICAL-MSM.md)。

Codex 版提供 11 个本地科学工具，不提供 DSH 的外部命令代理 `th_msm`。外部量化软件的执行需要另外配置与授权。不要将本地 MCP 的路径检查描述为操作系统级沙箱。

Codex 版不支持 `th_msm_build mode=index` 或可选向量模型下载；离线文献检索使用内置的 `th_msm_knowledge` 关键词检索。

## 呈现结果

先回答科学问题，再给数值、单位、验证结论与不确定性。引用实际生成的文件。失败时指出原因和 1–2 个具体下一步。每次教学或分析后给 2–3 个自然语言后续提问，例如“为什么不是各占一半？”、“计算到状态 1 的 MFPT”、“CK 不通过该怎么改？”
