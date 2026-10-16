# TH-MSM 软件使用手册

**Trajectory Hub for Markov State Modeling (TH-MSM)**

马尔可夫态建模轨迹工作台 · 适用版本：**v1.7.0** · 宿主：**Codex / DeepSeek Harness（DSH）**

**TH = Trajectory Hub；MSM = Markov State Modeling。**

这份手册面向第一次接触插件的使用者，也提供熟悉 MSM 的研究人员需要的参数、输入格式和复现说明。不要求先记住工具名称。最短路线是：**安装 → 选定项目目录 → 复制第 4 章提示词 → 检查生成文件 → 阅读结果**。

> 本文中的“提示词”输入在 Codex 或 DSH 的**聊天输入框**；标有 `sh` / `powershell` 的命令输入在**终端**；JSON 示例是**文件内容或工具调用参数**。这三种内容不要放错位置。聊天回复由宿主 AI 组织，措辞可能不同；成功与否以真实工具返回和保存文件为准。

## 阅读导航

| 你现在的情况 | 从这里开始 |
|---|---|
| 完全不知道插件能做什么 | [1. 功能与边界](#capabilities) |
| 还没安装，或不知道安装成功没有 | [2. 安装与检查](#installation) |
| 没有数据，想马上体验 | [4. 第一个完整模型](#first-model) |
| 想学 MSM、ITS、CK、MFPT 等概念 | [5. 学习模式](#learning) |
| 已有自己的轨迹或特征 | [6. 用自己的数据建模](#own-data) |
| 已经有模型，想解读或出报告 | [7. 分析与验证](#analysis) |
| 想了解非绝热 C1/WE | [8. 非绝热演示](#nonadiabatic) |
| 只想复制一句话开始 | [9. 提示词库](#prompts) |
| 想明确指定工具参数 | [10. 工具与参数速查](#tools) |
| 不知道结果文件在哪里 | [11. 文件与交付](#files) |
| 遇到错误或验证不通过 | [12. 故障排查](#troubleshooting) |
| 需要复现、源码 API 或外部命令接入 | [13. 高级使用](#advanced) |
| 不理解术语，或需要提问模板 | [14. 术语表](#glossary)、[15. 求助与验收](#support) |
| 想生成独立脚本或自动完成经典 MSM | [16. 环境检查、脚本与自动化](#workflows) |

---

<a id="capabilities"></a>
## 1. 插件能做什么，不能做什么

### 1.1 选择你的任务

| 任务 | 当前可以得到什么 | 最简单的开场白 |
|---|---|---|
| 学习 | 12 个主题的分层解释、公式、例子、练习和误区 | “我是新手，用两状态例子解释 MSM。” |
| 无数据体验 | 可复现合成轨迹、真实 MSM、验证结果和入门说明 | “没有数据，带我跑第一个模型。” |
| 经典 MSM 建模 | 离散轨迹计数，或预提取特征的 KMeans 分箱；转移矩阵、稳态布居、谱 | “用我的 JSON 轨迹建立基础 MSM。” |
| 结果分析 | 布居、慢时间尺度、到指定目标态的 MFPT、模型验证 | “解释这个模型，并计算到状态 1 的 MFPT。” |
| 报告 | 从真实模型或非绝热 run 生成 Markdown 报告 | “保存一份带单位和验证限制的报告。” |
| 方案设计 | 根据体系和目标给出方法建议 | “帮我设计建模流程，并区分内置功能和外部步骤。” |
| 文献检索 | 内置文献目录的关键词检索，支持部分中文关键词映射 | “查找 MSM 验证与 CK 的文献条目。” |
| 非绝热研究演示 | 解析 FC → FSSH+EDC → Direct/WE/CI-WE → C1 首达与跃迁统计 | “先跑小规模解析非绝热示例，再解释结果。” |
| 可复现脚本 | 自带运行核心的 JS 脚本、配置、许可与使用说明 | “生成 MSM 脚本，先不要执行。” |
| 原生全流程自动化 | 自检、建模、分析、验证、报告、阶段日志 | “环境可用后自动完成我的经典 MSM。” |

**经典 MSM 建模和非绝热 C1 是不同流程。** 平衡或长期转换问题通常看经典 MSM；有限时间内光化学通道的吸收概率看 C1。无法判断时说：“先帮我判断应该用经典 MSM 还是 C1，并解释理由。”

### 1.2 两个宿主有什么不同

| 项目 | Codex | DSH |
|---|---|---|
| 科学核心、模型文件格式 | 相同 | 相同 |
| 常用科学工具 | 13 个本地 MCP 工具 | 同样的 13 个工具 |
| 额外外部命令代理 | 不提供 | 另有 `th_msm`，需自行注册命令及配置沙箱 |
| 项目目录 | 文件工具显式指定 `workspaceRoot` | 使用当前 DSH 会话的工作目录 |
| 经典/解析模型是否需要 Python | 不需要 | 不需要 |

Codex 工具名称可能带 MCP 前缀，插件显示名是 **Trajectory Hub for Markov State Modeling (TH-MSM)**。用户说“TH-MSM”即可，不必输入完整英文名称。

### 1.3 这些功能目前没有实现

- 直接导入 XTC/DCD/PDB 拓扑并自动完成分子特征提取；需要外部工具准备特征。
- 内置 tICA/VAMP 拟合、可逆 MLE、PCCA+、经典 TPT 或贝叶斯 MSM。**能讲解这些概念，不表示能执行这些算法。**
- 经典 MSM 的布居/MFPT Bootstrap 置信区间。
- 非绝热吸收态 C2、真实分子外部电子结构传播、已接通的 AutoREST 适配器。
- 完整 WE runner 中断续跑、严格等 ES 预算的资源调度、已验证的普遍加速比。
- 自动从任意 CSV、pickle 或其他软件的模型文件识别并迁移全部语义。

内置非绝热模型是解析测试台，不是特定真实分子的量化模拟。所有功能都应按实际返回值判断，不能把方案建议当成已执行的计算。

<a id="installation"></a>
## 2. 安装、更新与确认可用

### 2.1 Codex：第一次安装

1. 准备支持本地插件的 Codex，确认终端中的 `codex` 命令可用。
2. 准备 Node.js **22 或更高版本**，并确保 Codex 启动的进程能找到 `node`。
3. 在终端执行下面四行。前两行仅查看版本；后两行安装插件。

```sh
codex --version
node --version
codex plugin marketplace add masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM --ref v1.6.0
codex plugin add th-msm@th-msm-plugins
```

4. 重新打开 Codex 或新建对话，选择 TH-MSM 插件。
5. 在聊天输入框发送下面的安装检查提示词。

```text
请检查 TH-MSM 是否已加载。实际调用它的环境检查工具，再用入门级教学工具解释 MSM。
告诉我哪些步骤实际成功了。如果工具未加载，请明确说明，不要用普通聊天回复代替插件调用成功。
```

**通过标准：**环境检查返回实际数值自检、Node/系统信息，教学工具返回概念解释；不是仅收到一句“已准备好”。Python 默认不检查，可选择 checkPython=true 测量导入；量化软件不在本次检查范围。独立脚本能否运行须看 readiness.standalone_node/workflow，不只看 env.ok。

本插件在本地运行，不需要 DSH、Python、Jev Key 或额外 AI API Key。Codex 本身的登录及使用条件由宿主决定。GitHub 分发版目前不等于已上架 OpenAI 公共插件目录。

### 2.2 DSH：第一次安装

1. 打开 [GitHub Releases](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM/releases)。
2. 下载 **`th-msm-dsh-plugin-1.6.0.tgz`**，不要选 Codex 的 `.tar.gz`。
3. 在 DSH 插件管理面板安装此文件。
4. 保存工作后完全退出并重新打开 DSH。
5. 在新的问答会话中发送上面的“安装检查提示词”。

DSH 主机需要提供插件声明的 Cordis、dsh-tools 和 schemastery 依赖。插件自己的数值依赖已随 `.tgz` 打包。安装成功不代表 Python、Gaussian、SHARC 或其他外部程序已经接通。

### 2.3 已安装旧版，怎样更新

**DSH：**下载新 `.tgz`，用插件面板更新，随后重开客户端。

**Codex：**若原 marketplace 跟踪某个固定 tag，例如 v1.5.1，单纯刷新它不会自动切换到 v1.5.2。需要将 TH-MSM 的来源重新登记到新 tag：

```sh
codex plugin marketplace remove th-msm-plugins
codex plugin marketplace add masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM --ref v1.6.0
codex plugin add th-msm@th-msm-plugins
```

这里只修改 **TH-MSM 的 marketplace 来源**，不要移除其他 marketplace。完成后新开对话并重新检查。已有的项目数据保存在用户项目目录中；安装缓存不是项目数据目录。

若团队选择跟踪 `main`，可用 `codex plugin marketplace upgrade th-msm-plugins` 刷新来源，再用 `codex plugin add` 安装该来源提供的版本。科研复现更适合记录固定版本。

<a id="workspace"></a>
## 3. 准备项目目录：数据应该放在哪里

### 3.1 什么是“工作区”

工作区就是**这次任务使用的项目文件夹**，例如 `D:/research/my-msm`。输入数据和输出结果都以它为边界。不是插件安装目录，也不是随便一个下载文件夹。

建议每个客户或课题使用独立目录：

```text
my-msm-project/
  data/                 自己的数据
  output/               模型、模拟记录与报告
  notes/                参数选择与研究笔记，可自行创建
```

这些目录不是全部必须预先存在；工具会创建需要的输出子目录。**项目根目录本身必须已存在。**

### 3.2 零基础用户创建一个空项目

Windows 用户可在 PowerShell 执行：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE/Documents/TH-MSM-Demo"
(Resolve-Path "$env:USERPROFILE/Documents/TH-MSM-Demo").Path
```

macOS/Linux 用户可在终端执行：

```sh
mkdir -p ~/Documents/TH-MSM-Demo
cd ~/Documents/TH-MSM-Demo
pwd
```

复制最后显示的完整目录。在 Codex 中打开该目录作为项目，或在 DSH 中把会话工作目录设为该目录。不同宿主版本的菜单位置可能不同；在开始计算前让助手复述实际绝对路径。

### 3.3 路径怎么写

| 写法 | 含义 |
|---|---|
| `D:/research/my-msm` | Windows 绝对项目路径；需要是真实存在的目录 |
| `/home/alice/research/my-msm` | Linux 绝对项目路径示例 |
| `data/classical.json` | 项目目录内的相对文件 |
| `output/first-msm/model.json` | 项目目录内的输出文件 |

在聊天里写 Windows 路径时，使用 `/` 比较方便。在 JSON 字符串里也推荐 `/`；如果写反斜杠，必须写成 `\\`，例如 `"C:\\Users\\alice\\project"`。

`../other-project/data.json` 之类的越界路径会被拒绝。外部数据先复制到选定项目的 `data/`，或明确切换项目根目录；不要要求助手绕过边界检查。

<a id="first-model"></a>
## 4. 第一次使用：没有任何数据，也能跑完整流程

**目标：**生成合成数据 → 建立 MSM → 解释结果 → 验证 → 保存报告。

### 4.1 第一步：整段复制到聊天框

先完成上一章，打开一个新的空项目。然后发送：

```text
我要使用 TH-MSM，第一次接触 MSM，暂时没有数据。
请先确认当前项目的绝对路径和插件工具是否可用。
然后使用默认两状态演示，seed 使用 msm-example，输出目录使用 output/first-msm。
这个目录若已有结果，请先另选一个新的输出目录并告诉我实际路径。
请实际生成数据和模型，解释转移矩阵、两态布居和到状态 1 的 MFPT，检查 ITS/CK，
最后保存一份标题为“我的第一个 MSM”的 Markdown 报告。
每一步说明正在做什么；信息不足时每轮只问我 1–3 个问题。
完成后列出实际文件路径和验证结论，不要把演示解释成真实分子模拟。
```

如果助手询问“先学习还是直接演示”，回答：

```text
直接运行演示，再用适合新手的语言解释。使用你刚确认的项目目录。
```

如果当前宿主没有打开项目，把你的完整目录告诉它，例如：“我的项目目录是 C:/Users/alice/Documents/TH-MSM-Demo。”**这里的 alice 必须换成你的真实用户名，或直接粘贴上一章打印的路径。**

### 4.2 第二步：检查真实文件

默认示例由 `th_msm_example` 完成数据生成和建模。它会生成 12 条、每条 2000 帧的两状态合成轨迹；默认将 3 条完整轨迹留出验证。若你按上面指定目录，主要文件应为：

```text
output/first-msm/
  trajectories.json     合成输入数据
  model.json            已经建立好的 MSM
  START-HERE.md         入门说明与解析参考
```

另请助手将正式报告保存到 `output/first-msm/report.md`。如果它采用其他路径，以工具实际返回的 `reportPath` 为准。

**注意：`model.json` 已经是模型，不需要再把它当轨迹送入 build。** 重新建模应读取 `trajectories.json`；分析和验证读取 `model.json`。

### 4.3 第三步：核对你看到的数值

默认种子 `msm-example` 的实测结果如下。这些数字是程序计算结果，不是要求助手照抄的“答案”。

| 指标 | 数据生成过程的解析参考 | 默认演示估计 |
|---|---:|---:|
| 状态 0 的长期布居 | 66.67% | 约 66.13% |
| 状态 1 的长期布居 | 33.33% | 约 33.87% |
| 从状态 0 首次到状态 1 的平均等待 | 10 steps | 约 9.824 steps |
| 验证 | 已知合成 Markov 链 | `SUPPORTED_AT_TESTED_LAGS` |

这里的 `steps` 是合成链的时间单位，**不是 fs 或 ps**。改变 seed、数据、lag 或验证划分后，估计值可以不同；同一版本、同一种子和参数用于复现。

参考转移矩阵是 `[[0.9, 0.1], [0.2, 0.8]]`。每一行表示从一个状态出发，一个 lag 之后去往各状态的概率，行和为 1。状态 0 不是天然的反应物、状态 1 也不是天然的产物；它们只是这个例子的标签。

### 4.4 第四步：继续提问

任选一句：

```text
为什么两个状态的长期布居不是各占一半？用这个模型的真实转移概率解释。
```

```text
请读取刚生成的 model.json，用生活中的例子解释 MFPT、慢时间尺度、ITS 和 CK 的区别。
```

```text
请把报告保存为 output/first-msm/report.md，并列出这次结果能支持什么、还不能支持什么。
```

**完成标准：**文件真实存在，报告引用实际数值和时间单位，并明确这是合成演示。只有一段概念介绍，还没有完成本教程。

<a id="learning"></a>
## 5. 学习模式：不会术语也能问

### 5.1 三种学习水平

| 你的情况 | 直接这样说 | 工具中的 level |
|---|---|---|
| 第一次学 MSM | “用直觉、两状态例子和一个小练习讲解。” | `undergraduate` |
| 已学概率和线性代数 | “给公式、参数含义和实际操作顺序。” | `graduate` |
| 已有科研经验 | “重点讨论假设、误差、验证和失效条件。” | `expert` |

无需在聊天框输入英文枚举；说“入门级 / 研究生级 / 专家级”即可。直接传工具参数时才使用表中的英文值，**不要传 `beginner`**。

### 5.2 内置 12 个主题

| 主题 | 可复制的问题 | concept |
|---|---|---|
| MSM | “MSM 到底在统计什么？” | `msm` |
| 特征与微态 | “怎样把轨迹变成状态？” | `features` |
| 转移计数 | “为什么不能把多条轨迹接起来计数？” | `counts` |
| 滞后时间 | “lag 应该怎么选，单位是什么？” | `lag` |
| 隐含时间尺度 | “ITS 图应该看什么？” | `its` |
| CK | “用两状态例子解释 CK 检验。” | `ck` |
| 稳态布居 | “稳态分布和直方图有什么区别？” | `stationary` |
| MFPT | “第一次到达和平均停留时间有什么区别？” | `mfpt` |
| WE | “分裂更多轨迹为什么不能直接按条数算概率？” | `we` |
| C1 | “加权首达概率怎样处理未反应轨迹？” | `c1` |
| tICA/VAMP | “解释原理，并明确哪些步骤需要外部软件。” | `tica` |
| TPT | “解释承诺概率和反应通量，说明当前执行边界。” | `tpt` |

综合学习提示词：

```text
请作为 TH-MSM 入门老师，按 MSM → 状态与计数 → lag → 稳态 → MFPT → ITS/CK 的顺序带我学习。
一次讲一个主题：先讲直觉，再讲一个能手算的例子，最后给一道练习。
等我回答后再解释答案。不要一次输出整门课程。
```

### 5.3 检索文献

```text
请用 TH-MSM 的内置知识库查找 CK 和 MSM 验证相关条目，最多 5 条，
给出标题、作者、年份和可用的来源信息。区分关键词检索结果与已阅读全文的结论。
```

这是**内置目录的离线检索**，不是实时网络文献搜索；相关度是关键词匹配分数，不是论文质量评分或科学结论置信度。没有找到条目不表示不存在相关文献。

<a id="own-data"></a>
## 6. 用自己的数据建立经典 MSM

### 6.1 先判断你的文件是哪一类

| 手里的数据 | 下一步 |
|---|---|
| 每条轨迹的离散状态序列 | 按 6.2 包装成 JSON |
| 每条轨迹、每帧的数值特征向量 | 按 6.3 包装成 JSON |
| XTC/DCD 与拓扑、PDB、GRO 等 | 先外部提取特征；本插件不直接完成此步骤 |
| CSV / TSV | 先确认列含义、轨迹边界和采样间隔，再转换；没有一键通用导入器 |
| 已建立的 TH-MSM `model.json` | 跳到第 7 章，直接分析 |
| WE 带权路径或光化学首达记录 | 不要伪装成普通无偏 MD；走 C1 流程 |

### 6.2 离散轨迹 JSON

保存为项目内的 `data/classical.json`：

```json
{
  "kind": "classical-trajectories",
  "origin": "synthetic-markov",
  "frame_time": 0.1,
  "time_unit": "ps",
  "trajectories": [
    [0, 0, 1, 1, 0, 0, 0, 1, 0, 0],
    [1, 1, 0, 0, 1, 1, 0, 1, 0, 0],
    [0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
    [1, 0, 0, 1, 0, 0, 1, 0, 0, 1]
  ]
}
```

**这是人工短序列格式示例，不是充分采样的科研数据。** 它可以用于理解输入；验证可能返回数据不足或 Markov 假设不受支持，不能当作可信科研模型。想体验通过验证的默认演示，请使用第 4 章。

| 字段 | 怎样填写 |
|---|---|
| `kind` | 离散序列固定为 `classical-trajectories` |
| `origin` | 真实无偏经典 MD 填 `unbiased-md`；合成 Markov 链填 `synthetic-markov`。必须如实填写 |
| `frame_time` | 相邻保存帧的实际间隔，正数；不是默认等于积分步长 |
| `time_unit` | `steps`、`fs`、`ps`、`ns` 四选一 |
| `trajectories` | 外层数组中每个内层数组是一条独立轨迹，每个整数是一帧状态标签 |

状态标签是非负安全整数，不要求从 0 连续编号。每条轨迹至少两帧，可长短不同。文件必须采用统一的帧间隔和时间单位；不规则采样需要先处理。不要跨轨迹拼接、填入 NaN/null、把表头当数据，或把采样权重忽略掉。

### 6.3 预提取特征 JSON

保存为 `data/features.json`：

```json
{
  "kind": "classical-features",
  "origin": "synthetic-markov",
  "frame_time": 0.1,
  "time_unit": "ps",
  "feature_trajectories": [
    [[1.0, 0.1], [1.1, 0.2], [2.1, 0.8], [2.0, 0.9], [1.0, 0.1], [2.0, 0.8]],
    [[2.0, 0.8], [1.0, 0.2], [1.1, 0.1], [2.1, 0.9], [1.0, 0.1], [1.1, 0.2]],
    [[1.1, 0.2], [2.0, 0.8], [2.1, 0.9], [1.0, 0.1], [2.0, 0.9], [1.0, 0.2]],
    [[2.1, 0.9], [1.0, 0.1], [2.0, 0.8], [1.1, 0.2], [2.0, 0.9], [1.0, 0.2]]
  ]
}
```

同样是人工短例子；真实 MD 要换成自己的特征并填写真实来源。这里每帧有两个特征，**所有帧维数必须相同、数值必须有限**。对这个很短的格式示例，明确指定 `nClusters=2`；默认的 8 类不适合拿它直接演示稳定建模。

特征可以是已提取的距离、角度、接触量等。特征的物理单位和量纲由使用者定义，当前工具不会自动消除尺度差异。周期性角度可先考虑 sin/cos 编码。归一化或特征学习应避免泄漏验证数据；模型的 KMeans 中心只在训练轨迹上拟合。

### 6.4 复制这个提示词，用自己的文件建模

```text
请使用 TH-MSM 建立经典 MSM。
先确认当前项目绝对路径，输入是 data/classical.json。
请检查 kind、origin、轨迹边界、帧间隔和时间单位，不要把多条轨迹连接起来。
使用 lagTime=1、holdoutFraction=0.25，模型保存为 output/my-msm/model.json。
实际完成建模后，解释状态标签与矩阵行列的对应关系，检查 ITS/CK，
计算到目标标签 1 的 MFPT，并将报告保存为 output/my-msm/report.md。
如果输入不符合经典 MSM 的前提或验证不支持，请明确说明原因，不要强行给出成功结论。
```

特征数据把输入改为 `data/features.json`，并加一句：“使用 `nClusters=2`”；自己的真实大数据应根据科学问题选择状态数，不应机械照抄 2。

### 6.5 参数选择的最低常识

- `lagTime` 是**保存帧数**。若 `frame_time=0.1 ps`，则 `lagTime=5` 对应 `0.5 ps`。
- 构建工具默认 `lagTime=1`；ITS 通常还尝试 2 倍、3 倍的 lag。大 lag 不自动更正确，也会减少计数。
- 至少有 4 条轨迹时，默认最后 `floor(N×0.25)` 条完整轨迹留出；3 条或更少默认没有独立留出集。
- `holdoutFraction` 范围为 `[0, 0.5)`。设成 0 不代表“数据更好”，而是没有这一路独立验证。
- 当前基础 dense 模型支持 **2–128 个观测状态**。特征聚类默认 8 类，只适用于足够数据与适当特征。
- 不支持静默删掉不连通状态或给没有出边的状态补造一行概率。失败时回到数据、分箱与科学定义。

输入的轨迹排序会影响哪些轨迹被留出；应在建模前制定代表性的划分策略，而不是为获得“通过”反复挑选验证组。

<a id="analysis"></a>
## 7. 已有模型：分析、验证与生成报告

### 7.1 不要把文件放错工具

| 你要做什么 | 应提供的文件 |
|---|---|
| 经典 MSM 构建 | `classical-trajectories` / `classical-features` 输入 JSON |
| 经典 MSM 分析、验证、报告 | 已保存的 `kind=classical-msm` 模型 JSON |
| C1 构建 | 原始非绝热 `run.json`，或符合条件的 direct JSONL |
| 非绝热分析、验证、报告 | **原始 run JSON**；不能拿 C1 统计摘要冒充 run |

目前分析/验证/报告工具不是所有外部文件格式的通用读取器。若助手不确定，先读文件的 `kind` / `schema_version`，再选择工具。

### 7.2 只分析，不重新建模

```text
我已有 TH-MSM 模型 output/my-msm/model.json。
请读取并分析它，不要重新建立或覆盖模型。
解释布居、慢时间尺度和验证结论，计算到目标状态标签 1 的 MFPT。
保留文件中的真实时间单位，说明点估计与不确定性的区别。
```

`targetState=1` 指的是**标签 1**，不是“矩阵的第二行”在所有输入中的通用代称。输入标签若是 2、5、9，要指定实际存在的目标标签。报告中的 `labels` 决定矩阵索引与标签的对应关系。

### 7.3 验证结论怎样读

| 结论 | 含义 | 你应该做什么 |
|---|---|---|
| `SUPPORTED_AT_TESTED_LAGS` | 当前数据与所检验 lag 的诊断支持模型 | 阅读误差边界，结合特征和科学问题判断；不是证明模型完全正确 |
| `INSUFFICIENT_DATA` | 留出数据、状态转移或多个 lag 支持不足 | 增加独立采样，检查稀有状态和划分；不要把“不足”改写成“通过” |
| `MARKOV_ASSUMPTION_UNSUPPORTED` | 至少一个现有诊断不支持 Markov 假设 | 检查特征、离散化、lag、非平稳性和采样；重新设计后再验证 |
| `INVALID_MODEL` | 保存模型的矩阵、谱、计数或结构不一致 | 回到原始输入重新建立，不要手动改几个数伪装修复 |
| `INVALID_INPUT` | 文件路径或输入结构不适用 | 核对传入文件类型、路径和内容 |

构建结果 `ok=true` 表示模型计算并保存成功，**不等于科学验证通过**。验证的 `ok=false` 也可能是诚实报告数据不足，而非软件崩溃。

当前 ITS 是多个 lag 的启发式收敛诊断；默认最慢衰减时间在至少三个 lag 的相对极差 <30% 才标为稳定。CK 使用独立留出轨迹，默认每个源态至少 20 个计数，误差容忍度为 0.1。它们不是显著性检验，也没有自动生成科研级置信区间或图像文件。

### 7.4 报告应该包含什么

```text
请基于 output/my-msm/model.json 生成一份标题为“我的动力学分析”的报告，
保存到 output/my-msm/report.md，目标态标签为 1。
先总结关键数值，再列验证结论、时间单位和限制；不要生成未计算的置信区间或不存在的图。
```

现有报告是 Markdown 文本。可用文本编辑器或 Markdown 阅读器打开 `.md`；不能把文件扩展名改成 `.pdf` 或 `.docx` 当作格式转换。内置报告目前不生成图像；如需图、PDF 或 Word，可让宿主使用额外工具另行处理，并确认实际生成了文件。

<a id="nonadiabatic"></a>
## 8. 非绝热 C1/WE：先用解析测试台理解流程

### 8.1 第一个非绝热示例

复制到聊天框：

```text
请在当前项目中用 TH-MSM 跑一个解析非绝热示例。
使用 mode=direct、model=lvc、seed=tutorial-lvc-01、nTrajectories=32、steps=1100、dt=0.5。
将原始 run 保存为 output/lvc-demo/run.json。
随后用这个 run 建立 Mode C1，保存到 output/lvc-demo/c1.json。
验证原始 run，并从原始 run 生成报告 output/lvc-demo/report.md。
解释各通道首达概率、未吸收质量、跃迁统计、能量漂移和计算成本。
明确说明它是解析模型，不是我的真实分子的解离计算，也不要宣布算力加速。
```

**单位特别重要：**这里 `dt=0.5` 是原子时间单位，**不是 0.5 fs**。总观察窗约为 `1100×0.5×0.0241888433 = 13.304 fs`。

以上参数在本版计算核中的实测结果：main 首达概率 `0.4375`，rare 首达概率 `0.46875`，未吸收质量 `0.09375`，三者之和为 1；最大能量漂移约 `1.0074×10^-5 Hartree`；`total_es_calls=0`；验证为 `C1_CHECKS_PASS`。

这些数值用于检查操作和复现，不是预设分支概率。**单 CI LVC 例子的 `rare` 只是通道名称；这里的 46.875% 显然不是稀有的 1%–3% 通道。** `dual-ci` 是另一种非线性双交叉模型，默认参数也不承诺固定产率；不能通过改标签制造“稀有通道”。

### 8.2 三种采样模式

| mode | 做什么 | 不会做什么 |
|---|---|---|
| `direct` | FC 分布启动独立轨迹 | 不从静态 CI 无动量发射 |
| `we` | 按进度箱进行加权分裂与合并 | 不把每条最终轨迹当等权独立样本 |
| `ci-we` | 在候选交叉区域附近调整分箱/采样分配 | 不改变真实势、动量、跃迁概率或科学权重规则 |

WE 克隆保留完整动力学状态，使用独立随机流继续传播；默认 EDC 是确定性的能量退相干修正，不是额外随机坍缩。C1 用事件历史计算加权首达和跃迁统计，不能由最后剩下几条轨迹的条数比例代替。

### 8.3 C1 的输出怎么解释

- `r_k(t)`：到时间 t 为止首次进入通道 k 的加权概率质量。
- `surviving_weight`：截至观察窗末端还没有首次进入 sink 的质量；不能随意删掉或归一化掉。
- Hopping Flux Map：带方向的加权跃迁事件分布；不是已证明的连续时间局域条件速率。
- `C_candidate`：外部或模型提供的候选交叉区。
- `C_reachable`：有轨迹访问证据的候选区。
- `C_reactive`：有真实跃迁并随后到达 sink 的完整路径证据。
- `model_evaluations`：解析模型调用成本；`total_es_calls` 是电子结构调用数。解析测试里后者为 0，不能用 0/0 得到“加速比”。

这些 sink 是人为规定的首达边界，不是谐振子势面上的真实分子解离渐近线。`C1_CHECKS_PASS` 只说明现有内部检查通过，仍需时间步收敛和独立物理验证。C1 免 Markov 假设，不代表底层 FSSH+EDC 没有近似。

非绝热验证中 `ITS_and_CK: not_run` 是 C2 未实现的预期说明，不会单独使 C1 检查失败；不能据此在经典 MSM 流程中忽略 CK 失败。

### 8.4 为什么只有一次运行没有置信区间

单次 run 通常返回 `insufficient_independent_runs`。需要同一物理与采样 protocol、不同 seed/run_id 的**完整独立重复运行**。同一 WE run 中的克隆不能当作独立重复。

```text
请使用相同的 lvc、direct、32 条初始轨迹、1100 步、dt=0.5 参数，
分别用 tutorial-lvc-01、tutorial-lvc-02、tutorial-lvc-03 三个不同种子完成三个独立 runs，
保存到 output/lvc-repeat/run-01.json、run-02.json、run-03.json。
以 run-01 为 trajectoryPath，另外两个完整 runs 为 bootstrapPaths，nBootstraps=200，
用 C1 构建工具保存 output/lvc-repeat/c1-bootstrap.json。
解释区间围绕多 run 平均值，而不是把单个 run 的点估计硬套入区间。
只有三个 runs 仅用于流程演示，请说明区间仍可能不稳定。
```

不要混用 direct/WE/CI-WE、不同时间窗或不同物理参数的 runs 来凑 Bootstrap。`nBootstraps=200` 也不是“已经做了 200 次独立动力学模拟”。

当前非绝热报告会从原始 run 重新计算单 run 统计，不会自动读取 `c1-bootstrap.json` 里的多 run 区间。需要含区间的交付时，让助手另外读取该 C1 文件并注明来源，不能声称标准报告已自动合并区间。

### 8.5 交互限制

工具默认 `64` 条初始轨迹、`800` 步、`dt=0.5`、`mode=direct`、`model=lvc`、`seed=run-1`。交互接口限制初始轨迹数不超过 1000、步数不超过 10000；这不是后续 WE walker 总数上限。先跑小实验，再安排更大基准。

`resampleEvery`、箱宽、candidate、EDC 参数等可以在源码核心配置，但**当前聊天采样工具并未暴露这些参数**。不要让助手把未暴露参数当作已经生效。

<a id="prompts"></a>
## 9. 提示词库：按目标复制，不必自己组织术语

### 9.1 通用模板

```text
我想用 TH-MSM 完成【目标】。
项目目录是【真实绝对路径，或请先确认当前项目】。
输入文件是【项目内相对路径；没有数据就写“没有数据”】。
我目前是【新手/熟悉 MSM/专家】，希望结果解释到【直觉/公式/验证与误差】层次。
输出保存到【新的 output 子目录】。
请先判断适用流程，实际调用工具，完成后列出文件、关键数值、单位、验证结论和限制。
缺少必要信息时每轮问 1–3 个问题；已提供的信息不要重复询问。
```

将 `【……】` 替换成自己的内容，不要原样发送占位符。描述清楚目标、数据路径和输出位置，比堆砌很多专业词更有用。

### 9.2 新手：我连自己要做什么都不知道

```text
我刚开始接触分子动力学分析，也不知道 MSM 是否适合我的问题。
请用 TH-MSM 向导，每轮给我不超过三个容易回答的问题和示例答案。
先判断我更适合学概念、运行演示，还是准备自己的数据。
```

### 9.3 高手：已有参数，直接执行

```text
使用 TH-MSM 对 data/features.json 建经典 MSM：lagTime=5、nClusters=8、holdoutFraction=0.25。
先核对 frame_time、time_unit 与特征维数，确认这是无偏经典数据。
输出 output/lag5-k8/model.json，计算到目标标签 3 的 MFPT，
保存 output/lag5-k8/report.md。若目标标签 3 不存在，请返回实际标签，不要替我猜目标。
保留完整验证结论；不要执行未实现的 tICA、PCCA 或 TPT。
```

其中参数仅是模板；必须确认真实数据足以支持 8 个状态，且目标标签有科学含义。

### 9.4 我只有 XTC/DCD

```text
我有原始 XTC/DCD 和拓扑文件，知道 TH-MSM 不能直接读取。
请先帮我明确需要提取哪些物理特征、轨迹边界、保存间隔和时间单位，
给出外部预处理计划与目标 JSON 格式，区分“准备计划”和“已经执行”。
在看到实际特征文件前不要声称 MSM 已建好。
```

### 9.5 给客户看结果

```text
请读取 output/my-msm/model.json，并保存一份基于实际数值的报告。
先用三句话回答业务/科研问题，再解释数值、单位、ITS/CK 和限制。
不能确定的结论单独列出。最后给三个客户可以继续问的问题。
```

### 9.6 比较 lag，而不是只找“最好看”的结果

```text
请在同一份 data/classical.json 上分别用 lagTime=1、2、5 建立模型，保持其余设置相同，
分别保存到 output/lag1、output/lag2、output/lag5。
比较实际 lag 时间、采样支持、慢时间尺度和验证结论。
不要只选择“通过”的一个，也不要把不同参数结果覆盖到同一个文件。
```

### 9.7 数据不足或 CK 失败

```text
请依据这个模型的实际诊断解释失败原因。
区分采样不足、状态定义不当、lag 不合适和文件错误。
给我按优先级排列的下一步，但不要通过删掉坏结果、放宽阈值或伪造转移来“修成通过”。
```

### 9.8 对比 Direct、WE 和 CI-WE

```text
请先帮我设计一个可证伪的 Direct/WE/CI-WE 对比方案：
相同物理模型、初态分布、观察时间与数值步长，各方法做多次完整独立重复，记录真实成本。
先做小规模流程检查；没有足够重复和可比预算时，不宣布效率优势。
如果只比较了不同解析成本，请明确不能称为同 ES 预算加速比。
```

这是实验设计入口，不是一个已经实现的全自动严格预算优化器。更多高级调用见第 13 章。

<a id="tools"></a>
## 10. 工具和参数速查：给熟悉软件接口的使用者

### 10.1 自然语言与 JSON 参数的关系

聊天时发送“请分析 output/my-msm/model.json”，由助手选择工具。下面的 JSON 是**工具参数示例，不是终端命令**；没有必要把 JSON 单独贴在聊天框期待它自行执行。

Codex 的所有文件操作需要 `workspaceRoot`；DSH 从会话取得目录。Codex 的向导可额外使用不同对话独有的 `conversationId` 记忆答案，省略时按无记忆方式调用。`th_msm_guide` 的 `reset=true` 清理该会话向导记忆，不删除项目文件。

### 10.2 13 个共享工具

| 工具 | 必填/主要参数 | 结果与默认行为 |
|---|---|---|
| `th_msm_env` | 可选 `trajectoryPath`、`outputDir`、`checkPython` | 数值核心、原生 Node、项目/输入/输出；可选 Python 导入；不检查 ES provider |
| `th_msm_guide` | `goal`、`dataPath`、`modelPath`、`dataFormat`、`level`、`topic`、`experience`、`reset` 均按需 | 补问问题、记忆与下一步；不自动保证后续任务已完成 |
| `th_msm_example` | 可选 `outputDir`、`seed` | 默认 `output/msm-demo`、`msm-example`；一次完成合成数据与模型 |
| `th_msm_build` | 建模通常需 `trajectoryPath`；可选 `mode`、`outputPath`、`lagTime`、`nClusters`、`holdoutFraction` | `mode=auto` 识别 MSM/C1；默认 MSM 输出 `output/msm/model.json`，C1 输出 `output/c1.json` |
| `th_msm_analyze` | **`modelPath`**；可选 `targetState` | 读经典模型或非绝热原始 run；结果通常在工具返回中，不自动保存新的分析文件 |
| `th_msm_validate` | **`modelPath`**；可选 `energyTolerance` | 经典或非绝热诊断；默认能漂容忍度 `1e-4 Hartree`，只用于非绝热 |
| `th_msm_report` | **`title`、`modelPath`**；可选 `outputPath`、`targetState` | 默认经典报告 `output/reports/msm_report.md`，非绝热 `output/reports/c1_report.md` |
| `th_msm_sample` | 可选 `mode`、`model`、`seed`、`nTrajectories`、`steps`、`dt`、`outputPath` | 解析模拟；默认保存 `output/run.json`，其余默认值见 8.5 |
| `th_msm_teach` | **`concept`**；可选 `level` | 概念讲解、练习和后续问题；默认 `undergraduate` |
| `th_msm_knowledge` | 可选 `query`、`topic`、`level`、`maxResults` | 关键词检索；默认最多 10 条；空查询提示补充关键词 |
| `th_msm_plan` | **`systemType`、`researchGoal`**；可选 `nAtoms`、`trajectoryLength`、`nTrajectories`、`temperature`、`dynamicsType` | 方法计划与限制，不是执行日志 |
| `th_msm_script` | 可选 `mode=example/msm`、`trajectoryPath`、`scriptDir`、`outputDir`、`lagTime`、`nClusters`、`holdoutFraction`、`targetState`、`seed` | 生成独立脚本，不执行；目录默认唯一；自己的数据需要 trajectoryPath |
| `th_msm_run` | 同 script；或只给 `workflowPath` | 自检后用固定运行核心完成经典流程；已有配置不得与内联参数混用 |

参数名区分大小写。应传数字 `5`，不要传字符串 `"5 ps"` 给 `lagTime`；真实单位在输入数据里声明。

### 10.3 常用枚举和值

| 参数 | 可用值 |
|---|---|
| guide.goal | `learn` / `classical-msm` / `nonadiabatic-c1` / `unsure` |
| guide.dataFormat | `discrete` / `features` / `xtc-dcd` / `run-json` / `none` |
| guide.experience | `guided` / `expert` |
| level | `undergraduate` / `graduate` / `expert` |
| build.mode | `auto` / `msm` / `c1`；`c2` 未实现，`index` 是另一路索引功能，Codex 版禁用 |
| sample.mode | `direct` / `we` / `ci-we` |
| sample.model | `lvc` / `dual-ci` |
| plan.systemType | `protein` / `peptide` / `small-molecule` / `material` / `solution` / `other` |
| plan.researchGoal | `kinetics` / `conformational-change` / `binding` / `reaction` / `electronic-properties` / `photochemistry` |
| plan.dynamicsType | `classical` / `nonadiabatic` |
| knowledge.topic | 目录主题，如 `theory`、`dim-reduction`、`clustering`、`msm-construction`、`validation`、`enhanced-sampling`、`deep-msm`、`applications` |

`trajectoryLength` 是方案描述字符串，如 `10 μs`；它不会替代数据文件的采样间隔。`temperature` 是计划上下文，不会自动改变已有轨迹或解析模型温度。

### 10.4 一组 Codex 工具参数示例

以下 `D:/research/my-msm` 必须换成自己的真实目录；每个 JSON 对应不同工具：

**build：**

```json
{
  "workspaceRoot": "D:/research/my-msm",
  "mode": "msm",
  "trajectoryPath": "data/classical.json",
  "lagTime": 1,
  "holdoutFraction": 0.25,
  "outputPath": "output/my-msm/model.json"
}
```

**analyze：**

```json
{
  "workspaceRoot": "D:/research/my-msm",
  "modelPath": "output/my-msm/model.json",
  "targetState": 1
}
```

**report：**

```json
{
  "workspaceRoot": "D:/research/my-msm",
  "title": "我的 MSM 分析",
  "modelPath": "output/my-msm/model.json",
  "targetState": 1,
  "outputPath": "output/my-msm/report.md"
}
```

C1 构建另可指定 `bootstrapPaths`（其他独立完整 run 的相对路径数组）和 `nBootstraps`（默认 200）。**经典 MSM 不支持这些 Bootstrap 参数**，不要套用。

<a id="files"></a>
## 11. 文件管理、结果交付和跨宿主使用

### 11.1 结果在哪里

工具实际返回的 `dataPath`、`modelPath`、`outputPath`、`reportPath` 是查找文件的依据。路径可能以绝对形式返回。让助手列出它们，而不是凭聊天文字猜测。

| 文件 | 保存的内容 | 如何使用 |
|---|---|---|
| `trajectories.json` | 输入序列、来源、时间定义 | 重新建模 |
| 经典 `model.json` | 标签、计数、矩阵、布居、谱、验证、provenance | 分析、验证、出报告 |
| 非绝热 `run.json` | protocol、初态、事件历史、重采样、诊断、成本 | 建 C1、验证与报告 |
| `c1.json` | 首达曲线、跃迁统计、候选/可达/反应证据、区间状态 | 阅读与进一步汇总；不是可恢复全部动力学的原始 run |
| `START-HERE.md` | 示例说明和参考答案 | 第一次使用先阅读 |
| `report.md` | 真实结果的可读总结 | 查看、交付或另行转换格式 |

原有单步工具的默认文件名会被下一次同路径运行覆盖；新端到端工作流拒绝复用已有输出目录。**每次参数比较使用不同子目录**，如 `output/lag1-k8`、`output/lag2-k8`。没有内置的结果版本库或自动备份，不要依靠聊天历史替代数据存档。

### 11.2 换电脑、换宿主、交付客户

复制项目中所需的 `data/`、`output/` 和方法说明。另一台电脑安装插件后，重新指定实际项目根目录。DSH 与 Codex 可以读取同一科学文件格式；绝对路径需要按新环境调整。

不要把原项目目录里的一个绝对文件名当成模型不可迁移的证据。复制文件后，向助手提供新项目内的相对路径即可。

建议交付：输入数据或其可获取来源、模型/run、报告、软件版本、参数、种子、单位、数据来源与验证限制。涉及客户数据时由你决定共享范围，不要把真实客户轨迹直接上传到公开 issue。

<a id="troubleshooting"></a>
## 12. 故障排查：看到什么，下一步做什么

| 现象或错误 | 常见原因 | 下一步 |
|---|---|---|
| 终端提示找不到 `codex` | CLI 不在 PATH 或未安装 | 先配置 Codex CLI，再运行安装命令；不是 JSON 数据问题 |
| 找不到 `node` / MCP 启动失败 | Codex 进程找不到合适 Node | 在启动客户端的环境检查 Node ≥22；安装后重开客户端 |
| marketplace already added from a different source | 改名后仍登记旧 URL | 按 2.3 仅重新登记 `th-msm-plugins` 来源 |
| 安装后聊天里没有工具 | 当前对话尚未刷新或未选择插件 | 新开对话选择插件；仍不见再重开客户端，先跑安装检查 |
| DSH `failed to import` | 主机汇总了加载异常 | 使用当前版本重装、重启，并保留它前面的原始异常；不能仅凭汇总句判断根因 |
| `WORKSPACE_REQUIRED` | 没有项目目录 | Codex 指定绝对 workspaceRoot；DSH 设置会话工作目录 |
| `workspaceRoot must be an absolute directory path` | 使用相对项目路径 | 用真实绝对目录，而不是 `.` 或 `data` |
| `workspaceRoot differs from configured TH_MSM_WORKSPACE` | 服务被固定到另一个项目 | 选择服务允许的项目，或由管理者调整配置；不要绕过 |
| `ENOENT` / 文件读不到 | 路径错误、目录不存在、文件未保存 | 核对实际根目录与相对文件路径；检查是否误用示例用户名 |
| `path escapes workspace` | `../` 或符号链接指向项目外 | 把文件复制到项目内，或明确切换工作区 |
| `INVALID_ARGS` / missing required property | 参数名、类型或枚举错误 | 参照第 10 章；例如 teach 需要 concept，level 不接受 beginner |
| JSON parse / unexpected token | JSON 语法错误 | 去掉注释/尾随逗号；字符串用双引号；Windows 反斜杠需转义 |
| `explicit classical dataset kind/origin/frame_time/time_unit required` | 输入缺元数据或不是经典输入 | 按第 6 章准备；不要改 origin 来伪装有偏或光化学数据 |
| `no outgoing observations` | lag 太大或稀有态没有足够出边 | 检查采样、lag 与有物理依据的状态定义；不补造概率 |
| `disconnected` / 不连通 | 状态之间缺少支持转换 | 增加采样或重新审查分箱，不静默删掉不方便的状态 |
| `state unseen in training` | 留出组有训练中从未出现的状态 | 检查划分的代表性与采样；不要只为通过而挑验证数据 |
| `more clusters than distinct feature points` | 聚类数超过不同特征点数 | 检查特征内容；有依据地减少 nClusters |
| `INSUFFICIENT_DATA` | 验证支持不足 | 看具体诊断，不把它简单当程序故障 |
| `MARKOV_ASSUMPTION_UNSUPPORTED` | 当前模型不受诊断支持 | 按 7.3 和 9.7 分析；报告保留负向结论 |
| MFPT 目标标签错误 | 指定的标签不在模型里 | 读取 labels，指定真实目标；不要混淆标签与索引 |
| `interactive run limit exceeded` | 交互运行规模超限 | 先缩小规模；更大的基准走源码流程 |
| C1 无置信区间 | 只有一个独立 run | 按 8.4 做多个完整独立重复 |
| `NOT_IMPLEMENTED` / c2 | 请求了未实现流程 | 使用现有 C1，或外部独立实现；不伪造吸收 MSM |
| Codex `build mode=index is not supported` | 调用了可选向量索引 | 当前用 th_msm_knowledge 的离线关键词检索 |
| 能漂 `FAIL` / FSSH 概率溢出 | 步长或传播支持不合适 | 研究较小 dt、同观察窗的收敛，不直接放宽容忍度冒充物理正确 |
| `ABORTED` / timeout | 用户取消或工具耗时过长 | 查是否有完整结果；减少规模后重新运行，不把部分任务当成功 |
| 同一个问题被反复问 | 新对话、重启或 guide 记忆未关联 | 一次给出目标、目录、数据路径与已知参数；记忆不保证跨重启 |

**最有效的求助提示词：**

```text
请先不要修改我的原始数据。这里是实际错误：[粘贴原始错误]。
我用的是 [Codex/DSH]，插件版本 [版本]，项目目录 [路径]，输入 [文件]，参数 [设置]。
请区分安装、文件格式、参数和科学验证问题，先给最小检查步骤。
```

<a id="advanced"></a>
## 13. 高级使用、复现和外部命令

### 13.1 软件版本与复现记录

建议保留：插件版本、Git commit/tag、Node 版本、输入文件及来源、帧间隔、时间单位、参数、seed、训练/验证划分和实际诊断。相同 seed 不代替独立重复；独立重复需要不同随机流。

`model.provenance.data_digest` 帮助识别输入内容；它不是外部数据真实性的证明。C1 的 run_id/protocol、成本和事件历史应与摘要一起保存。

改变 dt 做时间步收敛时，保持观察时间 `steps×dt` 一致，并在独立重复的基础上比较物理量。例如把 dt 减半时需要相应增加 steps；交互接口的步数上限仍然适用。

### 13.2 源码方式运行

以下命令在仓库根目录终端执行，不是在聊天框：

```sh
git clone https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM.git
cd Trajectory-Hub-for-Markov-State-Modeling-TH-MSM
git checkout v1.6.0
npm ci --ignore-scripts
npm run demo:msm
npm run demo
```

经典演示默认位于 `output/msm-demo/`；解析非绝热源码演示位于 `output/demo/`，包含 run、analysis 和 validation JSON。源码演示参数与第 8 章聊天示例不同，不应要求两者数值完全相同。

开发验证：`npm run check`、`npm test`。`npm run pack:codex` 构建独立 Codex 包；`npm pack --pack-destination dist` 构建 DSH 包。

`npm run benchmark` 与 `npm run benchmark:full` 是源码基准流程，后者规模更大；先阅读 [科学约定](SCIENCE.md) 与仓库 `benchmarks/` 说明，再安排运行。这些命令不是所有终端都已预装的系统命令，必须在准备好依赖的仓库内执行。

### 13.3 JS/TypeScript 核心 API

源码构建完成后，可从 `lib/msm/index.js`、`lib/engine.js` 导入；以 npm 包形式安装了本项目时，可用包导出 `@th-msm/dsh-plugin/msm` 和 `@th-msm/dsh-plugin/engine`。只安装 Codex 插件不意味着这些 npm 包导入已注册到你的项目。

```js
import { readFile } from 'node:fs/promises'
import { buildClassicalModel, mfptToState, validateMSM } from './lib/msm/index.js'

const dataset = JSON.parse(await readFile('data/classical.json', 'utf8'))
const model = buildClassicalModel(dataset, { lagFrames: 2, holdoutFraction: 0.25 })
console.log(validateMSM(model))
console.log(mfptToState(model, 1))
```

这段代码的文件假定放在已构建仓库的根目录，以 `.mjs` 运行。**聊天工具参数是 `lagTime`，核心 API 参数是 `lagFrames`。** 较低层 API 还可以配置 `itsLags`、`ckMultiples`、独立 validationTrajectories 等；请以导出的类型声明和源码为准，不把它们直接塞进聊天工具。

### 13.4 DSH 专用外部命令代理

这是已有独立程序的接入层，不是自动安装 pyEMMA/deeptime/量化软件。Codex 插件没有这个工具。

工作区 `.th-msm/registry.json` 的结构：

```json
{
  "version": 1,
  "msms": [
    {
      "name": "my_analysis",
      "command": "node scripts/registered-analysis.mjs",
      "description": "运行我自行准备的分析程序",
      "usage": "程序通过标准输入读取 json-stdin-v1 请求"
    }
  ]
}
```

`scripts/registered-analysis.mjs` 必须由你实际准备，并能读取一行 JSON 标准输入，例如 `{"protocol":"json-stdin-v1","msm":"my_analysis","args":["--help"]}`。参数不是自动追加到命令行；不支持该协议的程序需要自己编写适配器。

先说：“请用 th_msm 对 my_analysis 做 inspect=true，只检查注册元数据。”确认程序和环境后再授权执行。默认需要可用的 DSH shell 沙箱与策略服务；环境错误应按主机诊断处理，不要把关闭沙箱作为新手默认做法。

### 13.5 不能从一句提示词得到的科学保证

“帮我做到无偏”“自动选最优 lag”“保证稀有通道精确”“节省 100 倍成本”都不是验证方法。需要预先定义的协议、独立重复、可比成本与诊断。插件可以帮助记录和检查，不能用语言承诺替代实验。

<a id="glossary"></a>
## 14. 术语表

| 术语 | 这里的简明含义 |
|---|---|
| 帧 frame | 按保存间隔记录的一次状态/特征观察 |
| 特征 feature | 从构型得到的数值，如距离或角度编码 |
| 微态 microstate | 对特征空间做离散划分得到的状态 |
| lag / τ | 统计转换时隔多少保存帧或多少物理时间 |
| 转移矩阵 P | 从各源态出发，一个 lag 后去各目标态的条件概率 |
| 稳态 π | 当前经典模型的长期状态占比；不是光解分支比 |
| ITS | 从不同 lag 的模型谱估计慢过程时间尺度并检查一致性 |
| CK | 比较模型多步预测与独立留出数据的条件转换 |
| MFPT | 从一个状态首次到指定目标态的平均等待时间 |
| FC | Franck–Condon 初始分布，本项目非绝热轨迹的起点 |
| FSSH | 随机表面跳跃近似传播方法 |
| EDC | 能量退相干修正；当前实现采用确定性阻尼 |
| WE | 以权重保留概率意义的轨迹分裂/合并采样 |
| CI | 锥形交叉；候选几何不等于可达或反应活性证据 |
| sink | 声明的不可逆首达统计边界 |
| C1 | 直接从加权轨迹历史计算首达和跃迁统计的流程 |
| C2 | 规划中的带吸收态 MSM 流程；本版未实现 |
| ES call | 电子结构计算调用；与解析模型求值分开计数 |
| Bootstrap | 对合适的独立样本单位重采样估计区间，不是复制相关克隆 |
| MCP | Codex 发现并调用本地科学工具的接口，不是动力学算法 |

<a id="support"></a>
## 15. 完成验收与求助

### 15.1 交付前自己检查这六件事

1. **文件：**输入、模型/run、报告确实存在，路径正确。
2. **来源：**合成示例、真实无偏经典 MD、非绝热路径没有混淆。
3. **单位：**帧间隔、lag、dt 和结果时间单位明确。
4. **结果：**数值来自真实文件，状态标签/通道定义说明清楚。
5. **验证：**报告包含通过、失败或数据不足的真实结论。
6. **边界：**没有虚构置信区间、已执行算法、产物证据或加速比。

### 15.2 提交问题时提供什么

在 [GitHub Issues](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM/issues) 中提供：

```text
宿主：Codex / DSH，以及宿主版本
插件版本：
操作系统与 Node 版本：
任务：学习 / 经典建模 / 分析 / 非绝热 / 安装
输入文件类型和必要元数据：
实际参数或操作步骤：
预期发生什么：
实际发生什么：
原始错误与错误前面的异常：
能否用第 4 章默认示例复现：
脱敏后的最小示例文件（如适合公开）：
```

完整原始异常比截图里的最后一句提示更有帮助；需要保密的数据不要公开提交。

<a id="workflows"></a>
## 16. 环境检查、独立脚本与全流程自动化

### 16.1 不懂代码：直接运行完整示例

```text
请用 TH-MSM 的 th_msm_run 跑完整经典 MSM 示例，mode=example。
先确认工作区和运行环境，再生成可复现脚本，完成建模、分析、ITS/CK 和报告。
scriptDir=output/tutorial-script，outputDir=output/tutorial-results，必须都是新目录。
每个阶段用新手能懂的话解释，列出真实文件和科学验证结论。
```

不指定目录时会自动选择唯一目录。输出有 model.json、analysis.json、validation.json、report.md、START-HERE.md、run-manifest.json 和 workflow.log.jsonl；示例模式另有 trajectories.json。

### 16.2 只要脚本，稍后自己执行

```text
请用 th_msm_script 根据 data/classical.json 生成脚本，mode=msm、lagTime=2，
scriptDir=output/script-01、outputDir=output/results-01。
检查环境并解释配置，现在只生成，不执行。
```

脚本目录包含 run.mjs、workflow.json、自带 runtime.mjs、版本/摘要与许可说明。打开该目录的 README.md 获取准确命令；在项目根目录终端运行：

```sh
node output/script-01/run.mjs
```

只需要原生 Node ≥22，不需要 npm、Codex 或 DSH。配置里的输入和输出建议使用项目相对路径，方便迁移。重复运行必须先把 workflow.json 中 outputDir 改成另一个尚不存在的新目录，不覆盖旧结果。

### 16.3 专家：自己的数据端到端执行

```text
请用 th_msm_run 处理 data/features.json，mode=msm、lagTime=5、nClusters=8、
holdoutFraction=0.25、targetState=3，scriptDir=output/lag5-script、outputDir=output/lag5-results。
自检通过后直接执行，保存全部结果与日志；科学诊断不支持时保留负向结论。
```

自己的数据不指定 targetState 时不会猜测目标；示例默认目标为 1。工作流仅支持经典离散/预提取特征 JSON，输入 ≤64 MiB、状态数 2–128。原始 XTC/DCD、Python 后端、tICA/VAMP、PCCA/TPT 执行尚未接通；非绝热继续使用第 8 章的工具。

### 16.4 怎样判断环境能直接运行

```text
请用 th_msm_env 检查当前项目、data/classical.json 和尚不存在的 output/check-results。
同时 checkPython=true 检查 Python 依赖，不安装任何软件。
解释哪些检查实际执行过、哪些能力仍未实现。
```

重点看 readiness.workflow，而不是只看 env.ok。诊断实际检查数值自检、PATH 原生 Node、项目写入/移除探针、JSON 可读性与输出路径。Python 默认不检查，选择后尝试实际导入常见依赖；包可导入不表示已实现 Python 工作流。ready 是前置条件满足，不是对任意数据运行成功的保证。

### 16.5 已有配置与运行状态

```text
请用 th_msm_run，workflowPath=output/script-01/workflow.json。
只使用这个配置，不附加另一套内联参数。
```

插件以当前安装版本的固定运行核心执行配置；终端 run.mjs 使用导出时携带的核心。跨版本精确复现请保留完整脚本包并记录核心版本。

| 状态 | 解释 |
|---|---|
| completed | 计算完成且当前诊断支持 |
| completed_with_limitations | 计算完成，但科学诊断不支持或数据不足；仍有真实报告 |
| blocked | 环境、输入或输出前置检查未通过 |
| failed / cancelled | 失败或取消，不能当成功 |

已有目录（包括空目录）会触发 OUTPUT_EXISTS；scriptDir/outputDir 不得重叠。受控运行默认限时 300 秒；超时明确返回失败，不支持完整中断恢复。不会执行任意用户/模型编写的命令，也不会自动安装依赖。

更详细的配置格式、环境字段、复现设计与后续路线见 [脚本与自动化指南](WORKFLOWS.md)。

---

[返回项目 README](../README.md) · [经典 MSM 技术说明](CLASSICAL-MSM.md) · [非绝热科学约定](SCIENCE.md) · [Codex 宿主说明](CODEX.md)


## 17. 交互网页：本科生也能读懂 MSM

v1.7.0 新增离线网页。完整操作步骤见 [网页使用手册](WEB-UI.md)。下载 Release 中的 `th-msm-web.html`，双击后打开两状态教学示例；无需安装运行环境。

已安装插件可说：“生成 MSM 交互网页并解释状态、lag、布居、MFPT 与验证结论。”工具 `th_msm_view` 可传 `modelPath` 和 `outputPath`；Codex 还需绝对 `workspaceRoot`。完整 `th_msm_run` 自动生成 `dashboard.html`。网页导入的是模型 JSON，不是轨迹输入。
