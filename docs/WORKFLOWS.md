# 可复现脚本、环境诊断与端到端 MSM

适用版本：**v1.6.0**。这是 TH-MSM 从逐个工具调用走向可复现自动化的第一条原生工作流。

## 设计判断与优化

这个方向可行，但要区分三个问题：依赖是否可用、程序能否完成、模型是否得到科学支持。它们不应合并成一个“成功”。本版采用以下设计：

1. **新手与专家共用同一计算路径。** 新手得到分阶段解释和 START-HERE.md；专家明确指定参数，跳过不必要问答。
2. **脚本来自版本化模板。** 不让语言模型临时拼出一份无法核对的计算程序；脚本复用已测试的科学核心。
3. **先生成、后运行可分开。** script 工具只生成，run 工具才执行。一次授权完整工作流时可直接由 run 生成并执行。
4. **脚本可离开聊天运行。** 自带数值运行核心和第三方许可，只需原生 Node ≥22；无需 Codex、DSH 或 npm install。
5. **执行配置，不执行任意生成代码。** 管理运行工具只读取严格校验的 workflow.json，并执行插件自己的固定核心；没有 command/shell 字段。
6. **保留负向结论。** 计算完成但 ITS/CK 不支持时交付 completed_with_limitations 和真实报告。
7. **每次运行有新目录与记录。** 原子创建结果目录，避免覆盖；保存参数、输入摘要、运行版本、阶段状态、日志和实际文件。

## 当前能自动完成的范围

**合成示例或经典状态/预提取特征 JSON → 建模 → 布居/谱/可选 MFPT → ITS/CK → 报告。**

不直接处理 XTC/DCD 特征提取，不执行 Python MSM 后端、tICA/VAMP、可逆 MLE、PCCA 或 TPT。Python 依赖检查只是为外部环境准备提供信息；依赖存在不会使这些流程自动实现。非绝热 C1 继续使用已有采样/构建/验证/报告工具，本版的新 run 工具仅用于经典 MSM。

工作流 JSON 输入上限 64 MiB，基础模型仍限制 2–128 个观测状态。检查内存空闲信息不等于预测了任意大数据的资源需求；更大问题需要单独设计后端。没有自动安装依赖、自动恢复中断任务或自动优化到“验证通过”。

## 1. 新手：一句话运行完整示例

```text
请用 TH-MSM 的端到端工具带我运行完整示例，mode=example。
先确认工作区，再检查环境，生成可复现脚本，完成建模、分析、ITS/CK 和报告。
scriptDir 使用 output/tutorial-script，outputDir 使用 output/tutorial-results，两个目录都应是新的。
每个阶段用新手能懂的话解释，完成后列出真实文件和科学结论。
```

或者不指定目录，工具会选择唯一的 `output/scripts/<UUID>` 与 `output/runs/<UUID>`，方便多次尝试。

## 2. 专家：自己的数据直接运行

```text
请用 th_msm_run：mode=msm，trajectoryPath=data/features.json，lagTime=5，
nClusters=8，holdoutFraction=0.25，targetState=3，
scriptDir=output/lag5-script，outputDir=output/lag5-results。
先检查环境和输入，实际完成后交付参数、模型、分析、验证、报告与日志。
保留负向科学结论，不调参数迎合“通过”。
```

lagTime 是保存帧数；自己的数据不指定 targetState 时不猜目标，也不自动计算某个目标态 MFPT。示例默认目标为标签 1。seed 只控制合成示例数据；不是给已有轨迹重新随机赋值，也不是当前工具中可调的 KMeans 初始化种子。

## 3. 只生成脚本，不运行

```text
请用 th_msm_script 为 data/classical.json 生成独立脚本，mode=msm、lagTime=2，
scriptDir=output/exported-script，outputDir=output/exported-results。
先告诉我环境是否就绪，解释配置。现在只生成，不执行。
```

生成目录包含：

```text
exported-script/
  run.mjs                   可读入口
  workflow.json             可编辑参数
  runtime.mjs               自带数值运行核心
  runtime-manifest.json      核心版本与 SHA256
  THIRD-PARTY-NOTICES.txt    项目与依赖许可
  README.md                 运行说明
```

工具返回 ok=true 表示脚本生成成功；**是否当前机器可运行要看 environment.readiness.workflow**。环境未就绪仍可生成供另一台机器使用的脚本；不会以生成成功冒充试运行成功。

在项目根目录的终端执行：

```sh
node output/exported-script/run.mjs
```

移动整份项目时保留目录结构；单独移动脚本目录时显式传入新项目路径：

```sh
node /path/to/exported-script/run.mjs /absolute/path/to/project
```

Windows 路径有空格时请加双引号。脚本会检查核心摘要是否匹配，帮助发现意外损坏；这不是不可篡改的安全证明。

重复运行之前要修改 workflow.json 的 outputDir 为全新目录。即使已有目录是空的，也会拒绝复用；旧结果不会被自动覆盖。

## 4. workflow.json 的严格格式

```json
{
  "schema_version": 1,
  "mode": "msm",
  "trajectoryPath": "data/classical.json",
  "outputDir": "output/reproduction-01",
  "parameters": {
    "lagTime": 2,
    "nClusters": 8,
    "holdoutFraction": 0.25,
    "targetState": 1,
    "seed": "msm-example"
  }
}
```

mode=example 时省略 trajectoryPath；所有文件路径都受项目边界检查。schema_version 必须为 1，mode 仅 example/msm。未知字段、错误类型、非法范围和输出越界都会被拒绝。scriptDir 与 outputDir 不得相同或互相嵌套。

参数范围沿用基础模型：lagTime 为正整数，nClusters 为 2–128，holdoutFraction 在 `[0,0.5)`，targetState 是实际存在的非负整数标签，seed 为非空字符串。

## 5. 在插件中运行已有配置

```text
请用 th_msm_run 运行 output/exported-script/workflow.json。
只使用这个配置，不附加另一套内联参数。检查输出目录是否全新，再实际运行。
```

工具参数为 `workflowPath`；不能同时传入另一套 mode/outputDir/lagTime 等参数，避免参数优先级不清楚。

**两种复现方式的区别：**终端运行 run.mjs 使用该脚本包携带的固定运行核心；插件运行 workflowPath 使用当前安装版本的可信运行核心。跨插件版本精确复现时保留导出的脚本包，核对运行版本与摘要，不只保留 workflow.json。

## 6. 环境诊断怎样读

```text
请用 th_msm_env 检查我的项目、data/classical.json 和尚不存在的 output/check-results，
并使用 checkPython=true 检查 Python 依赖。不要安装或修改软件环境。
```

| 字段 | 证据与含义 |
|---|---|
| checks.numerics | 实际两状态稳态/MFPT 解析自检，不只是看包名 |
| checks.native_node | 真正启动 PATH 中的 node，并读取版本及可执行文件路径 |
| checks.workspace | 在项目中实际创建并移除一个探针文件 |
| checks.input | JSON 可读且属于经典输入格式；完整物理/统计有效性仍由构建检查 |
| checks.output | 输出路径在项目内且尚不存在；实际运行时还要原子创建 |
| readiness.in_process_native | 宿主内置数值核心是否可用 |
| readiness.standalone_node | 独立脚本所需原生 Node 是否可用 |
| readiness.workflow | 项目、输入、输出与 Node 的前置检查是否满足 |
| python | 可选检查 python/python3 中 numpy/scipy/deeptime/MDAnalysis/mdtraj/matplotlib 的实际导入 |
| readiness.external_python_execution | 本版固定为 not_implemented，即使所有包都能导入 |

不传项目目录时不会声称已检查写入权限，workflow 为 not_checked。env.ok 主要表示宿主数值核心自检状态，不代表其他 readiness 都是 ready。

Python 检查使用 PATH 中的解释器，列出实际解释器路径与版本；要检查特定 venv/conda，请从对应环境启动宿主或调整其 PATH。没有自动检测所有虚拟环境。探测有超时，超时可能是导入过慢，不应直接断言软件绝对不存在。

环境检查不是完整模型试运行。ready 只说明前置条件满足；实际建模、目标标签、科学验证、资源或文件系统后续变化仍可能失败。外部 ES provider 不在本次诊断范围。

## 7. 执行、科学结论与错误

| status | 意义 |
|---|---|
| completed | 阶段都完成，当前科学诊断支持模型 |
| completed_with_limitations | 阶段完成，但 Markov 诊断不支持或数据不足；报告保留原因 |
| blocked | 前置环境/输入/输出检查未通过，未启动工作流进程 |
| failed | 参数或执行阶段失败，不能当作完整成功 |
| cancelled | 用户取消，不能当作成功 |

返回 ok=true 表示执行完成，包括 completed_with_limitations。真正的模型支持程度看 science_verdict 与 validation.json。

默认受控运行最多 300 秒，取消/超时会停止该工作流进程；已创建清单且属于本次 run_id 时会标记失败或中断。进程启动前失败可能没有结果目录，此时看工具返回。没有完整断点续跑；重新运行应换新输出目录。

## 8. 交付文件与日志

```text
results/
  trajectories.json       仅示例模式生成
  model.json              模型
  analysis.json           分析结果
  validation.json         验证与不确定性
  report.md               可读报告
  START-HERE.md           初学者阅读顺序
  run-manifest.json       版本、参数、run_id、阶段与文件
  workflow.log.jsonl      每阶段开始/结束或错误
```

输入摘要是对解析后的 JSON 做规范化序列化再计算的 canonical_json_sha256，不等同于原文件字节摘要。日志不替代输入数据存档。结果文件格式继续与独立 build/analyze/validate/report 工具兼容。

本地进程只执行固定运行核心，并沿用项目路径边界；它不是 OS 级沙箱。Codex 不因此得到任意 shell 命令代理。DSH 原有注册命令代理仍是另一个显式配置的入口。

## 后续优化顺序

1. 为明确版本的外部 Python 后端增加统一输入/输出契约、适配器和独立数值对照。
2. 增加拓扑/轨迹预处理，明确原子选择、周期边界、对齐、帧间隔与特征元数据。
3. 在真实科学验证齐备后接入 tICA/VAMP、可逆估计、宏态与 TPT；不能仅靠提示词宣称完成。
4. 补充大型数据流式 IO、资源预测与可恢复任务；非绝热继续保持 FC/完整状态、WE 权重和成本核算红线。

[完整使用手册](USER-MANUAL.md) · [经典 MSM](CLASSICAL-MSM.md) · [科学约定](SCIENCE.md)
