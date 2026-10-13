# TH-MSM DSH 插件 v1.1

> **热力学与动力学马尔可夫状态模型智能体**
> Transition Handler for Markov State Model Intelligence Agent
> DeepSeek Harness 插件 | deeptime 为主力 Python 库 | 向量语义搜索 (RAG)

---

## 概述

TH-MSM 是一个面向 DeepSeek Harness 的智能 Markov State Model (MSM) 科研助手插件。
它能从分子动力学轨迹中自动提取长时尺度动力学信息，打通从"教学"到"出报告"的完整科研流程。

### v1.1 亮点

| 特性 | 说明 |
|------|------|
| 🔍 **语义搜索** | 35 篇论文预构建向量，自然语言查询直接语义匹配，无需关键词 |
| 🧠 **deeptime 主力** | MSM 流水线全面采用 [deeptime](https://deeptime-ml.github.io)，scikit-learn 兼容 |
| 📦 **即装即用** | 下载 tgz → 上传 DSH → 立即可用，零配置 |

### 工作流程

```
用户输入 → Agent Loop（意图检测）
    ├── 教学模式    → "解释 MSM 概念" → th_msm_knowledge + th_msm_teach
    ├── 规划模式    → "帮我设计方案" → th_msm_plan →（用户确认）→ th_msm_build
    ├── 建模模式    → "构建 MSM"     → th_msm_build → th_msm（通用执行代理）
    ├── 验证模式    → "验证模型"     → th_msm_validate
    └── 报告模式    → "生成报告"     → th_msm_report
```

---

## 目录结构

```
th-msm-dsh-plugin/
├── README.md                    ← 本文件
├── plugin.json                  ← 插件元数据（DSH 清单）
├── package.json                 ← npm 包定义
├── cordis.patch.yml             ← DSH bundle 补丁，用于主机集成
├── ADR.md                       ← 架构决策记录
├── LICENSE                      ← MIT
├── .gitignore / .npmignore
├── src/
│   ├── index.js                 ← 插件入口：注册 7 个工具 + 钩子 + Agent Loop
│   ├── agent/
│   │   ├── hooks.js             ← 每轮调用计数 + 策略守卫
│   │   └── loop.js              ← MSM Agent Loop（意图检测 + 模式路由）
│   ├── tools/
│   │   ├── msm.js               ← th_msm：通用执行代理（安全边界）
│   │   ├── knowledge.js         ← th_msm_knowledge：查询知识库
│   │   ├── teach.js             ← th_msm_teach：MSM 概念教学
│   │   ├── plan.js              ← th_msm_plan：设计 MSM 方案
│   │   ├── build.js             ← th_msm_build：编排 MSM 构建流程
│   │   ├── validate.js          ← th_msm_validate：运行验证测试
│   │   └── report.js            ← th_msm_report：生成科研报告
│   ├── registry/
│   │   └── loader.js            ← Registry 加载与校验（防符号链接逃逸）
│   ├── runtime/
│   │   ├── executor.js          ← Shell 执行器（沙箱强制）
│   │   └── python.js            ← Python/MSM 运行时管理
│   ├── knowledge/
│   │   ├── loader.js            ← 知识库扫描
│   │   ├── catalog.js           ← CATALOG.md 解析器
│   │   ├── searcher.js          ← 全文搜索 + 相关性评分
│   │   └── context.js           ← 提示词上下文注入
│   └── util/
│       └── text.js              ← 智能文本截断（60/40 保留头尾）
├── test/
│   └── core.test.mjs            ← 安全测试 + 知识库测试
└── examples/
    └── workspace/
        ├── .th-msm/
        │   └── registry.json    ← 示例注册表（6 个 MSM 命令）
        └── tools/
            └── echo.mjs         ← 测试用 echo 工具
```

---

## 功能详解

### 7 个工具一览

| 工具名 | 功能 | 典型用法 |
|--------|------|----------|
| **`th_msm`** | 通用 MSM 执行代理（安全边界） | 通过 registry 白名单执行任意注册的 shell 命令，args 走 JSON stdin 绝不拼接 |
| **`th_msm_knowledge`** | 知识库查询 | "搜索 MSM 理论论文"，"找 tICA 相关文献"，"列出研究生级别的 dim-reduction 论文" |
| **`th_msm_teach`** | MSM 概念教学 | "解释 implied timescale"、"讲解 PCCA+"，自动适配本科/研究生/专家三档 |
| **`th_msm_plan`** | MSM 方案设计 | "为 500 原子蛋白设计 MSM 方案"——自动推荐 feature、降维方法、聚类、lag time |
| **`th_msm_build`** | MSM 自动构建 | 编排完整流水线：预处理→特征提取→降维→聚类→MSM 估计 |
| **`th_msm_validate`** | 模型验证 | 四重检验：ITS 收敛 + CK 检验 + 布居分析 + 稳定性 Bootstrap |
| **`th_msm_report`** | 科研报告生成 | 生成 9 段 Markdown 报告：目标→数据→方法→参数→验证→状态→动力学→限制→下一步 |

### 5 种 Agent 模式

| 模式 | 触发关键词 | 自动调用的工具 |
|------|-----------|---------------|
| 🎓 **教学** | "解释"、"什么是"、"概念"、"学习"、"入门" | th_msm_knowledge + th_msm_teach |
| 📐 **规划** | "设计"、"方案"、"protocol"、"怎么选" | th_msm_plan + th_msm_knowledge |
| 🤖 **建模** | "构建"、"运行"、"执行"、"跑 MSM" | th_msm_build + th_msm |
| ✅ **验证** | "验证"、"检查"、"ITS"、"CK 检验" | th_msm_validate |
| 📝 **报告** | "报告"、"总结"、"生成文档" | th_msm_report |

Agent 会**自动检测你的意图**，不需要手动指定模式。你只需用自然语言描述需求。

---

## 安全模型

这是从 v0.1.0 完整继承的核心设计，不可妥协：

1. **Registry 命令白名单**：只有 `.th-msm/registry.json` 中注册的 `command` 才能抵达 shell
2. **JSON stdin 协议**：模型提供的参数序列化为 JSON 写入 stdin，**绝不拼接**到 shell 命令中
3. **沙箱默认强制**：要求 `ctx.shell` 处于沙箱模式；拒绝 `danger-full-access`
4. **符号链接逃逸保护**：`loadRegistry` 同时检查词法路径和真实路径的 workspace 边界
5. **每轮调用上限**：`maxCallsPerTurn` 防止失控循环

---

## 实际使用示例

### 场景 1：初学者想了解 MSM

```
你：MSM 是什么？为什么用它研究蛋白质动力学？

Agent 自动检测 → 教学模式 → 调用 th_msm_knowledge 查综述
→ 调用 th_msm_teach 用本科级别语言解释
→ 给出直观含义 + 数学定义 + 实际应用 + 参考文献
```

### 场景 2：研究生想设计 MSM 方案

```
你：我有 10 μs 的 BPTI 轨迹，体系大约 900 原子，想研究构象变化。
    帮我设计一个 MSM 方案。

Agent 自动检测 → 规划模式 → 调用 th_msm_plan
→ 推荐 feature：骨架二面角 + Cα 距离
→ 推荐降维：tICA（因为 >500 原子）
→ 推荐聚类：K-Means ~90 个微态
→ 推荐 lag time：ITS 收敛自动确定
→ 警告：单条轨迹可能遗漏稀有事件
→ 等你确认后，进入建模模式
```

### 场景 3：想直接构建 MSM

```
你：构建 MSM：
    轨迹在 data/traj.xtc，拓扑在 data/system.pdb
    用 tICA 降维，K-Means 100 个聚类，lag time 自动确定

Agent 自动检测 → 建模模式 → 调用 th_msm_build
→ Step 1 环境检查：Python + deeptime 就绪
→ Step 2 预处理：加载轨迹和拓扑
→ Step 3 特征提取：二面角 + 距离
→ Step 4 TICA 降维：保留 95% 动力学方差
→ Step 5 K-Means 聚类：100 个微态
→ Step 6 MSM 估计：deeptime MaximumLikelihoodMSM
→ 模型保存到 output/models/msm_model.pkl
→ 提示下一步：运行 th_msm_validate 验证
```

### 场景 4：验证模型质量

```
你：验证刚才那个 MSM，跑全四样检验

Agent 自动检测 → 验证模式 → 调用 th_msm_validate
→ 隐含时间尺度分析（ITS）：检验 τ 收敛性
→ Chapman-Kolmogorov 检验：检验 Markov 性
→ 布居分析：对比 MSM 稳态分布 vs MD 采样
→ 稳定性 Bootstrap：50 次重采样评估鲁棒性
→ 给出 Pass/Fail/Uncertain 判定 + 不确定性说明
```

### 场景 5：生成科研报告

```
你：帮我生成 MSM 分析报告，标题"BPTI 构象动力学的 MSM 研究"

Agent 自动检测 → 报告模式 → 调用 th_msm_report
→ 生成 9 段完整 Markdown 报告
→ 包含：研究目标、数据描述、方法理由、MSM 参数、
         模型验证、主要状态、动力学解释、限制、下一步
→ 可选生成 ITS / CK / 布居图
→ 输出到 output/reports/msm_report.md
```

---

## 安装指南

### 方式 A：从 GitHub Release 安装（推荐）

> 适用于 DSH 插件管理面板一键安装

1. 打开 [Releases 页面](https://github.com/masterTHou/TH-MSM-DSH/releases)
2. 下载最新 `th-msm-dsh-plugin-x.y.z.tgz`
3. 在 DSH 的「插件管理」中上传 `.tgz` 文件
4. 插件自动注册到 DSH，无需手动编辑配置

DSH 会读取 `plugin.json` 和 `cordis.patch.yml` 完成注册，**即装即用**。

### 方式 B：从 npm 安装

```bash
npm install @th-msm/dsh-plugin
```

### 方式 C：从源码安装

```bash
git clone https://github.com/masterTHou/TH-MSM-DSH.git
cd TH-MSM-DSH
npm install
npm pack --pack-destination ./dist
# 然后在 DSH 中安装 dist/th-msm-dsh-plugin-x.y.z.tgz
```

---

## 3 分钟上手

### 第 1 步：安装插件

如果你用 Release 的 `.tgz`，在 DSH 插件管理面板上传即可。如果是手动配置，在 DSH 的配置中加入：

```yaml
# cordis.patch.yml
- insert:
    - id: th-msm
      name: '@th-msm/dsh-plugin'
      config:
        requireSandbox: true
        agentLoopEnabled: true
        pythonEnabled: true
```

插件会自动注册 7 个工具和 Agent Loop，无需额外配置。

### 第 2 步：配置工作区

在 workspace 下创建 `.th-msm/registry.json`：

```json
{
  "version": 1,
  "msms": [
    {
      "name": "msm_featurize",
      "command": "python ./tools/msm_featurize.py",
      "description": "从 MD 轨迹提取特征",
      "timeoutMs": 60000
    },
    {
      "name": "msm_estimate",
      "command": "python ./tools/msm_estimate.py",
      "description": "估计 Markov State Model",
      "timeoutMs": 60000
    }
  ]
}
```

### 第 3 步：填充知识库

把论文 PDF 放入 `knowledge/` 对应子目录，更新 `CATALOG.md`：

```yaml
- id: P001
  title: "Markov models of molecular kinetics"
  authors: "Prinz et al."
  journal: "J. Chem. Phys., 134, 174105 (2011)"
  keywords: ["MSM", "theory", "transition matrix"]
  level: [graduate, expert]
  topic: "theory"
  filename: "P001_prinz_msm_theory.pdf"
```

### 第 4 步：开始对话

直接用自然语言描述需求即可，Agent 自动识别意图并路由到正确工具。

---

## 科学原则

1. **不盲目生成模型** — 每一步方法选择必须给出理由
2. **目标不适合时明确告知** — MSM 不是万能工具，电子态转移等不适合的要指出来
3. **不隐藏不确定性** — 区分"数值正确"和"科学可信"
4. **一切可复现** — 所有分析步骤、参数、随机种子可追溯

---

## 依赖

| 类型 | 依赖 | 版本 |
|------|------|------|
| 运行时 | Node.js | ≥ 22 |
| DSH 主机 | `@deepseek-ai/cordis` | ≥ 4 < 5 |
| DSH 主机 | `@deepseek-ai/dsh-tools` | ≥ 0.2.0-rc.2 < 0.3 |
| DSH 主机 | `@deepseek-ai/schemastery` | ≥ 3.18 < 4 |
| 可选 | Python + deeptime | 主力 MSM 库 (推荐) |
| 可选 | Python + PyEMMA | 备选 MSM 库 |

---

## 运行测试

```bash
npm test
```

测试覆盖：
- 安全测试：registry 校验、路径逃逸防护、stdin 注入防护、沙箱策略、边界值
- 知识库测试：CATALOG.md 解析、全文搜索、topic/level 过滤、相关性排序

---

## 许可证

MIT

---

## 架构决策

详见 [ADR.md](./ADR.md) —— 记录了从 v0.1.0 继承了什么、新增了什么、每一步权衡的理由。

---

## 提示词示例

> 以下是经过验证的参考问法，Agent 会自动识别意图并路由到正确工具。

### 教学模式

```
"用研究生水平解释什么是隐含时间尺度（implied timescale）"
"PCCA+ 是什么？给我一个本科级别的解释"
"MSM 的 Chapman-Kolmogorov 检验原理是什么"
"tICA 和 PCA 在 MSM 里有什么区别"
"推荐几篇 MSM 理论的经典综述论文"
"讲讲 Koopman 算子和 MSM 的关系"
```

### 规划模式

```
"我有一个 500 原子的蛋白轨迹，想研究折叠动力学，帮我设计 MSM 方案"
"预测 lag time 应该怎么选，有什么依据"
"二面角特征和距离特征哪个更适合小分子体系"
"我要研究蛋白-配体结合过程，MSM 需要哪些特殊处理"
"10 μs 的单条轨迹够不够构建可信的 MSM"
```

### 建模模式

```
"用 deeptime 对 data/traj.xtc 构建 MSM，拓扑是 data/system.pdb，100 个微态"
"对刚才提取的特征跑 TICA 降维，保留 5 个成分"
"用 BayesianMSM 替代 MaxLikelihoodMSM，lag time 设为 50 帧"
```

### 验证模式

```
"验证最新的 MSM 模型，跑全四样检验"
"这个模型的 ITS 图有没有收敛"
"CK 检验第 3 个宏态不通过，可能是什么原因"
```

### 报告模式

```
"生成 MSM 分析报告，标题「丙氨酸二肽的构象动力学 MSM 研究」"
"完整报告，包含 ITS 图和 CK 检验结果"
```

### 知识库搜索

```
"搜索变分原理相关的论文"
"找 2018 年以后发表的 deep-msm 主题论文"
"有哪些本科生级别的 MSM 综述"
"关于 TRAM 和增强采样的论文有哪些"
"列出 MSM 聚类方法的相关研究"
```

---

## 未来路线

```
v0.1.0 ✅ 安全沙箱 + 通用执行代理
v1.0.0 ✅ 7 工具 + Agent Loop + 关键词搜索
v1.1.0 ✅ deeptime 主力 + RAG 语义搜索 + 预构建向量
v1.2.0 ⏳ 端到端 MSM 自动构建（deeptime 全流水线自动执行）
v2.0.0 ⏳ TH-MSM → AutoREST 闭环
            MD → MSM → 代表构象 → QM/GW-BSE → 全自动科研
```

---

*TH-MSM · 让 MSM 科研更智能*
